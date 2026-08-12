"use client";

import { captainsLogCloudRest } from "./captains-log-cloud";
import type { CompassCaptainsLogActivity, CompassCaptainsLogTask, CompassClient, CompassDataset } from "./types";

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

type ReviewTaskState = {
  id: string;
  title: string;
  type: string;
  tag: string;
  done: boolean;
  deleted: boolean;
  scheduledAt: string;
  completedAt: string;
  createdAt: string;
  companyId: string;
  ambiguousCompanyId: boolean;
  clientCompassClientId: string;
  source: string;
};

const TASK_SELECT = "event_id,event_type,local_task_id,task_title,tag,done,occurred_at,inserted_at,metadata,company_id";
const PAGE_SIZE = 500;
const MAX_ROWS = 20_000;
const COMPANY_CHUNK_SIZE = 40;
const TASK_CHUNK_SIZE = 80;
const REVIEW_DISCOVERY_FILTER = "(tag.ilike.*account*review*,task_title.ilike.*account*review*,tag.ilike.*account*management*)";

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

function isAccountReviewDescriptor(titleValue: unknown, tagValue: unknown): boolean {
  const title = text(titleValue).toLowerCase().replace(/[\s_-]+/g, " ");
  const tag = text(tagValue).toLowerCase().replace(/[\s_-]+/g, " ");
  if (title.includes("coordination call") || tag === "client coordination" || tag === "coordination") return false;
  return tag === "account review" || tag === "account management" || title.includes("account review");
}

function companyIdFromRow(row: TaskEventRow): string {
  const meta = record(row.metadata);
  const patch = record(meta.patch);
  const mobile = record(meta.mobile_context);
  return text(row.company_id || patch.company_id || meta.company_id || mobile.company_id);
}

function clientCompassIdFromRow(row: TaskEventRow): string {
  const meta = record(row.metadata);
  const patch = record(meta.patch);
  const mobile = record(meta.mobile_context);
  return text(patch.client_compass_client_id || meta.client_compass_client_id || mobile.client_compass_client_id);
}

function taskTypeFromRow(row: TaskEventRow): string {
  const meta = record(row.metadata);
  const patch = record(meta.patch);
  const mobile = record(meta.mobile_context);
  return text(patch.task_type || patch.action_type || meta.task_type || meta.action_type || mobile.task_type);
}

function eventTime(row: TaskEventRow): string {
  return text(row.occurred_at || row.inserted_at);
}

function applyCompanyIdentity(currentId: string, incomingId: string, ambiguous: boolean): { companyId: string; ambiguous: boolean } {
  const next = text(incomingId);
  if (!next) return { companyId: currentId, ambiguous };
  if (!currentId) return { companyId: next, ambiguous };
  if (currentId === next) return { companyId: currentId, ambiguous };
  return { companyId: currentId, ambiguous: true };
}

async function fetchTaskRows(params: Record<string, string>): Promise<TaskEventRow[]> {
  const rows: TaskEventRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const page = await captainsLogCloudRest<TaskEventRow[]>("GET", "task_events", undefined, {
      ...params,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (!Array.isArray(page)) break;
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
  throw new Error(`Account Review task history exceeded ${MAX_ROWS.toLocaleString()} rows. Client Compass stopped instead of using an incomplete review state.`);
}

function knownReviewTaskIds(dataset: CompassDataset): Set<string> {
  const ids = new Set<string>();
  for (const client of dataset.clients) {
    for (const task of client.captainsLog?.openTasks ?? []) {
      if (isAccountReviewDescriptor(task.title, task.tag) && text(task.id)) ids.add(text(task.id));
    }
    for (const activity of client.captainsLog?.recentActivity ?? []) {
      if (isAccountReviewDescriptor(activity.title, activity.tag) && text(activity.id)) ids.add(text(activity.id));
    }
  }
  return ids;
}

async function discoverReviewTaskIds(dataset: CompassDataset, ids: Set<string>): Promise<void> {
  const companyIds = [...new Set(dataset.clients.map((client) => text(client.companyId)).filter(isUuid))];
  for (let offset = 0; offset < companyIds.length; offset += COMPANY_CHUNK_SIZE) {
    const chunk = companyIds.slice(offset, offset + COMPANY_CHUNK_SIZE);
    const rows = await fetchTaskRows({
      select: TASK_SELECT,
      company_id: `in.(${chunk.join(",")})`,
      or: REVIEW_DISCOVERY_FILTER,
      order: "inserted_at.asc,event_id.asc",
    });
    for (const row of rows) {
      const taskId = text(row.local_task_id);
      if (taskId) ids.add(taskId);
    }
  }
}

async function loadCanonicalReviewEvents(taskIds: Set<string>): Promise<TaskEventRow[]> {
  const ids = [...taskIds].filter(Boolean);
  const rows: TaskEventRow[] = [];
  for (let offset = 0; offset < ids.length; offset += TASK_CHUNK_SIZE) {
    const chunk = ids.slice(offset, offset + TASK_CHUNK_SIZE);
    rows.push(...await fetchTaskRows({
      select: TASK_SELECT,
      local_task_id: `in.(${chunk.map((id) => JSON.stringify(id)).join(",")})`,
      order: "inserted_at.asc,event_id.asc",
    }));
  }

  const unique = [...new Map(rows.map((row) => [text(row.event_id) || `${text(row.local_task_id)}:${eventTime(row)}:${text(row.event_type)}`, row])).values()];
  unique.sort((left, right) => eventTime(left).localeCompare(eventTime(right)) || text(left.event_id).localeCompare(text(right.event_id)));
  return unique;
}

function rebuildReviewTasks(rows: TaskEventRow[]): ReviewTaskState[] {
  const byId = new Map<string, ReviewTaskState>();
  for (const row of rows) {
    const id = text(row.local_task_id);
    if (!id) continue;
    const meta = record(row.metadata);
    const patch = record(meta.patch);
    const eventType = text(row.event_type).toLowerCase().replace(/_retro$/, "");
    const when = eventTime(row);
    const current = byId.get(id) ?? {
      id,
      title: text(row.task_title) || "Task",
      type: taskTypeFromRow(row) || "Task",
      tag: text(row.tag),
      done: false,
      deleted: false,
      scheduledAt: "",
      completedAt: "",
      createdAt: text(meta.created_at) || when,
      companyId: "",
      ambiguousCompanyId: false,
      clientCompassClientId: "",
      source: "focus",
    };

    const identity = applyCompanyIdentity(current.companyId, companyIdFromRow(row), current.ambiguousCompanyId);
    current.companyId = identity.companyId;
    current.ambiguousCompanyId = identity.ambiguous;
    current.clientCompassClientId = clientCompassIdFromRow(row) || current.clientCompassClientId;
    if (text(row.task_title)) current.title = text(row.task_title);
    if (text(row.tag)) current.tag = text(row.tag);
    const incomingType = taskTypeFromRow(row);
    if (incomingType) current.type = incomingType;
    current.source = text(patch.source || meta.source) || current.source;
    if (Object.prototype.hasOwnProperty.call(patch, "title")) current.title = text(patch.title) || current.title;
    if (Object.prototype.hasOwnProperty.call(patch, "tag")) current.tag = text(patch.tag) || current.tag;
    if (Object.prototype.hasOwnProperty.call(patch, "scheduled_at")) current.scheduledAt = text(patch.scheduled_at);
    else if (Object.prototype.hasOwnProperty.call(meta, "scheduled_at")) current.scheduledAt = text(meta.scheduled_at);
    if (Object.prototype.hasOwnProperty.call(patch, "completed_at")) current.completedAt = text(patch.completed_at);
    if (Object.prototype.hasOwnProperty.call(patch, "done")) current.done = boolish(patch.done);
    else if (row.done !== undefined && eventType !== "task_created") current.done = Boolean(row.done);

    if (eventType === "task_deleted" || eventType === "task_removed") current.deleted = true;
    else if (eventType.includes("reopened")) {
      current.deleted = false;
      current.done = false;
      current.completedAt = "";
    } else if (eventType.includes("completed")) {
      current.done = true;
      current.completedAt = text(meta.completed_at) || when;
      current.scheduledAt = "";
    } else if (eventType.includes("unscheduled")) {
      current.scheduledAt = "";
    } else if (eventType.includes("scheduled")) {
      if (!current.done) current.scheduledAt = text(meta.scheduled_at) || current.scheduledAt;
    } else if (eventType.startsWith("task_created")) {
      current.deleted = false;
      if (!current.done) current.done = Boolean(row.done);
    }
    byId.set(id, current);
  }

  return [...byId.values()].filter((task) => !task.ambiguousCompanyId && isAccountReviewDescriptor(task.title, task.tag));
}

function openTask(task: ReviewTaskState): CompassCaptainsLogTask {
  return {
    id: task.id,
    type: task.type || "Task",
    tag: task.tag,
    title: task.title,
    status: task.scheduledAt ? "scheduled" : "open",
    scheduledAt: task.scheduledAt,
    createdAt: task.createdAt,
    source: task.source,
    companyId: task.companyId || undefined,
  };
}

function activity(task: ReviewTaskState): CompassCaptainsLogActivity {
  return {
    id: task.id,
    type: task.type || "Task",
    tag: task.tag,
    title: task.title,
    status: task.done ? "completed" : task.scheduledAt ? "scheduled" : "open",
    scheduledAt: task.scheduledAt,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    source: task.source,
    companyId: task.companyId || undefined,
  };
}

function activityTime(item: CompassCaptainsLogActivity): string {
  return text(item.completedAt || item.scheduledAt || item.createdAt);
}

function dateOnly(value: string): string {
  const match = text(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || "";
}

function taskBelongsToClient(task: ReviewTaskState, client: CompassClient): boolean {
  if (task.companyId && client.companyId) return task.companyId === client.companyId;
  return Boolean(task.clientCompassClientId && task.clientCompassClientId === client.id);
}

export async function syncAccountReviewTasks(
  dataset: CompassDataset,
  options: { discover?: boolean } = {},
): Promise<{ dataset: CompassDataset; changed: boolean; taskCount: number }> {
  const taskIds = knownReviewTaskIds(dataset);
  if (options.discover) await discoverReviewTaskIds(dataset, taskIds);
  if (!taskIds.size) return { dataset, changed: false, taskCount: 0 };

  const rebuilt = rebuildReviewTasks(await loadCanonicalReviewEvents(taskIds));
  if (!rebuilt.length) return { dataset, changed: false, taskCount: taskIds.size };

  const canonicalIds = new Set(rebuilt.map((task) => task.id));
  let changed = false;
  const clients = dataset.clients.map((client) => {
    const owned = rebuilt.filter((task) => taskBelongsToClient(task, client));
    if (!owned.length) return client;

    const prior = client.captainsLog;
    const ownedIds = new Set(owned.map((task) => task.id));
    const untouchedOpen = (prior?.openTasks ?? []).filter((task) => !ownedIds.has(task.id) && !canonicalIds.has(task.id));
    const canonicalOpen = owned.filter((task) => !task.done && !task.deleted).map(openTask);
    const nextOpenTasks = [...untouchedOpen, ...canonicalOpen]
      .sort((left, right) => (left.scheduledAt || "9999").localeCompare(right.scheduledAt || "9999") || right.createdAt.localeCompare(left.createdAt));

    const untouchedActivity = (prior?.recentActivity ?? []).filter((item) => !ownedIds.has(item.id) && !canonicalIds.has(item.id));
    const canonicalActivity = owned.filter((task) => !task.deleted).map(activity);
    const nextActivity = [...untouchedActivity, ...canonicalActivity]
      .sort((left, right) => activityTime(right).localeCompare(activityTime(left)))
      .slice(0, 40);

    const newestCompletedReview = owned
      .filter((task) => task.done && !task.deleted)
      .map((task) => dateOnly(task.completedAt || task.createdAt))
      .filter(Boolean)
      .sort()
      .at(-1) || "";
    const lastAccountReview = newestCompletedReview > text(client.lastAccountReview) ? newestCompletedReview : client.lastAccountReview;
    const nextClient: CompassClient = {
      ...client,
      lastAccountReview,
      captainsLog: {
        matched: true,
        companyId: client.companyId || prior?.companyId,
        linkedCompany: prior?.linkedCompany || client.name,
        closestCompany: prior?.closestCompany || client.name,
        matchMethod: prior?.matchMethod || "supabase-review-task",
        matchScore: prior?.matchScore || 1,
        syncedAt: prior?.syncedAt || new Date().toISOString(),
        openTaskCount: nextOpenTasks.length,
        openTasks: nextOpenTasks,
        recentActivity: nextActivity,
      },
    };

    if (JSON.stringify(nextClient) !== JSON.stringify(client)) changed = true;
    return nextClient;
  });

  return changed ? { dataset: { ...dataset, clients }, changed: true, taskCount: taskIds.size } : { dataset, changed: false, taskCount: taskIds.size };
}