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
    return body.ok === true && body.app === "captains_log" && Number(body.version || 0) >= 837;
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

export async function syncClientFromCaptainsLog(
  clientId: string,
  company: string,
  timeoutMs = 2200,
): Promise<CaptainsLogClientSyncResult> {
  const params = new URLSearchParams({ client_id: clientId, company });
  return fetchLocalJson<CaptainsLogClientSyncResult>(`/v1/client-sync?${params.toString()}`, { method: "GET" }, timeoutMs);
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
  const coordinationDate = sync.coordination?.open ? dateOnly(sync.coordination.scheduled_at || "") : "";
  return {
    ...client,
    primaryContact: contact.name || client.primaryContact,
    primaryContactRole: contact.role || client.primaryContactRole,
    primaryContactEmail: contact.email || client.primaryContactEmail,
    primaryContactPhone: contact.phone || client.primaryContactPhone,
    lastAccountReview: newestDate(client.lastAccountReview, sync.last_account_review || ""),
    nextFollowUp: coordinationDate || client.nextFollowUp,
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
