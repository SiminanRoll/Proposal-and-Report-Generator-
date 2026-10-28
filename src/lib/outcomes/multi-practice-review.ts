import type { Project } from "@/lib/projects/types";
import { outcomeReady } from "@/lib/outcomes/builder";
import { factNumber, inventoryReportDevices, inventoryReconciliation, lifecycleSummary, osSupportSummary, storageAttentionSummary } from "@/lib/outcomes/client-report-data";
import { clientReportPlanActions } from "@/lib/outcomes/client-report-plan";
import { technologyBudgetOutlook } from "@/lib/outcomes/technology-budget-outlook";
import { hipaaTopGaps, scoreHipaaAssessment } from "@/lib/hipaa/engine";

const STORAGE_KEY = "advantage.client-compass.multi-practice-reviews.v1";
const MAX_PRACTICES = 6;

export interface MultiPracticeReview {
  id: string;
  title: string;
  ownerLabel: string;
  projectIds: string[];
  sourceUpdatedAt: Record<string, string>;
  includeBudget: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PracticeReview {
  id: string;
  companyId: string;
  name: string;
  sourceUpdatedAt: string;
  securityEvidence: boolean;
  securityEventsReported: boolean;
  securityInvestigationsReported: boolean;
  securityIncidentsReported: boolean;
  securityEvents: number;
  securityInvestigations: number;
  securityIncidents: number;
  assetCount: number;
  devices: ReturnType<typeof inventoryReportDevices>;
  lifecycle: ReturnType<typeof lifecycleSummary>;
  os: ReturnType<typeof osSupportSummary>;
  storage: ReturnType<typeof storageAttentionSummary>;
  bdrCount: number;
  hipaaEnabled: boolean;
  hipaaLabel: string;
  hipaaOpen: number;
  hipaaGaps: string[];
  actions: ReturnType<typeof clientReportPlanActions>;
  budget: ReturnType<typeof technologyBudgetOutlook>;
  reviewAgreed: boolean;
}

export interface MultiPracticeData {
  review: MultiPracticeReview;
  practices: PracticeReview[];
  totalReportedAssetEntries: number;
  combinedBudgetLow: number;
  combinedBudgetHigh: number;
  combinedQuarterlyLow: number;
  combinedQuarterlyHigh: number;
  warnings: string[];
  errors: string[];
}

function valid(value: unknown): value is MultiPracticeReview {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<MultiPracticeReview>;
  return typeof v.id === "string" && typeof v.title === "string"
    && typeof v.ownerLabel === "string" && Array.isArray(v.projectIds)
    && v.projectIds.every((id) => typeof id === "string")
    && v.sourceUpdatedAt !== null && typeof v.sourceUpdatedAt === "object"
    && typeof v.includeBudget === "boolean";
}

export function listMultiPracticeReviews(): MultiPracticeReview[] {
  if (typeof window === "undefined") return [];
  try {
    const records: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(records) ? records.filter(valid).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : [];
  } catch { return []; }
}

export function saveMultiPracticeReview(review: MultiPracticeReview): void {
  if (typeof window === "undefined") throw new Error("Report storage is available only in the browser.");
  const all = listMultiPracticeReviews().filter((item) => item.id !== review.id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...review, updatedAt: new Date().toISOString() }, ...all]));
}

export function deleteMultiPracticeReview(id: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(listMultiPracticeReviews().filter((item) => item.id !== id)));
}

export function newMultiPracticeReview(projects: Project[], ownerLabel: string, title: string, includeBudget: boolean): MultiPracticeReview {
  const now = new Date().toISOString();
  const sourceUpdatedAt: Record<string, string> = {};
  projects.forEach((p) => { sourceUpdatedAt[p.id] = p.updatedAt; });
  return {
    id: "multi-review-" + (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now())),
    title: title.trim() || "Multi-Practice Technology Health Review",
    ownerLabel: ownerLabel.trim(),
    projectIds: projects.map((p) => p.id),
    sourceUpdatedAt, includeBudget, createdAt: now, updatedAt: now,
  };
}

function hasSecurityData(project: Project): boolean {
  return project.intelligence.facts.some((fact) => fact.key.startsWith("huntress."))
    || project.intelligence.sourceSummaries.some((item) => item.sourceType === "huntress");
}

function issueText(project: Project): string {
  return project.client.name || project.name || "Unnamed practice";
}

export function buildMultiPracticeData(review: MultiPracticeReview, projects: Project[]): MultiPracticeData {
  const errors: string[] = [], warnings: string[] = [];
  const byId = new Map(projects.map((project) => [project.id, project]));
  const ids = review.projectIds.map((id) => String(id));
  if (ids.length < 2 || ids.length > MAX_PRACTICES) errors.push("Select between 2 and 6 distinct practice reports.");
  if (new Set(ids).size !== ids.length) errors.push("The same source report cannot appear twice.");
  if (!review.ownerLabel.trim()) errors.push("Confirm the shared ownership label before publishing.");
  const selected = ids.flatMap((id) => byId.get(id) ? [byId.get(id)!] : []);
  ids.filter((id) => !byId.has(id)).forEach((id) => errors.push("Source report is missing from this browser: " + id));
  const companyIds = new Set<string>();
  const practiceNames = new Set<string>();
  for (const project of selected) {
    if (project.type !== "client-report") errors.push(issueText(project) + " is not a Technology Review.");
    if (!outcomeReady(project)) errors.push(issueText(project) + " must be ready before it can be included.");
    const cid = project.client.companyId?.trim();
    if (cid) {
      if (companyIds.has(cid)) errors.push(issueText(project) + " shares a company identity with another selected report. Use separate practice records or the existing location review.");
      companyIds.add(cid);
    }
    const key = issueText(project).trim().toLocaleLowerCase();
    if (practiceNames.has(key)) errors.push("Two selected reports share the same practice name; confirm separate identities before combining.");
    practiceNames.add(key);
    if (review.sourceUpdatedAt[project.id] !== project.updatedAt) {
      errors.push(issueText(project) + " has changed since the combined review was saved. Reconfirm the current source reports.");
    }
    const reconciliation = inventoryReconciliation(project);
    if (!reconciliation.passed) errors.push(issueText(project) + " has unresolved inventory reconciliation; correct its original report before exporting.");
    if (!cid) warnings.push(issueText(project) + " has no company UUID on the standalone report; identity is tied to its unique report ID.");
  }
  if (selected.length !== ids.length) warnings.push("One or more linked reports are unavailable in this browser.");
  const practices: PracticeReview[] = selected.map((project) => {
    const devices = inventoryReportDevices(project);
    const h = project.hipaa.enabled ? scoreHipaaAssessment(project.hipaa) : null;
    const hipaaGaps = project.hipaa.enabled
      ? hipaaTopGaps(project, 4).map((item) => item.question.title || item.question.id)
      : [];
    const evidence = hasSecurityData(project);
    if (!evidence) warnings.push(issueText(project) + ": no Huntress reporting data confirmed. Security is shown as not assessed, not as zero incidents.");
    if (!project.hipaa.enabled) warnings.push(issueText(project) + ": HIPAA readiness not enabled for this report.");
    return {
      id: project.id, companyId: project.client.companyId?.trim() || "",
      name: issueText(project), sourceUpdatedAt: project.updatedAt,
      securityEvidence: evidence,
      securityEventsReported: project.intelligence.facts.some((fact) => fact.key === "huntress.eventsAnalyzed"),
      securityInvestigationsReported: project.intelligence.facts.some((fact) => fact.key === "huntress.signalsInvestigated"),
      securityIncidentsReported: project.intelligence.facts.some((fact) => fact.key === "huntress.incidentsReported"),
      securityEvents: evidence ? factNumber(project, "huntress.eventsAnalyzed") : 0,
      securityInvestigations: evidence ? factNumber(project, "huntress.signalsInvestigated") : 0,
      securityIncidents: evidence ? factNumber(project, "huntress.incidentsReported") : 0,
      assetCount: devices.length, devices,
      lifecycle: lifecycleSummary(project), os: osSupportSummary(project),
      storage: storageAttentionSummary(project),
      bdrCount: devices.filter((device) => device.type === "backup-server").length,
      hipaaEnabled: project.hipaa.enabled,
      hipaaLabel: h?.label || "Not assessed",
      hipaaOpen: h?.notYetAssessedCount ?? 0, hipaaGaps,
      actions: clientReportPlanActions(project),
      budget: technologyBudgetOutlook(project),
      reviewAgreed: project.reviewOutcome.status === "confirmed",
    };
  });
  // Cross-practice duplicates are uncertain. Do not merge on device names or count one physical asset twice as "unique".
  const serials = new Map<string, string>();
  for (const p of practices) {
    for (const device of p.devices) {
      const serial = device.serial?.trim().toUpperCase();
      if (!serial || serial.length < 5 || /^(N\/A|UNKNOWN|NONE|NOT AVAILABLE)$/i.test(serial)) continue;
      const prior = serials.get(serial);
      if (prior && prior !== p.name) {
        warnings.push("A device serial appears in both " + prior + " and " + p.name + ". Confirm shared equipment before relying on combined asset counts or budgets.");
      } else serials.set(serial, p.name);
    }
  }
  const combinedBudgetLow = practices.reduce((sum, p) => sum + p.budget.replacementBudgetLow, 0);
  const combinedBudgetHigh = practices.reduce((sum, p) => sum + p.budget.replacementBudgetHigh, 0);
  return {
    review, practices, errors, warnings,
    totalReportedAssetEntries: practices.reduce((sum, p) => sum + p.assetCount, 0),
    combinedBudgetLow, combinedBudgetHigh,
    combinedQuarterlyLow: Math.round(combinedBudgetLow / 4),
    combinedQuarterlyHigh: Math.round(combinedBudgetHigh / 4),
  };
}
