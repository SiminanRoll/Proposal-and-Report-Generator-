import type { ReviewDisposition, ReviewOutcome, ReviewOutcomeItem } from "./types";

export interface ReviewDispositionOption {
  value: ReviewDisposition;
  label: string;
  defaultOwner: string;
  defaultTiming: string;
  tone: "priority" | "attention" | "steady";
}

export const REVIEW_DISPOSITION_OPTIONS: ReviewDispositionOption[] = [
  { value: "advantage-replace", label: "Advantage to replace", defaultOwner: "Advantage + Client", defaultTiming: "Project planning", tone: "priority" },
  { value: "client-purchased", label: "Client already purchased equipment", defaultOwner: "Client", defaultTiming: "In progress", tone: "steady" },
  { value: "advantage-install-client-purchased", label: "Advantage to install client-purchased equipment", defaultOwner: "Advantage + Client", defaultTiming: "Schedule deployment", tone: "attention" },
  { value: "upgrade-only", label: "Upgrade only", defaultOwner: "Advantage", defaultTiming: "Near term", tone: "attention" },
  { value: "retire-decommission", label: "Retire and decommission", defaultOwner: "Advantage + Client", defaultTiming: "Planned retirement", tone: "priority" },
  { value: "migrate-retire", label: "Migrate and retire", defaultOwner: "Advantage + Client", defaultTiming: "Transition project", tone: "priority" },
  { value: "monitor", label: "Monitor", defaultOwner: "Advantage", defaultTiming: "Ongoing", tone: "steady" },
  { value: "deferred", label: "Deferred", defaultOwner: "Client + Advantage", defaultTiming: "Future review", tone: "attention" },
  { value: "no-action", label: "No action needed", defaultOwner: "Client + Advantage", defaultTiming: "No action", tone: "steady" },
  { value: "completed", label: "Already completed", defaultOwner: "Client + Advantage", defaultTiming: "Completed", tone: "steady" },
  { value: "investigate", label: "Needs further investigation", defaultOwner: "Advantage", defaultTiming: "Follow-up", tone: "attention" },
];

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyReviewOutcome(): ReviewOutcome {
  return { status: "not-reviewed", reviewedAt: "", meetingSummary: "", agreedNextStep: "", reportTitle: "", executiveSummary: "", items: [], lastUpdatedAt: "" };
}

export function createReviewOutcomeItem(input: Partial<ReviewOutcomeItem> = {}): ReviewOutcomeItem {
  return {
    id: input.id || createId("review-item"),
    title: String(input.title ?? "Decision from the review"),
    technicalFinding: String(input.technicalFinding ?? ""),
    disposition: REVIEW_DISPOSITION_OPTIONS.some((option) => option.value === input.disposition) ? input.disposition! : "investigate",
    clientFacingNote: String(input.clientFacingNote ?? ""),
    internalNote: String(input.internalNote ?? ""),
    responsibleParty: String(input.responsibleParty ?? ""),
    clientResponsibility: String(input.clientResponsibility ?? ""),
    advantageResponsibility: String(input.advantageResponsibility ?? ""),
    targetDate: String(input.targetDate ?? ""),
    quoted: Boolean(input.quoted),
    includeInReport: input.includeInReport !== false,
    deviceIds: Array.isArray(input.deviceIds) ? input.deviceIds.map(String) : [],
    locationIds: Array.isArray(input.locationIds) ? input.locationIds.map(String) : [],
  };
}

export function normalizeReviewOutcome(value: unknown): ReviewOutcome {
  const candidate = value && typeof value === "object" ? value as Partial<ReviewOutcome> : {};
  const status = candidate.status === "draft" || candidate.status === "confirmed" ? candidate.status : "not-reviewed";
  return {
    status,
    reviewedAt: String(candidate.reviewedAt ?? ""),
    meetingSummary: String(candidate.meetingSummary ?? ""),
    agreedNextStep: String(candidate.agreedNextStep ?? ""),
    reportTitle: String(candidate.reportTitle ?? ""),
    executiveSummary: String(candidate.executiveSummary ?? ""),
    items: Array.isArray(candidate.items) ? candidate.items.map((item) => createReviewOutcomeItem(item)) : [],
    lastUpdatedAt: String(candidate.lastUpdatedAt ?? ""),
  };
}

export function dispositionOption(value: ReviewDisposition): ReviewDispositionOption {
  return REVIEW_DISPOSITION_OPTIONS.find((option) => option.value === value) ?? REVIEW_DISPOSITION_OPTIONS.at(-1)!;
}

export function hasAgreedReviewPlan(outcome: ReviewOutcome | undefined): boolean {
  if (!outcome || outcome.status === "not-reviewed") return false;
  return Boolean(outcome.meetingSummary.trim() || outcome.agreedNextStep.trim() || outcome.items.some((item) => item.includeInReport && (item.title.trim() || item.clientFacingNote.trim())));
}

export function reviewOutcomePlanActions(outcome: ReviewOutcome | undefined): Array<{ id: string; title: string; detail: string; timing: string; owner: string; tone: "priority" | "attention" | "steady" }> {
  if (!hasAgreedReviewPlan(outcome)) return [];
  const actions = outcome!.items
    .filter((item) => item.includeInReport)
    .map((item) => {
      const option = dispositionOption(item.disposition);
      return {
        id: item.id,
        title: item.title.trim() || option.label,
        detail: item.clientFacingNote.trim() || item.technicalFinding.trim() || option.label,
        timing: item.targetDate.trim() || option.defaultTiming,
        owner: item.responsibleParty.trim() || option.defaultOwner,
        tone: option.tone,
      };
    });
  if (!actions.length && outcome!.agreedNextStep.trim()) {
    actions.push({ id: "agreed-next-step", title: "Complete the agreed next step", detail: outcome!.agreedNextStep.trim(), timing: "Agreed timing", owner: "Advantage + Client", tone: "attention" });
  }
  return actions;
}

export function latestReviewOutcome(localValue: ReviewOutcome | undefined, incomingValue: ReviewOutcome | undefined): ReviewOutcome {
  const local = normalizeReviewOutcome(localValue);
  const incoming = normalizeReviewOutcome(incomingValue);
  const localTime = Date.parse(local.lastUpdatedAt);
  const incomingTime = Date.parse(incoming.lastUpdatedAt);
  if (Number.isFinite(incomingTime) && (!Number.isFinite(localTime) || incomingTime > localTime)) return incoming;
  if (Number.isFinite(localTime) && (!Number.isFinite(incomingTime) || localTime >= incomingTime)) return local;
  if (hasAgreedReviewPlan(incoming) && !hasAgreedReviewPlan(local)) return incoming;
  return local;
}
