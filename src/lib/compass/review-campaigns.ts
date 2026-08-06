import type { CompassClient, CompassOpportunity } from "./types";
import type { ReviewDisposition } from "../review-outcomes/types";

export type CampaignHealth = "all" | "served" | "follow-through" | "review-needed";
export type ClientCampaignHealth = Exclude<CampaignHealth, "all">;

const NO_QUOTE_REQUIRED = new Set<ReviewDisposition>([
  "client-purchased",
  "monitor",
  "deferred",
  "no-action",
  "completed",
]);

function validDate(value: string | undefined): boolean {
  if (!value) return false;
  return Number.isFinite(Date.parse(value));
}

export function clientReviewDate(client: CompassClient): string {
  const values = [client.lastAccountReview, client.reviewOutcome?.reviewedAt]
    .filter((value): value is string => validDate(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  return values[0] ?? "";
}

export function clientHasReview(client: CompassClient): boolean {
  return Boolean(clientReviewDate(client) || client.reviewOutcome?.status === "confirmed");
}

export function clientHasQuote(client: CompassClient): boolean {
  return Boolean(client.quoted || validDate(client.lastQuoteDate) || client.reviewOutcome?.items.some((item) => item.quoted));
}

export function reviewOutcomeDoesNotRequireQuote(client: CompassClient): boolean {
  if (client.reviewOutcome?.status !== "confirmed") return false;
  const included = client.reviewOutcome.items.filter((item) => item.includeInReport);
  return included.length > 0 && included.every((item) => NO_QUOTE_REQUIRED.has(item.disposition));
}

export interface CampaignHealthResult {
  health: ClientCampaignHealth;
  label: string;
  reason: string;
  nextAction: string;
}

export function campaignHealthForClient(client: CompassClient): CampaignHealthResult {
  const reviewed = clientHasReview(client);
  const quoted = clientHasQuote(client);
  const noQuoteRequired = reviewOutcomeDoesNotRequireQuote(client);

  if (reviewed && (quoted || noQuoteRequired)) {
    return {
      health: "served",
      label: "Reviewed and served",
      reason: quoted ? "A current review and completed quote are recorded." : "A current review documents that no quote is presently required.",
      nextAction: client.nextFollowUp ? "Complete the scheduled relationship follow-up." : "Maintain the relationship and revisit when the agreed timing calls for it.",
    };
  }

  if (reviewed || quoted) {
    return {
      health: "follow-through",
      label: "Follow-through needed",
      reason: reviewed
        ? "The need was reviewed, but a completed quote or clear no-quote outcome is not recorded."
        : "A quote is recorded, but the account-review history is missing.",
      nextAction: reviewed ? "Confirm whether a consultation or quote was warranted and record the outcome." : "Add the missing account-review date and outcome from the existing history.",
    };
  }

  return {
    health: "review-needed",
    label: "Review needed",
    reason: "Neither an account review nor a completed quote is recorded for this technical need.",
    nextAction: "Contact the client and schedule the account review when appropriate.",
  };
}

export interface CampaignHealthMetric {
  health: CampaignHealth;
  count: number;
  value: number;
  affectedDeviceCount: number;
}

export function campaignHealthMetrics(rows: Array<{ client: CompassClient; opportunity: CompassOpportunity; affectedDeviceCount: number }>): CampaignHealthMetric[] {
  const metrics = new Map<CampaignHealth, CampaignHealthMetric>([
    ["all", { health: "all", count: 0, value: 0, affectedDeviceCount: 0 }],
    ["served", { health: "served", count: 0, value: 0, affectedDeviceCount: 0 }],
    ["follow-through", { health: "follow-through", count: 0, value: 0, affectedDeviceCount: 0 }],
    ["review-needed", { health: "review-needed", count: 0, value: 0, affectedDeviceCount: 0 }],
  ]);

  for (const row of rows) {
    const health = campaignHealthForClient(row.client).health;
    for (const key of ["all", health] as const) {
      const metric = metrics.get(key)!;
      metric.count += 1;
      metric.value += row.opportunity.estimatedValue;
      metric.affectedDeviceCount += row.affectedDeviceCount;
    }
  }

  return ["all", "served", "follow-through", "review-needed"].map((health) => metrics.get(health as CampaignHealth)!);
}
