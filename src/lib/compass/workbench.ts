"use client";

import { clientReviewStateByClientId, clientReviewStateForClient } from "./client-review-cloud";
import type { CompassCaptainsLogTask, CompassClient } from "./types";

export const WORKBENCH_STORAGE_KEY = "client-compass.workbench.v1";
export const WORKBENCH_CHANGED_EVENT = "client-compass-workbench-changed";

export type WorkbenchResolutionDisposition =
  | "activity-reviewed"
  | "review-completed"
  | "client-declined"
  | "rescheduled"
  | "record-corrected";

export interface WorkbenchReviewResolution {
  disposition: WorkbenchResolutionDisposition;
  date: string;
  activityThrough: string;
  nextReviewDate: string;
  note: string;
  resolvedAt: string;
}

export interface WorkbenchState {
  clientIds: string[];
  // v1.0.9.95 local resolutions remain as an offline/migration cache only.
  // Supabase client_review_event rows are authoritative in v1.0.9.96+.
  resolutions?: Record<string, WorkbenchReviewResolution>;
  updatedAt: string;
}

export type WorkbenchStage = string;

function cleanIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function dateOnly(value: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cleanResolution(value: unknown): WorkbenchReviewResolution | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<WorkbenchReviewResolution>;
  const disposition = String(raw.disposition ?? "") as WorkbenchResolutionDisposition;
  if (!["activity-reviewed", "review-completed", "client-declined", "rescheduled", "record-corrected"].includes(disposition)) return null;
  return {
    disposition,
    date: dateOnly(String(raw.date ?? "")),
    activityThrough: dateOnly(String(raw.activityThrough ?? "")),
    nextReviewDate: dateOnly(String(raw.nextReviewDate ?? "")),
    note: String(raw.note ?? ""),
    resolvedAt: String(raw.resolvedAt ?? ""),
  };
}

function cleanResolutions(value: unknown): Record<string, WorkbenchReviewResolution> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: Record<string, WorkbenchReviewResolution> = {};
  for (const [clientId, raw] of Object.entries(value as Record<string, unknown>)) {
    const id = String(clientId ?? "").trim();
    const resolution = cleanResolution(raw);
    if (id && resolution) next[id] = resolution;
  }
  return next;
}

function newestActivityDate(client: CompassClient): string {
  return (client.captainsLog?.recentActivity ?? [])
    .map((item) => dateOnly(item.completedAt || item.scheduledAt || item.createdAt))
    .filter(Boolean)
    .sort()
    .at(-1) ?? "";
}

function taskDate(task: CompassCaptainsLogTask): string {
  return dateOnly(task.scheduledAt || task.createdAt);
}

function maxDate(...values: string[]): string {
  return values.map(dateOnly).filter(Boolean).sort().at(-1) ?? "";
}

function cloudResolutionById(clientId: string): WorkbenchReviewResolution | null {
  const state = clientReviewStateByClientId(clientId);
  if (!state) return null;
  const disposition: WorkbenchResolutionDisposition = state.disposition === "client-declined" ? "client-declined"
    : state.disposition === "rescheduled" ? "rescheduled"
      : state.disposition === "activity-reviewed" ? "activity-reviewed"
        : state.disposition === "record-corrected" ? "record-corrected"
          : "review-completed";
  const date = disposition === "client-declined" ? state.reviewCycleResolvedDate
    : disposition === "rescheduled" ? state.nextReviewDate
      : disposition === "activity-reviewed" ? state.reviewedActivityThrough
        : state.lastCompletedReviewDate;
  return {
    disposition,
    date,
    activityThrough: state.reviewedActivityThrough,
    nextReviewDate: state.nextReviewDate,
    note: state.note,
    resolvedAt: state.updatedAt,
  };
}

export function loadWorkbenchState(): WorkbenchState {
  if (typeof window === "undefined") return { clientIds: [], resolutions: {}, updatedAt: "" };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WORKBENCH_STORAGE_KEY) || "null") as Partial<WorkbenchState> | null;
    return {
      clientIds: cleanIds(parsed?.clientIds),
      resolutions: cleanResolutions(parsed?.resolutions),
      updatedAt: String(parsed?.updatedAt ?? ""),
    };
  } catch {
    return { clientIds: [], resolutions: {}, updatedAt: "" };
  }
}

export function saveWorkbenchState(state: WorkbenchState): WorkbenchState {
  const next = {
    clientIds: cleanIds(state.clientIds),
    resolutions: cleanResolutions(state.resolutions),
    updatedAt: state.updatedAt || new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(WORKBENCH_CHANGED_EVENT));
  }
  return next;
}

export function addClientsToWorkbench(clientIds: string[]): WorkbenchState {
  const current = loadWorkbenchState();
  return saveWorkbenchState({ ...current, clientIds: [...current.clientIds, ...clientIds], updatedAt: new Date().toISOString() });
}

export function removeClientFromWorkbench(clientId: string): WorkbenchState {
  const current = loadWorkbenchState();
  const resolutions = { ...(current.resolutions ?? {}) };
  delete resolutions[clientId];
  return saveWorkbenchState({ clientIds: current.clientIds.filter((id) => id !== clientId), resolutions, updatedAt: new Date().toISOString() });
}

export function workbenchResolution(clientId: string): WorkbenchReviewResolution | null {
  return cloudResolutionById(clientId) ?? loadWorkbenchState().resolutions?.[clientId] ?? null;
}

export function setWorkbenchResolution(clientId: string, resolution: WorkbenchReviewResolution): WorkbenchState {
  const current = loadWorkbenchState();
  return saveWorkbenchState({
    ...current,
    resolutions: { ...(current.resolutions ?? {}), [clientId]: resolution },
    updatedAt: new Date().toISOString(),
  });
}

export function clearWorkbenchResolution(clientId: string): WorkbenchState {
  const current = loadWorkbenchState();
  const resolutions = { ...(current.resolutions ?? {}) };
  delete resolutions[clientId];
  return saveWorkbenchState({ ...current, resolutions, updatedAt: new Date().toISOString() });
}

export function workbenchHandledThrough(client: CompassClient): string {
  const cloud = clientReviewStateForClient(client);
  const local = workbenchResolution(client.id);
  const reviewDate = client.lastAccountReview || client.reviewOutcome?.reviewedAt || "";
  return maxDate(
    reviewDate,
    cloud?.reviewedActivityThrough ?? "",
    cloud?.status === "declined" ? cloud.reviewCycleResolvedDate : "",
    local?.activityThrough ?? "",
  );
}

export function workbenchActionableOpenTasks(client: CompassClient): CompassCaptainsLogTask[] {
  const handledThrough = workbenchHandledThrough(client);
  return (client.captainsLog?.openTasks ?? []).filter((task) => {
    if (!handledThrough) return true;
    const date = taskDate(task);
    return !date || date > handledThrough;
  });
}

export function workbenchActionableOpenTaskCount(client: CompassClient): number {
  return workbenchActionableOpenTasks(client).length;
}

export function workbenchStage(client: CompassClient): WorkbenchStage {
  const today = todayDate();
  const cloud = clientReviewStateForClient(client);
  const resolution = workbenchResolution(client.id);
  const openTasks = workbenchActionableOpenTasks(client);

  if (openTasks.length > 0) {
    const scheduledDates = openTasks.map(taskDate).filter(Boolean);
    if (scheduledDates.some((date) => date >= today)) return "Scheduled";
    return "Needs Action";
  }

  const nextReviewDate = cloud?.status === "scheduled" ? cloud.nextReviewDate : resolution?.disposition === "rescheduled" ? resolution.nextReviewDate : "";
  if (nextReviewDate) return nextReviewDate >= today ? "Scheduled" : "Needs Action";

  const latestActivity = newestActivityDate(client);
  const handledThrough = workbenchHandledThrough(client);

  if (handledThrough) {
    if (latestActivity && latestActivity > handledThrough) return latestActivity < today ? "Needs Action" : "In Progress";
    return "Completed";
  }

  if (latestActivity) return latestActivity < today ? "Needs Action" : "In Progress";
  return "Needs Action";
}
