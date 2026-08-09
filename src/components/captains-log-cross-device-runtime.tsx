"use client";

import { useEffect } from "react";
import { getCaptainsLogCloudAuthSnapshot, captainsLogCloudRest } from "@/lib/compass/captains-log-cloud";
import { mergeCaptainsLogSyncIntoClient, syncClientsFromCaptainsLog } from "@/lib/compass/captains-log-bridge";
import { loadCompassDataset, saveCompassDataset } from "@/lib/compass/store";
import type { CompassClient } from "@/lib/compass/types";

type JsonMap = Record<string, unknown>;
type TaskEventRow = { event_id?: string; event_type?: string; local_task_id?: string; task_title?: string; tag?: string; done?: boolean; occurred_at?: string; inserted_at?: string; metadata?: JsonMap };
type CallEventRow = { event_id?: string; event_type?: string; payload?: JsonMap; created_at?: string; inserted_at?: string };
type CursorState = { taskCursor: string; callCursor: string; fingerprint: string; account: string };

const CURSOR_KEY = "client-compass.captains-log-auto-sync.v2";
const SYNC_INTERVAL_MS = 180_000;
const FOCUS_THROTTLE_MS = 15_000;
const OVERLAP_MS = 10_000;
const PAGE_SIZE = 500;
const MAX_DELTA_ROWS = 10_000;

function text(value: unknown): string { return String(value ?? "").trim(); }
function record(value: unknown): JsonMap { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonMap : {}; }
function boolish(value: unknown): boolean { return typeof value === "boolean" ? value : typeof value === "number" ? value !== 0 : ["1", "true", "yes", "done", "completed"].includes(text(value).toLowerCase()); }
function day(value: string): string { return text(value).slice(0, 10); }
function newest(current: string, incoming: string): string { const next = day(incoming); const old = day(current); return next && (!old || next > old) ? next : current; }

function normalizeCompany(value: string): string {
  return text(value).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\b(llc|pllc|pc|inc|corp|corporation|company|co)\b/g, " ").replace(/\s+/g, " ").trim();
}

function similarity(left: string, right: string): number {
  const a = normalizeCompany(left); const b = normalizeCompany(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length >= 7 && b.length >= 7 && (a.includes(b) || b.includes(a))) return .93;
  const aa = new Set(a.split(" ").filter((part) => part.length > 1));
  const bb = new Set(b.split(" ").filter((part) => part.length > 1));
  if (!aa.size || !bb.size) return 0;
  let overlap = 0; aa.forEach((part) => { if (bb.has(part)) overlap += 1; });
  const union = new Set([...aa, ...bb]).size;
  return Math.min(.91, Math.max(union ? overlap / union : 0, (overlap / Math.min(aa.size, bb.size)) * .9));
}

function fingerprint(clients: CompassClient[]): string {
  return clients.map((client) => `${client.id}:${normalizeCompany(client.name)}:${(client.aliases || []).map(normalizeCompany).sort().join(",")}`).sort().join("|");
}

function readCursor(): CursorState | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CURSOR_KEY) || "null") as Partial<CursorState> | null;
    if (!parsed?.taskCursor || !parsed.callCursor || !parsed.fingerprint || !parsed.account) return null;
    return { taskCursor: text(parsed.taskCursor), callCursor: text(parsed.callCursor), fingerprint: text(parsed.fingerprint), account: text(parsed.account) };
  } catch { return null; }
}

function saveCursor(cursor: CursorState): void {
  try { window.localStorage.setItem(CURSOR_KEY, JSON.stringify(cursor)); } catch { /* local cache only */ }
}

function overlapCursor(value: string): string {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(Math.max(0, ms - OVERLAP_MS)).toISOString() : value;
}

async function fetchDelta<T>(path: string, cursor: string, params: Record<string, string>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < MAX_DELTA_ROWS; offset += PAGE_SIZE) {
    const page = await captainsLogCloudRest<T[]>("GET", path, undefined, {
      ...params,
      inserted_at: `gte.${overlapCursor(cursor)}`,
      order: "inserted_at.asc",
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (!Array.isArray(page)) break;
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function taskCompany(row: TaskEventRow): string {
  const meta = record(row.metadata); const patch = record(meta.patch); const mobile = record(meta.mobile_context);
  return text(patch.company || meta.company || mobile.company || meta.transcript_company);
}

function findClient(clients: CompassClient[], company = "", taskId = "", directId = ""): CompassClient | undefined {
  if (directId) {
    const direct = clients.find((client) => client.id === directId);
    if (direct) return direct;
  }
  if (taskId) {
    const taskOwner = clients.find((client) => client.captainsLog?.openTasks.some((task) => task.id === taskId) || client.captainsLog?.recentActivity.some((item) => item.id === taskId));
    if (taskOwner) return taskOwner;
  }
  if (!company) return undefined;
  let bestClient: CompassClient | undefined;
  let bestScore = 0;
  for (const client of clients) {
    const names = [client.name, ...(client.aliases || []), client.captainsLog?.linkedCompany || ""].filter(Boolean);
    const score = names.reduce((value, candidate) => Math.max(value, similarity(company, candidate)), 0);
    if (score > bestScore) { bestScore = score; bestClient = client; }
  }
  return bestScore >= .86 ? bestClient : undefined;
}

function isReview(title: string, tag: string, completed: boolean): boolean {
  if (!completed) return false;
  const cleanTitle = title.toLowerCase();
  const cleanTag = tag.toLowerCase().replace(/[\s_-]+/g, " ").trim();
  if (cleanTitle.startsWith("coordination call -") || ["client coordination", "coordination"].includes(cleanTag)) return false;
  return cleanTag === "account review" || cleanTag === "account management" || cleanTitle.includes("account review");
}

function applyTaskEvent(client: CompassClient, row: TaskEventRow): CompassClient {
  const meta = record(row.metadata); const patch = record(meta.patch);
  const eventType = text(row.event_type).toLowerCase().replace(/_retro$/, "");
  const id = text(row.local_task_id || row.event_id); if (!id) return client;
  const previousState = client.captainsLog;
  const previous = previousState?.recentActivity.find((item) => item.id === id);
  const when = text(row.occurred_at || row.inserted_at) || new Date().toISOString();
  let title = text(row.task_title) || previous?.title || "Task";
  let tag = text(row.tag) || previous?.tag || "";
  let scheduledAt = previous?.scheduledAt || "";
  let completedAt = previous?.completedAt || "";
  let completed = previous?.status === "completed";
  let deleted = false;

  if (Object.prototype.hasOwnProperty.call(patch, "title")) title = text(patch.title) || title;
  if (Object.prototype.hasOwnProperty.call(patch, "tag")) tag = text(patch.tag) || tag;
  if (Object.prototype.hasOwnProperty.call(patch, "scheduled_at")) scheduledAt = text(patch.scheduled_at);
  else if (Object.prototype.hasOwnProperty.call(meta, "scheduled_at")) scheduledAt = text(meta.scheduled_at);
  if (Object.prototype.hasOwnProperty.call(patch, "completed_at")) completedAt = text(patch.completed_at);
  if (Object.prototype.hasOwnProperty.call(patch, "done")) completed = boolish(patch.done);
  else if (row.done !== undefined && eventType !== "task_created") completed = Boolean(row.done);

  if (eventType === "task_deleted" || eventType === "task_removed") deleted = true;
  else if (eventType.includes("reopened")) { completed = false; completedAt = ""; }
  else if (eventType.includes("completed")) { completed = true; completedAt = text(meta.completed_at) || when; scheduledAt = ""; }
  else if (eventType.includes("unscheduled")) scheduledAt = "";
  else if (eventType.includes("scheduled")) { if (!completed) scheduledAt = text(meta.scheduled_at) || scheduledAt; }

  const createdAt = previous?.createdAt || text(meta.created_at) || when;
  const source = text(patch.source || meta.source) || previous?.source || "focus";
  const recentActivity = (previousState?.recentActivity || []).filter((item) => item.id !== id);
  if (!deleted) recentActivity.unshift({ id, type: "Task", tag, title, status: completed ? "completed" : scheduledAt ? "scheduled" : "open", scheduledAt, completedAt, createdAt, source });
  recentActivity.sort((a, b) => (b.completedAt || b.scheduledAt || b.createdAt).localeCompare(a.completedAt || a.scheduledAt || a.createdAt));
  const openTasks = (previousState?.openTasks || []).filter((item) => item.id !== id);
  if (!deleted && !completed) openTasks.push({ id, type: "Task", tag, title, status: scheduledAt ? "scheduled" : "open", scheduledAt, createdAt, source });
  openTasks.sort((a, b) => (a.scheduledAt || "9999").localeCompare(b.scheduledAt || "9999") || (b.createdAt || "").localeCompare(a.createdAt || ""));
  const interaction = completedAt || scheduledAt || createdAt;

  return {
    ...client,
    lastSalesInteraction: newest(client.lastSalesInteraction, interaction),
    lastAccountReview: isReview(title, tag, completed) ? newest(client.lastAccountReview, completedAt || when) : client.lastAccountReview,
    captainsLog: {
      matched: previousState?.matched ?? true,
      linkedCompany: previousState?.linkedCompany || taskCompany(row) || client.name,
      closestCompany: previousState?.closestCompany || "",
      matchMethod: previousState?.matchMethod || (text(meta.client_compass_client_id) ? "client-compass-id" : "supabase-delta"),
      matchScore: previousState?.matchScore ?? 1,
      syncedAt: new Date().toISOString(),
      openTaskCount: openTasks.length,
      openTasks,
      recentActivity,
    },
  };
}

function applyCallEvent(client: CompassClient, row: CallEventRow): CompassClient {
  const payload = record(row.payload); if (text(payload.schema) !== "call_mode_v1") return client;
  const prospect = record(payload.prospect); const salesTask = record(payload.sales_task); const rawActivity = record(payload.activity);
  const eventType = text(payload.call_event_type).toLowerCase();
  const when = text(payload.occurred_at || row.created_at || row.inserted_at) || new Date().toISOString();
  let next = client;
  const taskId = text(salesTask.id);

  if (taskId) {
    const state = next.captainsLog;
    const previous = state?.recentActivity.find((item) => item.id === taskId);
    const title = text(salesTask.task_tag) || previous?.title || `${text(salesTask.action_type) || "Task"} follow-up`;
    const tag = text(salesTask.task_tag) || previous?.tag || "";
    const scheduledAt = text(salesTask.due_date) || previous?.scheduledAt || "";
    const createdAt = text(salesTask.created_at) || previous?.createdAt || when;
    let completed = boolish(salesTask.completed) || eventType === "task_completed" || eventType === "queue_closed";
    if (eventType === "task_reopened" || eventType === "queue_restored") completed = false;
    const deleted = eventType === "task_deleted" || eventType === "prospect_deleted";
    const completedAt = completed ? text(salesTask.completed_at) || previous?.completedAt || when : "";
    const recentActivity = (state?.recentActivity || []).filter((item) => item.id !== taskId);
    if (!deleted) recentActivity.unshift({ id: taskId, type: text(salesTask.action_type) || "Task", tag, title, status: completed ? "completed" : scheduledAt ? "scheduled" : "open", scheduledAt, completedAt, createdAt, source: "call_mode" });
    recentActivity.sort((a, b) => (b.completedAt || b.scheduledAt || b.createdAt).localeCompare(a.completedAt || a.scheduledAt || a.createdAt));
    const openTasks = (state?.openTasks || []).filter((item) => item.id !== taskId);
    if (!deleted && !completed) openTasks.push({ id: taskId, type: text(salesTask.action_type) || "Task", tag, title, status: scheduledAt ? "scheduled" : "open", scheduledAt, createdAt, source: "call_mode" });
    next = {
      ...next,
      lastSalesInteraction: newest(next.lastSalesInteraction, completedAt || scheduledAt || createdAt),
      lastAccountReview: isReview(title, tag, completed) ? newest(next.lastAccountReview, completedAt || when) : next.lastAccountReview,
      captainsLog: {
        matched: state?.matched ?? true,
        linkedCompany: state?.linkedCompany || text(prospect.company || salesTask.company) || next.name,
        closestCompany: state?.closestCompany || "",
        matchMethod: state?.matchMethod || "supabase-delta",
        matchScore: state?.matchScore ?? 1,
        syncedAt: new Date().toISOString(),
        openTaskCount: openTasks.length,
        openTasks,
        recentActivity,
      },
    };
  }

  if (Object.keys(rawActivity).length) {
    const state = next.captainsLog;
    const id = text(rawActivity.id) || text(row.event_id) || `activity-${when}`;
    const createdAt = text(rawActivity.created_at) || when;
    const recentActivity = (state?.recentActivity || []).filter((item) => !(item.id === id && item.source === "sales_activity"));
    recentActivity.unshift({ id, type: text(rawActivity.activity_type) || "Activity", tag: "", title: text(rawActivity.label) || "Client activity", status: "completed", scheduledAt: "", completedAt: createdAt, createdAt, source: "sales_activity" });
    recentActivity.sort((a, b) => (b.completedAt || b.scheduledAt || b.createdAt).localeCompare(a.completedAt || a.scheduledAt || a.createdAt));
    next = {
      ...next,
      lastSalesInteraction: newest(next.lastSalesInteraction, createdAt),
      captainsLog: {
        matched: state?.matched ?? true,
        linkedCompany: state?.linkedCompany || text(prospect.company || salesTask.company) || next.name,
        closestCompany: state?.closestCompany || "",
        matchMethod: state?.matchMethod || "supabase-delta",
        matchScore: state?.matchScore ?? 1,
        syncedAt: new Date().toISOString(),
        openTaskCount: state?.openTasks.length || 0,
        openTasks: state?.openTasks || [],
        recentActivity,
      },
    };
  }

  const contact = text(prospect.contact); const phone = text(prospect.phone);
  if (contact || phone) next = { ...next, primaryContact: contact || next.primaryContact, primaryContactPhone: phone || next.primaryContactPhone };
  return next;
}

export function CaptainsLogCrossDeviceRuntime() {
  useEffect(() => {
    let disposed = false; let inFlight = false; let lastRunAt = 0;

    const sync = async (urgent = false) => {
      const now = Date.now();
      if (disposed || inFlight || now - lastRunAt < (urgent ? FOCUS_THROTTLE_MS : SYNC_INTERVAL_MS - 2_000)) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const auth = getCaptainsLogCloudAuthSnapshot(); if (!auth.configured || !auth.signedIn) return;
      const dataset = await loadCompassDataset(); if (!dataset?.clients.length || disposed) return;
      inFlight = true; lastRunAt = now;

      try {
        const currentFingerprint = fingerprint(dataset.clients);
        const account = auth.userId || auth.email;
        let cursor = readCursor();

        if (!cursor || cursor.fingerprint !== currentFingerprint || cursor.account !== account) {
          const baseline = new Date(Date.now() - OVERLAP_MS).toISOString();
          const batch = await syncClientsFromCaptainsLog(dataset.clients.map((client) => ({ clientId: client.id, company: client.name, aliases: client.aliases || [] })));
          const byId = new Map(batch.results.filter((result) => result.client_id).map((result) => [result.client_id as string, result]));
          const clients = dataset.clients.map((client) => { const result = byId.get(client.id); return result ? mergeCaptainsLogSyncIntoClient(client, result) : client; });
          if (!disposed) await saveCompassDataset({ ...dataset, clients });
          cursor = { taskCursor: baseline, callCursor: baseline, fingerprint: currentFingerprint, account };
          saveCursor(cursor);
          return;
        }

        const nextCursor = new Date(Date.now() - 1_000).toISOString();
        const [taskRows, callRows] = await Promise.all([
          fetchDelta<TaskEventRow>("task_events", cursor.taskCursor, { select: "event_id,event_type,local_task_id,task_title,tag,done,occurred_at,inserted_at,metadata" }),
          fetchDelta<CallEventRow>("app_events", cursor.callCursor, { select: "event_id,event_type,payload,created_at,inserted_at", event_type: "eq.call_mode_event" }),
        ]);

        if (!taskRows.length && !callRows.length) {
          saveCursor({ taskCursor: nextCursor, callCursor: nextCursor, fingerprint: currentFingerprint, account });
          return;
        }

        let clients = dataset.clients;
        for (const row of taskRows) {
          const meta = record(row.metadata);
          const owner = findClient(clients, taskCompany(row), text(row.local_task_id), text(meta.client_compass_client_id));
          if (owner) clients = clients.map((client) => client.id === owner.id ? applyTaskEvent(client, row) : client);
        }
        for (const row of callRows) {
          const payload = record(row.payload); const prospect = record(payload.prospect); const salesTask = record(payload.sales_task);
          const owner = findClient(clients, text(prospect.company || salesTask.company), text(salesTask.id));
          if (owner) clients = clients.map((client) => client.id === owner.id ? applyCallEvent(client, row) : client);
        }
        if (!disposed) await saveCompassDataset({ ...dataset, clients });
        saveCursor({ taskCursor: nextCursor, callCursor: nextCursor, fingerprint: currentFingerprint, account });
      } catch (cause) {
        if (typeof console !== "undefined") console.debug("Captain's Log delta sync deferred", cause);
      } finally { inFlight = false; }
    };

    const onFocus = () => { void sync(true); };
    const onVisibility = () => { if (document.visibilityState === "visible") void sync(true); };
    const onOnline = () => { void sync(true); };
    const startup = window.setTimeout(() => { void sync(true); }, 900);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void sync(false); }, SYNC_INTERVAL_MS);
    window.addEventListener("focus", onFocus); window.addEventListener("online", onOnline); document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true; window.clearTimeout(startup); window.clearInterval(interval);
      window.removeEventListener("focus", onFocus); window.removeEventListener("online", onOnline); document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return null;
}
