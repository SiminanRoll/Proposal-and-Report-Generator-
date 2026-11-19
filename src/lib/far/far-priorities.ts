import type { FarReviewItem, Project } from "@/lib/projects/types";
import { farPresentationItems, safeFarClientText } from "./far-review";

export type FarPriorityStatus = NonNullable<FarReviewItem["priorityStatus"]>;

export const FAR_PRIORITY_STATUSES: { value: FarPriorityStatus; label: string }[] = [
  { value: "plan", label: "Plan next step" },
  { value: "resolved", label: "Already resolved" },
  { value: "verify", label: "Needs verification" },
  { value: "later", label: "Revisit later" },
];

export function farPriorityStatus(item: FarReviewItem): FarPriorityStatus {
  return item.priorityStatus ?? "verify";
}

/** Only separately reviewed client-facing FAR statements may be priority candidates.
 * Selecting one explicit Top 3 checkbox makes the selection intentional; for
 * existing saved FARs without selection data, use up to three approved decisions.
 */
export function farTopPriorities(project: Project): FarReviewItem[] {
  const groups = farPresentationItems(project);
  const eligible = [...groups["open-decision"], ...groups["potential-adjustment"]]
    .filter((item) => safeFarClientText(item.clientText) && item.prioritySelected !== false);
  const selected = eligible.filter((item) => item.prioritySelected === true);
  const pool = selected.length > 0 ? selected : eligible;
  const seen = new Set<string>();
  return pool.filter((item) => {
    const key = item.clientText.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

export function farPriorityEligibleCount(project: Project): number {
  const groups = farPresentationItems(project);
  return [...groups["open-decision"], ...groups["potential-adjustment"]].length;
}

export function safeFarActionText(value: string): string {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < 6 || text.length > 210 || /@|\$\s*\d|\b(?:ticket|case|agreement|company|contact)\s*#?\d+|\bconfidential\b|\b(?:dr|mr|ms|mrs)\.\s+\w+/i.test(text)) return "";
  return text;
}

export function priorityActionSummary(item: FarReviewItem): string {
  const custom = safeFarActionText(item.priorityNextAction ?? "");
  const resolved = safeFarActionText(item.priorityResolutionNote ?? "");
  const status = farPriorityStatus(item);
  if (status === "resolved") return resolved || "Reported resolved; confirm the current technical evidence.";
  if (status === "later") return custom || "Revisit at the next technology review.";
  return custom || (status === "verify" ? "Confirm whether this is still an active concern." : "Agree on scope, timing, and the next action.");
}

export function farPriorityScoreLink(project: Project, item: FarReviewItem): { area: string; note: string; scored: boolean } {
  const content = (item.clientText + " " + item.evidence).toLowerCase();
  const currentFacts = project.intelligence.facts.filter((fact) => {
    const source = project.sources.flatMap((group) => group.files).find((file) => file.id === fact.sourceFileId);
    return fact.confidence === "high" && source?.status !== "failed" && source?.analysis?.sourceType !== "far-brief";
  });
  if (/workstation|computer|device age|replacement|operating system|server lifecycle|warranty/.test(content)) {
    const measured = currentFacts.some((f) => f.key === "scalepad.inventory" || f.key === "scalepad.replacement.overdue");
    return { area: "Equipment health", note: measured ? "Related current lifecycle measure" : "Verify against current inventory", scored: measured };
  }
  if (/security|mfa|malware|antivirus|endpoint|phishing|firewall|threat/.test(content)) {
    const measured = currentFacts.some((f) => f.key === "huntress.eventsAnalyzed" || f.key === "huntress.entitiesProtected");
    return { area: "Security protection", note: measured ? "Related current monitoring measure" : "Verify security coverage", scored: measured };
  }
  if (/backup|restore|recovery|battery backup|ups|continuity/.test(content)) {
    return { area: "Recovery readiness", note: "Not separately scored by this FAR", scored: false };
  }
  return { area: "Operational improvement", note: "No automatic score impact", scored: false };
}
