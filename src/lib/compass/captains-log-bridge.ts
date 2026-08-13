export interface CaptainsLogCoordinationCallRequest {
  clientId: string;
  company: string;
  companyId?: string;
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

function text(value: unknown): string {
  return String(value ?? "").trim();
}

export function coordinationCallTaskTitle(company: string): string {
  return `Coordination Call - ${text(company) || "Client"} - Account Review Priority`;
}

export function nextBusinessDate(from = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1, 12, 0, 0);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function checkCaptainsLogCloudBridge(): Promise<boolean> {
  try {
    const { getCaptainsLogCloudAuthSnapshot, captainsLogCloudRest } = await import("./captains-log-cloud");
    const snapshot = getCaptainsLogCloudAuthSnapshot();
    if (!snapshot.configured || !snapshot.signedIn) return false;
    await captainsLogCloudRest<unknown[]>("GET", "tasks", undefined, { select: "task_id", limit: "1" });
    return true;
  } catch {
    return false;
  }
}

export async function syncClientFromCaptainsLog(
  clientId: string,
  company: string,
  _timeoutMs = 7000,
  aliases: string[] = [],
): Promise<CaptainsLogClientSyncResult> {
  const { syncClientsFromCompassCurrentState } = await import("./captains-log-current-state");
  const batch = await syncClientsFromCompassCurrentState([{ clientId: text(clientId), company: text(company), aliases }]);
  return batch.results[0] ?? {
    ok: false,
    client_id: clientId,
    requested_company: company,
    synced_at: "",
    error: "No canonical Captain's Log task state was returned.",
  };
}

export async function syncClientsFromCaptainsLog(
  clients: Array<{ clientId: string; company: string; aliases?: string[]; companyId?: string }>,
  _timeoutMs = 24000,
): Promise<CaptainsLogBatchSyncResult> {
  const { syncClientsFromCompassCurrentState } = await import("./captains-log-current-state");
  return syncClientsFromCompassCurrentState(clients);
}

export async function sendCoordinationCallToCaptainsLogReliable(
  request: CaptainsLogCoordinationCallRequest,
  _timeoutMs = 9000,
): Promise<CaptainsLogBridgeResult> {
  const { writeCoordinationTaskToCaptainsLog } = await import("./captains-log-task-write");
  const created = await writeCoordinationTaskToCaptainsLog(request);
  let sync: CaptainsLogClientSyncResult | undefined;
  try {
    sync = await syncClientFromCaptainsLog(request.clientId, request.company, 7000);
  } catch {
    // The canonical task write already succeeded. A later client refresh can reload the snapshot.
  }
  return { ...created, sync };
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
  const safeOpen = (sync.open_tasks ?? []).filter((task) => !companyId || !task.company_id || task.company_id === companyId);
  const safeActivity = (sync.recent_activity ?? []).filter((item) => !companyId || !item.company_id || item.company_id === companyId);
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
