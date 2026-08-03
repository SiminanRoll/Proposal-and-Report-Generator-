import type { Finding, FindingCandidate, Project, Recommendation } from "@/lib/projects/types";
import { factNumber, formatMetric } from "./client-report-data";

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

function convertFinding(candidate: FindingCandidate): Finding {
  return {
    id: createId("finding"),
    category: candidate.category,
    title: candidate.title,
    clientSummary: candidate.clientSummary,
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
  const proposal = project.type === "prospect-proposal";
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
      report: "Use a practical replacement schedule that prioritizes business risk, warranty status, and the systems the office depends on most.",
      proposal: "Advantage 360 will maintain a proactive lifecycle plan so critical devices are addressed before age or support status interrupts the practice.",
    },
    backup: {
      title: "Confirm recovery readiness",
      report: "Verify what is protected, how quickly it can be restored, and where any recovery gaps remain.",
      proposal: "Advantage 360 will align backup, recovery, and continuity around the systems and data the office cannot afford to lose.",
    },
    operations: {
      title: "Create one accountable support experience",
      report: "Keep ownership clear, document the environment, and make future technology decisions from one shared plan.",
      proposal: "Advantage 360 will replace fragmented IT ownership with one accountable team, documented standards, and an ongoing support process.",
    },
    planning: {
      title: "Build the next 12-month technology plan",
      report: "Turn today’s findings into a short, prioritized roadmap with clear owners and review dates.",
      proposal: "Advantage 360 will maintain the roadmap, budget visibility, and review cadence needed to keep technology aligned with the practice.",
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

function executiveSummary(project: Project, findings: Finding[]): string {
  const priority = findings.filter((item) => item.severity === "priority").length;
  const attention = findings.filter((item) => item.severity === "attention").length;
  const pain = project.painPoints.filter(Boolean)[0];
  const context = pain ? `The review was shaped around one clear concern: ${sentence(pain)}` : "The review combines the available technical evidence into one clear client conversation.";

  if (project.type === "client-report") {
    const assets = factNumber(project, "scalepad.totalAssets");
    const overdue = factNumber(project, "scalepad.replacement.overdue");
    const dueSoon = factNumber(project, "scalepad.replacement.dueSoon");
    const events = factNumber(project, "huntress.eventsAnalyzed");
    const incidents = factNumber(project, "huntress.incidentsReported");
    const canaries = factNumber(project, "huntress.canaryFiles");
    const malwareBlocked = factNumber(project, "huntress.malwareFilesBlocked");
    if (assets || events) {
      const lifecycle = assets ? `${assets} technology assets were reviewed, with ${overdue} recommended for replacement now and ${dueSoon} approaching the planning window.` : "The available lifecycle information was reviewed.";
      const security = events ? ` Huntress analyzed ${formatMetric(events)} security events, maintained ${canaries} ransomware canary files, blocked ${malwareBlocked} malware file${malwareBlocked === 1 ? "" : "s"}, and reported ${incidents} incidents.` : "";
      return `${lifecycle}${security} The result is one practical technology and security plan instead of two separate technical reports.`;
    }
    return `${context} We found ${priority} priority item${priority === 1 ? "" : "s"} and ${attention} item${attention === 1 ? "" : "s"} that deserve attention, while also preserving the healthy parts of the environment. The goal is a practical plan—not a technical data dump.`;
  }
  if (project.type === "legacy-modernization") {
    return `${context} The existing proposal has been reorganized into a clearer value story so the client can understand the scope, the reason behind it, and the path to approval without working through a legacy quote format.`;
  }
  return `${context} The assessment identified ${priority} priority item${priority === 1 ? "" : "s"} and ${attention} additional item${attention === 1 ? "" : "s"} that should be addressed. The proposed Advantage 360 approach connects those findings to one accountable support, security, recovery, and planning experience.`;
}

export function buildOutcome(project: Project): Pick<Project, "findings" | "recommendations" | "presentation"> {
  const findings = project.intelligence.findingCandidates
    .slice()
    .sort((a, b) => priorityRank(b.severity) - priorityRank(a.severity))
    .map(convertFinding);
  const healthy = healthyFinding(project);
  if (healthy) findings.push(healthy);

  const actionableCategories = [...new Set(findings.filter((item) => item.severity !== "healthy").map((item) => item.category))];
  if (!actionableCategories.includes("planning")) actionableCategories.push("planning");
  if (project.type === "prospect-proposal" && !actionableCategories.includes("operations")) actionableCategories.unshift("operations");
  const recommendations = actionableCategories.slice(0, 6).map((category) => recommendationForCategory(category, findings, project));

  const title = project.type === "client-report"
    ? `${project.client.name} Technology Review`
    : project.type === "legacy-modernization"
      ? `${project.client.name} Modern Proposal`
      : `${project.client.name} Advantage 360 Proposal`;

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
  return {
    ...project,
    ...outcome,
    updatedAt: new Date().toISOString(),
  };
}

export function outcomeReady(project: Project): boolean {
  return Boolean(project.presentation.executiveSummary && project.findings.length && project.recommendations.length);
}

export function categoryLabel(category: Finding["category"]): string {
  return CATEGORY_LABELS[category];
}
