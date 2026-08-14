import { buildSegmentClientMetrics, segmentRuleMatches } from "@/lib/segments/engine";
import type { SegmentRule } from "@/lib/segments/types";
import type { CompassDataset } from "./types";
import type { ProjectCoverageCardId, ProjectCoverageCardMetric, ProjectCoverageClient, ProjectCoverageCardStat } from "./project-coverage";

const STORAGE_KEY = "client-compass.coverage-card-criteria.v1";
const CHANGE_EVENT = "client-compass-data-changed";

export interface CoverageCardCriteria {
  matchMode: "all" | "any";
  rules: SegmentRule[];
  includeClientIds: string[];
  excludeClientIds: string[];
}

export type CoverageCardCriteriaMap = Partial<Record<ProjectCoverageCardId, CoverageCardCriteria>>;

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.map(String).map((item) => item.trim()).filter(Boolean))] : [];
}

function normalizeCriteria(value: unknown): CoverageCardCriteria | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CoverageCardCriteria>;
  const rules = Array.isArray(raw.rules)
    ? raw.rules.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const rule = item as Partial<SegmentRule>;
      if (!rule.id || !rule.field || !rule.operator) return [];
      return [{ id: String(rule.id), field: rule.field as SegmentRule["field"], operator: rule.operator as SegmentRule["operator"], value: String(rule.value ?? "") }];
    })
    : [];
  const includeClientIds = stringList(raw.includeClientIds);
  const excludeClientIds = stringList(raw.excludeClientIds).filter((id) => !includeClientIds.includes(id));
  if (!rules.length && !includeClientIds.length && !excludeClientIds.length) return null;
  return { matchMode: raw.matchMode === "any" ? "any" : "all", rules, includeClientIds, excludeClientIds };
}

export function loadCoverageCardCriteria(): CoverageCardCriteriaMap {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: CoverageCardCriteriaMap = {};
    for (const [id, value] of Object.entries(parsed)) {
      const criteria = normalizeCriteria(value);
      if (criteria) result[id as ProjectCoverageCardId] = criteria;
    }
    return result;
  } catch {
    return {};
  }
}

export function saveCoverageCardCriteria(cardId: ProjectCoverageCardId, criteria: CoverageCardCriteria | null): void {
  if (typeof window === "undefined") return;
  const current = loadCoverageCardCriteria();
  const normalized = normalizeCriteria(criteria);
  if (normalized) current[cardId] = normalized;
  else delete current[cardId];
  if (Object.keys(current).length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  else window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
  window.dispatchEvent(new Event("storage"));
}

export function hasCoverageCardCriteria(cardId: ProjectCoverageCardId): boolean {
  return Boolean(loadCoverageCardCriteria()[cardId]);
}

function criteriaIncludesClient(criteria: CoverageCardCriteria, dataset: CompassDataset, clientId: string): boolean {
  if (criteria.excludeClientIds.includes(clientId)) return false;
  if (criteria.includeClientIds.includes(clientId)) return true;
  if (!criteria.rules.length) return false;
  const metrics = buildSegmentClientMetrics(dataset, clientId);
  if (!metrics) return false;
  const matches = criteria.rules.map((rule) => segmentRuleMatches(rule, metrics));
  return criteria.matchMode === "any" ? matches.some(Boolean) : matches.every(Boolean);
}

function formatDate(value: string): string {
  if (!value) return "Not recorded";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function compactMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

function primaryStats(cardId: ProjectCoverageCardId, clients: ProjectCoverageClient[]): ProjectCoverageCardStat[] | null {
  if (cardId === "needs-review") {
    const server = clients.filter((client) => client.serverProjectCount > 0);
    const workstations = clients.filter((client) => client.workstationProjectCount > 0);
    const noHistory = clients.filter((client) => client.noRelationshipHistory);
    return [
      { id: "server-projects", label: "Server projects", value: server.length, clientIds: server.map((client) => client.clientId) },
      { id: "workstation-projects", label: "Workstation projects", value: workstations.length, clientIds: workstations.map((client) => client.clientId) },
      { id: "no-relationship-history", label: "No relationship history", value: noHistory.length, clientIds: noHistory.map((client) => client.clientId) },
    ];
  }
  if (cardId === "discussed-open") {
    const dated = clients.filter((client) => Boolean(client.reviewDate)).sort((a, b) => new Date(a.reviewDate).getTime() - new Date(b.reviewDate).getTime());
    const oldest = dated[0]?.reviewDate || "";
    const pastDue = clients.filter((client) => client.followUpPastDue);
    const missing = clients.filter((client) => client.missingDocumentedOutcome);
    return [
      { id: "oldest-discussion", label: "Oldest discussion", value: oldest ? formatDate(oldest) : "Not recorded", clientIds: oldest ? dated.filter((client) => client.reviewDate === oldest).map((client) => client.clientId) : [] },
      { id: "past-due-followups", label: "Past-due follow-ups", value: pastDue.length, clientIds: pastDue.map((client) => client.clientId) },
      { id: "missing-outcome", label: "Missing outcome", value: missing.length, clientIds: missing.map((client) => client.clientId) },
    ];
  }
  if (cardId === "quoted-open") {
    const recent = clients.filter((client) => client.quoteAgeBand === "recent");
    const reengagement = clients.filter((client) => client.quoteAgeBand === "re-engagement");
    const revisit = clients.filter((client) => client.quoteAgeBand === "revisit");
    const missingReview = clients.filter((client) => client.reviewHistoryMissing);
    return [
      { id: "recent-quotes", label: "Recent quotes", value: recent.length, clientIds: recent.map((client) => client.clientId) },
      { id: "quotes-6-12-months", label: "Quotes 6–12 months", value: reengagement.length, clientIds: reengagement.map((client) => client.clientId) },
      { id: "quotes-older-12-months", label: "Quotes older than 12 months", value: revisit.length, clientIds: revisit.map((client) => client.clientId) },
      { id: "review-history-missing", label: "Review history missing", value: missingReview.length, clientIds: missingReview.map((client) => client.clientId) },
    ];
  }
  return null;
}

function priorityStats(clients: ProjectCoverageClient[]): ProjectCoverageCardStat[] {
  return clients.slice(0, 3).map((client) => ({ id: `client-${client.clientId}`, label: client.clientName, value: compactMoney(client.estimatedValue), clientIds: [client.clientId] }));
}

function spotlight(cardId: ProjectCoverageCardId, clients: ProjectCoverageClient[]): string {
  const first = clients[0];
  if (!first) return "No qualifying clients match the custom criteria.";
  if (cardId === "oldest-quotes") return first.quoteDate ? `Oldest recorded quote: ${formatDate(first.quoteDate)}` : "The oldest matching open quote is missing a recorded date.";
  if (cardId === "largest-need") return `${first.clientName} has the largest estimated need at ${compactMoney(first.estimatedValue)}.`;
  return first.priorityReason || "Custom card criteria are active.";
}

export function applyCoverageCardCriteria(card: ProjectCoverageCardMetric, dataset: CompassDataset | null, criteriaMap = loadCoverageCardCriteria()): ProjectCoverageCardMetric {
  const criteria = criteriaMap[card.id];
  if (!dataset || !criteria) return card;
  const clients = card.clients.filter((client) => criteriaIncludesClient(criteria, dataset, client.clientId));
  const stats = primaryStats(card.id, clients) ?? priorityStats(clients);
  return {
    ...card,
    count: clients.length,
    estimatedValue: Math.round(clients.reduce((sum, client) => sum + client.estimatedValue, 0)),
    clients,
    stats,
    spotlight: spotlight(card.id, clients),
  };
}
