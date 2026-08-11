import type { CompassCaptainsLogTask, CompassClient } from "@/lib/compass/types";
import { workbenchActionableOpenTasks, workbenchLatestReviewActivity, type WorkbenchStage } from "@/lib/compass/workbench";

export type StageFilter = WorkbenchStage | "All";
export type SortKey = "client" | "stage" | "activity" | "tasks" | "review" | "salesActivity" | "technicalConsultant" | "value";
export type SortDirection = "asc" | "desc";
export type DateWindow = 14 | 30 | 90 | "all";
export type ViewMode = "table" | "calendar";

export type WorkbenchActivity = {
  kind: "open" | "last" | "review" | "none";
  title: string;
  date: string;
  task: CompassCaptainsLogTask | null;
};

export type WorkbenchRow = {
  client: CompassClient;
  stage: WorkbenchStage;
  manual: boolean;
  activity: WorkbenchActivity;
  openTaskCount: number;
  reviewDate: string;
  estimatedValue: number;
};

export type ScheduleEditor = {
  clientId: string;
  clientName: string;
  task: CompassCaptainsLogTask;
};

export const STAGES: WorkbenchStage[] = ["Needs Action", "In Progress", "Scheduled", "Completed"];

export function formatWorkbenchDate(value: string): string {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function formatWorkbenchMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function workbenchDateTime(value: string): number {
  if (!value) return 0;
  const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function workbenchDateKey(value: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function workbenchLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function primaryReviewTask(client: CompassClient): CompassCaptainsLogTask | null {
  const tasks = [...workbenchActionableOpenTasks(client)];
  tasks.sort((left, right) => {
    const leftScheduled = workbenchDateTime(left.scheduledAt);
    const rightScheduled = workbenchDateTime(right.scheduledAt);
    if (leftScheduled && rightScheduled) return leftScheduled - rightScheduled;
    if (leftScheduled) return -1;
    if (rightScheduled) return 1;
    return workbenchDateTime(right.createdAt) - workbenchDateTime(left.createdAt);
  });
  return tasks[0] ?? null;
}

export function workbenchRowActivity(client: CompassClient): WorkbenchActivity {
  const openTask = primaryReviewTask(client);
  if (openTask) return { kind: "open", title: openTask.title || openTask.tag || "Open review task", date: openTask.scheduledAt || openTask.createdAt, task: openTask };
  const status = String(client.accountReviewStatus || "").toLowerCase();
  const disposition = String(client.accountReviewDisposition || "").toLowerCase();
  if ((status === "scheduled" || disposition === "rescheduled") && client.accountReviewNextDate) return { kind: "review", title: "Account review scheduled", date: client.accountReviewNextDate, task: null };
  if ((disposition === "client-declined" || status === "declined") && client.accountReviewCycleResolvedDate) return { kind: "review", title: "Review cycle declined", date: client.accountReviewCycleResolvedDate, task: null };
  if (disposition === "activity-reviewed" && client.accountReviewActivityThrough) return { kind: "review", title: "Review cycle handled", date: client.accountReviewActivityThrough, task: null };
  if ((disposition === "review-completed" || disposition === "record-corrected" || status === "completed") && (client.lastAccountReview || client.reviewOutcome?.reviewedAt)) return { kind: "review", title: "Account review completed", date: client.lastAccountReview || client.reviewOutcome?.reviewedAt || "", task: null };
  const recent = workbenchLatestReviewActivity(client);
  if (recent) return { kind: "last", title: recent.title || recent.tag || "Review activity", date: recent.completedAt || recent.scheduledAt || recent.createdAt, task: null };
  const reviewDate = client.lastAccountReview || client.reviewOutcome?.reviewedAt || "";
  if (reviewDate) return { kind: "review", title: "Last account review", date: reviewDate, task: null };
  return { kind: "none", title: "No review activity yet", date: "", task: null };
}

export function reportUrl(clientId: string, clientName: string): string {
  const params = new URLSearchParams({ type: "client-report", compassClientId: clientId, client: clientName });
  return `/create/?${params.toString()}`;
}

export function matchesWorkbenchDateWindow(row: WorkbenchRow, window: DateWindow): boolean {
  if (row.stage === "Needs Action") return true;
  if (window === "all") return true;
  if (!row.activity.date) return row.stage === "Needs Action";
  const time = workbenchDateTime(row.activity.date);
  if (!time) return row.stage === "Needs Action";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();
  const span = window * 86400000;
  if (row.activity.kind === "open" || row.stage === "Scheduled") return time <= todayTime || time <= todayTime + span;
  return time >= todayTime - span;
}

export function sortIndicator(column: SortKey, active: SortKey, direction: SortDirection): string {
  if (column !== active) return "↕";
  return direction === "asc" ? "↑" : "↓";
}

export function monthLabel(value: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(value);
}

export function moveMonth(value: Date, amount: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1, 12, 0, 0);
}

export function calendarDates(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12, 0, 0);
  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() - first.getDay(), 12, 0, 0);
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index, 12, 0, 0));
}

export function calendarDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
