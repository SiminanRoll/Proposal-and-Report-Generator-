"use client";

import type { CompassCaptainsLogActivity, CompassCaptainsLogTask, CompassClient } from "./types";

export const WORKBENCH_STORAGE_KEY = "client-compass.workbench.v1";
export const WORKBENCH_CHANGED_EVENT = "client-compass-workbench-changed";
export const WORKBENCH_REVIEW_CADENCE_MONTHS = 12;
export const WORKBENCH_COMPLETED_RETENTION_DAYS = 30;
export const WORKBENCH_SNOOZE_DAYS = 90;
const WORKBENCH_ACTIVITY_RETENTION_DAYS = 30;

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

export interface WorkbenchSnooze {
  until: string;
  snoozedAt: string;
}

export interface WorkbenchState {
  clientIds: string[];
  resolutions?: Record<string, WorkbenchReviewResolution>;
  snoozes?: Record<string, WorkbenchSnooze>;
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

function addDays(value: string, days: number): string {
  const date = new Date(`${dateOnly(value)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return dateOnly(date.toISOString());
}

function addMonths(value: string, months: number): string {
  const source = new Date(`${dateOnly(value)}T12:00:00`);
  if (Number.isNaN(source.getTime())) return "";
  const day = source.getDate();
  const target = new Date(source.getFullYear(), source.getMonth() + months, 1, 12, 0, 0);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12, 0, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return dateOnly(target.toISOString());
}

function daysBetween(earlier: string, later: string): number | null {
  const first = Date.parse(`${dateOnly(earlier)}T12:00:00`);
  const second = Date.parse(`${dateOnly(later)}T12:00:00`);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  return Math.floor((second - first) / 86400000);
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

function cleanSnooze(value: unknown): WorkbenchSnooze | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<WorkbenchSnooze>;
  const until = dateOnly(String(raw.until ?? ""));
  if (!until || until <= todayDate()) return null;
  return { until, snoozedAt: String(raw.snoozedAt ?? "") };
}

function cleanSnoozes(value: unknown): Record<string, WorkbenchSnooze> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: Record<string, WorkbenchSnooze> = {};
  for (const [clientId, raw] of Object.entries(value as Record<string, unknown>)) {
    const id = String(clientId ?? "").trim();
    const snooze = cleanSnooze(raw);
    if (id && snooze) next[id] = snooze;
  }
  return next;
}

function taskDate(task: CompassCaptainsLogTask): string {
  return dateOnly(task.scheduledAt || task.createdAt);
}

function activityDate(activity: CompassCaptainsLogActivity): string {
  return dateOnly(activity.completedAt || activity.scheduledAt || activity.createdAt);
}

function maxDate(...values: string[]): string {
  return values.map(dateOnly).filter(Boolean).sort().at(-1) ?? "";
}

function reviewLanguage(value: Pick<CompassCaptainsLogTask, "title" | "tag" | "type"> | Pick<CompassCaptainsLogActivity, "title" | "tag" | "type">): string {
  return `${value.title || ""} ${value.tag || ""} ${value.type || ""}`.trim().toLowerCase();
}

export function workbenchIsReviewItem(value: Pick<CompassCaptainsLogTask, "title" | "tag" | "type"> | Pick<CompassCaptainsLogActivity, "title" | "tag" | "type">): boolean {
  const language = reviewLanguage(value);
  if (!language) return false;
  return /account\s*review|coordination\s*call/.test(language)
    || /(^|\s)review($|\s)/.test(language)
    || /review[-_ ]?(priority|follow[-_ ]?up)/.test(language);
}

export function loadWorkbenchState(): WorkbenchState {
  if (typeof window === "undefined") return { clientIds: [], resolutions: {}, snoozes: {}, updatedAt: "" };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WORKBENCH_STORAGE_KEY) || "null") as Partial<WorkbenchState> | null;
    return {
      clientIds: cleanIds(parsed?.clientIds),
      resolutions: cleanResolutions(parsed?.resolutions),
      snoozes: cleanSnoozes(parsed?.snoozes),
      updatedAt: String(parsed?.updatedAt ?? ""),
    };
  } catch {
    return { clientIds: [], resolutions: {}, snoozes: {}, updatedAt: "" };
  }
}

export function saveWorkbenchState(state: WorkbenchState): WorkbenchState {
  const next = {
    clientIds: cleanIds(state.clientIds),
    resolutions: cleanResolutions(state.resolutions),
    snoozes: cleanSnoozes(state.snoozes),
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
  const snoozes = { ...(current.snoozes ?? {}) };
  clientIds.forEach((id) => delete snoozes[id]);
  return saveWorkbenchState({ ...current, clientIds: [...current.clientIds, ...clientIds], snoozes, updatedAt: new Date().toISOString() });
}

export function removeClientFromWorkbench(clientId: string): WorkbenchState {
  const current = loadWorkbenchState();
  return saveWorkbenchState({ ...current, clientIds: current.clientIds.filter((id) => id !== clientId), updatedAt: new Date().toISOString() });
}

export function snoozeClientInWorkbench(clientId: string, days = WORKBENCH_SNOOZE_DAYS): WorkbenchState {
  const current = loadWorkbenchState();
  const now = new Date().toISOString();
  const until = addDays(todayDate(), Math.max(1, days));
  return saveWorkbenchState({
    ...current,
    clientIds: current.clientIds.filter((id) => id !== clientId),
    snoozes: { ...(current.snoozes ?? {}), [clientId]: { until, snoozedAt: now } },
    updatedAt: now,
  });
}

export function mergeWorkbenchSnoozes(snoozes: Record<string, WorkbenchSnooze>): WorkbenchState {
  const current = loadWorkbenchState();
  return saveWorkbenchState({ ...current, snoozes: { ...(current.snoozes ?? {}), ...snoozes }, updatedAt: new Date().toISOString() });
}

export function clearWorkbenchSnooze(clientId: string): WorkbenchState {
  const current = loadWorkbenchState();
  const snoozes = { ...(current.snoozes ?? {}) };
  delete snoozes[clientId];
  return saveWorkbenchState({ ...current, snoozes, updatedAt: new Date().toISOString() });
}

export function workbenchSnooze(clientId: string): WorkbenchSnooze | null {
  return loadWorkbenchState().snoozes?.[clientId] ?? null;
}

export function workbenchSnoozeActive(value: WorkbenchSnooze | undefined | null, today = todayDate()): boolean {
  return Boolean(value?.until && value.until > today);
}

export function workbenchResolution(clientId: string): WorkbenchReviewResolution | null {
  return loadWorkbenchState().resolutions?.[clientId] ?? null;
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

export function workbenchCadenceDate(client: CompassClient): string {
  const formal = client.lastAccountReview || client.reviewOutcome?.reviewedAt || "";
  const disposition = String(client.accountReviewDisposition || "").toLowerCase();
  const status = String(client.accountReviewStatus || "").toLowerCase();
  const operational = disposition === "client-declined" || status === "declined"
    ? client.accountReviewCycleResolvedDate || ""
    : disposition === "activity-reviewed"
      ? client.accountReviewActivityThrough || ""
      : "";
  return maxDate(formal, operational);
}

export function workbenchReviewDue(client: CompassClient, cadenceMonths = WORKBENCH_REVIEW_CADENCE_MONTHS, today = todayDate()): boolean {
  const cadence = workbenchCadenceDate(client);
  if (!cadence) return false;
  const due = addMonths(cadence, Math.max(1, cadenceMonths));
  return Boolean(due && due <= today);
}

export function workbenchScheduledDate(client: CompassClient): string {
  const status = String(client.accountReviewStatus || "").toLowerCase();
  const disposition = String(client.accountReviewDisposition || "").toLowerCase();
  if ((status === "scheduled" || disposition === "rescheduled") && client.accountReviewNextDate) return dateOnly(client.accountReviewNextDate);
  return "";
}

export function workbenchResolutionDate(client: CompassClient): string {
  const disposition = String(client.accountReviewDisposition || "").toLowerCase();
  const status = String(client.accountReviewStatus || "").toLowerCase();
  if (disposition === "client-declined" || status === "declined") return dateOnly(client.accountReviewCycleResolvedDate || "");
  if (disposition === "activity-reviewed") return dateOnly(client.accountReviewActivityThrough || "");
  if (disposition === "review-completed" || disposition === "record-corrected" || status === "completed") {
    return dateOnly(client.lastAccountReview || client.reviewOutcome?.reviewedAt || "");
  }
  return "";
}

export function workbenchRecentlyResolved(client: CompassClient, retentionDays = WORKBENCH_COMPLETED_RETENTION_DAYS, today = todayDate()): boolean {
  const resolved = workbenchResolutionDate(client);
  if (!resolved) return false;
  const age = daysBetween(resolved, today);
  return age !== null && age >= 0 && age <= Math.max(0, retentionDays);
}

export function workbenchLatestReviewActivity(client: CompassClient): CompassCaptainsLogActivity | null {
  return [...(client.captainsLog?.recentActivity ?? [])]
    .filter(workbenchIsReviewItem)
    .sort((left, right) => activityDate(right).localeCompare(activityDate(left)))[0] ?? null;
}

export function workbenchHasRecentReviewActivity(client: CompassClient, retentionDays = WORKBENCH_ACTIVITY_RETENTION_DAYS, today = todayDate()): boolean {
  const recent = workbenchLatestReviewActivity(client);
  if (!recent) return false;
  const age = daysBetween(activityDate(recent), today);
  return age !== null && age >= 0 && age <= Math.max(0, retentionDays);
}

export function workbenchHandledThrough(client: CompassClient): string {
  const resolution = workbenchResolution(client.id);
  return maxDate(workbenchCadenceDate(client), resolution?.activityThrough ?? "");
}

export function workbenchActionableOpenTasks(client: CompassClient): CompassCaptainsLogTask[] {
  const handledThrough = workbenchHandledThrough(client);
  return (client.captainsLog?.openTasks ?? []).filter(workbenchIsReviewItem).filter((task) => {
    if (!handledThrough) return true;
    const date = taskDate(task);
    return !date || date > handledThrough;
  });
}

export function workbenchActionableOpenTaskCount(client: CompassClient): number {
  return workbenchActionableOpenTasks(client).length;
}

export function workbenchShouldInclude(client: CompassClient, manual = false, snooze?: WorkbenchSnooze | null): boolean {
  if (workbenchSnoozeActive(snooze) && !manual) return false;
  if (workbenchActionableOpenTasks(client).length > 0) return true;
  if (workbenchScheduledDate(client)) return true;
  if (manual) return true;
  if (workbenchRecentlyResolved(client)) return true;
  if (workbenchReviewDue(client)) return true;
  return workbenchHasRecentReviewActivity(client);
}

export function workbenchStage(client: CompassClient, manual = false): WorkbenchStage {
  const today = todayDate();
  const openTasks = workbenchActionableOpenTasks(client);

  if (openTasks.length > 0) {
    const scheduledDates = openTasks.map(taskDate).filter(Boolean);
    if (scheduledDates.some((date) => date >= today)) return "Scheduled";
    return "Needs Action";
  }

  const scheduled = workbenchScheduledDate(client);
  if (scheduled) return scheduled >= today ? "Scheduled" : "Needs Action";
  if (workbenchRecentlyResolved(client)) return "Completed";
  if (workbenchHasRecentReviewActivity(client)) return "In Progress";
  if (workbenchReviewDue(client) || manual) return "Needs Action";
  return "Needs Action";
}
