export interface CaptainsLogCoordinationCallRequest {
  clientId: string;
  company: string;
  dueDate: string;
  priorityReason?: string;
  requestId?: string;
}

export interface CaptainsLogSyncedContact {
  name: string;
  role: string;
  email: string;
  phone: string;
  source?: string;
  prospect_id?: string;
}

export interface CaptainsLogActivityItem {
  id: string;
  type: string;
  tag: string;
  title: string;
  status: "completed" | "scheduled" | "open" | string;
  scheduled_at: string;
  completed_at: string;
  created_at: string;
  source: string;
  company_id?: string;
}

export interface CaptainsLogOpenTask {
  id: string;
  type: string;
  tag: string;
  title: string;
  status: "scheduled" | "open" | string;
  scheduled_at: string;
  created_at: string;
  source: string;
  company_id?: string;
}

export interface CaptainsLogCoordinationState {
  exists: boolean;
  open: boolean;
  task_id: string;
  title: string;
  scheduled_at: string;
  status: string;
}

export interface CaptainsLogClientSyncResult {
  ok: boolean;
  client_id?: string;
  company_id?: string;
  requested_company?: string;
  matched?: boolean;
  linked_company?: string;
  closest_company?: string;
  match_method?: string;
  match_score?: number;
  contact?: CaptainsLogSyncedContact;
  has_open_tasks?: boolean;
  open_task_count?: number;
  open_tasks?: CaptainsLogOpenTask[];
  primary_open_task?: CaptainsLogOpenTask;
  coordination?: CaptainsLogCoordinationState;
  last_account_review?: string;
  recent_activity?: CaptainsLogActivityItem[];
  synced_at?: string;
  error?: string;
}

export interface CaptainsLogBridgeResult {
  ok: boolean;
  status?: string;
  task_id?: string;
  company?: string;
  company_id?: string;
  linked_company?: string;
  company_link_state?: string;
  match_method?: string;
  match_score?: number;
  scheduled_at?: string;
  sync?: CaptainsLogClientSyncResult;
  error?: string;
  request_id?: string;
}

export interface CaptainsLogBatchSyncResult {
  results: CaptainsLogClientSyncResult[];
  pendingBatches: number;
  totalBatches: number;
}

export function coordinationCallTaskTitle(company: string): string {
  const cleanCompany = String(company || "Client").trim() || "Client";
  return `Coordination Call - ${cleanCompany} - Account Review Priority`;
}

export function nextBusinessDate(from = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1, 12, 0, 0);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type JsonMap = Record<string, unknown>;

type SupabaseTaskEventRow = {
  event_id?: string;
  event_type?: string;
  local_task_id?: string;
  task_title?: string;
  tag?: string;
  parking_lot?: boolean;
  done?: boolean;
  occurred_at?: string;
  inserted_at?: string;
  metadata?: JsonMap;
  company_id?: string;
};

type SupabaseCallModeEventRow = {
  event_id?: string;
  event_type?: string;
  payload?: JsonMap;
  created_at?: string;
  inserted_at?: string;
  company_id?: string;
};

type DirectSyncClientInput = {
  clientId: string;
  company: string;
  aliases?: string[];
  companyId?: string;
};

type RebuiltFocusTask = {
  id: string;
  title: string;
  tag: string;
  done: boolean;
  deleted: boolean;
  scheduledAt: string;
  completedAt: string;
  createdAt: string;
  company: string;
  companyId: string;
  ambiguousCompanyId: boolean;
  contact: string;
  clientCompassClientId: string;
  source: string;
};

type RebuiltSalesTask = {
  id: string;
  company: string;
  companyId: string;
  ambiguousCompanyId: boolean;
  contact: string;
  phone: string;
  actionType: string;
  tag: string;
  dueDate: string;
  completed: boolean;
  deleted: boolean;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
};

type RebuiltSalesActivity = {
  id: string;
  company: string;
  companyId: string;
  type: string;
  title: string;
  createdAt: string;
};

type RebuiltContact = {
  company: string;
  companyId: string;
  name: string;
  phone: string;
  prospectId: string;
  updatedAt: string;
};

type SupabaseLedgerSnapshot = {
  taskEvents: SupabaseTaskEventRow[];
  callEvents: SupabaseCallModeEventRow[];
  loadedAt: number;
};

let ledgerCache: SupabaseLedgerSnapshot | null = null;
let ledgerPromise: Promise<SupabaseLedgerSnapshot> | null = null;
const LEDGER_CACHE_MS = 18_000;
const LEDGER_PAGE_SIZE = 1000;
const LEDGER_MAX_ROWS_PER_TABLE = 250_000;
const MAX_ID_ROWS = 20_000;

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

function normalizeCompanyName(value: string): string {
  return text(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(llc|pllc|pc|inc|corp|corporation|company|co)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value));
}

function exactCompanyMatch(left: string, right: string): boolean {
  const a = normalizeCompanyName(left);
  const b = normalizeCompanyName(right);
  return Boolean(a && b && a === b);
}

function companyIdFromTaskRow(row: SupabaseTaskEventRow): string {
  const meta = record(row.metadata);
  const patch = record(meta.patch);
  const mobile = record(meta.mobile_context);
  return text(row.company_id || patch.company_id || meta.company_id || mobile.company_id);
}

function companyFromTaskRow(row: SupabaseTaskEventRow): string {
  const meta = record(row.metadata);
  const patch = record(meta.patch);
  const mobile = record(meta.mobile_context);
  return text(patch.company || meta.company || mobile.company || meta.transcript_company);
}

function companyIdFromCallRow(row: SupabaseCallModeEventRow): string {
  const payload = record(row.payload);
  const salesTask = record(payload.sales_task);
  const prospect = record(payload.prospect);
  const activity = record(payload.activity);
  const extra = record(payload.extra);
  return text(row.company_id || payload.company_id || salesTask.company_id || prospect.company_id || activity.company_id || extra.company_id);
}

function companyFromCallRow(row: SupabaseCallModeEventRow): string {
  const payload = record(row.payload);
  const salesTask = record(payload.sales_task);
  const prospect = record(payload.prospect);
  const activity = record(payload.activity);
  const extra = record(payload.extra);
  return text(salesTask.company || prospect.company || activity.company || extra.company);
}

function applyCompanyIdentity(currentId: string, incomingId: string, ambiguous: boolean): { companyId: string; ambiguous: boolean } {
  const next = text(incomingId);
  if (!next) return { companyId: currentId, ambiguous };
  if (!currentId) return { companyId: next, ambiguous };
  if (currentId === next) return { companyId: currentId, ambiguous };
  return { companyId: currentId, ambiguous: true };
}

async function fetchAllRows<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const { captainsLogCloudRest } = await import("./captains-log-cloud");
  const rows: T[] = [];
  for (let offset = 0; offset < LEDGER_MAX_ROWS_PER_TABLE; offset += LEDGER_PAGE_SIZE) {
    const page = await captainsLogCloudRest<T[]>("GET", path, undefined, {
      ...params,
      limit: String(LEDGER_PAGE_SIZE),
      offset: String(offset),
    });
    if (!Array.isArray(page)) break;
    rows.push(...page);
    if (page.length < LEDGER_PAGE_SIZE) return rows;
  }
  throw new Error(`Supabase ${path} history exceeded ${LEDGER_MAX_ROWS_PER_TABLE.toLocaleString()} rows. Client Compass stopped instead of silently using an incomplete history.`);
}

async function loadSupabaseLedger(force = false): Promise<SupabaseLedgerSnapshot> {
  if (!force && ledgerCache && Date.now() - ledgerCache.loadedAt < LEDGER_CACHE_MS) return ledgerCache;
  if (!force && ledgerPromise) return ledgerPromise;
  ledgerPromise = (async () => {
    const [taskEvents, callEvents] = await Promise.all([
      fetchAllRows<SupabaseTaskEventRow>("task_events", {
        select: "event_id,event_type,local_task_id,task_title,tag,parking_lot,done,occurred_at,inserted_at,metadata,company_id",
        order: "occurred_at.asc,event_id.asc",
      }),
      fetchAllRows<SupabaseCallModeEventRow>("app_events", {
        select: "event_id,event_type,payload,created_at,inserted_at,company_id",
        event_type: "eq.call_mode_event",
        order: "created_at.asc,event_id.asc",
      }),
    ]);
    ledgerCache = { taskEvents, callEvents, loadedAt: Date.now() };
    return ledgerCache;
  })();
  try { return await ledgerPromise; }
  finally { ledgerPromise = null; }
}

async function loadSupabaseLedgerForCompanyIds(companyIds: string[]): Promise<SupabaseLedgerSnapshot> {
  const unique = [...new Set(companyIds.map(text).filter(isUuid))];
  if (!unique.length) return { taskEvents: [], callEvents: [], loadedAt: Date.now() };

  const taskEvents: SupabaseTaskEventRow[] = [];
  const callEvents: SupabaseCallModeEventRow[] = [];
  const chunkSize = 40;
  for (let offset = 0; offset < unique.length; offset += chunkSize) {
    const chunk = unique.slice(offset, offset + chunkSize);
    const companyFilter = `in.(${chunk.join(",")})`;
    const [tasks, calls] = await Promise.all([
      fetchAllRows<SupabaseTaskEventRow>("task_events", {
        select: "event_id,event_type,local_task_id,task_title,tag,parking_lot,done,occurred_at,inserted_at,metadata,company_id",
        company_id: companyFilter,
        order: "inserted_at.asc,event_id.asc",
      }),
      fetchAllRows<SupabaseCallModeEventRow>("app_events", {
        select: "event_id,event_type,payload,created_at,inserted_at,company_id",
        event_type: "eq.call_mode_event",
        company_id: companyFilter,
        order: "inserted_at.asc,event_id.asc",
      }),
    ]);
    taskEvents.push(...tasks);
    callEvents.push(...calls);
  }
  return { taskEvents, callEvents, loadedAt: Date.now() };
}

async function companyIdsForCompassClients(clientIds: string[]): Promise<Map<string, string>> {
  const { captainsLogCloudRest } = await import("./captains-log-cloud");
  const wanted = [...new Set(clientIds.map(text).filter(Boolean))];
  if (!wanted.length) return new Map();
  const result = new Map<string, string>();
  const chunkSize = 100;
  for (let offset = 0; offset < wanted.length; offset += chunkSize) {
    const chunk = wanted.slice(offset, offset + chunkSize);
    const rows = await captainsLogCloudRest<Array<{ company_id?: string; external_id?: string }>>("GET", "company_external_ids", undefined, {
      select: "company_id,external_id",
      source: "eq.client_compass",
      external_id: `in.(${chunk.map((id) => JSON.stringify(id)).join(",")})`,
      limit: String(chunk.length),
    });
    for (const row of Array.isArray(rows) ? rows : []) {
      const externalId = text(row.external_id);
      const companyId = text(row.company_id);
      if (chunk.includes(externalId) && isUuid(companyId)) result.set(externalId, companyId);
    }
  }
  return result;
}

async function ensureCompanyId(clientId: string, company: string): Promise<string> {
  const existing = await companyIdsForCompassClients([clientId]);
  const known = existing.get(clientId);
  if (known) return known;
  const { captainsLogCloudRest } = await import("./captains-log-cloud");
  const created = await captainsLogCloudRest<string>("POST", "rpc/ensure_company_identity", {
    p_display_name: company,
    p_aliases: [],
    p_source: "client_compass",
    p_external_id: clientId,
  });
  const companyId = text(created);
  if (!isUuid(companyId)) throw new Error(`Supabase did not establish a universal company UUID for ${company}.`);
  return companyId;
}

function rebuildFocusTasks(rows: SupabaseTaskEventRow[]): RebuiltFocusTask[] {
  const byId = new Map<string, RebuiltFocusTask>();
  for (const row of rows) {
    const id = text(row.local_task_id);
    if (!id) continue;
    const meta = record(row.metadata);
    const patch = record(meta.patch);
    const mobile = record(meta.mobile_context);
    const eventType = text(row.event_type).toLowerCase().replace(/_retro$/, "");
    const when = text(row.occurred_at || row.inserted_at);
    const incomingCompanyId = companyIdFromTaskRow(row);
    const current = byId.get(id) ?? {
      id,
      title: text(row.task_title) || "Task",
      tag: text(row.tag),
      done: false,
      deleted: false,
      scheduledAt: "",
      completedAt: "",
      createdAt: text(meta.created_at) || when,
      company: "",
      companyId: "",
      ambiguousCompanyId: false,
      contact: "",
      clientCompassClientId: "",
      source: "focus",
    };
    const identity = applyCompanyIdentity(current.companyId, incomingCompanyId, current.ambiguousCompanyId);
    current.companyId = identity.companyId;
    current.ambiguousCompanyId = identity.ambiguous;
    if (text(row.task_title)) current.title = text(row.task_title);
    if (text(row.tag)) current.tag = text(row.tag);
    current.company = companyFromTaskRow(row) || current.company;
    current.contact = text(patch.contact || meta.contact || mobile.contact || meta.transcript_contact) || current.contact;
    current.clientCompassClientId = text(patch.client_compass_client_id || meta.client_compass_client_id || mobile.client_compass_client_id) || current.clientCompassClientId;
    current.source = text(patch.source || meta.source) || current.source;
    if (Object.prototype.hasOwnProperty.call(patch, "title")) current.title = text(patch.title) || current.title;
    if (Object.prototype.hasOwnProperty.call(patch, "tag")) current.tag = text(patch.tag) || current.tag;
    if (Object.prototype.hasOwnProperty.call(patch, "scheduled_at")) current.scheduledAt = text(patch.scheduled_at);
    else if (Object.prototype.hasOwnProperty.call(meta, "scheduled_at")) current.scheduledAt = text(meta.scheduled_at);
    if (Object.prototype.hasOwnProperty.call(patch, "completed_at")) current.completedAt = text(patch.completed_at);
    if (Object.prototype.hasOwnProperty.call(patch, "done")) current.done = boolish(patch.done);
    else if (row.done !== undefined && eventType !== "task_created") current.done = Boolean(row.done);

    if (eventType === "task_deleted" || eventType === "task_removed") current.deleted = true;
    else if (eventType.includes("reopened")) { current.deleted = false; current.done = false; current.completedAt = ""; }
    else if (eventType.includes("completed")) { current.done = true; current.completedAt = text(meta.completed_at) || when; current.scheduledAt = ""; }
    else if (eventType.includes("unscheduled")) current.scheduledAt = "";
    else if (eventType.includes("scheduled")) { if (!current.done) current.scheduledAt = text(meta.scheduled_at) || current.scheduledAt; }
    else if (eventType.startsWith("task_created")) { current.deleted = false; if (!current.done) current.done = Boolean(row.done); }
    byId.set(id, current);
  }
  return [...byId.values()].filter((task) => !task.deleted && !task.ambiguousCompanyId);
}

function rebuildCallMode(rows: SupabaseCallModeEventRow[]) {
  const tasks = new Map<string, RebuiltSalesTask>();
  const activities: RebuiltSalesActivity[] = [];
  const contacts: RebuiltContact[] = [];

  rows.forEach((row, index) => {
    const payload = record(row.payload);
    if (text(payload.schema) !== "call_mode_v1") return;
    const eventType = text(payload.call_event_type).toLowerCase();
    const occurredAt = text(payload.occurred_at || row.created_at || row.inserted_at);
    const companyId = companyIdFromCallRow(row);
    const company = companyFromCallRow(row);
    const prospect = record(payload.prospect);
    const prospectId = text(prospect.id);
    const contactName = text(prospect.contact);
    const contactPhone = text(prospect.phone);
    if ((companyId || company) && (contactName || contactPhone)) {
      contacts.push({ company, companyId, name: contactName, phone: contactPhone, prospectId, updatedAt: text(prospect.updated_at) || occurredAt });
    }

    const salesTask = record(payload.sales_task);
    const taskId = text(salesTask.id);
    if (taskId) {
      const current = tasks.get(taskId) ?? {
        id: taskId,
        company: "",
        companyId: "",
        ambiguousCompanyId: false,
        contact: "",
        phone: "",
        actionType: "Call",
        tag: "",
        dueDate: "",
        completed: false,
        deleted: false,
        completedAt: "",
        createdAt: occurredAt,
        updatedAt: occurredAt,
      };
      const identity = applyCompanyIdentity(current.companyId, companyId, current.ambiguousCompanyId);
      current.companyId = identity.companyId;
      current.ambiguousCompanyId = identity.ambiguous;
      current.company = text(salesTask.company) || company || current.company;
      current.contact = text(salesTask.contact) || current.contact;
      current.phone = text(salesTask.phone) || current.phone;
      current.actionType = text(salesTask.action_type) || current.actionType;
      if (Object.prototype.hasOwnProperty.call(salesTask, "task_tag")) current.tag = text(salesTask.task_tag);
      if (Object.prototype.hasOwnProperty.call(salesTask, "due_date")) current.dueDate = text(salesTask.due_date);
      if (Object.prototype.hasOwnProperty.call(salesTask, "completed")) current.completed = boolish(salesTask.completed);
      current.completedAt = text(salesTask.completed_at) || current.completedAt;
      current.updatedAt = text(salesTask.updated_at) || occurredAt || current.updatedAt;
      if (eventType === "task_deleted" || eventType === "prospect_deleted") current.deleted = true;
      else if (eventType === "task_completed" || eventType === "queue_closed") { current.completed = true; current.completedAt = current.completedAt || occurredAt; }
      else if (eventType === "task_reopened" || eventType === "queue_restored") { current.deleted = false; current.completed = false; current.completedAt = ""; }
      tasks.set(taskId, current);
    }

    const activity = record(payload.activity);
    if (Object.keys(activity).length) {
      activities.push({
        id: text(activity.id) || `activity-${text(row.event_id) || index}`,
        company: text(activity.company) || company,
        companyId: text(activity.company_id) || companyId,
        type: text(activity.activity_type) || "Activity",
        title: text(activity.label) || "Client activity",
        createdAt: text(activity.created_at) || occurredAt,
      });
    }
  });

  return {
    tasks: [...tasks.values()].filter((task) => !task.deleted && !task.ambiguousCompanyId),
    activities,
    contacts,
  };
}

function rowBelongsToClient(companyId: string, company: string, input: DirectSyncClientInput): boolean {
  if (input.companyId) return Boolean(companyId && companyId === input.companyId);
  if (companyId) return false;
  return [input.company, ...(input.aliases || [])].some((candidate) => exactCompanyMatch(company, candidate));
}

function isReviewActivity(item: CaptainsLogActivityItem): boolean {
  if (text(item.status).toLowerCase() !== "completed") return false;
  const title = text(item.title).toLowerCase();
  const tag = text(item.tag).toLowerCase().replace(/[\s_-]+/g, " ").trim();
  if (title.startsWith("coordination call -") || ["client coordination", "coordination"].includes(tag)) return false;
  return tag === "account review" || tag === "account management" || title.includes("account review");
}

function newest(values: string[]): string {
  return values.filter(Boolean).sort().at(-1) || "";
}

function buildClientSnapshotsFromLedger(ledger: SupabaseLedgerSnapshot, clients: DirectSyncClientInput[]): CaptainsLogClientSyncResult[] {
  const focusTasks = rebuildFocusTasks(ledger.taskEvents);
  const callMode = rebuildCallMode(ledger.callEvents);
  const syncedAt = new Date().toISOString();

  return clients.map((input) => {
    const focus = focusTasks.filter((task) => rowBelongsToClient(task.companyId, task.company, input));
    const sales = callMode.tasks.filter((task) => rowBelongsToClient(task.companyId, task.company, input));
    const salesActivity = callMode.activities.filter((activity) => rowBelongsToClient(activity.companyId, activity.company, input));
    const contacts = callMode.contacts.filter((contact) => rowBelongsToClient(contact.companyId, contact.company, input)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const primaryContact = contacts[0];

    const openTasks: CaptainsLogOpenTask[] = [
      ...focus.filter((task) => !task.done).map((task) => ({
        id: task.id,
        type: "Task",
        tag: task.tag,
        title: task.title,
        status: task.scheduledAt ? "scheduled" : "open",
        scheduled_at: task.scheduledAt,
        created_at: task.createdAt,
        source: task.source || "focus",
        company_id: task.companyId || undefined,
      })),
      ...sales.filter((task) => !task.completed).map((task) => ({
        id: task.id,
        type: task.actionType || "Task",
        tag: task.tag,
        title: task.tag || `${task.actionType || "Task"} follow-up`,
        status: task.dueDate ? "scheduled" : "open",
        scheduled_at: task.dueDate,
        created_at: task.createdAt,
        source: "call_mode",
        company_id: task.companyId || undefined,
      })),
    ];
    const uniqueOpen = [...new Map(openTasks.map((task) => [task.id, task])).values()]
      .sort((a, b) => (a.scheduled_at || "9999").localeCompare(b.scheduled_at || "9999") || (b.created_at || "").localeCompare(a.created_at || ""));

    const activities: CaptainsLogActivityItem[] = [
      ...focus.map((task) => ({
        id: task.id,
        type: "Task",
        tag: task.tag,
        title: task.title,
        status: task.done ? "completed" : task.scheduledAt ? "scheduled" : "open",
        scheduled_at: task.scheduledAt,
        completed_at: task.completedAt,
        created_at: task.createdAt,
        source: task.source || "focus",
        company_id: task.companyId || undefined,
      })),
      ...sales.map((task) => ({
        id: task.id,
        type: task.actionType || "Task",
        tag: task.tag,
        title: task.tag || `${task.actionType || "Task"} follow-up`,
        status: task.completed ? "completed" : task.dueDate ? "scheduled" : "open",
        scheduled_at: task.dueDate,
        completed_at: task.completedAt,
        created_at: task.createdAt,
        source: "call_mode",
        company_id: task.companyId || undefined,
      })),
      ...salesActivity.map((activity) => ({
        id: activity.id,
        type: activity.type,
        tag: "",
        title: activity.title,
        status: "completed",
        scheduled_at: "",
        completed_at: activity.createdAt,
        created_at: activity.createdAt,
        source: "sales_activity",
        company_id: activity.companyId || undefined,
      })),
    ];
    activities.sort((a, b) => (b.completed_at || b.scheduled_at || b.created_at || "").localeCompare(a.completed_at || a.scheduled_at || a.created_at || ""));
    const activityHistory = [...new Map(activities.map((item) => [`${item.source}:${item.id}`, item])).values()];
    const reviewDates = activityHistory.filter(isReviewActivity).map((item) => item.completed_at || item.created_at);
    const coordinationTask = uniqueOpen.find((task) => task.tag.toLowerCase().includes("coordination") || task.title.toLowerCase().startsWith("coordination call -"));
    const hasAnyHistory = activityHistory.length > 0 || uniqueOpen.length > 0 || Boolean(primaryContact);
    const matched = Boolean(input.companyId) || hasAnyHistory;

    return {
      ok: true,
      client_id: input.clientId,
      company_id: input.companyId || "",
      requested_company: input.company,
      matched,
      linked_company: matched ? input.company : "",
      closest_company: matched ? input.company : "",
      match_method: input.companyId ? "supabase-company-id" : hasAnyHistory ? "supabase-exact-legacy" : "none",
      match_score: matched ? 1 : 0,
      contact: {
        name: primaryContact?.name || focus.find((task) => task.contact)?.contact || "",
        role: "",
        email: "",
        phone: primaryContact?.phone || "",
        source: primaryContact ? "supabase_call_mode" : "supabase_task_events",
        prospect_id: primaryContact?.prospectId || "",
      },
      has_open_tasks: uniqueOpen.length > 0,
      open_task_count: uniqueOpen.length,
      open_tasks: uniqueOpen,
      primary_open_task: uniqueOpen[0],
      coordination: {
        exists: Boolean(coordinationTask),
        open: Boolean(coordinationTask),
        task_id: coordinationTask?.id || "",
        title: coordinationTask?.title || "",
        scheduled_at: coordinationTask?.scheduled_at || "",
        status: coordinationTask ? "open" : "none",
      },
      last_account_review: newest(reviewDates),
      recent_activity: activityHistory,
      synced_at: syncedAt,
    };
  });
}

async function hydrateClientCompanyIds(clients: DirectSyncClientInput[]): Promise<DirectSyncClientInput[]> {
  const ids = await companyIdsForCompassClients(clients.map((client) => client.clientId));
  return clients.map((client) => ({ ...client, companyId: client.companyId || ids.get(client.clientId) || "" }));
}

export async function checkCaptainsLogCloudBridge(): Promise<boolean> {
  try {
    const { getCaptainsLogCloudAuthSnapshot, captainsLogCloudRest } = await import("./captains-log-cloud");
    const snapshot = getCaptainsLogCloudAuthSnapshot();
    if (!snapshot.configured || !snapshot.signedIn) return false;
    await Promise.all([
      captainsLogCloudRest<unknown[]>("GET", "task_events", undefined, { select: "event_id", limit: "1" }),
      captainsLogCloudRest<unknown[]>("GET", "app_events", undefined, { select: "event_id", event_type: "eq.call_mode_event", limit: "1" }),
    ]);
    return true;
  } catch { return false; }
}

export async function syncClientFromCaptainsLog(
  clientId: string,
  company: string,
  _timeoutMs = 7000,
  aliases: string[] = [],
): Promise<CaptainsLogClientSyncResult> {
  const [input] = await hydrateClientCompanyIds([{ clientId: text(clientId), company: text(company), aliases }]);
  const ledger = await loadSupabaseLedgerForCompanyIds(input?.companyId ? [input.companyId] : []);
  return buildClientSnapshotsFromLedger(ledger, [input])[0] ?? {
    ok: false,
    client_id: clientId,
    requested_company: company,
    synced_at: "",
    error: "No Supabase history was returned.",
  };
}

export async function syncClientsFromCaptainsLog(
  clients: Array<{ clientId: string; company: string; aliases?: string[]; companyId?: string }>,
  _timeoutMs = 24000,
): Promise<CaptainsLogBatchSyncResult> {
  const cleaned = clients
    .map((client) => ({
      clientId: text(client.clientId),
      company: text(client.company),
      aliases: Array.isArray(client.aliases) ? client.aliases.filter(Boolean) : [],
      companyId: text(client.companyId),
    }))
    .filter((client) => client.clientId && client.company);
  if (!cleaned.length) return { results: [], pendingBatches: 0, totalBatches: 0 };
  const hydrated = await hydrateClientCompanyIds(cleaned);
  const ledger = await loadSupabaseLedgerForCompanyIds(hydrated.map((client) => client.companyId || ""));
  return { results: buildClientSnapshotsFromLedger(ledger, hydrated), pendingBatches: 0, totalBatches: 1 };
}

export async function sendCoordinationCallToCaptainsLogReliable(
  request: CaptainsLogCoordinationCallRequest,
  _timeoutMs = 9000,
): Promise<CaptainsLogBridgeResult> {
  const { captainsLogCloudRest } = await import("./captains-log-cloud");
  const companyId = await ensureCompanyId(request.clientId, request.company);
  const requestId = request.requestId?.trim().slice(0, 100) || (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `cc-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const taskId = `client-compass-${requestId}`;
  const now = new Date().toISOString();
  const row = {
    event_id: `client_compass_task:${requestId}`,
    event_type: "task_created",
    local_task_id: taskId,
    task_title: coordinationCallTaskTitle(request.company),
    tag: "Client Coordination",
    parking_lot: false,
    done: false,
    occurred_at: now,
    device_name: "Client Compass",
    company_id: companyId,
    metadata: {
      created_at: now,
      updated_at: now,
      scheduled_at: request.dueDate,
      company: request.company,
      company_id: companyId,
      source: "client_compass",
      client_compass_client_id: request.clientId,
      client_compass_request_id: requestId,
      client_compass_reason: request.priorityReason || "",
      mobile_context: { company: request.company, company_id: companyId },
    },
  };
  await captainsLogCloudRest<null>("POST", "task_events", [row], { on_conflict: "event_id" }, "resolution=ignore-duplicates,return=minimal");
  ledgerCache = null;

  let sync: CaptainsLogClientSyncResult | undefined;
  try { sync = await syncClientFromCaptainsLog(request.clientId, request.company, 7000); }
  catch { /* task is committed; a later refresh can repopulate the local snapshot */ }

  return {
    ok: true,
    status: "created",
    task_id: taskId,
    company: request.company,
    company_id: companyId,
    linked_company: sync?.linked_company || request.company,
    company_link_state: "universal-id",
    match_method: "supabase-company-id",
    match_score: 1,
    scheduled_at: request.dueDate,
    sync,
    request_id: requestId,
  };
}

import type { CompassClient } from "./types";

function dateOnly(value: string): string {
  return text(value).slice(0, 10);
}

function newestDate(current: string, incoming: string): string {
  const next = dateOnly(incoming);
  if (!next) return current;
  const existing = dateOnly(current);
  return !existing || next > existing ? next : current;
}

export function mergeCaptainsLogSyncIntoClient(client: CompassClient, sync: CaptainsLogClientSyncResult): CompassClient {
  const contact = sync.contact ?? { name: "", role: "", email: "", phone: "" };
  const companyId = text(sync.company_id || client.companyId);
  const safeOpen = (sync.open_tasks ?? []).filter((task) => !companyId || task.company_id === companyId);
  const safeActivity = (sync.recent_activity ?? []).filter((item) => !companyId || item.company_id === companyId);
  const newestActivity = safeActivity.map((item) => item.completed_at || item.scheduled_at || item.created_at).filter(Boolean).sort().at(-1) || "";
  return {
    ...client,
    companyId: companyId || client.companyId,
    primaryContact: contact.name || client.primaryContact,
    primaryContactRole: contact.role || client.primaryContactRole,
    primaryContactEmail: contact.email || client.primaryContactEmail,
    primaryContactPhone: contact.phone || client.primaryContactPhone,
    lastAccountReview: newestDate(client.lastAccountReview, sync.last_account_review || ""),
    lastSalesInteraction: newestDate(client.lastSalesInteraction, newestActivity),
    captainsLog: {
      matched: Boolean(sync.matched),
      companyId,
      linkedCompany: sync.linked_company || "",
      closestCompany: sync.closest_company || "",
      matchMethod: sync.match_method || "",
      matchScore: Number(sync.match_score || 0),
      syncedAt: sync.synced_at || new Date().toISOString(),
      openTaskCount: safeOpen.length,
      openTasks: safeOpen.map((task) => ({
        id: task.id || "",
        type: task.type || "Task",
        tag: task.tag || "",
        title: task.title || "Task",
        status: task.status || "open",
        scheduledAt: task.scheduled_at || "",
        createdAt: task.created_at || "",
        source: task.source || "",
        companyId: task.company_id || companyId,
      })),
      recentActivity: safeActivity.map((item) => ({
        id: item.id || "",
        type: item.type || "Activity",
        tag: item.tag || "",
        title: item.title || "Activity",
        status: item.status || "",
        scheduledAt: item.scheduled_at || "",
        completedAt: item.completed_at || "",
        createdAt: item.created_at || "",
        source: item.source || "",
        companyId: item.company_id || companyId,
      })),
    },
  };
}
