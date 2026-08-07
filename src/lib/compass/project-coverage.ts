import { hasAgreedReviewPlan } from "../review-outcomes/model";
import type { ReviewDisposition } from "../review-outcomes/types";
import { buildCompassProjectPackages, type CompassProjectPackage } from "./project-packaging";
import { compareCoverageClients, coveragePriorityReason, quoteAgeBand, validDate } from "./project-coverage-priority";
import type { CompassClient, CompassConfig, CompassDataset, CompassDevice, CompassFinding } from "./types";

export type ProjectCoveragePosition = "needs-review" | "discussed-open" | "quoted-open";
export type ProjectCoverageCardId = ProjectCoveragePosition | "highest-risk" | "oldest-quotes" | "largest-need";
export type QuoteAgeBand = "recent" | "follow-up" | "re-engagement" | "revisit" | "date-missing";

export type ProjectCoverageCardSetId = "client-project-coverage" | "priority-lens";

export interface ProjectCoverageCardSetDefinition {
  id: ProjectCoverageCardSetId;
  label: string;
  title: string;
  description: string;
}
export type QualifiedProjectKind = "server" | "workstations";

export interface QualifiedProjectRecord {
  id: string;
  clientId: string;
  kind: QualifiedProjectKind;
  title: string;
  deviceIds: string[];
  technicalDrivers: string[];
  estimatedValue: number;
  critical: boolean;
  quoted: boolean;
  dispositions: ReviewDisposition[];
}

export interface ProjectCoverageClient {
  clientId: string;
  clientName: string;
  position: ProjectCoveragePosition;
  projects: QualifiedProjectRecord[];
  estimatedValue: number;
  serverProjectCount: number;
  workstationProjectCount: number;
  workstationDeviceCount: number;
  hasCriticalServer: boolean;
  technicalSeverity: number;
  reviewDate: string;
  quoteDate: string;
  quoteAgeBand: QuoteAgeBand;
  nextFollowUp: string;
  followUpPastDue: boolean;
  reviewHistoryMissing: boolean;
  missingDocumentedOutcome: boolean;
  noRelationshipHistory: boolean;
  hasUnsupportedSystems: boolean;
  attentionReason: string;
  priorityReason: string;
}

export interface ProjectCoverageCardMetric {
  id: ProjectCoverageCardId;
  title: string;
  count: number;
  estimatedValue: number;
  valueLabel: string;
  explanation: string;
  clients: ProjectCoverageClient[];
  stats: Array<{ label: string; value: string | number }>;
  spotlight: string;
}

export interface ProjectCoverageSnapshot {
  generatedAt: string;
  qualifyingClientCount: number;
  qualifyingProjectCount: number;
  clients: ProjectCoverageClient[];
  cards: ProjectCoverageCardMetric[];
  needsReviewExpectedCount: number;
  needsReviewDifference: number;
}

const RESOLVED_DISPOSITIONS = new Set<ReviewDisposition>(["client-purchased", "monitor", "deferred", "no-action", "completed"]);
const SERVER_CATEGORIES = new Set(["server-replacement", "server-retirement", "server-migration"]);
const WORKSTATION_CATEGORIES = new Set(["workstation-refresh", "client-purchased-deployment", "os-remediation"]);
const CRITICAL_SERVER_SIGNALS = new Set(["server-2012", "unsupported-server-os", "server-age-critical", "server-age-warranty-critical", "critical-server-storage"]);
const UNSUPPORTED_SYSTEM_SIGNALS = new Set(["server-2012", "unsupported-server-os", "windows-10-active"]);

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function rounded(value: number): number {
  return Math.round(Math.max(0, value));
}

function isOpenPackage(project: CompassProjectPackage): boolean {
  return project.includeInReport && !RESOLVED_DISPOSITIONS.has(project.disposition);
}

function projectDevices(project: CompassProjectPackage, devicesById: Map<string, CompassDevice>): CompassDevice[] {
  return project.deviceIds.flatMap((id) => {
    const device = devicesById.get(id);
    return device ? [device] : [];
  });
}

function mergeServerProject(
  clientId: string,
  packages: CompassProjectPackage[],
  devicesById: Map<string, CompassDevice>,
  findings: CompassFinding[],
): QualifiedProjectRecord | null {
  const serverPackages = packages.filter((project) => {
    if (SERVER_CATEGORIES.has(project.category)) return true;
    const devices = projectDevices(project, devicesById);
    return project.category === "application-migration" && devices.some((device) => device.deviceType === "physical-server" || device.deviceType === "virtual-server");
  });
  if (!serverPackages.length) return null;
  const deviceIds = unique(serverPackages.flatMap((project) => project.deviceIds).filter((id) => {
    const device = devicesById.get(id);
    return device?.deviceType === "physical-server" || device?.deviceType === "virtual-server";
  }));
  const relevantIds = new Set(deviceIds);
  const critical = findings.some((finding) => relevantIds.has(finding.deviceId) && (finding.severity === "critical" || CRITICAL_SERVER_SIGNALS.has(finding.category)));
  const categories = new Set(serverPackages.map((project) => project.category));
  const title = categories.has("server-retirement")
    ? "Server retirement or modernization"
    : categories.has("server-migration") || categories.has("application-migration")
      ? "Server migration or modernization"
      : critical ? "Priority server modernization" : "Server modernization";
  return {
    id: `coverage-${clientId}-server`,
    clientId,
    kind: "server",
    title,
    deviceIds,
    technicalDrivers: unique(serverPackages.flatMap((project) => project.technicalDrivers)).slice(0, 8),
    estimatedValue: rounded(serverPackages.reduce((sum, project) => sum + project.estimatedValue, 0)),
    critical,
    quoted: serverPackages.some((project) => project.quoted),
    dispositions: unique(serverPackages.map((project) => project.disposition)) as ReviewDisposition[],
  };
}

function mergeWorkstationProject(
  clientId: string,
  packages: CompassProjectPackage[],
  devicesById: Map<string, CompassDevice>,
  minimumWorkstations: number,
): QualifiedProjectRecord | null {
  const workstationPackages = packages.filter((project) => WORKSTATION_CATEGORIES.has(project.category));
  const deviceIds = unique(workstationPackages.flatMap((project) => project.deviceIds).filter((id) => devicesById.get(id)?.deviceType === "physical-workstation"));
  if (deviceIds.length < minimumWorkstations) return null;
  return {
    id: `coverage-${clientId}-workstations`,
    clientId,
    kind: "workstations",
    title: `${deviceIds.length}-workstation refresh`,
    deviceIds,
    technicalDrivers: unique(workstationPackages.flatMap((project) => project.technicalDrivers)).slice(0, 8),
    estimatedValue: rounded(workstationPackages.reduce((sum, project) => sum + project.estimatedValue, 0)),
    critical: false,
    quoted: workstationPackages.some((project) => project.quoted),
    dispositions: unique(workstationPackages.map((project) => project.disposition)) as ReviewDisposition[],
  };
}

function confirmedDiscussion(client: CompassClient): boolean {
  return Boolean(client.lastAccountReview || (client.reviewOutcome.status === "confirmed" && hasAgreedReviewPlan(client.reviewOutcome)));
}

function projectPosition(client: CompassClient, projects: QualifiedProjectRecord[]): ProjectCoveragePosition {
  if (client.quoted || client.lastQuoteDate || projects.some((project) => project.quoted)) return "quoted-open";
  if (confirmedDiscussion(client)) return "discussed-open";
  return "needs-review";
}

function dateIsPast(value: string, now: Date): boolean {
  const date = validDate(value);
  return Boolean(date && date.getTime() < now.getTime());
}

function relationshipMissing(client: CompassClient): boolean {
  return !client.lastAccountReview
    && !client.lastSalesInteraction
    && !client.lastQuoteDate
    && !client.nextFollowUp
    && client.reviewOutcome.status === "not-reviewed";
}

function technicalSeverity(projects: QualifiedProjectRecord[]): number {
  if (projects.some((project) => project.critical)) return 3;
  if (projects.some((project) => project.kind === "server")) return 2;
  return 1;
}

function conciseAttentionReason(projects: QualifiedProjectRecord[]): string {
  const drivers = unique(projects.flatMap((project) => project.technicalDrivers))
    .map((driver) => driver.trim().replace(/[.;]+$/, ""))
    .filter(Boolean);
  if (!drivers.length) return projects.map((project) => project.title).join(" and ");
  return drivers.slice(0, 2).join("; ");
}

function coverageClient(
  client: CompassClient,
  projects: QualifiedProjectRecord[],
  findings: CompassFinding[],
  now: Date,
): ProjectCoverageClient {
  const reviewDate = client.lastAccountReview || client.reviewOutcome.reviewedAt || "";
  const quoteDate = client.lastQuoteDate || "";
  const position = projectPosition(client, projects);
  const result: ProjectCoverageClient = {
    clientId: client.id,
    clientName: client.name,
    position,
    projects,
    estimatedValue: rounded(projects.reduce((sum, project) => sum + project.estimatedValue, 0)),
    serverProjectCount: projects.filter((project) => project.kind === "server").length,
    workstationProjectCount: projects.filter((project) => project.kind === "workstations").length,
    workstationDeviceCount: projects.filter((project) => project.kind === "workstations").reduce((sum, project) => sum + project.deviceIds.length, 0),
    hasCriticalServer: projects.some((project) => project.kind === "server" && project.critical),
    technicalSeverity: technicalSeverity(projects),
    reviewDate,
    quoteDate,
    quoteAgeBand: quoteAgeBand(quoteDate, now),
    nextFollowUp: client.nextFollowUp,
    followUpPastDue: dateIsPast(client.nextFollowUp, now),
    reviewHistoryMissing: !reviewDate,
    missingDocumentedOutcome: client.reviewOutcome.status !== "confirmed" || !hasAgreedReviewPlan(client.reviewOutcome),
    noRelationshipHistory: relationshipMissing(client),
    hasUnsupportedSystems: findings.some((finding) => UNSUPPORTED_SYSTEM_SIGNALS.has(finding.category)),
    attentionReason: conciseAttentionReason(projects),
    priorityReason: "",
  };
  result.priorityReason = coveragePriorityReason(result, now);
  return result;
}

function formatDate(value: string): string {
  const date = validDate(value);
  return date ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date) : "Not recorded";
}

function cardStats(position: ProjectCoveragePosition, clients: ProjectCoverageClient[]): Array<{ label: string; value: string | number }> {
  if (position === "needs-review") {
    return [
      { label: "Server projects", value: clients.reduce((sum, client) => sum + client.serverProjectCount, 0) },
      { label: "Workstation projects", value: clients.reduce((sum, client) => sum + client.workstationProjectCount, 0) },
      { label: "No relationship history", value: clients.filter((client) => client.noRelationshipHistory).length },
    ];
  }
  if (position === "discussed-open") {
    const dated = clients.map((client) => client.reviewDate).filter(Boolean).sort((left, right) => (validDate(left)?.getTime() ?? 0) - (validDate(right)?.getTime() ?? 0));
    return [
      { label: "Oldest discussion", value: dated.length ? formatDate(dated[0]) : "Not recorded" },
      { label: "Past-due follow-ups", value: clients.filter((client) => client.followUpPastDue).length },
      { label: "Missing outcome", value: clients.filter((client) => client.missingDocumentedOutcome).length },
    ];
  }
  return [
    { label: "Recent quotes", value: clients.filter((client) => client.quoteAgeBand === "recent").length },
    { label: "Quotes 6–12 months", value: clients.filter((client) => client.quoteAgeBand === "re-engagement").length },
    { label: "Quotes older than 12 months", value: clients.filter((client) => client.quoteAgeBand === "revisit").length },
    { label: "Review history missing", value: clients.filter((client) => client.reviewHistoryMissing).length },
  ];
}

function cardDefinition(position: ProjectCoveragePosition): Pick<ProjectCoverageCardMetric, "title" | "valueLabel" | "explanation"> {
  if (position === "needs-review") return {
    title: "Needs Client Review",
    valueLabel: "estimated project need",
    explanation: "Qualified need with no recorded review or quote.",
  };
  if (position === "discussed-open") return {
    title: "Discussed, Decision Open",
    valueLabel: "estimated need awaiting a decision",
    explanation: "Reviewed with the client, but no final resolution is recorded.",
  };
  return {
    title: "Quoted, Still Open",
    valueLabel: "estimated need associated with open quotes",
    explanation: "A quote was prepared, but no completed outcome is recorded.",
  };
}

function buildCard(position: ProjectCoveragePosition, clients: ProjectCoverageClient[]): ProjectCoverageCardMetric {
  const sorted = [...clients].sort((left, right) => compareCoverageClients(position, left, right));
  const definition = cardDefinition(position);
  return {
    id: position,
    ...definition,
    count: sorted.length,
    estimatedValue: rounded(sorted.reduce((sum, client) => sum + client.estimatedValue, 0)),
    clients: sorted,
    stats: cardStats(position, sorted),
    spotlight: sorted[0]?.priorityReason ?? "No qualifying clients in the current snapshot.",
  };
}

export function buildProjectCoverageSnapshot(
  dataset: CompassDataset | null,
  config: CompassConfig,
  now = new Date(),
  minimumWorkstations = 5,
  expectedNeedsReviewCount = 23,
): ProjectCoverageSnapshot {
  if (!dataset) {
    const emptyCards = (["needs-review", "discussed-open", "quoted-open"] as ProjectCoveragePosition[]).map((position) => buildCard(position, []));
    return { generatedAt: now.toISOString(), qualifyingClientCount: 0, qualifyingProjectCount: 0, clients: [], cards: emptyCards, needsReviewExpectedCount: expectedNeedsReviewCount, needsReviewDifference: -expectedNeedsReviewCount };
  }
  const devicesById = new Map(dataset.devices.map((device) => [device.id, device]));
  const clients: ProjectCoverageClient[] = [];
  for (const client of dataset.clients) {
    const packages = buildCompassProjectPackages(dataset, config, client.id).filter(isOpenPackage);
    const findings = dataset.findings.filter((finding) => finding.clientId === client.id);
    const projects = [
      mergeServerProject(client.id, packages, devicesById, findings),
      mergeWorkstationProject(client.id, packages, devicesById, minimumWorkstations),
    ].filter((project): project is QualifiedProjectRecord => Boolean(project));
    if (!projects.length) continue;
    clients.push(coverageClient(client, projects, findings, now));
  }
  const cards = (["needs-review", "discussed-open", "quoted-open"] as ProjectCoveragePosition[]).map((position) => buildCard(position, clients.filter((client) => client.position === position)));
  const needsReviewCount = cards.find((card) => card.id === "needs-review")?.count ?? 0;
  return {
    generatedAt: now.toISOString(),
    qualifyingClientCount: clients.length,
    qualifyingProjectCount: clients.reduce((sum, client) => sum + client.projects.length, 0),
    clients,
    cards,
    needsReviewExpectedCount: expectedNeedsReviewCount,
    needsReviewDifference: needsReviewCount - expectedNeedsReviewCount,
  };
}



export const PROJECT_COVERAGE_CARD_SETS: ProjectCoverageCardSetDefinition[] = [
  {
    id: "client-project-coverage",
    label: "Card set",
    title: "Client Project Coverage",
    description: "Qualified needs organized from first review through an open quote.",
  },
  {
    id: "priority-lens",
    label: "Card set",
    title: "Priority Lens",
    description: "The same qualified client book ranked by risk, quote age, and estimated need.",
  },
];

function compareHighestRisk(left: ProjectCoverageClient, right: ProjectCoverageClient): number {
  return Number(right.hasCriticalServer) - Number(left.hasCriticalServer)
    || right.technicalSeverity - left.technicalSeverity
    || Number(right.followUpPastDue) - Number(left.followUpPastDue)
    || right.estimatedValue - left.estimatedValue
    || left.clientName.localeCompare(right.clientName);
}

function compareLargestNeed(left: ProjectCoverageClient, right: ProjectCoverageClient): number {
  return right.estimatedValue - left.estimatedValue
    || right.technicalSeverity - left.technicalSeverity
    || left.clientName.localeCompare(right.clientName);
}

function compareOldestOpenQuote(left: ProjectCoverageClient, right: ProjectCoverageClient): number {
  const leftDate = validDate(left.quoteDate)?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightDate = validDate(right.quoteDate)?.getTime() ?? Number.POSITIVE_INFINITY;
  return leftDate - rightDate
    || Number(right.reviewHistoryMissing) - Number(left.reviewHistoryMissing)
    || right.technicalSeverity - left.technicalSeverity
    || right.estimatedValue - left.estimatedValue
    || left.clientName.localeCompare(right.clientName);
}

function compactMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

function priorityLensStats(clients: ProjectCoverageClient[]): Array<{ label: string; value: string | number }> {
  return clients.slice(0, 3).map((client) => ({ label: client.clientName, value: compactMoney(client.estimatedValue) }));
}

function priorityLensCard(
  id: Extract<ProjectCoverageCardId, "highest-risk" | "oldest-quotes" | "largest-need">,
  title: string,
  valueLabel: string,
  explanation: string,
  clients: ProjectCoverageClient[],
  spotlight: string,
): ProjectCoverageCardMetric {
  return {
    id,
    title,
    valueLabel,
    explanation,
    count: clients.length,
    estimatedValue: rounded(clients.reduce((sum, client) => sum + client.estimatedValue, 0)),
    clients,
    stats: priorityLensStats(clients),
    spotlight: clients[0] ? spotlight : "No qualifying clients in the current snapshot.",
  };
}

function priorityLensCards(snapshot: ProjectCoverageSnapshot): ProjectCoverageCardMetric[] {
  const highestRisk = [...snapshot.clients].sort(compareHighestRisk);
  const oldestQuotes = snapshot.clients
    .filter((client) => client.position === "quoted-open")
    .sort(compareOldestOpenQuote);
  const largestNeed = [...snapshot.clients].sort(compareLargestNeed);
  return [
    priorityLensCard(
      "highest-risk",
      "Highest Technical Risk",
      "estimated need across highest-risk clients",
      "Qualified clients ordered by critical server exposure and technical severity.",
      highestRisk,
      highestRisk[0]?.priorityReason ?? "No technical-risk signal is available.",
    ),
    priorityLensCard(
      "oldest-quotes",
      "Oldest Open Quotes",
      "estimated need associated with open quotes",
      "Open quotes ordered from the oldest re-engagement need to the most recent.",
      oldestQuotes,
      oldestQuotes[0]?.quoteDate ? `Oldest recorded quote: ${formatDate(oldestQuotes[0].quoteDate)}` : "The oldest open quote is missing a recorded date.",
    ),
    priorityLensCard(
      "largest-need",
      "Largest Estimated Need",
      "combined estimated project need",
      "Qualified clients ordered by deduplicated project-package value.",
      largestNeed,
      largestNeed[0] ? `${largestNeed[0].clientName} has the largest estimated need at ${compactMoney(largestNeed[0].estimatedValue)}.` : "No estimated project need is available.",
    ),
  ];
}

export function projectCoverageCardsForSet(snapshot: ProjectCoverageSnapshot, setId: ProjectCoverageCardSetId): ProjectCoverageCardMetric[] {
  return setId === "priority-lens" ? priorityLensCards(snapshot) : snapshot.cards;
}
