import type { CompassClient, CompassConfig } from "./types";

function parsedDate(value: string): Date | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function reviewDateOnly(value: string): string {
  const date = parsedDate(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function newestReviewDate(...values: string[]): string {
  const dated = values
    .map((value) => ({ value: reviewDateOnly(value), time: parsedDate(value)?.getTime() ?? 0 }))
    .filter((item) => item.value && item.time > 0)
    .sort((left, right) => right.time - left.time);
  return dated[0]?.value ?? "";
}

/**
 * One source of truth for the most recent completed account review recorded
 * anywhere inside the Compass client record.
 */
export function effectiveAccountReviewDate(client: Pick<CompassClient, "lastAccountReview" | "reviewOutcome">): string {
  return newestReviewDate(client.lastAccountReview, client.reviewOutcome?.reviewedAt || "");
}

export function accountReviewDueMonths(config: CompassConfig): number {
  const workflowCard = config.cards.find((card) => card.enabled && card.workflowRule === "reviews-due");
  return Math.max(1, workflowCard?.workflowMonths || config.thresholds.accountReviewDueMonths || 1);
}

export function monthsSinceAccountReview(client: Pick<CompassClient, "lastAccountReview" | "reviewOutcome">, now = new Date()): number | null {
  const reviewDate = parsedDate(effectiveAccountReviewDate(client));
  if (!reviewDate) return null;
  return Math.max(0, (now.getTime() - reviewDate.getTime()) / 2629800000);
}

export function isAccountReviewDue(
  client: Pick<CompassClient, "lastAccountReview" | "reviewOutcome">,
  months: number,
  now = new Date(),
): boolean {
  const elapsed = monthsSinceAccountReview(client, now);
  return elapsed === null || elapsed >= Math.max(1, months);
}
