"use client";

import { captainsLogCloudRest } from "./captains-log-cloud";
import { resolveCompassCompanyIdsBulk } from "./company-identity-bulk";

type JsonMap = Record<string, unknown>;

type SyncClientInput = {
  clientId: string;
  company: string;
  aliases?: string[];
  companyId?: string;
};

type CurrentStateRow = {
  company_id?: string;
  linked_company?: string;
  focus_tasks?: unknown;
  sales_tasks?: unknown;
  sales_activities?: unknown;
  contact?: unknown;
  last_account_review?: string;
  synced_at?: string;
};

type OpenTask = {
  id: string;
  type: string;
  tag: string;
  title: string;
  status: string;
  scheduled_at: string;
  created_at: string;
  source: string;
  company_id?: string;
};

type ActivityItem = OpenTask & { completed_at: string };

type CurrentStateResult = {
  ok: boolean;
  client_id?: string;
  company_id?: string;
  requested_company?: string;
  matched?: boolean;
  linked_company?: string;
  closest_company?: string;
  match_method?: string;
  match_score?: number;
  contact?: { name: string; role: string; email: string; phone: string; source?: string; prospect_id?: string };
  has_open_tasks?: boolean;
  open_task_count?: number;
  open_tasks?: OpenTask[];
  primary_open_task?: OpenTask;
  coordination?: { exists: boolean; open: boolean; task_id: string; title: string; scheduled_at: string; status: string };
  last_account_review?: string;
  recent_activity?: ActivityItem[];
  synced_at?: string;
  error?: string;
};

export type CurrentStateBatchResult = {
  results: CurrentStateResult[];
  pendingBatches: number;
  totalBatches: number;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function record(value: unknown): JsonMap {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonMap : {};
}

function objectArray(value: unknown): JsonMap[] {
  return Array.isArray(value) ? value.filter((item): item is JsonMap => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
}

function boolish(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return ["1", "true", "yes", "done", "completed"].includes(text(value).toLowerCase());
}

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value));
}

function rpcUnavailable(cause: unknown): boolean {
  const message = String(cause instanceof Error ? cause.message : cause || "").toLowerCase();
  return message.includes("pgrst202")
    || message.includes("42883")
    || message.includes("schema cache")
    || message.includes("could not find the function")
    || (message.includes("404") && message.includes("client_compass_current_state"));
}

function newest(values: string[]): string {
  return values.map(text).filter(Boolean).sort().at(-1) || "";
}

function isReviewActivity(item: ActivityItem): boolean {
  if (text(item.status).toLowerCase() !== "completed") return false;
  const title = text(item.title).toLowerCase();
  const tag = text(item.tag).toLowerCase().replace(/[\s_-]+/g, " ").trim();
  if (title.startsWith("coordination call -") || ["client coordination", "coordination"].includes(tag)) return false;
  return tag === "account review" || tag === "account management" || title.includes("account review");
}

function buildResult(input: SyncClientInput & { companyId: string }, row: CurrentStateRow | undefined): CurrentStateResult {
  const companyId = input.companyId;
  if (!row) {
    return {
      ok: true,
      client_id: input.clientId,
      company_id: companyId,
      requested_company: input.company,
      matched: true,
      linked_company: input.company,
      closest_company: input.company,
      match_method: "supabase-company-id",
      match_score: 1,
      contact: { name: "", role: "", email: "", phone: "" },
      has_open_tasks: false,
      open_task_count: 0,
      open_tasks: [],
      coordination: { exists: false, open: false, task_id: "", title: "", scheduled_at: "", status: "none" },
      last_account_review: "",
      recent_activity: [],
      synced_at: new Date().toISOString(),
    };
  }

  const focus = objectArray(row.focus_tasks);
  const sales = objectArray(row.sales_tasks);
  const standalone = objectArray(row.sales_activities);

  const openTasks: OpenTask[] = [
    ...focus.filter((task) => !boolish(task.done)).map((task) => ({
      id: text(task.id),
      type: "Task",
      tag: text(task.tag),
      title: text(task.title) || "Task",
      status: text(task.scheduled_at) ? "scheduled" : "open",
      scheduled_at: text(task.scheduled_at),
      created_at: text(task.created_at),
      source: text(task.source) || "focus",
      company_id: companyId,
    })),
    ...sales.filter((task) => !boolish(task.completed)).map((task) => ({
      id: text(task.id),
      type: text(task.action_type) || "Task",
      tag: text(task.tag),
      title: text(task.tag) || `${text(task.action_type) || "Task"} follow-up`,
      status: text(task.due_date) ? "scheduled" : "open",
      scheduled_at: text(task.due_date),
      created_at: text(task.created_at),
      source: "call_mode",
      company_id: companyId,
    })),
  ].filter((task) => task.id);

  const uniqueOpen = [...new Map(openTasks.map((task) => [task.id, task])).values()]
    .sort((a, b) => (a.scheduled_at || "9999").localeCompare(b.scheduled_at || "9999") || (b.created_at || "").localeCompare(a.created_at || ""));

  const activities: ActivityItem[] = [
    ...focus.map((task) => ({
      id: text(task.id),
      type: "Task",
      tag: text(task.tag),
      title: text(task.title) || "Task",
      status: boolish(task.done) ? "completed" : text(task.scheduled_at) ? "scheduled" : "open",
      scheduled_at: text(task.scheduled_at),
      completed_at: text(task.completed_at),
      created_at: text(task.created_at),
      source: text(task.source) || "focus",
      company_id: companyId,
    })),
    ...sales.map((task) => ({
      id: text(task.id),
      type: text(task.action_type) || "Task",
      tag: text(task.tag),
      title: text(task.tag) || `${text(task.action_type) || "Task"} follow-up`,
      status: boolish(task.completed) ? "completed" : text(task.due_date) ? "scheduled" : "open",
      scheduled_at: text(task.due_date),
      completed_at: text(task.completed_at),
      created_at: text(task.created_at),
      source: "call_mode",
      company_id: companyId,
    })),
    ...standalone.map((activity) => ({
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
    })),
  ].filter((item) => item.id);

  activities.sort((a, b) => (b.completed_at || b.scheduled_at || b.created_at || "").localeCompare(a.completed_at || a.scheduled_at || a.created_at || ""));
  const history = [...new Map(activities.map((item) => [`${item.source}:${item.id}`, item])).values()];
  const reviewDates = history.filter(isReviewActivity).map((item) => item.completed_at || item.created_at);
  const coordination = uniqueOpen.find((task) => task.tag.toLowerCase().includes("coordination") || task.title.toLowerCase().startsWith("coordination call -"));

  const rawContact = record(row.contact);
  const focusContact = focus
    .filter((task) => text(task.contact))
    .sort((a, b) => text(b.created_at).localeCompare(text(a.created_at)))[0];
  const contactName = text(rawContact.name) || text(focusContact?.contact);

  return {
    ok: true,
    client_id: input.clientId,
    company_id: companyId,
    requested_company: input.company,
    matched: true,
    linked_company: text(row.linked_company) || input.company,
    closest_company: text(row.linked_company) || input.company,
    match_method: "supabase-current-state",
    match_score: 1,
    contact: {
      name: contactName,
      role: text(rawContact.role),
      email: text(rawContact.email),
      phone: text(rawContact.phone),
      source: text(rawContact.source) || (contactName ? "supabase_current_state" : ""),
      prospect_id: text(rawContact.prospect_id),
    },
    has_open_tasks: uniqueOpen.length > 0,
    open_task_count: uniqueOpen.length,
    open_tasks: uniqueOpen,
    primary_open_task: uniqueOpen[0],
    coordination: {
      exists: Boolean(coordination),
      open: Boolean(coordination),
      task_id: coordination?.id || "",
      title: coordination?.title || "",
      scheduled_at: coordination?.scheduled_at || "",
      status: coordination ? "open" : "none",
    },
    last_account_review: text(row.last_account_review) || newest(reviewDates),
    recent_activity: history,
    synced_at: text(row.synced_at) || new Date().toISOString(),
  };
}

/**
 * Returns null only when the Phase 1 Supabase RPC has not been installed yet.
 * Callers can then fall back to the legacy company-scoped ledger reconstruction.
 */
export async function syncClientsFromCompassCurrentState(clients: SyncClientInput[]): Promise<CurrentStateBatchResult | null> {
  const cleaned = clients
    .map((client) => ({
      clientId: text(client.clientId),
      company: text(client.company),
      aliases: Array.isArray(client.aliases) ? client.aliases.filter(Boolean) : [],
      companyId: text(client.companyId),
    }))
    .filter((client) => client.clientId && client.company);
  if (!cleaned.length) return { results: [], pendingBatches: 0, totalBatches: 0 };

  const resolved = await resolveCompassCompanyIdsBulk(cleaned.map((client) => ({
    id: client.clientId,
    name: client.company,
    aliases: client.aliases,
    companyId: client.companyId,
  })));
  const hydrated = cleaned.map((client) => ({ ...client, companyId: isUuid(client.companyId) ? client.companyId : resolved.get(client.clientId) || "" }));
  const companyIds = [...new Set(hydrated.map((client) => client.companyId).filter(isUuid))];

  if (!companyIds.length) {
    return {
      results: hydrated.map((client) => ({ ok: true, client_id: client.clientId, requested_company: client.company, matched: false, synced_at: new Date().toISOString() })),
      pendingBatches: 0,
      totalBatches: 1,
    };
  }

  const rows: CurrentStateRow[] = [];
  const chunkSize = 80;
  const totalBatches = Math.max(1, Math.ceil(companyIds.length / chunkSize));
  try {
    for (let offset = 0; offset < companyIds.length; offset += chunkSize) {
      const page = await captainsLogCloudRest<CurrentStateRow[]>("POST", "rpc/client_compass_current_state", {
        p_company_ids: companyIds.slice(offset, offset + chunkSize),
        p_recent_limit: 40,
      });
      if (Array.isArray(page)) rows.push(...page);
    }
  } catch (cause) {
    if (rpcUnavailable(cause)) return null;
    throw cause;
  }

  const byCompanyId = new Map(rows.map((row) => [text(row.company_id), row]));
  return {
    results: hydrated.map((client) => client.companyId
      ? buildResult({ ...client, companyId: client.companyId }, byCompanyId.get(client.companyId))
      : { ok: true, client_id: client.clientId, requested_company: client.company, matched: false, synced_at: new Date().toISOString() }),
    pendingBatches: 0,
    totalBatches,
  };
}
