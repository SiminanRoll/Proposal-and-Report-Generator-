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

interface CaptainsLogCloudSubmission {
  ok: boolean;
  configured?: boolean;
  status: string;
  request_id: string;
  transport?: string;
  error?: string;
}

interface CaptainsLogCloudPoll<T> {
  ok: boolean;
  status: "pending" | "completed" | string;
  request_id: string;
  result?: T;
  error?: string;
}

export interface CaptainsLogBatchSyncResult {
  results: CaptainsLogClientSyncResult[];
  pendingBatches: number;
  totalBatches: number;
}

const CAPTAINS_LOG_LOCAL_BASE_URLS = ["http://127.0.0.1:8769", ("http:" + "//localhost:8769")] as const;
export const CAPTAINS_LOG_LOCAL_BRIDGE_URL = "http://127.0.0.1:8769/v1/coordination-call";
export const CAPTAINS_LOG_LOCAL_HEALTH_URL = "http://127.0.0.1:8769/v1/health";
export const CAPTAINS_LOG_LOCAL_SYNC_URL = "http://127.0.0.1:8769/v1/client-sync";

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

export function captainsLogCoordinationCallPayload(request: CaptainsLogCoordinationCallRequest) {
  return {
    client_id: request.clientId,
    company: request.company,
    due: request.dueDate,
    title: coordinationCallTaskTitle(request.company),
    tag: "Client Coordination",
    task_type: "Call",
    source: "client_compass",
    request_id: request.requestId?.trim().slice(0, 100) || "",
    reason: request.priorityReason?.trim().slice(0, 500) || "",
  };
}

export function captainsLogCoordinationCallUrl(request: CaptainsLogCoordinationCallRequest): string {
  const payload = captainsLogCoordinationCallPayload(request);
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return `captainslog://coordination-call?${params.toString()}`;
}

async function fetchLocalJson<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  let lastError: unknown = null;
  for (const base of CAPTAINS_LOG_LOCAL_BASE_URLS) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${base}${path}`, {
        ...init,
        mode: "cors",
        cache: "no-store",
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({})) as T & { error?: string; ok?: boolean };
      if (!response.ok || body.ok === false) throw new Error(body.error || `Captain's Log returned ${response.status}`);
      return body;
    } catch (cause) {
      lastError = cause;
    } finally {
      window.clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Captain's Log local receiver is unavailable");
}

export async function checkCaptainsLogLocalBridge(timeoutMs = 900): Promise<boolean> {
  try {
    const body = await fetchLocalJson<{ ok?: boolean; app?: string; version?: number }>("/v1/health", { method: "GET" }, timeoutMs);
    return body.ok === true && body.app === "captains_log" && Number(body.version || 0) >= 839;
  } catch {
    return false;
  }
}

export async function waitForCaptainsLogLocalBridge(maxWaitMs = 8000, intervalMs = 600): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    if (await checkCaptainsLogLocalBridge(Math.min(900, intervalMs))) return true;
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }
  return false;
}

export async function checkCaptainsLogCloudBridge(): Promise<boolean> {
  try {
    const { captainsLogCloudRest, getCaptainsLogCloudAuthSnapshot } = await import("./captains-log-cloud");
    const snapshot = getCaptainsLogCloudAuthSnapshot();
    if (!snapshot.configured || !snapshot.signedIn) return false;
    // A lightweight owner-scoped read proves both the saved session and RLS path.
    await captainsLogCloudRest<unknown[]>("GET", "app_events", undefined, {
      select: "event_id",
      event_type: "eq.client_compass_response",
      order: "inserted_at.desc",
      limit: "1",
    });
    return true;
  } catch {
    return false;
  }
}

async function submitCaptainsLogCloudRequest(action: "ping" | "sync" | "create_coordination_call", request: CaptainsLogCoordinationCallRequest): Promise<CaptainsLogCloudSubmission> {
  const { captainsLogCloudRest } = await import("./captains-log-cloud");
  const requestId = request.requestId?.trim().slice(0, 100) || (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `cc-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const payload = {
    request_id: requestId,
    action,
    client_id: request.clientId,
    company: request.company,
    due: action === "create_coordination_call" ? request.dueDate : "",
    reason: request.priorityReason || "",
    source: "client_compass",
    requested_at: new Date().toISOString(),
  };
  await captainsLogCloudRest<null>("POST", "app_events", [{
    event_id: `client_compass_request:${requestId}`,
    event_type: "client_compass_request",
    payload,
  }], { on_conflict: "event_id" }, "resolution=ignore-duplicates,return=minimal");
  return { ok: true, configured: true, status: "queued", request_id: requestId, transport: "supabase-app-events" };
}

async function submitCaptainsLogCloudBatchRequest(clients: Array<{ clientId: string; company: string }>): Promise<CaptainsLogCloudSubmission> {
  const { captainsLogCloudRest } = await import("./captains-log-cloud");
  const requestId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `cc-batch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await captainsLogCloudRest<null>("POST", "app_events", [{
    event_id: `client_compass_request:${requestId}`,
    event_type: "client_compass_request",
    payload: {
      request_id: requestId,
      action: "sync_clients_batch",
      clients: clients.map((client) => ({ client_id: client.clientId, company: client.company })),
      source: "client_compass",
      requested_at: new Date().toISOString(),
    },
  }], { on_conflict: "event_id" }, "resolution=ignore-duplicates,return=minimal");
  return { ok: true, configured: true, status: "queued", request_id: requestId, transport: "supabase-app-events" };
}

async function pollCaptainsLogCloudResponse<T>(requestId: string, maxWaitMs = 8000, intervalMs = 900): Promise<T | null> {
  const { captainsLogCloudRest } = await import("./captains-log-cloud");
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const rows = await captainsLogCloudRest<Array<{ payload?: T }>>("GET", "app_events", undefined, {
      select: "event_id,payload,created_at,inserted_at",
      event_type: "eq.client_compass_response",
      event_id: `eq.client_compass_response:${requestId}`,
      order: "inserted_at.desc",
      limit: "1",
    });
    if (Array.isArray(rows) && rows[0]?.payload) return rows[0].payload as T;
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }
  return null;
}

export interface CaptainsLogDesktopProbe {
  ok: boolean;
  desktopOnline: boolean;
  desktopVersion: number;
  appVersion: string;
  error?: string;
}

export async function probeCaptainsLogCloudDesktop(timeoutMs = 7000): Promise<CaptainsLogDesktopProbe> {
  try {
    const submission = await submitCaptainsLogCloudRequest("ping", {
      clientId: "__client_compass_probe__",
      company: "Client Compass",
      dueDate: nextBusinessDate(),
    });
    const result = await pollCaptainsLogCloudResponse<{ ok?: boolean; desktop_online?: boolean; desktop_version?: number; app_version?: string; error?: string }>(submission.request_id, timeoutMs, 650);
    if (!result?.ok || !result.desktop_online) {
      return { ok: false, desktopOnline: false, desktopVersion: 0, appVersion: "", error: result?.error || "Captain's Log desktop did not acknowledge the cloud request." };
    }
    return { ok: true, desktopOnline: true, desktopVersion: Number(result.desktop_version || 0), appVersion: String(result.app_version || "") };
  } catch (cause) {
    return { ok: false, desktopOnline: false, desktopVersion: 0, appVersion: "", error: cause instanceof Error ? cause.message : "Captain's Log desktop probe failed." };
  }
}

export async function syncClientFromCaptainsLog(
  clientId: string,
  company: string,
  timeoutMs = 7000,
): Promise<CaptainsLogClientSyncResult> {
  const submission = await submitCaptainsLogCloudRequest("sync", {
    clientId,
    company,
    dueDate: nextBusinessDate(),
  });
  const result = await pollCaptainsLogCloudResponse<CaptainsLogClientSyncResult>(submission.request_id, timeoutMs);
  if (result) return result;
  return {
    ok: false,
    client_id: clientId,
    requested_company: company,
    synced_at: "",
    error: "Captain's Log desktop did not return a sync response. Open Captain's Log V843, verify Supabase sign-in, and retry.",
  };
}

export async function syncClientsFromCaptainsLog(
  clients: Array<{ clientId: string; company: string }>,
  timeoutMs = 24000,
): Promise<CaptainsLogBatchSyncResult> {
  const cleaned = clients.map((client) => ({ clientId: String(client.clientId || "").trim(), company: String(client.company || "").trim() })).filter((client) => client.clientId && client.company);
  if (!cleaned.length) return { results: [], pendingBatches: 0, totalBatches: 0 };
  const probe = await probeCaptainsLogCloudDesktop(Math.min(9000, Math.max(5000, Math.floor(timeoutMs / 3))));
  if (!probe.desktopOnline || probe.desktopVersion < 843) {
    throw new Error(probe.error || `Captain's Log desktop did not acknowledge Client Compass. Open V843 or newer and verify the same Supabase account is signed in.`);
  }
  const chunks: Array<Array<{ clientId: string; company: string }>> = [];
  for (let index = 0; index < cleaned.length; index += 20) chunks.push(cleaned.slice(index, index + 20));
  const submissions = await Promise.all(chunks.map((chunk) => submitCaptainsLogCloudBatchRequest(chunk)));
  const responses = await Promise.all(submissions.map((submission) => pollCaptainsLogCloudResponse<{ ok?: boolean; clients?: CaptainsLogClientSyncResult[] }>(submission.request_id, timeoutMs, 850).catch(() => null)));
  const results = responses.flatMap((response) => Array.isArray(response?.clients) ? response!.clients! : []);
  return {
    results,
    pendingBatches: responses.filter((response) => !response).length,
    totalBatches: submissions.length,
  };
}

export async function sendCoordinationCallToLocalCaptainsLog(
  request: CaptainsLogCoordinationCallRequest,
  timeoutMs = 3600,
): Promise<CaptainsLogBridgeResult> {
  return fetchLocalJson<CaptainsLogBridgeResult>("/v1/coordination-call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Compass": "1",
    },
    body: JSON.stringify(captainsLogCoordinationCallPayload(request)),
  }, timeoutMs);
}


export function launchCaptainsLogCoordinationCall(request: CaptainsLogCoordinationCallRequest): void {
  if (typeof document === "undefined") return;
  const link = document.createElement("a");
  link.href = captainsLogCoordinationCallUrl(request);
  link.style.display = "none";
  link.setAttribute("aria-hidden", "true");
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => link.remove(), 1200);
}

export async function sendCoordinationCallToCaptainsLogReliable(
  request: CaptainsLogCoordinationCallRequest,
  timeoutMs = 9000,
): Promise<CaptainsLogBridgeResult> {
  const submission = await submitCaptainsLogCloudRequest("create_coordination_call", request);
  const result = await pollCaptainsLogCloudResponse<CaptainsLogBridgeResult>(submission.request_id, timeoutMs);
  if (result) return { ...result, request_id: submission.request_id };
  return {
    ok: false,
    status: "no-response",
    company: request.company,
    scheduled_at: request.dueDate,
    request_id: submission.request_id,
    error: "Captain's Log desktop did not confirm the task request. Nothing should be treated as scheduled until V843 returns a response.",
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

interface CaptainsLogInteractiveEnvelope<T> {
  type: "captains-log-client-compass";
  request_id: string;
  payload: T;
}

function captainsLogInteractiveUrl(mode: "sync" | "create", request: CaptainsLogCoordinationCallRequest): string {
  const params = new URLSearchParams({
    mode,
    client_id: request.clientId,
    company: request.company,
    return_origin: window.location.origin,
    request_id: request.requestId?.trim().slice(0, 100) || `ccui-${Date.now()}`,
  });
  if (mode === "create") {
    params.set("due", request.dueDate);
    if (request.priorityReason) params.set("reason", request.priorityReason.slice(0, 500));
  }
  return `${CAPTAINS_LOG_LOCAL_BASE_URLS[0]}/v1/client-compass?${params.toString()}`;
}

async function captainsLogInteractiveRequest<T>(mode: "sync" | "create", request: CaptainsLogCoordinationCallRequest, timeoutMs = 6500): Promise<T> {
  if (typeof window === "undefined") throw new Error("Captain's Log interactive bridge requires a browser window");
  const requestId = request.requestId?.trim().slice(0, 100) || `ccui-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const normalized = { ...request, requestId };
  const popup = window.open("about:blank", "captains-log-client-compass", "popup,width=420,height=300,resizable=yes,scrollbars=no");
  if (!popup) throw new Error("Captain's Log connection window was blocked by the browser");
  try {
    popup.document.title = "Connecting to Captain's Log";
    popup.document.body.innerHTML = '<div style="font:14px Segoe UI,Arial,sans-serif;padding:28px;color:#173451">Connecting to Captain\'s Log…</div>';
  } catch { /* popup may already be cross-origin */ }
  const targetUrl = captainsLogInteractiveUrl(mode, normalized);
  return await new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      try { if (!popup.closed) popup.close(); } catch { /* ignore */ }
      callback();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== CAPTAINS_LOG_LOCAL_BASE_URLS[0] && event.origin !== CAPTAINS_LOG_LOCAL_BASE_URLS[1]) return;
      const envelope = event.data as CaptainsLogInteractiveEnvelope<T> | null;
      if (!envelope || envelope.type !== "captains-log-client-compass" || envelope.request_id !== requestId) return;
      const payload = envelope.payload as T & { ok?: boolean; error?: string };
      if (payload?.ok === false) finish(() => reject(new Error(payload.error || "Captain's Log request failed")));
      else finish(() => resolve(payload));
    };
    const timer = window.setTimeout(() => finish(() => reject(new Error("Captain's Log did not respond. Open Captain's Log V837 and try again."))), timeoutMs);
    window.addEventListener("message", onMessage);
    try { popup.location.href = targetUrl; }
    catch { finish(() => reject(new Error("Captain's Log local connection could not be opened"))); }
  });
}

export async function syncClientFromCaptainsLogInteractive(clientId: string, company: string, timeoutMs = 6500): Promise<CaptainsLogClientSyncResult> {
  return captainsLogInteractiveRequest<CaptainsLogClientSyncResult>("sync", {
    clientId,
    company,
    dueDate: nextBusinessDate(),
  }, timeoutMs);
}

export async function sendCoordinationCallToCaptainsLogInteractive(request: CaptainsLogCoordinationCallRequest, timeoutMs = 7000): Promise<CaptainsLogBridgeResult> {
  return captainsLogInteractiveRequest<CaptainsLogBridgeResult>("create", request, timeoutMs);
}
