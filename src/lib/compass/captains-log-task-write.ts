import {
  coordinationCallTaskTitle,
  sendCoordinationCallToCaptainsLogReliable,
  type CaptainsLogBridgeResult,
  type CaptainsLogCoordinationCallRequest,
} from "./captains-log-bridge";
import { captainsLogCloudRest } from "./captains-log-cloud";

export interface CaptainsLogTaskWriteRequest extends CaptainsLogCoordinationCallRequest {
  companyId?: string;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value));
}

function requestIdFor(request: CaptainsLogTaskWriteRequest): string {
  const supplied = text(request.requestId).slice(0, 100);
  if (supplied) return supplied;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `cc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Verifies the exact authenticated Supabase REST path used by Captain's Log
 * before Client Compass begins creating a task. This also refreshes an expired
 * session through captainsLogCloudRest when a reusable refresh token exists.
 */
export async function verifyCaptainsLogTaskConnection(): Promise<void> {
  await captainsLogCloudRest<Array<{ event_id?: string }>>(
    "GET",
    "task_events",
    undefined,
    { select: "event_id", limit: "1" },
  );
}

/**
 * Writes a Client Compass coordination task using the company's already-known
 * universal UUID whenever possible. If Compass does not yet know a UUID, the
 * established bridge resolves one before the task is created.
 */
export async function writeCoordinationTaskToCaptainsLog(
  request: CaptainsLogTaskWriteRequest,
): Promise<CaptainsLogBridgeResult> {
  const companyId = text(request.companyId);
  if (!isUuid(companyId)) return sendCoordinationCallToCaptainsLogReliable(request, 9000);

  const requestId = requestIdFor(request);
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

  // event_id is stable for the request, so a repeated submit cannot create
  // duplicate tasks if Supabase committed the original write.
  await captainsLogCloudRest<null>(
    "POST",
    "task_events",
    [row],
    { on_conflict: "event_id" },
    "resolution=ignore-duplicates,return=minimal",
  );

  return {
    ok: true,
    status: "created",
    task_id: taskId,
    company: request.company,
    company_id: companyId,
    linked_company: request.company,
    company_link_state: "universal-id",
    match_method: "supabase-company-id",
    match_score: 1,
    scheduled_at: request.dueDate,
    request_id: requestId,
  };
}
