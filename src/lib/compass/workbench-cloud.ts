"use client";

import { captainsLogCloudRest } from "./captains-log-cloud";

export interface CloudWorkbenchState {
  company_id: string;
  manual_included: boolean;
  updated_at: string;
  source_app: string;
}

export interface CloudWorkbenchSnooze {
  company_id: string;
  snoozed_until: string;
  snoozed_at: string;
  source_app: string;
}

function cleanCompanyIds(companyIds: string[]): string[] {
  return [...new Set(companyIds.map((value) => String(value || "").trim()).filter(Boolean))];
}

export async function loadCloudWorkbenchStates(): Promise<CloudWorkbenchState[]> {
  const rows = await captainsLogCloudRest<CloudWorkbenchState[]>("GET", "company_workbench_state", undefined, {
    select: "company_id,manual_included,updated_at,source_app",
    order: "updated_at.asc",
    limit: "20000",
  });
  return Array.isArray(rows) ? rows : [];
}

export async function saveCloudWorkbenchMembership(companyId: string, manualIncluded: boolean, sourceApp = "client_compass"): Promise<void> {
  const id = String(companyId || "").trim();
  if (!id) return;
  await captainsLogCloudRest<null>("POST", "company_workbench_state", [{
    company_id: id,
    manual_included: Boolean(manualIncluded),
    updated_at: new Date().toISOString(),
    source_app: sourceApp,
  }], { on_conflict: "user_id,company_id" }, "resolution=merge-duplicates,return=minimal");
}

export async function saveCloudWorkbenchMemberships(companyIds: string[], manualIncluded: boolean, sourceApp = "client_compass"): Promise<void> {
  const ids = cleanCompanyIds(companyIds);
  if (!ids.length) return;
  const updatedAt = new Date().toISOString();
  await captainsLogCloudRest<null>("POST", "company_workbench_state", ids.map((companyId) => ({
    company_id: companyId,
    manual_included: Boolean(manualIncluded),
    updated_at: updatedAt,
    source_app: sourceApp,
  })), { on_conflict: "user_id,company_id" }, "resolution=merge-duplicates,return=minimal");
}

export async function loadCloudWorkbenchSnoozes(): Promise<CloudWorkbenchSnooze[]> {
  const rows = await captainsLogCloudRest<CloudWorkbenchSnooze[]>("GET", "company_workbench_snoozes", undefined, {
    select: "company_id,snoozed_until,snoozed_at,source_app",
    order: "snoozed_at.asc",
    limit: "20000",
  });
  return Array.isArray(rows) ? rows : [];
}

export async function saveCloudWorkbenchSnooze(companyId: string, snoozedUntil: string, sourceApp = "client_compass"): Promise<void> {
  const id = String(companyId || "").trim();
  const until = String(snoozedUntil || "").slice(0, 10);
  if (!id || !until) return;
  await captainsLogCloudRest<null>("POST", "company_workbench_snoozes", [{
    company_id: id,
    snoozed_until: until,
    snoozed_at: new Date().toISOString(),
    source_app: sourceApp,
  }], { on_conflict: "user_id,company_id" }, "resolution=merge-duplicates,return=minimal");
}

export async function clearCloudWorkbenchSnooze(companyId: string): Promise<void> {
  const id = String(companyId || "").trim();
  if (!id) return;
  await captainsLogCloudRest<null>("DELETE", "company_workbench_snoozes", undefined, { company_id: `eq.${id}` }, "return=minimal");
}
