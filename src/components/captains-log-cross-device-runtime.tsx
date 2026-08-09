"use client";

import { useEffect } from "react";
import { getCaptainsLogCloudAuthSnapshot, captainsLogCloudRest } from "@/lib/compass/captains-log-cloud";
import { mergeCaptainsLogSyncIntoClient, syncClientsFromCaptainsLog } from "@/lib/compass/captains-log-bridge";
import { ensureCompanyIdentitiesForClients } from "@/lib/compass/company-identity";
import { loadCompassDataset, saveCompassDataset } from "@/lib/compass/store";
import type { CompassClient } from "@/lib/compass/types";

type JsonMap = Record<string, unknown>;
type TaskEventRow = { event_id?: string; event_type?: string; local_task_id?: string; task_title?: string; tag?: string; done?: boolean; occurred_at?: string; inserted_at?: string; metadata?: JsonMap };
type CallEventRow = { event_id?: string; event_type?: string; payload?: JsonMap; created_at?: string; inserted_at?: string };
type CursorState = { taskCursor: string; callCursor: string; fingerprint: string; account: string };

const CURSOR_KEY = "client-compass.captains-log-auto-sync.v4";
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

function coordinationTitleCompany(title: string): string {
  const match = /^\s*coordination call\s*-\s*(.+?)\s*-\s*account review priority\s*$/i.exec(text(title));
  return match?.[1]?.trim() || "";
}

function fingerprint(clients: CompassClient[]): string {
  return clients.map((client) => `${client.id}:${client.companyId || ""}:${normalizeCompany(client.name)}:${(client.aliases || []).map(normalizeCompany).sort().join(",")}`).sort().join("|");
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

function taskContext(row: TaskEventRow) {
  const meta = record(row.metadata);
  const patch = record(meta.patch);
  const mobile = record(meta.mobile_context);
  return {
    meta,
    patch,
    mobile,
    companyId: text(patch.company_id || meta.company_id || mobile.company_id),
    company: text(patch.company || meta.company || mobile.company || meta.transcript_company),
    directCompassId: text(meta.client_compass_client_id),
  };
}

function callContext(row: CallEventRow) {
  const payload = record(row.payload);
  const prospect = record(payload.prospect);
  const salesTask = record(payload.sales_task);
  const activity = record(payload.activity);
  const extra = record(payload.extra);
  return {
    payload,
    prospect,
    salesTask,
    activity,
    companyId: text(salesTask.company_id || prospect.company_id || activity.company_id || extra.company_id),
    company: text(salesTask.company || prospect.company || activity.company || extra.company),
  };
}

function findClient(clients: CompassClient[], companyId = "", company = "", taskId = "", directId = ""): CompassClient | undefined {
  if (companyId) {
    const directCompany = clients.find((client) => client.companyId === companyId || client.captainsLog?.companyId === companyId);
    if (directCompany) return directCompany;
    return undefined;
  }
  if (directId) {
    const direct = clients.find((client) => client.id === directId);
    if (direct) return direct;
  }
  if (company) {
    let bestClient: CompassClient | undefined;
    let bestScore = 0;
    for (const client of clients) {
      const names = [client.name, ...(client.aliases || []), client.captainsLog?.linkedCompany || ""].filter(Boolean);
      const score = names.reduce((value, candidate) => Math.max(value, similarity(company, candidate)), 0);
      if (score > bestScore) { bestScore = score; bestClient = client; }
    }
    return bestScore >= .86 ? bestClient : undefined;
  }
  if (taskId) {
    return clients.find((client) => client.captainsLog?.openTasks.some((task) => task.id === taskId) || client.captainsLog?.recentActivity.some((item) => item.id === taskId));
  }
  return undefined;
}

function removeTaskProjection(client: CompassClient, taskId: string): CompassClient {
  const state = client.captainsLog;
  if (!state || !taskId) return client;
  const openTasks = state.openTasks.filter((task) => task.id !== taskId);
  const recentActivity = state.recentActivity.filter((item) => item.id !== taskId);
  if (openTasks.length === state.openTasks.length && recentActivity.length === state.recentActivity.length) return client;
  return { ...client, captainsLog: { ...state, openTaskCount: openTasks.length, openTasks, recentActivity, syncedAt: new Date().toISOString() } };
}

function taskAssociationIsSafe(client: CompassClient, row: TaskEventRow): boolean {
  const ctx = taskContext(row);
  const titleCompany = coordinationTitleCompany(text(row.task_title));
  if (ctx.companyId) return Boolean(client.companyId && ctx.companyId === client.companyId);
  if (ctx.directCompassId && ctx.directCompassId !== client.id) return false;
  if (ctx.directCompassId && ctx.company && similarity(ctx.company, client.name) < .86) return false;
  if (titleCompany && similarity(titleCompany, client.name) < .86) return false;
  return true;
}

function isReview(title: string, tag: string, completed: boolean): boolean {
  if (!completed) return false;
  const cleanTitle = title.toLowerCase();
  const cleanTag = tag.toLowerCase().replace(/[\s_-]+/g, " ").trim();
  if (cleanTitle.startsWith("coordination call -") || ["client coordination", "coordination"].includes(cleanTag)) return false;
  return cleanTag === "account review" || cleanTag === "account management" || cleanTitle.includes("account review");
}

function applyTaskEvent(client: CompassClient, row: TaskEventRow): CompassClient {
  if (!taskAssociationIsSafe(client, row)) return client;
  const ctx = taskContext(row);
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

  if (Object.prototype.hasOwnProperty.call(ctx.patch, "title")) title = text(ctx.patch.title) || title;
  if (Object.prototype.hasOwnProperty.call(ctx.patch, "tag")) tag = text(ctx.patch.tag) || tag;
  if (Object.prototype.hasOwnProperty.call(ctx.patch, "scheduled_at")) scheduledAt = text(ctx.patch.scheduled_at);
  else if (Object.prototype.hasOwnProperty.call(ctx.meta, "scheduled_at")) scheduledAt = text(ctx.meta.scheduled_at);
  if (Object.prototype.hasOwnProperty.call(ctx.patch, "completed_at")) completedAt = text(ctx.patch.completed_at);
  if (Object.prototype.hasOwnProperty.call(ctx.patch, "done")) completed = boolish(ctx.patch.done);
  else if (row.done !== undefined && eventType !== "task_created") completed = Boolean(row.done);

  if (eventType === "task_deleted" || eventType === "task_removed") deleted = true;
  else if (eventType.includes("reopened")) { completed = false; completedAt = ""; }
  else if (eventType.includes("completed")) { completed = true; completedAt = text(ctx.meta.completed_at) || when; scheduledAt = ""; }
  else if (eventType.includes("unscheduled")) scheduledAt = "";
  else if (eventType.includes("scheduled")) { if (!completed) scheduledAt = text(ctx.meta.scheduled_at) || scheduledAt; }

  const createdAt = previous?.createdAt || text(ctx.meta.created_at) || when;
  const source = text(ctx.patch.source || ctx.meta.source) || previous?.source || "focus";
  const companyId = ctx.companyId || client.companyId || previousState?.companyId || "";
  const recentActivity = (previousState?.recentActivity || []).filter((item) => item.id !== id);
  if (!deleted) recentActivity.unshift({ id, type: "Task", tag, title, status: completed ? "completed" : scheduledAt ? "scheduled" : "open", scheduledAt, completedAt, createdAt, source, companyId });
  recentActivity.sort((a, b) => (b.completedAt || b.scheduledAt || b.createdAt).localeCompare(a.completedAt || a.scheduledAt || a.createdAt));
  const openTasks = (previousState?.openTasks || []).filter((item) => item.id !== id);
  if (!deleted && !completed) openTasks.push({ id, type: "Task", tag, title, status: scheduledAt ? "scheduled" : "open", scheduledAt, createdAt, source, companyId });
  openTasks.sort((a, b) => (a.scheduledAt || "9999").localeCompare(b.scheduledAt || "9999") || (b.createdAt || "").localeCompare(a.createdAt || ""));
  const interaction = completedAt || scheduledAt || createdAt;

  return {
    ...client,
    companyId: companyId || client.companyId,
    lastSalesInteraction: newest(client.lastSalesInteraction, interaction),
    lastAccountReview: isReview(title, tag, completed) ? newest(client.lastAccountReview, completedAt || when) : client.lastAccountReview,
    captainsLog: {
      matched: previousState?.matched ?? true,
      companyId,
      linkedCompany: previousState?.linkedCompany || ctx.company || client.name,
      closestCompany: previousState?.closestCompany || "",
      matchMethod: companyId ? "supabase-company-id" : previousState?.matchMethod || (ctx.directCompassId ? "client-compass-id" : "supabase-delta"),
      matchScore: companyId ? 1 : previousState?.matchScore ?? 1,
      syncedAt: new Date().toISOString(),
      openTaskCount: openTasks.length,
      openTasks,
      recentActivity,
    },
  };
}

function applyCallEvent(client: CompassClient, row: CallEventRow): CompassClient {
  const ctx = callContext(row);
  if (text(ctx.payload.schema) !== "call_mode_v1") return client;
  if (ctx.companyId && client.companyId && ctx.companyId !== client.companyId) return client;
  const eventType = text(ctx.payload.call_event_type).toLowerCase();
  const when = text(ctx.payload.occurred_at || row.created_at || row.inserted_at) || new Date().toISOString();
  const companyId = ctx.companyId || client.companyId || client.captainsLog?.companyId || "";
  let next = { ...client, companyId: companyId || client.companyId };
  const taskId = text(ctx.salesTask.id);

  if (taskId) {
    const state = next.captainsLog;
    const previous = state?.recentActivity.find((item) => item.id === taskId);
    const title = text(ctx.salesTask.task_tag) || previous?.title || `${text(ctx.salesTask.action_type) || "Task"} follow-up`;
    const tag = text(ctx.salesTask.task_tag) || previous?.tag || "";
    const scheduledAt = text(ctx.salesTask.due_date) || previous?.scheduledAt || "";
    const createdAt = text(ctx.salesTask.created_at) || previous?.createdAt || when;
    let completed = boolish(ctx.salesTask.completed) || eventType === "task_completed" || eventType === "queue_closed";
    if (eventType === "task_reopened" || eventType === "queue_restored") completed = false;
    const deleted = eventType === "task_deleted" || eventType === "prospect_deleted";
    const completedAt = completed ? text(ctx.salesTask.completed_at) || previous?.completedAt || when : "";
    const recentActivity = (state?.recentActivity || []).filter((item) => item.id !== taskId);
    if (!deleted) recentActivity.unshift({ id: taskId, type: text(ctx.salesTask.action_type) || "Task", tag, title, status: completed ? "completed" : scheduledAt ? "scheduled" : "open", scheduledAt, completedAt, createdAt, source: "call_mode", companyId });
    recentActivity.sort((a, b) => (b.completedAt || b.scheduledAt || b.createdAt).localeCompare(a.completedAt || a.scheduledAt || a.createdAt));
    const openTasks = (state?.openTasks || []).filter((item) => item.id !== taskId);
    if (!deleted && !completed) openTasks.push({ id: taskId, type: text(ctx.salesTask.action_type) || "Task", tag, title, status: scheduledAt ? "scheduled" : "open", scheduledAt, createdAt, source: "call_mode", companyId });
    next = {
      ...next,
      lastSalesInteraction: newest(next.lastSalesInteraction, completedAt || scheduledAt || createdAt),
      lastAccountReview: isReview(title, tag, completed) ? newest(next.lastAccountReview, completedAt || when) : next.lastAccountReview,
      captainsLog: {
        matched: state?.matched ?? true,
        companyId,
        linkedCompany: state?.linkedCompany || ctx.company || next.name,
        closestCompany: state?.closestCompany || "",
        matchMethod: companyId ? "supabase-company-id" : state?.matchMethod || "supabase-delta",
        matchScore: companyId ? 1 : state?.matchScore ?? 1,
        syncedAt: new Date().toISOString(),
        openTaskCount: openTasks.length,
        openTasks,
        recentActivity,
      },
    };
  }

  if (Object.keys(ctx.activity).length) {
    const state = next.captainsLog;
    const id = text(ctx.activity.id) || text(row.event_id) || `activity-${when}`;
    const createdAt = text(ctx.activity.created_at) || when;
    const recentActivity = (state?.recentActivity || []).filter((item) => !(item.id === id && item.source === "sales_activity"));
    recentActivity.unshift({ id, type: text(ctx.activity.activity_type) || "Activity", tag: "", title: text(ctx.activity.label) || "Client activity", status: "completed", scheduledAt: "", completedAt: createdAt, createdAt, source: "sales_activity", companyId });
    recentActivity.sort((a, b) => (b.completedAt || b.scheduledAt || b.createdAt).localeCompare(a.completedAt || a.scheduledAt || a.createdAt));
    next = {
      ...next,
      lastSalesInteraction: newest(next.lastSalesInteraction, createdAt),
      captainsLog: {
        matched: state?.matched ?? true,
        companyId,
        linkedCompany: state?.linkedCompany || ctx.company || next.name,
        closestCompany: state?.closestCompany || "",
        matchMethod: companyId ? "supabase-company-id" : state?.matchMethod || "supabase-delta",
        matchScore: companyId ? 1 : state?.matchScore ?? 1,
        syncedAt: new Date().toISOString(),
        openTaskCount: state?.openTasks.length || 0,
        openTasks: state?.openTasks || [],
        recentActivity,
      },
    };
  }

  const contact = text(ctx.prospect.contact); const phone = text(ctx.prospect.phone);
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
      let dataset = await loadCompassDataset(); if (!dataset?.clients.length || disposed) return;
      inFlight = true; lastRunAt = now;

      try {
        const identities = await ensureCompanyIdentitiesForClients(dataset.clients);
        let identityChanged = false;
        const identifiedClients = dataset.clients.map((client) => {
          const identity = identities.get(client.id);
          if (!identity || client.companyId === identity.companyId) return client;
          identityChanged = true;
          return { ...client, companyId: identity.companyId, captainsLog: client.captainsLog ? { ...client.captainsLog, companyId: identity.companyId } : client.captainsLog };
        });
        if (identityChanged) {
          dataset = { ...dataset, clients: identifiedClients };
          await saveCompassDataset(dataset);
        }

        const currentFingerprint = fingerprint(dataset.clients);
        const account = auth.userId || auth.email;
        let cursor = readCursor();

        if (!cursor || cursor.fingerprint !== currentFingerprint || cursor.account !== account) {
          const baseline = new Date(Date.now() - OVERLAP_MS).toISOString();
          const batch = await syncClientsFromCaptainsLog(dataset.clients.map((client) => ({ clientId: client.id, company: client.name, aliases: client.aliases || [] })));
          const byId = new Map(batch.results.filter((result) => result.client_id).map((result) => [result.client_id as string, result]));
          const clients = dataset.clients.map((client) => {
            const result = byId.get(client.id);
            const merged = result ? mergeCaptainsLogSyncIntoClient(client, result) : client;
            return { ...merged, companyId: client.companyId, captainsLog: merged.captainsLog ? { ...merged.captainsLog, companyId: client.companyId || merged.captainsLog.companyId } : merged.captainsLog };
          });
          if (!disposed) await saveCompassDataset({ ...dataset, clients });
          cursor = { taskCursor: baseline, callCursor: baseline, fingerprint: fingerprint(clients), account };
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
          const ctx = taskContext(row);
          const taskId = text(row.local_task_id);
          const owner = findClient(clients, ctx.companyId, ctx.company, taskId, ctx.directCompassId);
          if (!owner) continue;
          clients = clients.map((client) => {
            if (client.id === owner.id) return applyTaskEvent(client, row);
            return taskId ? removeTaskProjection(client, taskId) : client;
          });
        }
        for (const row of callRows) {
          const ctx = callContext(row);
          const taskId = text(ctx.salesTask.id);
          const owner = findClient(clients, ctx.companyId, ctx.company, taskId);
          if (!owner) continue;
          clients = clients.map((client) => {
            if (client.id === owner.id) return applyCallEvent(client, row);
            return taskId ? removeTaskProjection(client, taskId) : client;
          });
        }
        if (!disposed) await saveCompassDataset({ ...dataset, clients });
        saveCursor({ taskCursor: nextCursor, callCursor: nextCursor, fingerprint: fingerprint(clients), account });
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
