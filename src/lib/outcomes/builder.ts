import type { Finding, FindingCandidate, Project, Recommendation } from "@/lib/projects/types";
import { factNumber, formatMetric } from "./client-report-data";
import { adaptOrganizationLanguage, organizationReference, organizationTerm } from "@/lib/projects/client-language";
import { hasAgreedReviewPlan } from "@/lib/review-outcomes/model";

const CATEGORY_LABELS: Record<Finding["category"], string> = {
  security: "Security",
  network: "Network health",
  lifecycle: "Technology lifecycle",
  backup: "Backup & recovery",
  operations: "Operations",
  planning: "Proactive planning",
};

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function sentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function priorityRank(value: FindingCandidate["severity"]): number {
  return value === "priority" ? 3 : value === "attention" ? 2 : 1;
}

function convertFinding(candidate: FindingCandidate, project: Project): Finding {
  return {
    id: createId("finding"),
    category: candidate.category,
    title: candidate.title,
    clientSummary: adaptOrganizationLanguage(candidate.clientSummary, project),
    severity: candidate.severity,
    evidenceIds: [candidate.sourceFileId],
  };
}

function healthyFinding(project: Project): Finding | null {
  const candidates = project.intelligence.findingCandidates;
  if (candidates.some((item) => item.severity === "healthy")) return null;
  const factCount = project.intelligence.facts.length;
  if (!factCount) return null;
  return {
    id: createId("finding"),
    category: "operations",
    title: "A strong baseline is already visible",
    clientSummary: `The review confirmed ${factCount} useful environment facts. These provide a reliable starting point for focused planning instead of broad, disruptive change.`,
    severity: "healthy",
    evidenceIds: project.intelligence.sourceSummaries.map((item) => item.fileId),
  };
}

function recommendationCopy(category: Finding["category"], project: Project): { title: string; value: string } {
  const proposal = project.type !== "client-report";
  const copies: Record<Finding["category"], { title: string; report: string; proposal: string }> = {
    security: {
      title: "Strengthen the security baseline",
      report: "Address the highest-value protection gaps first, then verify the controls through the next client review.",
      proposal: "Advantage 360 will standardize monitoring, protection, patching, and response around a clearly managed security baseline.",
    },
    network: {
      title: "Stabilize the network foundation",
      report: "Document the network, resolve the items affecting reliability, and create a clear replacement path for aging infrastructure.",
      proposal: "Advantage 360 will bring the network under proactive management so connectivity, access, and support are handled as one system.",
    },
    lifecycle: {
      title: "Plan replacements before they become emergencies",
      report: `Use a practical replacement schedule that prioritizes business risk, warranty status, and the systems ${organizationReference(project)} depends on most.`,
      proposal: `Advantage 360 will maintain a proactive lifecycle plan so critical devices are addressed before age or support status interrupts ${organizationReference(project)}.`,
    },
    backup: {
      title: "Confirm recovery readiness",
      report: "Verify what is protected, how quickly it can be restored, and where any recovery gaps remain.",
      proposal: `Advantage 360 will align backup, recovery, and continuity around the systems and data ${organizationReference(project)} cannot afford to lose.`,
    },
    operations: {
      title: "Create one accountable support experience",
      report: "Keep ownership clear, document the environment, and make future technology decisions from one shared plan.",
      proposal: "Advantage 360 will replace fragmented IT ownership with one accountable team, documented standards, and an ongoing support process.",
    },
    planning: {
      title: "Build the next 12-month technology plan",
      report: "Turn today’s findings into a short, prioritized roadmap with clear owners and review dates.",
      proposal: `Advantage 360 will maintain the roadmap, budget visibility, and review cadence needed to keep technology aligned with ${organizationReference(project)}.`,
    },
  };
  const selected = copies[category];
  return { title: selected.title, value: proposal ? selected.proposal : selected.report };
}

function recommendationForCategory(category: Finding["category"], findings: Finding[], project: Project): Recommendation {
  const copy = recommendationCopy(category, project);
  return {
    id: createId("recommendation"),
    title: copy.title,
    clientValue: copy.value,
    findingIds: findings.filter((item) => item.category === category).map((item) => item.id),
    itemIds: [],
    optional: false,
  };
}

function clientReportDefaultSummary(project: Project): string {
  const assets = factNumber(project, "scalepad.totalAssets");
  const overdue = factNumber(project, "scalepad.replacement.overdue");
  const dueSoon = factNumber(project, "scalepad.replacement.dueSoon");
  const events = factNumber(project, "huntress.eventsAnalyzed");
  const incidents = factNumber(project, "huntress.incidentsReported");

  let lifecycle = "";
  if (assets) {
    if (overdue > 0 && dueSoon > 0) {
      lifecycle = `Your technology review includes ${assets} technology assets. ${overdue} aging system${overdue === 1 ? "" : "s"} ${overdue === 1 ? "carries" : "carry"} a higher risk of unexpected failure as ${overdue === 1 ? "it continues" : "they continue"} to age, and ${dueSoon} more ${dueSoon === 1 ? "is" : "are"} approaching the planning window. That does not mean everything needs to be replaced at once; Advantage can help prioritize the highest-risk systems and build a practical plan over time.`;
    } else if (overdue > 0) {
      lifecycle = `Your technology review includes ${assets} technology assets. ${overdue} aging system${overdue === 1 ? "" : "s"} ${overdue === 1 ? "carries" : "carry"} a higher risk of unexpected failure as ${overdue === 1 ? "it continues" : "they continue"} to age. That does not mean everything needs to be replaced at once; Advantage can help prioritize the highest-risk systems and build a practical plan over time.`;
    } else if (dueSoon > 0) {
      lifecycle = `Your technology review includes ${assets} technology assets. ${dueSoon} system${dueSoon === 1 ? " is" : "s are"} approaching the planning window, giving you time to plan ahead before age becomes a larger operational risk.`;
    } else {
      lifecycle = `Your technology review includes ${assets} technology assets. The current lifecycle picture is healthy, with no systems flagged for near-term replacement planning.`;
    }
  } else {
    lifecycle = "The available technology environment was reviewed to give you a clear picture of what is working and what may need attention.";
  }

  const security = events
    ? incidents > 0
      ? ` Security monitoring remains active, with ${formatMetric(events)} events analyzed and ${incidents} reported incident${incidents === 1 ? "" : "s"} identified for review.`
      : ` Security monitoring remains active, with ${formatMetric(events)} events analyzed and no reported incidents.`
    : incidents > 0
      ? ` Security monitoring identified ${incidents} reported incident${incidents === 1 ? "" : "s"} for review.`
      : "";
  const compliance = project.hipaa.enabled
    ? " HIPAA readiness is also included so any remaining items can be reviewed alongside the technology plan."
    : "";
  const close = " The goal is simple: understand what is working, what needs attention, and what to plan for next.";

  return `${lifecycle}${security}${compliance}${close}`.trim();
}

function executiveSummary(project: Project, findings: Finding[]): string {
  const priority = findings.filter((item) => item.severity === "priority").length;
  const attention = findings.filter((item) => item.severity === "attention").length;
  const pain = project.painPoints.filter(Boolean)[0];
  const context = pain ? `The review was shaped around one clear concern: ${sentence(pain)}` : "The review combines the available technical evidence into one clear client conversation.";

  if (project.type === "client-report") {
    if (hasAgreedReviewPlan(project.reviewOutcome)) {
      const tailoredFraming = project.reviewOutcome.executiveSummary.trim() || project.reviewOutcome.meetingSummary.trim();
      if (tailoredFraming) return tailoredFraming;
    }
    const assets = factNumber(project, "scalepad.totalAssets");
    const events = factNumber(project, "huntress.eventsAnalyzed");
    if (assets || events || project.hipaa.enabled) return clientReportDefaultSummary(project);
    if (hasAgreedReviewPlan(project.reviewOutcome)) return `${context} ${sentence(project.reviewOutcome.meetingSummary)}${project.reviewOutcome.agreedNextStep.trim() ? ` Agreed next step: ${sentence(project.reviewOutcome.agreedNextStep)}` : ""}`.trim();
    return `This technology review brings the available information into one place so the conversation stays simple and useful. We found ${priority} priority item${priority === 1 ? "" : "s"} and ${attention} item${attention === 1 ? "" : "s"} that deserve attention. The goal is to focus on what matters most and build a practical plan for what comes next.`;
  }
  if (project.type === "legacy-modernization") {
    const assets = factNumber(project, "scalepad.totalAssets") || factNumber(project, "environment.totalComputers");
    const overdue = factNumber(project, "scalepad.replacement.overdue");
    const dueSoon = factNumber(project, "scalepad.replacement.dueSoon");
    return `${context} The RFT is the primary technical assessment${assets ? ` and documents ${assets} systems, including ${overdue} replacement priorities and ${dueSoon} planning items` : ""}. The existing proposal is used as the scope and pricing reference, then reorganized into a clearer Advantage 360 recommendation, investment, and approval path.`;
  }
  return `We reviewed the technology supporting your ${organizationTerm(project)} using the RFT as the primary technical assessment. The proposal carries its hardware, operating-system support, storage, security configuration, patching, backup, and application findings into our recommendations, investment, and next steps.`;
}

export function buildOutcome(project: Project): Pick<Project, "findings" | "recommendations" | "presentation"> {
  const findings = project.intelligence.findingCandidates
    .slice()
    .sort((a, b) => priorityRank(b.severity) - priorityRank(a.severity))
    .map((candidate) => convertFinding(candidate, project));
  const healthy = healthyFinding(project);
  if (healthy) findings.push(healthy);

  const actionableCategories = [...new Set(findings.filter((item) => item.severity !== "healthy").map((item) => item.category))];
  if (!actionableCategories.includes("planning")) actionableCategories.push("planning");
  if (project.type !== "client-report" && !actionableCategories.includes("operations")) actionableCategories.unshift("operations");
  const recommendations = actionableCategories.slice(0, 6).map((category) => recommendationForCategory(category, findings, project));

  const title = project.type === "client-report"
    ? (hasAgreedReviewPlan(project.reviewOutcome) && project.reviewOutcome.reportTitle.trim() ? project.reviewOutcome.reportTitle.trim() : `${project.client.name} Technology Review`)
    : project.type === "legacy-modernization"
      ? `${project.client.name} Modern Proposal`
      : "Advantage 360";

  return {
    findings,
    recommendations,
    presentation: {
      ...project.presentation,
      title,
      executiveSummary: executiveSummary(project, findings),
    },
  };
}

export function projectWithBuiltOutcome(project: Project): Project {
  const outcome = buildOutcome(project);
  const timestamp = new Date().toISOString();
  return {
    ...project,
    ...outcome,
    presentation: { ...outcome.presentation, publishedAt: timestamp },
    updatedAt: timestamp,
  };
}

export function outcomeReady(project: Project): boolean {
  return Boolean(project.presentation.executiveSummary && project.findings.length && project.recommendations.length);
}

export function categoryLabel(category: Finding["category"]): string {
  return CATEGORY_LABELS[category];
}
