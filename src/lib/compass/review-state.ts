import type { CompassClient } from "./types";

export type SharedReviewStatus = "needs_review" | "scheduled" | "completed" | "declined" | "acknowledged";

export function dateOnly(value: string): string {
  const clean = String(value || "").trim();
  if (!clean) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) return clean.slice(0, 10);
  const parsed = new Date(clean);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function newestDate(...values: string[]): string {
  return values.map(dateOnly).filter(Boolean).sort().at(-1) ?? "";
}

export function formalAccountReviewDate(client: CompassClient): string {
  return newestDate(client.lastAccountReview || "", client.reviewOutcome?.reviewedAt || "");
}

export function reviewCadenceDate(client: CompassClient): string {
  const formal = formalAccountReviewDate(client);
  if (client.accountReviewStatus === "declined") {
    return newestDate(formal, client.accountReviewCycleResolvedDate || "");
  }
  return formal;
}

export function reviewIsTemporarilyScheduled(client: CompassClient, now = new Date()): boolean {
  if (client.accountReviewStatus !== "scheduled") return false;
  const next = dateOnly(client.accountReviewNextDate || "");
  if (!next) return false;
  const today = dateOnly(now.toISOString());
  return Boolean(today && next >= today);
}
