"use client";

import { captainsLogCloudRest } from "./captains-log-cloud";
import { resolveCompassCompanyIdsBulk } from "./company-identity-bulk";
import type {
  CaptainsLogActivityItem,
  CaptainsLogBatchSyncResult,
  CaptainsLogClientSyncResult,
  CaptainsLogOpenTask,
} from "./captains-log-bridge";

export interface CurrentStateClientInput {
  clientId: string;
  company: string;
  aliases?: string[];
  companyId?: string;
}

type CanonicalTaskRow = {
  task_id?: string;
  record_kind?: string;
  lifecycle_state?: string;
  title?: string;
  tag?: string;
  task_type?: string;
  action_type?: string;
  company_id?: string;
  company?: string;
  contact?: string;
  scheduled_at?: string;
  due_date?: string;
  source?: string;
  payload?: Record<string, unknown>;
  version?: number;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
  deleted_at?: string;
};

const TASK_SELECT = "task_id,record_kind,lifecycle_state,title,tag,task_type,action_type,company_id,company,contact,scheduled_at,due_date,source,payload,version,created_at,updated_at,completed_at,deleted_at";
const OPEN_LIMIT = 24;
const RECENT_COMPLETED_LIMIT = 12;
const RECENT_COMPLETION_FILTER = "(lifecycle_state.in.(completed,done,closed,resolved),completed_at.not.is.null,payload->>done.eq.true,payload->>completed.eq.true,payload->>completed_at.not.is.null,payload->>done_at.not.is.null)";
const BATCH_CONCURRENCY = 6;

export type SelectedCompanyActivityFallback = {
  companyId: string;
  linkedCompany: string;
  openTasks: CaptainsLogOpenTask[];
  recentActivity: CaptainsLogActivityItem[];
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function boolish(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return ["1", "true", "yes", "done", "completed", "closed", "resolved"].includes(text(value).toLowerCase());
}

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value));
}

function stamp(row: CanonicalTaskRow): string {
  return text(row.completed_at || row.scheduled_at || row.due_date || row.updated_at || row.created_at);
}

function completedStamp(row: CanonicalTaskRow): string {
  const payload = record(row.payload);
  return text(row.completed_at || payload.completed_at || payload.done_at || row.updated_at || row.created_at);
}

function isCompleted(row: CanonicalTaskRow): boolean {
  const payload = record(row.payload);
  const state = text(row.lifecycle_state || payload.lifecycle_state || payload.status).toLowerCase();
  return ["completed", "done", "closed", "resolved"].includes(state)
    || Boolean(text(row.completed_at || payload.completed_at || payload.done_at))
    || boolish(payload.done)
    || boolish(payload.completed);
}

function isCoordination(row: CanonicalTaskRow): boolean {
  const tag = text(row.tag).toLowerCase().replace(/[\s_-]+/g, " ");
  const title = text(row.title).toLowerCase();
  return tag === "client coordination" || tag === "coordination" || title.startsWith("coordination call -");
}

function isAccountReview(row: CanonicalTaskRow): boolean {
  if (isCoordination(row)) return false;
  const tag = text(row.tag).toLowerCase().replace(/[\s_-]+/g, " ");
  const title = text(row.title).toLowerCase();
  const taskType = text(row.action_type || row.task_type).toLowerCase();
  return tag === "account review" || tag === "account management" || (title.includes("account review") && taskType === "meeting");
}

function openTask(row: CanonicalTaskRow): CaptainsLogOpenTask {
  const scheduled = text(row.scheduled_at || row.due_date);
  return {
    id: text(row.task_id),
    type: text(row.action_type || row.task_type) || "Task",
    tag: text(row.tag),
    title: text(row.title) || "Task",
    status: scheduled ? "scheduled" : "open",
    scheduled_at: scheduled,
    created_at: text(row.created_at),
    source: text(row.source || row.record_kind) || "task_service_v2",
    company_id: text(row.company_id) || undefined,
  };
}

function activity(row: CanonicalTaskRow): CaptainsLogActivityItem {
  const completed = isCompleted(row);
  return {
    id: text(row.task_id),
    type: text(row.action_type || row.task_type) || "Task",
    tag: text(row.tag),
    title: text(row.title) || "Task",
    status: completed ? "completed" : text(row.scheduled_at || row.due_date) ? "scheduled" : "open",
    scheduled_at: text(row.scheduled_at || row.due_date),
    completed_at: completed ? completedStamp(row) : "",
    created_at: text(row.created_at),
    source: text(row.source || row.record_kind) || "task_service_v2",
    company_id: text(row.company_id) || undefined,
  };
}

/**
 * Company Detail compatibility lookup. This is one exact-name, 24-row request
 * used only when the UUID-scoped current-state response is empty. It avoids a
 * broad task scan while repairing stale/missing company identity links.
 */
export async function loadSelectedCompanyActivityByName(companyValue: string): Promise<SelectedCompanyActivityFallback | null> {
  const company = text(companyValue);
  if (!company) return null;
  const rows = await captainsLogCloudRest<CanonicalTaskRow[]>("GET", "tasks", undefined, {
    select: TASK_SELECT,
    company: `eq.${company}`,
    deleted_at: "is.null",
    order: "updated_at.desc.nullslast,created_at.desc",
    limit: "24",
  });
  const owned = (Array.isArray(rows) ? rows : []).filter((row) => text(row.task_id) && !text(row.deleted_at));
  if (!owned.length) return null;
  const openRows = owned.filter((row) => text(row.lifecycle_state).toLowerCase() === "open" && !isCompleted(row));
  const completedRows = owned.filter(isCompleted).sort((left, right) => completedStamp(right).localeCompare(completedStamp(left))).slice(0, RECENT_COMPLETED_LIMIT);
  return {
    companyId: text(owned.find((row) => isUuid(row.company_id))?.company_id),
    linkedCompany: text(owned[0]?.company) || company,
    openTasks: openRows.map(openTask),
    recentActivity: [...openRows.slice(0, 4), ...completedRows]
      .sort((left, right) => stamp(right).localeCompare(stamp(left)))
      .slice(0, RECENT_COMPLETED_LIMIT)
      .map(activity),
  };
}

async function snapshotForClient(input: CurrentStateClientInput, companyId: string): Promise<CaptainsLogClientSyncResult> {
  const syncedAt = new Date().toISOString();
  if (!isUuid(companyId)) {
    return {
      ok: true,
      client_id: input.clientId,
      company_id: "",
      requested_company: input.company,
      matched: false,
      linked_company: "",
      closest_company: "",
      match_method: "none",
      match_score: 0,
      has_open_tasks: false,
      open_task_count: 0,
      open_tasks: [],
      recent_activity: [],
      synced_at: syncedAt,
    };
  }

  const [openRows, recentTaskRows] = await Promise.all([
    captainsLogCloudRest<CanonicalTaskRow[]>("GET", "tasks", undefined, {
      select: TASK_SELECT,
      company_id: `eq.${companyId}`,
      lifecycle_state: "eq.open",
      deleted_at: "is.null",
      order: "due_date.asc.nullslast,scheduled_at.asc.nullslast,updated_at.desc",
      limit: String(OPEN_LIMIT),
    }),
    captainsLogCloudRest<CanonicalTaskRow[]>("GET", "tasks", undefined, {
      select: TASK_SELECT,
      company_id: `eq.${companyId}`,
      deleted_at: "is.null",
      or: RECENT_COMPLETION_FILTER,
      order: "updated_at.desc.nullslast,completed_at.desc.nullslast,created_at.desc",
      limit: String(RECENT_COMPLETED_LIMIT),
    }),
  ]);

  const currentRows = (Array.isArray(openRows) ? openRows : []).filter((row) => text(row.task_id) && text(row.lifecycle_state).toLowerCase() === "open" && !text(row.deleted_at) && !isCompleted(row));
  const recentRows = (Array.isArray(recentTaskRows) ? recentTaskRows : [])
    .filter((row) => text(row.task_id) && !text(row.deleted_at) && isCompleted(row))
    .sort((left, right) => completedStamp(right).localeCompare(completedStamp(left)))
    .slice(0, RECENT_COMPLETED_LIMIT);
  const openTasks = currentRows.map(openTask);
  const recentActivity = [...currentRows.slice(0, 4), ...recentRows]
    .sort((a, b) => stamp(b).localeCompare(stamp(a)))
    .slice(0, RECENT_COMPLETED_LIMIT)
    .map(activity);
  const reviewDates = recentRows.filter(isAccountReview).map(completedStamp).filter(Boolean).sort();
  const coordination = currentRows.find(isCoordination);
  const contactRow = [...currentRows, ...recentRows].find((row) => text(row.contact));
  const linkedCompany = text(currentRows[0]?.company || recentRows[0]?.company || input.company);

  return {
    ok: true,
    client_id: input.clientId,
    company_id: companyId,
    requested_company: input.company,
    matched: true,
    linked_company: linkedCompany || input.company,
    closest_company: linkedCompany || input.company,
    match_method: "supabase-company-id",
    match_score: 1,
    contact: {
      name: text(contactRow?.contact),
      role: "",
      email: "",
      phone: "",
      source: contactRow ? "task_service_v2" : "",
      prospect_id: "",
    },
    has_open_tasks: openTasks.length > 0,
    open_task_count: openTasks.length,
    open_tasks: openTasks,
    primary_open_task: openTasks[0],
    coordination: {
      exists: Boolean(coordination),
      open: Boolean(coordination),
      task_id: text(coordination?.task_id),
      title: text(coordination?.title),
      scheduled_at: text(coordination?.scheduled_at || coordination?.due_date),
      status: coordination ? "open" : "none",
    },
    last_account_review: reviewDates.at(-1) || "",
    recent_activity: recentActivity,
    synced_at: syncedAt,
  };
}

export async function syncClientsFromCompassCurrentState(clients: CurrentStateClientInput[]): Promise<CaptainsLogBatchSyncResult> {
  const cleaned = (clients || [])
    .map((client) => ({
      clientId: text(client.clientId),
      company: text(client.company),
      aliases: Array.isArray(client.aliases) ? client.aliases.map(text).filter(Boolean) : [],
      companyId: text(client.companyId),
    }))
    .filter((client) => client.clientId && client.company);
  if (!cleaned.length) return { results: [], pendingBatches: 0, totalBatches: 0 };

  const resolved = await resolveCompassCompanyIdsBulk(cleaned.map((client) => ({
    id: client.clientId,
    name: client.company,
    aliases: client.aliases,
    companyId: client.companyId || undefined,
  })));
  const results: CaptainsLogClientSyncResult[] = [];
  for (let index = 0; index < cleaned.length; index += BATCH_CONCURRENCY) {
    const batch = cleaned.slice(index, index + BATCH_CONCURRENCY);
    const settled = await Promise.all(batch.map((client) => snapshotForClient(client, client.companyId || resolved.get(client.clientId) || "").catch(() => null)));
    for (const row of settled) if (row) results.push(row);
  }
  return {
    results,
    pendingBatches: 0,
    totalBatches: Math.ceil(cleaned.length / BATCH_CONCURRENCY),
  };
}
