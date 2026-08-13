"use client";

import { captainsLogCloudRest } from "./captains-log-cloud";
import type { CaptainsLogActivityItem } from "./captains-log-bridge";

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
  company_id?: string;
};

type RebuiltTask = {
  id: string;
  title: string;
  type: string;
  tag: string;
  done: boolean;
  deleted: boolean;
  scheduledAt: string;
  completedAt: string;
  createdAt: string;
  source: string;
  companyId: string;
};

const TASK_SELECT = "event_id,event_type,local_task_id,task_title,tag,done,occurred_at,inserted_at,metadata,company_id";
const COMPANY_EVENT_SCAN_LIMIT = 80;
const RECENT_COMPLETED_LIMIT = 12;

function record(value: unknown): JsonMap {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonMap : {};
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function boolish(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return ["1", "true", "yes", "done", "completed"].includes(text(value).toLowerCase());
}

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value));
}

function eventTime(row: TaskEventRow): string {
  return text(row.occurred_at || row.inserted_at);
}

function taskType(row: TaskEventRow): string {
  const meta = record(row.metadata);
  const patch = record(meta.patch);
  return text(patch.task_type || patch.action_type || meta.task_type || meta.action_type) || "Task";
}

function rebuildCompletedActivity(rows: TaskEventRow[], companyId: string): CaptainsLogActivityItem[] {
  const byId = new Map<string, RebuiltTask>();
  const ordered = [...rows].sort((left, right) => eventTime(left).localeCompare(eventTime(right)) || text(left.event_id).localeCompare(text(right.event_id)));

  for (const row of ordered) {
    const id = text(row.local_task_id);
    if (!id) continue;
    const meta = record(row.metadata);
    const patch = record(meta.patch);
    const when = eventTime(row);
    const eventType = text(row.event_type).toLowerCase().replace(/_retro$/, "");
    const current = byId.get(id) ?? {
      id,
      title: text(row.task_title || patch.title) || "Completed task",
      type: taskType(row),
      tag: text(row.tag || patch.tag),
      done: false,
      deleted: false,
      scheduledAt: text(patch.scheduled_at || meta.scheduled_at),
      completedAt: "",
      createdAt: text(meta.created_at) || when,
      source: text(patch.source || meta.source) || "supabase_task_events",
      companyId,
    };

    if (text(row.task_title)) current.title = text(row.task_title);
    if (Object.prototype.hasOwnProperty.call(patch, "title")) current.title = text(patch.title) || current.title;
    if (text(row.tag)) current.tag = text(row.tag);
    if (Object.prototype.hasOwnProperty.call(patch, "tag")) current.tag = text(patch.tag);
    const incomingType = taskType(row);
    if (incomingType) current.type = incomingType;
    if (Object.prototype.hasOwnProperty.call(patch, "scheduled_at")) current.scheduledAt = text(patch.scheduled_at);
    if (Object.prototype.hasOwnProperty.call(patch, "completed_at")) current.completedAt = text(patch.completed_at);

    if (eventType === "task_deleted" || eventType === "task_removed") {
      current.deleted = true;
    } else if (eventType.includes("reopened")) {
      current.deleted = false;
      current.done = false;
      current.completedAt = "";
    } else if (eventType.includes("completed")) {
      current.deleted = false;
      current.done = true;
      current.completedAt = text(patch.completed_at || meta.completed_at) || when;
      current.scheduledAt = "";
    } else if (Object.prototype.hasOwnProperty.call(patch, "done") || row.done !== undefined) {
      current.done = Object.prototype.hasOwnProperty.call(patch, "done") ? boolish(patch.done) : Boolean(row.done);
      if (current.done) current.completedAt = current.completedAt || text(meta.completed_at) || when;
      else current.completedAt = "";
    }

    byId.set(id, current);
  }

  return [...byId.values()]
    .filter((task) => task.done && !task.deleted)
    .sort((left, right) => (right.completedAt || right.createdAt).localeCompare(left.completedAt || left.createdAt))
    .slice(0, RECENT_COMPLETED_LIMIT)
    .map((task) => ({
      id: task.id,
      type: task.type,
      tag: task.tag,
      title: task.title,
      status: "completed",
      scheduled_at: task.scheduledAt,
      completed_at: task.completedAt,
      created_at: task.createdAt,
      source: task.source,
      company_id: task.companyId,
    }));
}

/**
 * Loads only the newest event rows for one company. Company Detail calls this
 * on entry/manual refresh; it is intentionally excluded from global polling.
 */
export async function loadRecentCompletedCompanyActivity(companyIdValue: string): Promise<CaptainsLogActivityItem[]> {
  const companyId = text(companyIdValue);
  if (!isUuid(companyId)) return [];
  try {
    const rows = await captainsLogCloudRest<TaskEventRow[]>("GET", "task_events", undefined, {
      select: TASK_SELECT,
      company_id: `eq.${companyId}`,
      order: "inserted_at.desc,event_id.desc",
      limit: String(COMPANY_EVENT_SCAN_LIMIT),
    });
    return rebuildCompletedActivity(Array.isArray(rows) ? rows : [], companyId);
  } catch {
    // Canonical task state remains usable if the compatibility ledger is unavailable.
    return [];
  }
}
