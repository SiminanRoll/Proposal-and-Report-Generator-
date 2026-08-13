"use client";

import { captainsLogCloudRest } from "./captains-log-cloud";
import type { CaptainsLogBridgeResult, CaptainsLogCoordinationCallRequest } from "./captains-log-bridge";

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value));
}

function coordinationCallTitle(company: string): string {
  return `Coordination Call - ${text(company) || "Client"} - Account Review Priority`;
}

async function ensureCompanyId(clientId: string, company: string): Promise<string> {
  const companyId = text(await captainsLogCloudRest<string>("POST", "rpc/ensure_company_identity", {
    p_display_name: text(company),
    p_aliases: [],
    p_source: "client_compass",
    p_external_id: text(clientId),
  }));
  if (!isUuid(companyId)) throw new Error("Supabase did not return a canonical company ID for this client.");
  return companyId;
}

export async function verifyCaptainsLogTaskConnection(): Promise<boolean> {
  try {
    await captainsLogCloudRest<unknown[]>(
      "GET",
      "tasks",
      undefined,
      { select: "task_id", limit: "1" },
    );
    return true;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause || "Unknown error");
    throw new Error(`Supabase Data API check failed: ${message}`);
  }
}

export async function writeCoordinationTaskToCaptainsLog(request: CaptainsLogCoordinationCallRequest): Promise<CaptainsLogBridgeResult> {
  const clientId = text(request.clientId);
  const company = text(request.company);
  const dueDate = text(request.dueDate).slice(0, 10);
  if (!clientId || !company || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error("Client, company, and due date are required.");

  const requestId = text(request.requestId).slice(0, 100) || (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `cc-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const safeId = requestId.replace(/[^A-Za-z0-9_.-]+/g, "-").slice(0, 120);
  const taskId = `client-compass-${safeId}`;
  const title = coordinationCallTitle(company);
  const requestedCompanyId = text(request.companyId);
  const companyId = isUuid(requestedCompanyId) ? requestedCompanyId : await ensureCompanyId(clientId, company);
  const now = new Date().toISOString();
  const row = {
    task_id: taskId,
    record_kind: "focus",
    lifecycle_state: "open",
    title,
    tag: "Client Coordination",
    task_type: "Call",
    action_type: "Call",
    company_id: companyId,
    company,
    due_date: dueDate,
    parking_lot: false,
    call_mode: false,
    sales_call: false,
    source: "client_compass",
    source_device: "Client Compass",
    payload: {
      id: taskId,
      title,
      text: title,
      tag: "Client Coordination",
      task_type: "Call",
      action_type: "Call",
      company_id: companyId,
      company,
      due_date: dueDate,
      source: "client_compass",
      created_at: now,
      client_compass_client_id: clientId,
      client_compass_request_id: requestId,
      client_compass_reason: text(request.priorityReason).slice(0, 500),
    },
  };

  let saved = await captainsLogCloudRest<Array<{ task_id?: string; company_id?: string; company?: string; due_date?: string; scheduled_at?: string }>>(
    "POST",
    "tasks",
    [row],
    { on_conflict: "user_id,record_kind,task_id" },
    "resolution=ignore-duplicates,return=representation",
  );
  if (!Array.isArray(saved) || !saved.length) {
    saved = await captainsLogCloudRest<Array<{ task_id?: string; company_id?: string; company?: string; due_date?: string; scheduled_at?: string }>>(
      "GET",
      "tasks",
      undefined,
      { select: "task_id,company_id,company,due_date,scheduled_at", record_kind: "eq.focus", task_id: `eq.${taskId}`, limit: "1" },
    );
  }
  const confirmed = Array.isArray(saved) ? saved[0] : undefined;
  if (!text(confirmed?.task_id)) throw new Error("Supabase did not confirm the Captain's Log task write.");

  return {
    ok: true,
    status: "created",
    task_id: text(confirmed?.task_id),
    company,
    company_id: text(confirmed?.company_id) || companyId,
    linked_company: text(confirmed?.company) || company,
    company_link_state: "universal-id",
    match_method: "supabase-company-id",
    match_score: 1,
    scheduled_at: text(confirmed?.scheduled_at || confirmed?.due_date) || dueDate,
    request_id: requestId,
  };
}
