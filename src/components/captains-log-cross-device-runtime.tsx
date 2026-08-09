"use client";

import { useEffect } from "react";
import { getCaptainsLogCloudAuthSnapshot, captainsLogCloudRest } from "@/lib/compass/captains-log-cloud";
import { loadCompassDataset, saveCompassDataset } from "@/lib/compass/store";

interface TaskEventRow {
  event_id?: string;
  event_type?: string;
  local_task_id?: string;
  task_title?: string;
  tag?: string;
  done?: boolean;
  occurred_at?: string;
  inserted_at?: string;
  metadata?: Record<string, unknown>;
}

interface RebuiltCompassTask {
  id: string;
  clientId: string;
  company: string;
  title: string;
  tag: string;
  scheduledAt: string;
  createdAt: string;
  completedAt: string;
  done: boolean;
  deleted: boolean;
}

const SYNC_INTERVAL_MS = 45_000;
const CURSOR_OVERLAP_MS = 5_000;
const PAGE_SIZE = 1000;
const MAX_ROWS = 20_000;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function boolish(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return ["1", "true", "yes", "done", "completed"].includes(text(value).toLowerCase());
}

function eventKey(row: TaskEventRow, index: number): string {
  return text(row.event_id) || `${text(row.local_task_id)}:${text(row.event_type)}:${text(row.inserted_at || row.occurred_at)}:${index}`;
}

function eventTime(row: TaskEventRow): string {
  return text(row.occurred_at || row.inserted_at);
}

async function fetchCompassTaskEvents(since = ""): Promise<TaskEventRow[]> {
  const rows: TaskEventRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const params: Record<string, string> = {
      select: "event_id,event_type,local_task_id,task_title,tag,done,occurred_at,inserted_at,metadata",
      local_task_id: "like.client-compass-*",
      order: "inserted_at.asc,event_id.asc",
      limit: String(PAGE_SIZE),
      offset: String(offset),
    };
    if (since) params.inserted_at = `gte.${since}`;
    const page = await captainsLogCloudRest<TaskEventRow[]>("GET", "task_events", undefined, params);
    if (!Array.isArray(page)) break;
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
  return rows;
}

function rebuildTasks(rows: TaskEventRow[]): RebuiltCompassTask[] {
  const byTask = new Map<string, RebuiltCompassTask>();
  [...rows]
    .sort((left, right) => eventTime(left).localeCompare(eventTime(right)) || text(left.event_id).localeCompare(text(right.event_id)))
    .forEach((row) => {
      const id = text(row.local_task_id);
      if (!id.startsWith("client-compass-")) return;
      const meta = record(row.metadata);
      const patch = record(meta.patch);
      const eventType = text(row.event_type).toLowerCase().replace(/_retro$/, "");
      const when = eventTime(row);
      const current = byTask.get(id) ?? {
        id,
        clientId: "",
        company: "",
        title: text(row.task_title) || "Task",
        tag: text(row.tag),
        scheduledAt: "",
        createdAt: text(meta.created_at) || when,
        completedAt: "",
        done: false,
        deleted: false,
      };

      current.clientId = text(meta.client_compass_client_id) || current.clientId;
      current.company = text(patch.company || meta.company) || current.company;
      if (text(row.task_title)) current.title = text(row.task_title);
      if (text(row.tag)) current.tag = text(row.tag);
      if (Object.prototype.hasOwnProperty.call(patch, "title")) current.title = text(patch.title) || current.title;
      if (Object.prototype.hasOwnProperty.call(patch, "tag")) current.tag = text(patch.tag) || current.tag;
      if (Object.prototype.hasOwnProperty.call(patch, "scheduled_at")) current.scheduledAt = text(patch.scheduled_at);
      else if (Object.prototype.hasOwnProperty.call(meta, "scheduled_at")) current.scheduledAt = text(meta.scheduled_at);
      if (Object.prototype.hasOwnProperty.call(patch, "completed_at")) current.completedAt = text(patch.completed_at);
      if (Object.prototype.hasOwnProperty.call(patch, "done")) current.done = boolish(patch.done);
      else if (row.done !== undefined && eventType !== "task_created") current.done = Boolean(row.done);

      if (eventType === "task_deleted" || eventType === "task_removed") current.deleted = true;
      else if (eventType === "task_reopened" || eventType.includes("reopened")) {
        current.deleted = false;
        current.done = false;
        current.completedAt = "";
      } else if (eventType === "task_completed" || eventType.includes("completed")) {
        current.done = true;
        current.completedAt = text(meta.completed_at) || when;
        current.scheduledAt = "";
      } else if (eventType === "task_scheduled" || eventType.includes("task_scheduled")) {
        if (!current.done) current.scheduledAt = text(meta.scheduled_at) || current.scheduledAt;
      } else if (eventType === "task_unscheduled" || eventType.includes("task_unscheduled")) {
        current.scheduledAt = "";
      } else if (eventType === "task_created" || eventType.startsWith("task_created")) {
        current.deleted = false;
        if (!current.done) current.done = Boolean(row.done);
      }
      byTask.set(id, current);
    });
  return [...byTask.values()].filter((task) => task.clientId && !task.deleted);
}

function newestDateOnly(values: string[]): string {
  return values.filter(Boolean).map((value) => value.slice(0, 10)).filter(Boolean).sort().at(-1) || "";
}

export function CaptainsLogCrossDeviceRuntime() {
  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let lastRunAt = 0;
    let cursorAt = 0;
    const knownRows = new Map<string, TaskEventRow>();

    const sync = async (force = false) => {
      if (disposed || inFlight) return;
      const now = Date.now();
      if (!force && now - lastRunAt < Math.min(12_000, SYNC_INTERVAL_MS / 2)) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const auth = getCaptainsLogCloudAuthSnapshot();
      if (!auth.configured || !auth.signedIn) return;

      inFlight = true;
      const requestStartedAt = Date.now();
      try {
        const since = cursorAt ? new Date(Math.max(0, cursorAt - CURSOR_OVERLAP_MS)).toISOString() : "";
        const rows = await fetchCompassTaskEvents(since);
        rows.forEach((row, index) => knownRows.set(eventKey(row, index), row));
        cursorAt = requestStartedAt;
        lastRunAt = Date.now();

        const tasks = rebuildTasks([...knownRows.values()]);
        const byClient = new Map<string, RebuiltCompassTask[]>();
        tasks.forEach((task) => {
          const list = byClient.get(task.clientId) ?? [];
          list.push(task);
          byClient.set(task.clientId, list);
        });

        const dataset = await loadCompassDataset();
        if (!dataset || disposed) return;
        let changed = false;
        const syncedAt = new Date().toISOString();
        const clients = dataset.clients.map((client) => {
          const hotTasks = byClient.get(client.id) ?? [];
          const existing = client.captainsLog;
          const existingOpen = existing?.openTasks ?? [];
          const existingActivity = existing?.recentActivity ?? [];
          const keepOpen = existingOpen.filter((item) => !item.id.startsWith("client-compass-"));
          const keepActivity = existingActivity.filter((item) => !item.id.startsWith("client-compass-"));
          const hotOpen = hotTasks.filter((task) => !task.done).map((task) => ({
            id: task.id,
            type: "Task",
            tag: task.tag || "Client Coordination",
            title: task.title,
            status: task.scheduledAt ? "scheduled" : "open",
            scheduledAt: task.scheduledAt,
            createdAt: task.createdAt,
            source: "client_compass",
          }));
          const hotActivity = hotTasks.map((task) => ({
            id: task.id,
            type: "Task",
            tag: task.tag || "Client Coordination",
            title: task.title,
            status: task.done ? "completed" : task.scheduledAt ? "scheduled" : "open",
            scheduledAt: task.scheduledAt,
            completedAt: task.completedAt,
            createdAt: task.createdAt,
            source: "client_compass",
          }));
          const nextOpen = [...keepOpen, ...hotOpen];
          const nextActivity = [...keepActivity, ...hotActivity]
            .sort((left, right) => (right.completedAt || right.scheduledAt || right.createdAt || "").localeCompare(left.completedAt || left.scheduledAt || left.createdAt || ""));
          const nextCaptainsLog = (existing || hotTasks.length) ? {
            matched: existing?.matched ?? Boolean(hotTasks.length),
            linkedCompany: existing?.linkedCompany || (hotTasks.length ? client.name : ""),
            closestCompany: existing?.closestCompany || "",
            matchMethod: existing?.matchMethod || (hotTasks.length ? "client-compass-id" : ""),
            matchScore: existing?.matchScore ?? (hotTasks.length ? 1 : 0),
            syncedAt: hotTasks.length || existing ? syncedAt : "",
            openTaskCount: nextOpen.length,
            openTasks: nextOpen,
            recentActivity: nextActivity,
          } : undefined;
          const newestHot = newestDateOnly(hotTasks.map((task) => task.completedAt || task.scheduledAt || task.createdAt));
          const nextLastInteraction = newestHot && newestHot > (client.lastSalesInteraction || "") ? newestHot : client.lastSalesInteraction;
          if (JSON.stringify(existing) !== JSON.stringify(nextCaptainsLog) || nextLastInteraction !== client.lastSalesInteraction) changed = true;
          return { ...client, captainsLog: nextCaptainsLog, lastSalesInteraction: nextLastInteraction };
        });

        if (changed && !disposed) await saveCompassDataset({ ...dataset, clients });
      } catch (cause) {
        if (typeof console !== "undefined") console.debug("Captain's Log cross-device sync deferred", cause);
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
