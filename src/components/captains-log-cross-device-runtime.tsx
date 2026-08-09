"use client";

import { useEffect } from "react";
import { getCaptainsLogCloudAuthSnapshot, captainsLogCloudRest } from "@/lib/compass/captains-log-cloud";
import { mergeCaptainsLogSyncIntoClient, syncClientsFromCaptainsLog } from "@/lib/compass/captains-log-bridge";
import { loadCompassDataset, saveCompassDataset } from "@/lib/compass/store";
import type { CompassClient } from "@/lib/compass/types";

type JsonMap = Record<string, unknown>;

type TaskEventRow = {
  event_id?: string;
  event_type?: string;
  local_task_id?: string;
  task_title?: string;
  tag?: string;
  done?: boolean;
  occurred_at?: string;
  inserted_at?: string;
  metadata?: JsonMap;
};

type CallEventRow = {
  event_id?: string;
  event_type?: string;
  payload?: JsonMap;
  created_at?: string;
  inserted_at?: string;
};

type SyncCursor = {
  taskCursor: string;
  callCursor: string;
  fingerprint: string;
  account: string;
};

const CURSOR_KEY = "client-compass.captains-log-auto-sync.v2";
const SYNC_INTERVAL_MS = 180_000;
const MIN_FOCUS_REFRESH_MS = 15_000;
const CURSOR_OVERLAP_MS = 10_000;
const PAGE_SIZE = 500;
const MAX_DELTA_ROWS = 10_000;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function record(value: unknown): JsonMap {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonMap : {};
}

function boolish(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return ["1", "true", "yes", "done", "completed"].includes(text(value).toLowerCase());
}

function dateOnly(value: string): string {
  return text(value).slice(0, 10);
}

function newestDate(current: string, incoming: string): string {
  const next = dateOnly(incoming);
  const existing = dateOnly(current);
  return next && (!existing || next > existing) ? next : current;
}

function normalizeCompany(value: string): string {
  return text(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(llc|pllc|pc|inc|corp|corporation|company|co)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function companySimilarity(left: string, right: string): number {
  const a = normalizeCompany(left);
  const b = normalizeCompany(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length >= 7 && b.length >= 7 && (a.includes(b) || b.includes(a))) return .93;
  const aa = new Set(a.split(" ").filter((token) => token.length > 1));
  const bb = new Set(b.split(" ").filter((token) => token.length > 1));
  if (!aa.size || !bb.size) return 0;
  let intersection = 0;
  aa.forEach((token) => { if (bb.has(token)) intersection += 1; });
  const union = new Set([...aa, ...bb]).size;
  return Math.min(.91, Math.max(union ? intersection / union : 0, (intersection / Math.min(aa.size, bb.size)) * .9));
}

function clientFingerprint(clients: CompassClient[]): string {
  return clients.map((client) => `${client.id}:${normalizeCompany(client.name)}:${(client.aliases || []).map(normalizeCompany).sort().join(",")}`).sort().join("|");
}

function readCursor(): SyncCursor | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CURSOR_KEY) || "null") as Partial<SyncCursor> | null;
    if (!parsed) return null;
    return {
      taskCursor: text(parsed.taskCursor),
      callCursor: text(parsed.callCursor),
      fingerprint: text(parsed.fingerprint),
      account: text(parsed.account),
    };
  } catch {
    return null;
  }
}

function writeCursor(cursor: SyncCursor): void {
  try { window.localStorage.setItem(CURSOR_KEY, JSON.stringify(cursor)); } catch { /* browser storage can be unavailable */ }
}

function overlapCursor(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "";
  return new Date(Math.max(0, time - CURSOR_OVERLAP_MS)).toISOString();
}

function maxInserted<T>(rows: T[], getter: (row: T) => string, fallback: string): string {
  return rows.map(getter).filter(Boolean).sort().at(-1) || fallback;
}

async function fetchDelta<T>(path: string, since: string, baseParams: Record<string, string>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < MAX_DELTA_ROWS; offset += PAGE_SIZE) {
    const page = await captainsLogCloudRest<T[]>("GET", path, undefined, {
      ...baseParams,
      inserted_at: `gte.${overlapCursor(since) || since}`,
      order: "inserted_at.asc",
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (!Array.isArray(page)) break;
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
  return rows;
}

function taskCompany(row: TaskEventRow): string {
  const meta = record(row.metadata);
  const patch = record(meta.patch);
  const mobile = record(meta.mobile_context);
  return text(patch.company || meta.company || mobile.company || meta.transcript_company);
}

function findClient(clients: CompassClient[], company: string, taskId = "", directClientId = ""): CompassClient | undefined {
  if (directClientId) {
    const direct = clients.find((client) => client.id === directClientId);
    if (direct) return direct;
  }
  if (taskId) {
    const byTask = clients.find((client) => client.captainsLog?.openTasks.some((task) => task.id === taskId) || client.captainsLog?.recentActivity.some((item) => item.id === taskId));
    if (byTask) return byTask;
  }
  if (!company) return undefined;
  let best: { client: CompassClient; score: number } | null = null;
  clients.forEach((client) => {
    const candidates = [client.name, ...(client.aliases || []), client.captainsLog?.linkedCompany || ""].filter(Boolean);
    const score = Math.max(...candidates.map((candidate) => companySimilarity(company, candidate)));
    if (!best || score > best.score) best = { client, score };
  });
  return best && best.score >= .86 ? best.client : undefined;
}

function isReviewActivity(title: string, tag: string, completed: boolean): boolean {
  if (!completed) return false;
  const cleanTitle = title.toLowerCase();
  const cleanTag = tag.toLowerCase().replace(/[\s_-]+/g, " ").trim();
  if (cleanTitle.startsWith("coordination call -") || ["client coordination", "coordination"].includes(cleanTag)) return false;
  return cleanTag === "account review" || cleanTag === "account management" || cleanTitle.includes("account review");
}

function withTaskEvent(client: CompassClient, row: TaskEventRow): CompassClient {
  const meta = record(row.metadata);
  const patch = record(meta.patch);
  const eventType = text(row.event_type).toLowerCase().replace(/_retro$/, "");
  const id = text(row.local_task_id || row.event_id);
  if (!id) return client;
  const existing = client.captainsLog;
  const previous = existing?.recentActivity.find((item) => item.id === id);
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
  else if (eventType === "task_reopened" || eventType.includes("reopened")) { completed = false; completedAt = ""; }
  else if (eventType === "task_completed" || eventType.includes("completed")) { completed = true; completedAt = text(meta.completed_at) || when; scheduledAt = ""; }
  else if (eventType === "task_scheduled" || eventType.includes("task_scheduled")) { if (!completed) scheduledAt = text(meta.scheduled_at) || scheduledAt; }
  else if (eventType === "task_unscheduled" || eventType.includes("task_unscheduled")) scheduledAt = "";

  const createdAt = previous?.createdAt || text(meta.created_at) || when;
  const activity = { id, type: "Task", tag, title, status: completed ? "completed" : scheduledAt ? "scheduled" : "open", scheduledAt, completedAt, createdAt, source: text(patch.source || meta.source) || previous?.source || "focus" };
  const recentActivity = (existing?.recentActivity || []).filter((item) => item.id !== id);
  if (!deleted) recentActivity.unshift(activity);
  recentActivity.sort((a, b) => (b.completedAt || b.scheduledAt || b.createdAt || "").localeCompare(a.completedAt || a.scheduledAt || a.createdAt || ""));
  const openTasks = (existing?.openTasks || []).filter((task) => task.id !== id);
  if (!deleted && !completed) openTasks.push({ id, type: "Task", tag, title, status: scheduledAt ? "scheduled" : "open", scheduledAt, createdAt, source: activity.source });
  openTasks.sort((a, b) => (a.scheduledAt || "9999").localeCompare(b.scheduledAt || "9999") || (b.createdAt || "").localeCompare(a.createdAt || ""));
  const newest = completedAt || scheduledAt || createdAt || when;

  return {
    ...client,
    lastSalesInteraction: newestDate(client.lastSalesInteraction, newest),
    lastAccountReview: isReviewActivity(title, tag, completed) ? newestDate(client.lastAccountReview, completedAt || when) : client.lastAccountReview,
    captainsLog: {
      matched: existing?.matched ?? true,
      linkedCompany: existing?.linkedCompany || taskCompany(row) || client.name,
      closestCompany: existing?.closestCompany || "",
      matchMethod: existing?.matchMethod || (text(meta.client_compass_client_id) ? "client-compass-id" : "supabase-delta"),
      matchScore: existing?.matchScore ?? 1,
      syncedAt: new Date().toISOString(),
      openTaskCount: openTasks.length,
      openTasks,
      recentActivity,
    },
  };
}

function withCallEvent(client: CompassClient, row: CallEventRow): CompassClient {
  const payload = record(row.payload);
  if (text(payload.schema) !== "call_mode_v1") return client;
  const prospect = record(payload.prospect);
  const salesTask = record(payload.sales_task);
  const activityRaw = record(payload.activity);
  const eventType = text(payload.call_event_type).toLowerCase();
  const when = text(payload.occurred_at || row.created_at || row.inserted_at) || new Date().toISOString();
  let next = client;

  const taskId = text(salesTask.id);
  if (taskId) {
    const existing = next.captainsLog;
    const previous = existing?.recentActivity.find((item) => item.id === taskId);
    const title = text(salesTask.task_tag) || previous?.title || `${text(salesTask.action_type) || "Task"} follow-up`;
    const tag = text(salesTask.task_tag) || previous?.tag || "";
    const scheduledAt = text(salesTask.due_date) || previous?.scheduledAt || "";
    const createdAt = text(salesTask.created_at) || previous?.createdAt || when;
    const completed = boolish(salesTask.completed) || eventType === "task_completed" || eventType === "queue_closed";
    const deleted = eventType === "task_deleted" || eventType === "prospect_deleted";
    const completedAt = completed ? text(salesTask.completed_at) || previous?.completedAt || when : "";
    const recentActivity = (existing?.recentActivity || []).filter((item) => item.id !== taskId);
    if (!deleted) recentActivity.unshift({ id: taskId, type: text(salesTask.action_type) || "Task", tag, title, status: completed ? "completed" : scheduledAt ? "scheduled" : "open", scheduledAt, completedAt, createdAt, source: "call_mode" });
    const openTasks = (existing?.openTasks || []).filter((task) => task.id !== taskId);
    if (!deleted && !completed) openTasks.push({ id: taskId, type: text(salesTask.action_type) || "Task", tag, title, status: scheduledAt ? "scheduled" : "open", scheduledAt, createdAt, source: "call_mode" });
    recentActivity.sort((a, b) => (b.completedAt || b.scheduledAt || b.createdAt || "").localeCompare(a.completedAt || a.scheduledAt || a.createdAt || ""));
    next = {
      ...next,
      lastSalesInteraction: newestDate(next.lastSalesInteraction, completedAt || scheduledAt || createdAt),
      lastAccountReview: isReviewActivity(title, tag, completed) ? newestDate(next.lastAccountReview, completedAt || when) : next.lastAccountReview,
      captainsLog: {
        matched: existing?.matched ?? true,
        linkedCompany: existing?.linkedCompany || text(prospect.company || salesTask.company) || next.name,
        closestCompany: existing?.closestCompany || "",
        matchMethod: existing?.matchMethod || "supabase-delta",
        matchScore: existing?.matchScore ?? 1,
        syncedAt: new Date().toISOString(),
        openTaskCount: openTasks.length,
        openTasks,
        recentActivity,
      },
    };
  }

  if (Object.keys(activityRaw).length) {
    const existing = next.captainsLog;
    const id = text(activityRaw.id) || text(row.event_id) || `activity-${when}`;
    const createdAt = text(activityRaw.created_at) || when;
    const item = { id, type: text(activityRaw.activity_type) || "Activity", tag: "", title: text(activityRaw.label) || "Client activity", status: "completed", scheduledAt: "", completedAt: createdAt, createdAt, source: "sales_activity" };
    const recentActivity = (existing?.recentActivity || []).filter((entry) => !(entry.id === id && entry.source === "sales_activity"));
    recentActivity.unshift(item);
    recentActivity.sort((a, b) => (b.completedAt || b.scheduledAt || b.createdAt || "").localeCompare(a.completedAt || a.scheduledAt || a.createdAt || ""));
    next = {
      ...next,
      lastSalesInteraction: newestDate(next.lastSalesInteraction, createdAt),
      captainsLog: {
        matched: existing?.matched ?? true,
        linkedCompany: existing?.linkedCompany || text(prospect.company || salesTask.company) || next.name,
        closestCompany: existing?.closestCompany || "",
        matchMethod: existing?.matchMethod || "supabase-delta",
        matchScore: existing?.matchScore ?? 1,
        syncedAt: new Date().toISOString(),
        openTaskCount: existing?.openTasks.length || 0,
        openTasks: existing?.openTasks || [],
        recentActivity,
      },
    };
  }

  const contact = text(prospect.contact);
  const phone = text(prospect.phone);
  if (contact || phone) next = { ...next, primaryContact: contact || next.primaryContact, primaryContactPhone: phone || next.primaryContactPhone };
  return next;
}

export function CaptainsLogCrossDeviceRuntime() {
  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let lastRunAt = 0;

    const sync = async (urgent = false) => {
      if (disposed || inFlight) return;
      const now = Date.now();
      if (now - lastRunAt < (urgent ? MIN_FOCUS_REFRESH_MS : SYNC_INTERVAL_MS - 2_000)) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const auth = getCaptainsLogCloudAuthSnapshot();
      if (!auth.configured || !auth.signedIn) return;
      const dataset = await loadCompassDataset();
      if (!dataset?.clients.length || disposed) return;

      inFlight = true;
      lastRunAt = now;
      try {
        const fingerprint = clientFingerprint(dataset.clients);
        const account = auth.userId || auth.email;
        let cursor = readCursor();

        if (!cursor || cursor.fingerprint !== fingerprint || cursor.account !== account) {
          const startedAt = new Date(Date.now() - CURSOR_OVERLAP_MS).toISOString();
          const batch = await syncClientsFromCaptainsLog(dataset.clients.map((client) => ({ clientId: client.id, company: client.name, aliases: client.aliases || [] })));
          const byId = new Map(batch.results.filter((result) => result.client_id).map((result) => [result.client_id as string, result]));
          const clients = dataset.clients.map((client) => {
            const result = byId.get(client.id);
            return result ? mergeCaptainsLogSyncIntoClient(client, result) : client;
          });
          if (!disposed) await saveCompassDataset({ ...dataset, clients });
          cursor = { taskCursor: startedAt, callCursor: startedAt, fingerprint, account };
          writeCursor(cursor);
          return;
        }

        const [taskRows, callRows] = await Promise.all([
          fetchDelta<TaskEventRow>("task_events", cursor.taskCursor, { select: "event_id,event_type,local_task_id,task_title,tag,done,occurred_at,inserted_at,metadata" }),
          fetchDelta<CallEventRow>("app_events", cursor.callCursor, { select: "event_id,event_type,payload,created_at,inserted_at", event_type: "eq.call_mode_event" }),
        ]);

        if (!taskRows.length && !callRows.length) {
          writeCursor({ ...cursor, fingerprint, account });
          return;
        }

        let clients = dataset.clients;
        for (const row of taskRows) {
          const meta = record(row.metadata);
          const client = findClient(clients, taskCompany(row), text(row.local_task_id), text(meta.client_compass_client_id));
          if (!client) continue;
          clients = clients.map((candidate) => candidate.id === client.id ? withTaskEvent(candidate, row) : candidate);
        }
        for (const row of callRows) {
          const payload = record(row.payload);
          const prospect = record(payload.prospect);
          const salesTask = record(payload.sales_task);
          const company = text(prospect.company || salesTask.company);
          const taskId = text(salesTask.id);
          const client = findClient(clients, company, taskId);
          if (!client) continue;
          clients = clients.map((candidate) => candidate.id === client.id ? withCallEvent(candidate, row) : candidate);
        }

        if (!disposed) await saveCompassDataset({ ...dataset, clients });
        writeCursor({
          taskCursor: maxInserted(taskRows, (row) => text(row.inserted_at), cursor.taskCursor),
          callCursor: maxInserted(callRows, (row) => text(row.inserted_at), cursor.callCursor),
          fingerprint,
          account,
        });
      } catch (cause) {
        if (typeof console !== "undefined") console.debug("Captain's Log delta sync deferred", cause);
      } finally {
        inFlight = false;
      }
    };

    const onFocus = () => { void sync(true); };
    const onVisibility = () => { if (document.visibilityState === "visible") void sync(true); };
    const onOnline = () => { void sync(true); };
    const startup = window.setTimeout(() => { void sync(true); }, 900);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void sync(false); }, SYNC_INTERVAL_MS);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      window.clearTimeout(startup);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
