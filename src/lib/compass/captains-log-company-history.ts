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

type CallModeEventRow = {
  event_id?: string;
  event_type?: string;
  payload?: JsonMap;
  created_at?: string;
  inserted_at?: string;
  company_id?: string;
};

type CurrentStateProjectionRow = {
  company_id?: string;
  focus_tasks?: unknown;
  sales_tasks?: unknown;
  sales_activities?: unknown;
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
const CALL_MODE_SELECT = "event_id,event_type,payload,created_at,inserted_at,company_id";
const COMPANY_EVENT_SCAN_LIMIT = 80;
const COMPANY_TASK_ID_LIMIT = 24;
const TASK_HISTORY_SCAN_LIMIT = 240;
const LEGACY_CALL_SCAN_LIMIT = 80;
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

function objectArray(value: unknown): JsonMap[] {
  return Array.isArray(value) ? value.filter((item): item is JsonMap => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
}

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value));
}

function eventTime(row: TaskEventRow): string {
  return text(row.occurred_at || row.inserted_at);
}

function callModeEventTime(row: CallModeEventRow): string {
  const payload = record(row.payload);
  return text(payload.occurred_at || row.created_at || row.inserted_at);
}

function taskType(row: TaskEventRow): string {
  const meta = record(row.metadata);
  const patch = record(meta.patch);
  return text(patch.task_type || patch.action_type || meta.task_type || meta.action_type) || "Task";
}

function activityStamp(item: CaptainsLogActivityItem): string {
  return text(item.completed_at || item.scheduled_at || item.created_at);
}

function mergeCompletedActivity(...groups: CaptainsLogActivityItem[][]): CaptainsLogActivityItem[] {
  return [...new Map(groups.flat().filter((item) => item.id).map((item) => [item.id, item])).values()]
    .sort((left, right) => activityStamp(right).localeCompare(activityStamp(left)))
    .slice(0, RECENT_COMPLETED_LIMIT);
}

function projectedCompletedActivity(row: CurrentStateProjectionRow | undefined, companyId: string): CaptainsLogActivityItem[] {
  if (!row) return [];
  const focus = objectArray(row.focus_tasks)
    .filter((task) => boolish(task.done))
    .map((task) => ({
      id: text(task.id),
      type: "Task",
      tag: text(task.tag),
      title: text(task.title) || "Completed task",
      status: "completed",
      scheduled_at: text(task.scheduled_at),
      completed_at: text(task.completed_at),
      created_at: text(task.created_at),
      source: text(task.source) || "focus",
      company_id: companyId,
    }));
  const sales = objectArray(row.sales_tasks)
    .filter((task) => boolish(task.completed))
    .map((task) => ({
      id: text(task.id),
      type: text(task.action_type) || "Task",
      tag: text(task.tag),
      title: text(task.tag) || `${text(task.action_type) || "Task"} follow-up`,
      status: "completed",
      scheduled_at: text(task.due_date),
      completed_at: text(task.completed_at),
      created_at: text(task.created_at),
      source: "call_mode",
      company_id: companyId,
    }));
  const standalone = objectArray(row.sales_activities).map((activity) => ({
    id: text(activity.id),
    type: text(activity.type) || "Activity",
    tag: "",
    title: text(activity.title) || "Client activity",
    status: "completed",
    scheduled_at: "",
    completed_at: text(activity.created_at),
    created_at: text(activity.created_at),
    source: "sales_activity",
    company_id: companyId,
  }));
  return [...focus, ...sales, ...standalone]
    .filter((item) => item.id)
    .sort((left, right) => (right.completed_at || right.created_at).localeCompare(left.completed_at || left.created_at))
    .slice(0, RECENT_COMPLETED_LIMIT);
}

async function loadProjectedCompletedActivity(companyId: string): Promise<CaptainsLogActivityItem[]> {
  if (!companyId) return [];
  try {
    const rows = await captainsLogCloudRest<CurrentStateProjectionRow[]>("POST", "rpc/client_compass_current_state", {
      p_company_ids: [companyId],
      p_recent_limit: 40,
    });
    return projectedCompletedActivity(Array.isArray(rows) ? rows[0] : undefined, companyId);
  } catch {
    // Older Supabase installations can use the bounded history fallbacks below.
    return [];
  }
}

function completedCallModeTask(row: CallModeEventRow, companyId: string): CaptainsLogActivityItem | null {
  const payload = record(row.payload);
  const salesTask = record(payload.sales_task);
  const prospect = record(payload.prospect);
  const taskId = text(salesTask.id);
  if (!taskId || !boolish(salesTask.completed)) return null;

  const tag = text(salesTask.task_tag || salesTask.tag);
  const actionType = text(salesTask.action_type) || "Task";
  const contact = text(salesTask.contact || prospect.contact);
  const completedAt = text(salesTask.completed_at || payload.occurred_at || row.created_at || row.inserted_at);
  const createdAt = text(salesTask.created_at || row.created_at || row.inserted_at || completedAt);
  const title = tag
    ? `${tag}${contact ? ` - ${contact}` : ""}`
    : `${actionType}${contact ? ` - ${contact}` : ""}`;

  return {
    id: taskId,
    type: actionType,
    tag,
    title,
    status: "completed",
    scheduled_at: text(salesTask.due_date),
    completed_at: completedAt,
    created_at: createdAt,
    source: "call_mode",
    company_id: companyId,
  };
}

async function loadLegacyCallModeCompletedActivity(companyNameValue: string, companyId: string): Promise<CaptainsLogActivityItem[]> {
  const companyName = text(companyNameValue);
  if (!companyName || !companyId) return [];
  try {
    const common = {
      select: CALL_MODE_SELECT,
      event_type: "eq.call_mode_event",
      order: "created_at.desc.nullslast,inserted_at.desc",
      limit: String(LEGACY_CALL_SCAN_LIMIT),
    };
    const [prospectRows, transcriptRows] = await Promise.all([
      captainsLogCloudRest<CallModeEventRow[]>("GET", "app_events", undefined, {
        ...common,
        "payload->prospect->>company": `eq.${companyName}`,
      }),
      captainsLogCloudRest<CallModeEventRow[]>("GET", "app_events", undefined, {
        ...common,
        "payload->sales_task->>transcript_company": `eq.${companyName}`,
      }),
    ]);
    const rows = [...new Map([...(Array.isArray(prospectRows) ? prospectRows : []), ...(Array.isArray(transcriptRows) ? transcriptRows : [])]
      .map((row) => [text(row.event_id) || `${callModeEventTime(row)}:${JSON.stringify(row.payload ?? {})}`, row])).values()]
      .sort((left, right) => callModeEventTime(right).localeCompare(callModeEventTime(left)));

    // app_events predates universal company UUIDs for some Call Mode records.
    // Keep only the newest state for each sales task, then project completed rows
    // onto the already-resolved canonical company UUID used by Client Compass.
    const latestByTask = new Map<string, CallModeEventRow>();
    for (const row of rows) {
      const taskId = text(record(record(row.payload).sales_task).id);
      if (taskId && !latestByTask.has(taskId)) latestByTask.set(taskId, row);
    }
    return [...latestByTask.values()]
      .map((row) => completedCallModeTask(row, companyId))
      .filter((item): item is CaptainsLogActivityItem => Boolean(item))
      .sort((left, right) => activityStamp(right).localeCompare(activityStamp(left)))
      .slice(0, RECENT_COMPLETED_LIMIT);
  } catch {
    return [];
  }
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
 * Loads only the newest task/activity rows for one canonical company. Company
 * Detail calls this on entry/manual refresh; it is intentionally excluded from
 * global polling. Legacy Call Mode rows that predate company_id backfill are
 * matched by the canonical company name and projected onto the resolved UUID.
 */
export async function loadRecentCompletedCompanyActivity(
  companyIdValue: string,
  knownTaskIdValues: string[] = [],
  companyNameValue = "",
): Promise<CaptainsLogActivityItem[]> {
  const requestedCompanyId = text(companyIdValue);
  const companyId = isUuid(requestedCompanyId) ? requestedCompanyId : "";
  const knownTaskIds = [...new Set(knownTaskIdValues.map(text).filter(Boolean))].slice(0, COMPANY_TASK_ID_LIMIT);
  if (!companyId && !knownTaskIds.length) return [];
  try {
    const [projected, legacyCallMode] = await Promise.all([
      loadProjectedCompletedActivity(companyId),
      loadLegacyCallModeCompletedActivity(companyNameValue, companyId),
    ]);
    if (projected.length) return mergeCompletedActivity(projected, legacyCallMode);

    const companyRows = companyId ? await captainsLogCloudRest<TaskEventRow[]>("GET", "task_events", undefined, {
      select: TASK_SELECT,
      company_id: `eq.${companyId}`,
      order: "inserted_at.desc,event_id.desc",
      limit: String(COMPANY_EVENT_SCAN_LIMIT),
    }) : [];
    const seedRows = Array.isArray(companyRows) ? companyRows : [];
    const taskIds = [...new Set([...knownTaskIds, ...seedRows.map((row) => text(row.local_task_id)).filter(Boolean)])].slice(0, COMPANY_TASK_ID_LIMIT);
    if (!taskIds.length) return legacyCallMode;

    // Some completion/reopen events omit company_id even though the task's
    // creation event carries it. Rebuild the discovered company tasks by task
    // identity, matching Workbench without downloading the broader ledger.
    const taskRows = await captainsLogCloudRest<TaskEventRow[]>("GET", "task_events", undefined, {
      select: TASK_SELECT,
      local_task_id: `in.(${taskIds.map((id) => JSON.stringify(id)).join(",")})`,
      order: "inserted_at.asc,event_id.asc",
      limit: String(TASK_HISTORY_SCAN_LIMIT),
    });
    const canonicalRows = Array.isArray(taskRows) ? taskRows : [];
    const rows = [...new Map([...seedRows, ...canonicalRows].map((row) => [text(row.event_id) || `${text(row.local_task_id)}:${eventTime(row)}:${text(row.event_type)}`, row])).values()];
    return mergeCompletedActivity(rebuildCompletedActivity(rows, companyId), legacyCallMode);
  } catch {
    // Canonical task state remains usable if compatibility history is unavailable.
    return [];
  }
}
