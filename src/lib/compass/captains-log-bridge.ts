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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}


type JsonMap = Record<string, unknown>;

interface SupabaseTaskEventRow {
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
}

interface SupabaseCallModeEventRow {
  event_id?: string;
  event_type?: string;
  payload?: JsonMap;
  created_at?: string;
  inserted_at?: string;
}

interface DirectSyncClientInput {
  clientId: string;
  company: string;
  aliases?: string[];
}

interface RebuiltFocusTask {
  id: string;
  title: string;
  tag: string;
  done: boolean;
  deleted: boolean;
  scheduledAt: string;
  completedAt: string;
  createdAt: string;
  company: string;
  contact: string;
  source: string;
}

interface RebuiltProspect {
  id: string;
  company: string;
  contact: string;
  phone: string;
  status: string;
  updatedAt: string;
  deleted: boolean;
}

interface RebuiltSalesTask {
  id: string;
  prospectId: string;
  company: string;
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
}

interface RebuiltSalesActivity {
  id: string;
  prospectId: string;
  company: string;
  type: string;
  title: string;
  createdAt: string;
}

interface SupabaseLedgerSnapshot {
  taskEvents: SupabaseTaskEventRow[];
  callEvents: SupabaseCallModeEventRow[];
  loadedAt: number;
}

let ledgerCache: SupabaseLedgerSnapshot | null = null;
let ledgerPromise: Promise<SupabaseLedgerSnapshot> | null = null;
const LEDGER_CACHE_MS = 18_000;
const LEDGER_PAGE_SIZE = 1000;
const LEDGER_MAX_ROWS_PER_TABLE = 60_000;

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
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(llc|pllc|pc|inc|corp|corporation|company|co)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function companyTokens(value: string): Set<string> {
  return new Set(normalizeCompanyName(value).split(" ").filter((token) => token.length > 1));
}

function companySimilarity(left: string, right: string): number {
  const a = normalizeCompanyName(left);
  const b = normalizeCompanyName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length >= 7 && b.length >= 7 && (a.includes(b) || b.includes(a))) return 0.93;
  const aa = companyTokens(a);
  const bb = companyTokens(b);
  if (!aa.size || !bb.size) return 0;
  let intersection = 0;
  aa.forEach((token) => { if (bb.has(token)) intersection += 1; });
  const union = new Set([...aa, ...bb]).size;
  const jaccard = union ? intersection / union : 0;
  const containment = intersection / Math.min(aa.size, bb.size);
  return Math.min(0.91, Math.max(jaccard, containment * 0.9));
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
        select: "event_id,event_type,local_task_id,task_title,tag,parking_lot,done,occurred_at,inserted_at,metadata",
        order: "occurred_at.asc,event_id.asc",
      }),
      fetchAllRows<SupabaseCallModeEventRow>("app_events", {
        select: "event_id,event_type,payload,created_at,inserted_at",
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

function rebuildFocusTasks(rows: SupabaseTaskEventRow[]): RebuiltFocusTask[] {
  const byId = new Map<string, RebuiltFocusTask>();
  rows.forEach((row) => {
    const id = text(row.local_task_id);
    if (!id) return;
    const meta = record(row.metadata);
    const patch = record(meta.patch);
    const mobile = record(meta.mobile_context);
    const eventType = text(row.event_type).toLowerCase().replace(/_retro$/, "");
    const when = text(row.occurred_at || row.inserted_at);
    const current = byId.get(id) ?? {
      id, title: text(row.task_title) || "Task", tag: text(row.tag), done: false, deleted: false,
      scheduledAt: "", completedAt: "", createdAt: text(meta.created_at) || when,
      company: "", contact: "", source: "focus",
    };
    if (text(row.task_title)) current.title = text(row.task_title);
    if (text(row.tag)) current.tag = text(row.tag);
    current.company = text(patch.company || meta.company || mobile.company || meta.transcript_company) || current.company;
    current.contact = text(patch.contact || meta.contact || mobile.contact || meta.transcript_contact) || current.contact;
    current.source = text(patch.source || meta.source) || current.source;
    if (Object.prototype.hasOwnProperty.call(patch, "title")) current.title = text(patch.title) || current.title;
    if (Object.prototype.hasOwnProperty.call(patch, "tag")) current.tag = text(patch.tag) || current.tag;
    if (Object.prototype.hasOwnProperty.call(patch, "scheduled_at")) current.scheduledAt = text(patch.scheduled_at);
    else if (Object.prototype.hasOwnProperty.call(meta, "scheduled_at")) current.scheduledAt = text(meta.scheduled_at);
    if (Object.prototype.hasOwnProperty.call(patch, "completed_at")) current.completedAt = text(patch.completed_at);
    if (Object.prototype.hasOwnProperty.call(patch, "done")) current.done = boolish(patch.done);
    else if (row.done !== undefined && eventType !== "task_created") current.done = Boolean(row.done);

    if (eventType === "task_deleted" || eventType === "task_removed") current.deleted = true;
    else if (eventType === "task_reopened" || eventType.includes("reopened")) {
      current.deleted = false; current.done = false; current.completedAt = "";
    } else if (eventType === "task_completed" || eventType.includes("completed")) {
      current.done = true; current.completedAt = text(meta.completed_at) || when; current.scheduledAt = "";
    } else if (eventType === "task_scheduled" || eventType.includes("task_scheduled")) {
      if (!current.done) current.scheduledAt = text(meta.scheduled_at) || current.scheduledAt;
    } else if (eventType === "task_unscheduled" || eventType.includes("task_unscheduled")) {
      current.scheduledAt = "";
    } else if (eventType === "task_created" || eventType.startsWith("task_created")) {
      current.deleted = false;
      current.done = Boolean(row.done);
    }
    byId.set(id, current);
  });
  return [...byId.values()].filter((task) => !task.deleted);
}

function rebuildCallMode(rows: SupabaseCallModeEventRow[]) {
  const prospects = new Map<string, RebuiltProspect>();
  const tasks = new Map<string, RebuiltSalesTask>();
  const activities: RebuiltSalesActivity[] = [];

  rows.forEach((row, index) => {
    const payload = record(row.payload);
    if (text(payload.schema) !== "call_mode_v1") return;
    const eventType = text(payload.call_event_type).toLowerCase();
    const occurredAt = text(payload.occurred_at || row.created_at || row.inserted_at);
    const prospect = record(payload.prospect);
    const prospectId = text(prospect.id);
    if (prospectId) {
      const current = prospects.get(prospectId) ?? { id: prospectId, company: "", contact: "", phone: "", status: "active", updatedAt: "", deleted: false };
      if (Object.prototype.hasOwnProperty.call(prospect, "company")) current.company = text(prospect.company) || current.company;
      if (Object.prototype.hasOwnProperty.call(prospect, "contact")) current.contact = text(prospect.contact);
      if (Object.prototype.hasOwnProperty.call(prospect, "phone")) current.phone = text(prospect.phone);
      if (Object.prototype.hasOwnProperty.call(prospect, "status")) current.status = text(prospect.status) || current.status;
      current.updatedAt = text(prospect.updated_at) || occurredAt || current.updatedAt;
      if (eventType === "prospect_deleted") current.deleted = true;
      else if (eventType === "prospect_upsert" || eventType === "queue_restored") current.deleted = false;
      prospects.set(prospectId, current);
    }

    const salesTask = record(payload.sales_task);
    const taskId = text(salesTask.id);
    if (taskId) {
      const current = tasks.get(taskId) ?? {
        id: taskId, prospectId: "", company: "", contact: "", phone: "", actionType: "Call", tag: "",
        dueDate: "", completed: false, deleted: false, completedAt: "", createdAt: occurredAt, updatedAt: occurredAt,
      };
      if (Object.prototype.hasOwnProperty.call(salesTask, "prospect_id")) current.prospectId = text(salesTask.prospect_id) || current.prospectId;
      if (Object.prototype.hasOwnProperty.call(salesTask, "company")) current.company = text(salesTask.company) || current.company;
      if (Object.prototype.hasOwnProperty.call(salesTask, "contact")) current.contact = text(salesTask.contact);
      if (Object.prototype.hasOwnProperty.call(salesTask, "phone")) current.phone = text(salesTask.phone);
      if (Object.prototype.hasOwnProperty.call(salesTask, "action_type")) current.actionType = text(salesTask.action_type) || current.actionType;
      if (Object.prototype.hasOwnProperty.call(salesTask, "task_tag")) current.tag = text(salesTask.task_tag);
      if (Object.prototype.hasOwnProperty.call(salesTask, "due_date")) current.dueDate = text(salesTask.due_date);
      if (Object.prototype.hasOwnProperty.call(salesTask, "completed")) current.completed = boolish(salesTask.completed);
      current.completedAt = text(salesTask.completed_at) || current.completedAt;
      current.updatedAt = text(salesTask.updated_at) || occurredAt || current.updatedAt;
      if (eventType === "task_deleted" || eventType === "prospect_deleted") current.deleted = true;
      else if (eventType === "task_completed" || eventType === "queue_closed") {
        current.completed = true; current.completedAt = current.completedAt || occurredAt;
      } else if (eventType === "task_reopened" || eventType === "queue_restored") {
        current.deleted = false; current.completed = false; current.completedAt = "";
      }
      tasks.set(taskId, current);
    }

    const activity = record(payload.activity);
    if (Object.keys(activity).length) {
      const linkedProspectId = prospectId || text(activity.prospect_id);
      const linked = prospects.get(linkedProspectId);
      activities.push({
        id: text(activity.id) || `activity-${text(row.event_id) || index}`,
        prospectId: linkedProspectId,
        company: text(prospect.company) || linked?.company || "",
        type: text(activity.activity_type) || "Activity",
        title: text(activity.label) || "Client activity",
        createdAt: text(activity.created_at) || occurredAt,
      });
    }
  });
  return { prospects, tasks, activities };
}

function bestCompanyMatch(input: DirectSyncClientInput, companies: string[]) {
  const candidates = [input.company, ...(input.aliases || [])].filter(Boolean);
  let best = { company: "", score: 0 };
  for (const known of companies) {
    for (const candidate of candidates) {
      const score = companySimilarity(candidate, known);
      if (score > best.score) best = { company: known, score };
    }
  }
  return { ...best, matched: best.score >= 0.72, method: best.score === 1 ? "supabase-exact" : best.score >= 0.72 ? "supabase-fuzzy" : "none" };
}

function newest(values: string[]): string {
  return values.filter(Boolean).sort().at(-1) || "";
}

function isReviewActivity(item: CaptainsLogActivityItem): boolean {
  if (String(item.status || "").toLowerCase() !== "completed") return false;
  const title = String(item.title || "").toLowerCase();
  const tag = String(item.tag || "").toLowerCase().replace(/[\s_-]+/g, " ").trim();
  if (title.startsWith("coordination call -") || ["client coordination", "coordination"].includes(tag)) return false;
  return tag === "account review" || tag === "account management" || title.includes("account review");
}

function buildClientSnapshotsFromLedger(ledger: SupabaseLedgerSnapshot, clients: DirectSyncClientInput[]): CaptainsLogClientSyncResult[] {
  const focusTasks = rebuildFocusTasks(ledger.taskEvents);
  const callMode = rebuildCallMode(ledger.callEvents);
  const knownCompanies = new Set<string>();
  focusTasks.forEach((task) => { if (task.company) knownCompanies.add(task.company); });
  callMode.prospects.forEach((prospect) => { if (!prospect.deleted && prospect.company) knownCompanies.add(prospect.company); });
  callMode.tasks.forEach((task) => { if (!task.deleted && task.company) knownCompanies.add(task.company); });
  callMode.activities.forEach((activity) => { if (activity.company) knownCompanies.add(activity.company); });
  const known = [...knownCompanies];
  const syncedAt = new Date().toISOString();

  return clients.map((input) => {
    const match = bestCompanyMatch(input, known);
    const matchedCompany = match.matched ? match.company : "";
    const sameCompany = (value: string) => Boolean(matchedCompany && companySimilarity(value, matchedCompany) >= 0.92);
    const matchingProspects = [...callMode.prospects.values()].filter((prospect) => !prospect.deleted && sameCompany(prospect.company));
    matchingProspects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const primaryProspect = matchingProspects[0];
    const matchingProspectIds = new Set(matchingProspects.map((prospect) => prospect.id));

    const focus = focusTasks.filter((task) => sameCompany(task.company));
    const sales = [...callMode.tasks.values()].filter((task) => !task.deleted && (matchingProspectIds.has(task.prospectId) || sameCompany(task.company)));
    const salesActivity = callMode.activities.filter((activity) => matchingProspectIds.has(activity.prospectId) || sameCompany(activity.company));

    const openTasks: CaptainsLogOpenTask[] = [
      ...focus.filter((task) => !task.done).map((task) => ({
        id: task.id, type: "Task", tag: task.tag, title: task.title, status: task.scheduledAt ? "scheduled" : "open",
        scheduled_at: task.scheduledAt, created_at: task.createdAt, source: task.source || "focus",
      })),
      ...sales.filter((task) => !task.completed).map((task) => ({
        id: task.id, type: task.actionType || "Task", tag: task.tag, title: task.tag || `${task.actionType || "Task"} follow-up`,
        status: task.dueDate ? "scheduled" : "open", scheduled_at: task.dueDate, created_at: task.createdAt, source: "call_mode",
      })),
    ];
    const uniqueOpen = [...new Map(openTasks.map((task) => [task.id, task])).values()]
      .sort((a, b) => (a.scheduled_at || "9999").localeCompare(b.scheduled_at || "9999") || (b.created_at || "").localeCompare(a.created_at || ""));

    const activities: CaptainsLogActivityItem[] = [
      ...focus.map((task) => ({
        id: task.id, type: "Task", tag: task.tag, title: task.title, status: task.done ? "completed" : task.scheduledAt ? "scheduled" : "open",
        scheduled_at: task.scheduledAt, completed_at: task.completedAt, created_at: task.createdAt, source: task.source || "focus",
      })),
      ...sales.map((task) => ({
        id: task.id, type: task.actionType || "Task", tag: task.tag, title: task.tag || `${task.actionType || "Task"} follow-up`, status: task.completed ? "completed" : task.dueDate ? "scheduled" : "open",
        scheduled_at: task.dueDate, completed_at: task.completedAt, created_at: task.createdAt, source: "call_mode",
      })),
      ...salesActivity.map((activity) => ({
        id: activity.id, type: activity.type, tag: "", title: activity.title, status: "completed",
        scheduled_at: "", completed_at: activity.createdAt, created_at: activity.createdAt, source: "sales_activity",
      })),
    ];
    activities.sort((a, b) => (b.completed_at || b.scheduled_at || b.created_at || "").localeCompare(a.completed_at || a.scheduled_at || a.created_at || ""));
    const recentActivity = activities.slice(0, 12);
    const reviewDates = activities.filter(isReviewActivity).map((item) => item.completed_at || item.created_at);

    return {
      ok: true,
      client_id: input.clientId,
      requested_company: input.company,
      matched: match.matched,
      linked_company: matchedCompany,
      closest_company: match.company,
      match_method: match.method,
      match_score: match.score,
      contact: {
        name: primaryProspect?.contact || focus.find((task) => task.contact)?.contact || "",
        role: "",
        email: "",
        phone: primaryProspect?.phone || "",
        source: primaryProspect ? "supabase_call_mode" : "supabase_task_events",
        prospect_id: primaryProspect?.id || "",
      },
      has_open_tasks: uniqueOpen.length > 0,
      open_task_count: uniqueOpen.length,
      open_tasks: uniqueOpen,
      primary_open_task: uniqueOpen[0],
      coordination: {
        exists: uniqueOpen.some((task) => task.tag.toLowerCase().includes("coordination") || task.title.toLowerCase().startsWith("coordination call -")),
        open: uniqueOpen.some((task) => task.tag.toLowerCase().includes("coordination") || task.title.toLowerCase().startsWith("coordination call -")),
        task_id: uniqueOpen.find((task) => task.tag.toLowerCase().includes("coordination") || task.title.toLowerCase().startsWith("coordination call -"))?.id || "",
        title: uniqueOpen.find((task) => task.tag.toLowerCase().includes("coordination") || task.title.toLowerCase().startsWith("coordination call -"))?.title || "",
        scheduled_at: uniqueOpen.find((task) => task.tag.toLowerCase().includes("coordination") || task.title.toLowerCase().startsWith("coordination call -"))?.scheduled_at || "",
        status: uniqueOpen.some((task) => task.tag.toLowerCase().includes("coordination") || task.title.toLowerCase().startsWith("coordination call -")) ? "open" : "none",
      },
      last_account_review: newest(reviewDates),
      recent_activity: recentActivity,
      synced_at: syncedAt,
    };
  });
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
  const ledger = await loadSupabaseLedger(false);
  return buildClientSnapshotsFromLedger(ledger, [{ clientId, company, aliases }])[0] ?? {
    ok: false, client_id: clientId, requested_company: company, synced_at: "", error: "No Supabase history was returned.",
  };
}

export async function syncClientsFromCaptainsLog(
  clients: Array<{ clientId: string; company: string; aliases?: string[] }>,
  _timeoutMs = 24000,
): Promise<CaptainsLogBatchSyncResult> {
  const cleaned = clients
    .map((client) => ({ clientId: text(client.clientId), company: text(client.company), aliases: Array.isArray(client.aliases) ? client.aliases.filter(Boolean) : [] }))
    .filter((client) => client.clientId && client.company);
  if (!cleaned.length) return { results: [], pendingBatches: 0, totalBatches: 0 };
  const ledger = await loadSupabaseLedger(true);
  return { results: buildClientSnapshotsFromLedger(ledger, cleaned), pendingBatches: 0, totalBatches: 1 };
}

export async function sendCoordinationCallToLocalCaptainsLog(
  request: CaptainsLogCoordinationCallRequest,
  timeoutMs = 3600,
): Promise<CaptainsLogBridgeResult> {
  return fetchLocalJson<CaptainsLogBridgeResult>("/v1/coordination-call", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Client-Compass": "1" },
    body: JSON.stringify(captainsLogCoordinationCallPayload(request)),
  }, timeoutMs);
}


export async function sendCoordinationCallToCaptainsLogReliable(
  request: CaptainsLogCoordinationCallRequest,
  _timeoutMs = 9000,
): Promise<CaptainsLogBridgeResult> {
  const gate = await syncClientFromCaptainsLog(request.clientId, request.company, 0);
  if (!gate.matched) {
    return {
      ok: false,
      status: "no-match",
      company: request.company,
      linked_company: gate.linked_company || "",
      sync: gate,
      error: gate.closest_company
        ? `Supabase history could not confidently match ${request.company}. Closest company: ${gate.closest_company}.`
        : `Supabase history could not confidently match ${request.company}.`,
      request_id: request.requestId || "",
    };
  }
  const openCount = Number(gate.open_task_count ?? gate.open_tasks?.length ?? 0);
  if (openCount > 0) {
    return { ok: false, status: "blocked-open-task", company: request.company, sync: gate, error: "Existing open work is already recorded in Supabase." };
  }
  const { captainsLogCloudRest } = await import("./captains-log-cloud");
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
    metadata: {
      created_at: now,
      updated_at: now,
      scheduled_at: request.dueDate,
      company: request.company,
      source: "client_compass",
      client_compass_client_id: request.clientId,
      client_compass_request_id: requestId,
      client_compass_reason: request.priorityReason || "",
      mobile_context: { company: request.company },
    },
  };
  await captainsLogCloudRest<null>("POST", "task_events", [row], { on_conflict: "event_id" }, "resolution=ignore-duplicates,return=minimal");
  ledgerCache = null;
  const sync: CaptainsLogClientSyncResult = {
    ...gate,
    ok: true,
    has_open_tasks: true,
    open_task_count: openCount + 1,
    open_tasks: [{ id: taskId, type: "Call", tag: "Client Coordination", title: row.task_title, status: "scheduled", scheduled_at: request.dueDate, created_at: now, source: "client_compass" }, ...(gate.open_tasks || [])],
    primary_open_task: { id: taskId, type: "Call", tag: "Client Coordination", title: row.task_title, status: "scheduled", scheduled_at: request.dueDate, created_at: now, source: "client_compass" },
    synced_at: now,
  };
  return {
    ok: true,
    status: "created",
    task_id: taskId,
    company: request.company,
    linked_company: gate.linked_company || request.company,
    scheduled_at: request.dueDate,
    sync,
    request_id: requestId,
  };
}

import type { CompassClient } from "./types";

function dateOnly(value: string): string {
  return String(value || "").slice(0, 10);
}

function newestDate(current: string, incoming: string): string {
  const next = dateOnly(incoming);
  if (!next) return current;
  const existing = dateOnly(current);
  return !existing || next > existing ? next : current;
}

export function mergeCaptainsLogSyncIntoClient(client: CompassClient, sync: CaptainsLogClientSyncResult): CompassClient {
  const contact = sync.contact ?? { name: "", role: "", email: "", phone: "" };
  const primaryOpen = sync.primary_open_task ?? sync.open_tasks?.[0];
  const plannedDate = primaryOpen ? dateOnly(primaryOpen.scheduled_at || "") : (sync.coordination?.open ? dateOnly(sync.coordination.scheduled_at || "") : "");
  const newestActivity = (sync.recent_activity ?? []).map((item) => item.completed_at || item.scheduled_at || item.created_at).filter(Boolean).sort().at(-1) || "";
  return {
    ...client,
    primaryContact: contact.name || client.primaryContact,
    primaryContactRole: contact.role || client.primaryContactRole,
    primaryContactEmail: contact.email || client.primaryContactEmail,
    primaryContactPhone: contact.phone || client.primaryContactPhone,
    lastAccountReview: newestDate(client.lastAccountReview, sync.last_account_review || ""),
    lastSalesInteraction: newestDate(client.lastSalesInteraction, newestActivity),
    nextFollowUp: plannedDate || client.nextFollowUp,
    captainsLog: {
      matched: Boolean(sync.matched),
      linkedCompany: sync.linked_company || "",
      closestCompany: sync.closest_company || "",
      matchMethod: sync.match_method || "",
      matchScore: Number(sync.match_score || 0),
      syncedAt: sync.synced_at || new Date().toISOString(),
      openTaskCount: Number(sync.open_task_count ?? sync.open_tasks?.length ?? 0),
      openTasks: (sync.open_tasks ?? []).map((task) => ({
        id: task.id || "", type: task.type || "Task", tag: task.tag || "", title: task.title || "Task", status: task.status || "open",
        scheduledAt: task.scheduled_at || "", createdAt: task.created_at || "", source: task.source || "",
      })),
      recentActivity: (sync.recent_activity ?? []).map((item) => ({
        id: item.id || "", type: item.type || "Activity", tag: item.tag || "", title: item.title || "Activity", status: item.status || "",
        scheduledAt: item.scheduled_at || "", completedAt: item.completed_at || "", createdAt: item.created_at || "", source: item.source || "",
      })),
    },
  };
}

