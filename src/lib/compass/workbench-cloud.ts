"use client";

import { captainsLogCloudRest } from "./captains-log-cloud";

export interface CloudWorkbenchSnooze {
  company_id: string;
  snoozed_until: string;
  snoozed_at: string;
  source_app: string;
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
