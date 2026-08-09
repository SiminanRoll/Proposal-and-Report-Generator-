"use client";

import { captainsLogCloudRest } from "./captains-log-cloud";
import type { CompassClient } from "./types";
import { dateOnly, formalAccountReviewDate, type SharedReviewStatus } from "./review-state";
import type { WorkbenchReviewResolution, WorkbenchResolutionDisposition } from "./workbench";

export interface CloudReviewState {
  company_id: string;
  review_status: SharedReviewStatus | string;
  last_completed_review_date: string | null;
  cycle_resolved_date: string | null;
  reviewed_activity_through: string | null;
  next_review_date: string | null;
  disposition: WorkbenchResolutionDisposition | string | null;
  note: string | null;
  updated_at: string;
  updated_by: string | null;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function statusForDisposition(disposition: WorkbenchResolutionDisposition): SharedReviewStatus {
  if (disposition === "review-completed" || disposition === "record-corrected") return "completed";
  if (disposition === "client-declined") return "declined";
  if (disposition === "rescheduled") return "scheduled";
  return "acknowledged";
}

export function resolutionFromCloudState(row: CloudReviewState): WorkbenchReviewResolution | null {
  const disposition = text(row.disposition) as WorkbenchResolutionDisposition;
  if (!["activity-reviewed", "review-completed", "client-declined", "rescheduled", "record-corrected"].includes(disposition)) return null;
  const date = disposition === "rescheduled"
    ? dateOnly(text(row.next_review_date))
    : disposition === "client-declined"
      ? dateOnly(text(row.cycle_resolved_date))
      : disposition === "activity-reviewed"
        ? dateOnly(text(row.reviewed_activity_through))
        : dateOnly(text(row.last_completed_review_date));
  return {
    disposition,
    date,
    activityThrough: dateOnly(text(row.reviewed_activity_through)),
    nextReviewDate: dateOnly(text(row.next_review_date)),
    note: text(row.note),
    resolvedAt: text(row.updated_at),
  };
}

export async function loadCloudReviewStates(): Promise<CloudReviewState[]> {
  const rows = await captainsLogCloudRest<CloudReviewState[]>("GET", "company_review_state", undefined, {
    select: "company_id,review_status,last_completed_review_date,cycle_resolved_date,reviewed_activity_through,next_review_date,disposition,note,updated_at,updated_by",
    order: "updated_at.asc",
    limit: "20000",
  });
  return Array.isArray(rows) ? rows : [];
}

export async function saveCloudReviewState(
  client: CompassClient,
  resolution: WorkbenchReviewResolution,
  sourceApp = "client_compass",
): Promise<void> {
  const companyId = text(client.companyId);
  if (!companyId) throw new Error(`Supabase has not assigned a universal company UUID to ${client.name} yet.`);

  const status = statusForDisposition(resolution.disposition);
  const formalDate = formalAccountReviewDate(client);
  const completedDate = resolution.disposition === "review-completed" || resolution.disposition === "record-corrected"
    ? dateOnly(resolution.date)
    : formalDate;
  const cycleResolvedDate = resolution.disposition === "review-completed" || resolution.disposition === "record-corrected" || resolution.disposition === "client-declined"
    ? dateOnly(resolution.date)
    : "";
  const updatedAt = resolution.resolvedAt || new Date().toISOString();

  const row = {
    company_id: companyId,
    review_status: status,
    last_completed_review_date: completedDate || null,
    cycle_resolved_date: cycleResolvedDate || null,
    reviewed_activity_through: dateOnly(resolution.activityThrough) || null,
    next_review_date: dateOnly(resolution.nextReviewDate) || null,
    disposition: resolution.disposition,
    note: resolution.note || "",
    updated_at: updatedAt,
    updated_by: sourceApp,
  };

  await captainsLogCloudRest<null>("POST", "company_review_state", [row], { on_conflict: "user_id,company_id" }, "resolution=merge-duplicates,return=minimal");
  await captainsLogCloudRest<null>("POST", "company_review_history", [{
    company_id: companyId,
    event_type: "review_state_changed",
    review_status: status,
    disposition: resolution.disposition,
    effective_date: dateOnly(resolution.date) || null,
    activity_through: dateOnly(resolution.activityThrough) || null,
    next_review_date: dateOnly(resolution.nextReviewDate) || null,
    note: resolution.note || "",
    source_app: sourceApp,
    created_at: updatedAt,
  }], undefined, "return=minimal");
}

export async function saveFormalReviewDateToCloud(client: CompassClient, reviewDate: string, sourceApp = "client_compass"): Promise<void> {
  const date = dateOnly(reviewDate);
  if (!date) return;
  const resolution: WorkbenchReviewResolution = {
    disposition: "record-corrected",
    date,
    activityThrough: date,
    nextReviewDate: "",
    note: "",
    resolvedAt: new Date().toISOString(),
  };
  await saveCloudReviewState({ ...client, lastAccountReview: date }, resolution, sourceApp);
}
