export interface CaptainsLogCoordinationCallRequest {
  clientId: string;
  company: string;
  dueDate: string;
  priorityReason?: string;
  requestId?: string;
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
  error?: string;
}

export const CAPTAINS_LOG_LOCAL_BRIDGE_URL = "http://127.0.0.1:8769/v1/coordination-call";
export const CAPTAINS_LOG_LOCAL_HEALTH_URL = "http://127.0.0.1:8769/v1/health";

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


export async function checkCaptainsLogLocalBridge(timeoutMs = 1000): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(CAPTAINS_LOG_LOCAL_HEALTH_URL, { method: "GET", mode: "cors", cache: "no-store", signal: controller.signal });
    if (!response.ok) return false;
    const body = await response.json().catch(() => ({})) as { ok?: boolean; app?: string };
    return body.ok === true && body.app === "captains_log";
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function waitForCaptainsLogLocalBridge(maxWaitMs = 7000, intervalMs = 650): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    if (await checkCaptainsLogLocalBridge(Math.min(900, intervalMs))) return true;
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }
  return false;
}

export async function sendCoordinationCallToLocalCaptainsLog(
  request: CaptainsLogCoordinationCallRequest,
  timeoutMs = 3200,
): Promise<CaptainsLogBridgeResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(CAPTAINS_LOG_LOCAL_BRIDGE_URL, {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Compass": "1",
      },
      body: JSON.stringify(captainsLogCoordinationCallPayload(request)),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({})) as CaptainsLogBridgeResult;
    if (!response.ok || !body.ok) throw new Error(body.error || `Captain's Log returned ${response.status}`);
    return body;
  } finally {
    window.clearTimeout(timer);
  }
}
