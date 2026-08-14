import type { PresentationConcernId, PresentationConcernSelection, ReviewDisposition, ReviewOutcome, ReviewOutcomeItem } from "./types";

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

const PRESENTATION_CONCERN_IDS: PresentationConcernId[] = [
  "server-lifecycle",
  "workstation-lifecycle",
  "os-support",
  "backup-recovery",
  "storage-capacity",
  "network-reliability",
  "cybersecurity",
  "hipaa-readiness",
  "practice-growth",
  "other",
];

function stripReportMarkdownEmphasis(value: unknown): string {
  return String(value ?? "")
    .replace(/\*\*([^\n]*?)\*\*/g, "$1")
    .replace(/__([^\n]*?)__/g, "$1");
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizePresentationConcerns(value: unknown): PresentationConcernSelection[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<PresentationConcernId>();
  const output: PresentationConcernSelection[] = [];
  for (const entry of value) {
    const candidate: Partial<PresentationConcernSelection> | null = typeof entry === "string" ? { id: entry as PresentationConcernId } : entry && typeof entry === "object" ? entry as Partial<PresentationConcernSelection> : null;
    if (!candidate || !PRESENTATION_CONCERN_IDS.includes(candidate.id as PresentationConcernId)) continue;
    const id = candidate.id as PresentationConcernId;
    if (seen.has(id)) continue;
    seen.add(id);
    output.push({ id, customLabel: id === "other" ? stripReportMarkdownEmphasis(candidate.customLabel).trim() : undefined });
  }
  return output.slice(0, 3);
}

export function emptyReviewOutcome(): ReviewOutcome {
  return { status: "not-reviewed", reviewedAt: "", meetingSummary: "", agreedNextStep: "", reportTitle: "", executiveSummary: "", presentationConcerns: [], clientConcern: "", items: [], lastUpdatedAt: "" };
}

export function createReviewOutcomeItem(input: Partial<ReviewOutcomeItem> = {}): ReviewOutcomeItem {
  return {
    id: input.id || createId("review-item"),
    title: stripReportMarkdownEmphasis(input.title ?? "Decision from the review"),
    technicalFinding: stripReportMarkdownEmphasis(input.technicalFinding),
    disposition: REVIEW_DISPOSITION_OPTIONS.some((option) => option.value === input.disposition) ? input.disposition! : "investigate",
    clientFacingNote: stripReportMarkdownEmphasis(input.clientFacingNote),
    internalNote: stripReportMarkdownEmphasis(input.internalNote),
    responsibleParty: stripReportMarkdownEmphasis(input.responsibleParty),
    clientResponsibility: stripReportMarkdownEmphasis(input.clientResponsibility),
    advantageResponsibility: stripReportMarkdownEmphasis(input.advantageResponsibility),
    targetDate: stripReportMarkdownEmphasis(input.targetDate),
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
    meetingSummary: stripReportMarkdownEmphasis(candidate.meetingSummary),
    agreedNextStep: stripReportMarkdownEmphasis(candidate.agreedNextStep),
    reportTitle: stripReportMarkdownEmphasis(candidate.reportTitle),
    executiveSummary: stripReportMarkdownEmphasis(candidate.executiveSummary),
    presentationConcerns: normalizePresentationConcerns(candidate.presentationConcerns),
    clientConcern: stripReportMarkdownEmphasis(candidate.clientConcern),
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

function clientFacingActionDetail(item: ReviewOutcomeItem, title: string): string {
  const note = item.clientFacingNote.trim();
  if (!note) return "";
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (normalize(note) === normalize(title)) return "";
  if (/^supporting condition discussed during the review/i.test(note)) return "";
  return note;
}

export function reviewOutcomePlanActions(outcome: ReviewOutcome | undefined): Array<{ id: string; title: string; detail: string; timing: string; owner: string; tone: "priority" | "attention" | "steady" }> {
  if (!hasAgreedReviewPlan(outcome)) return [];
  const actions = outcome!.items
    .filter((item) => item.includeInReport)
    .map((item) => {
      const option = dispositionOption(item.disposition);
      const title = item.title.trim() || option.label;
      return {
        id: item.id,
        title,
        // Technical findings are internal evidence. Never fall back to them in
        // the client-facing agreed roadmap when tailored plan language is blank.
        detail: clientFacingActionDetail(item, title),
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
