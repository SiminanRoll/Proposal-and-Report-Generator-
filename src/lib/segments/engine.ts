import type { CompassConfig, CompassDataset } from "@/lib/compass/types";
import type {
  SegmentAggregate,
  SegmentClientMetrics,
  SegmentDefinition,
  SegmentRule,
  SegmentRuleField,
  SegmentRuleOperator,
  SegmentSnapshot,
  SegmentStatId,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export type SegmentRuleFieldKind = "number" | "text" | "boolean" | "os";
export interface SegmentOsOption { value: string; label: string; }

export const SERVER_OS_OPTIONS: SegmentOsOption[] = [
  { value: "windows-server-2008", label: "Windows Server 2008 / 2008 R2" },
  { value: "windows-server-2012", label: "Windows Server 2012 / 2012 R2" },
  { value: "windows-server-2016", label: "Windows Server 2016" },
  { value: "windows-server-2019", label: "Windows Server 2019" },
  { value: "windows-server-2022", label: "Windows Server 2022" },
  { value: "windows-server-2025", label: "Windows Server 2025" },
  { value: "other-server-os", label: "Other server OS" },
  { value: "unknown-server-os", label: "Unknown / unreported" },
];

export const WORKSTATION_OS_OPTIONS: SegmentOsOption[] = [
  { value: "windows-8", label: "Windows 8 / 8.1" },
  { value: "windows-10", label: "Windows 10 (all editions)" },
  { value: "windows-10-home", label: "Windows 10 Home" },
  { value: "windows-10-pro", label: "Windows 10 Pro / Professional" },
  { value: "windows-11", label: "Windows 11 (all editions)" },
  { value: "windows-11-home", label: "Windows 11 Home" },
  { value: "windows-11-pro", label: "Windows 11 Pro / Professional" },
  { value: "macos", label: "macOS" },
  { value: "linux", label: "Linux" },
  { value: "other-workstation-os", label: "Other workstation OS" },
  { value: "unknown-workstation-os", label: "Unknown / unreported" },
];

export const SEGMENT_RULE_FIELDS: Array<{ id: SegmentRuleField; label: string; kind: SegmentRuleFieldKind }> = [
  { id: "managed-assets", label: "Managed assets", kind: "number" },
  { id: "replace-now", label: "Replacement Now devices", kind: "number" },
  { id: "plan-soon", label: "Plan Soon devices", kind: "number" },
  { id: "healthy", label: "Healthy devices", kind: "number" },
  { id: "physical-servers", label: "Physical servers", kind: "number" },
  { id: "server-os", label: "Server OS", kind: "os" },
  { id: "virtual-server-os", label: "Virtual Server OS", kind: "os" },
  { id: "workstations", label: "Workstations", kind: "number" },
  { id: "workstation-os", label: "Workstation OS", kind: "os" },
  { id: "estimated-value", label: "Estimated project need", kind: "number" },
  { id: "priority-score", label: "Priority score", kind: "number" },
  { id: "account-review-age-days", label: "Days since account review", kind: "number" },
  { id: "quote-age-days", label: "Days since quote", kind: "number" },
  { id: "quoted", label: "Has quote", kind: "boolean" },
  { id: "activity-tracked", label: "Captain's Log activity tracked", kind: "boolean" },
  { id: "assigned-owner", label: "Assigned owner", kind: "text" },
  { id: "city", label: "Client city", kind: "text" },
  { id: "state", label: "Client state", kind: "text" },
  { id: "market", label: "Territory / market", kind: "text" },
  { id: "industry", label: "Industry / vertical", kind: "text" },
  { id: "client-tags", label: "Client tags", kind: "text" },
  { id: "location-contains", label: "Hardware location contains", kind: "text" },
  { id: "client-name-contains", label: "Client name contains", kind: "text" },
];

export const SEGMENT_STAT_OPTIONS: Array<{ id: SegmentStatId; label: string; format: "number" | "currency" }> = [
  { id: "replace-now", label: "Replacement Now", format: "number" },
  { id: "plan-soon", label: "Plan Soon", format: "number" },
  { id: "healthy", label: "Healthy devices", format: "number" },
  { id: "managed-assets", label: "Managed assets", format: "number" },
  { id: "physical-servers", label: "Physical servers", format: "number" },
  { id: "workstations", label: "Workstations", format: "number" },
  { id: "reviews-due", label: "Reviews due", format: "number" },
  { id: "open-quotes", label: "Clients with quotes", format: "number" },
  { id: "activity-tracked", label: "Activity tracked", format: "number" },
];

export function segmentFieldKind(field: SegmentRuleField): SegmentRuleFieldKind {
  return SEGMENT_RULE_FIELDS.find((item) => item.id === field)?.kind ?? "number";
}

export function segmentOsOptions(field: SegmentRuleField): SegmentOsOption[] {
  if (field === "server-os" || field === "virtual-server-os") return SERVER_OS_OPTIONS;
  if (field === "workstation-os") return WORKSTATION_OS_OPTIONS;
  return [];
}

export function operatorsForSegmentField(field: SegmentRuleField): SegmentRuleOperator[] {
  const kind = segmentFieldKind(field);
  if (kind === "text") return ["contains", "not-contains", "eq"];
  if (kind === "boolean" || kind === "os") return ["is"];
  return ["gte", "lte", "eq", "gt", "lt"];
}

export function segmentOperatorLabel(operator: SegmentRuleOperator): string {
  if (operator === "gte") return "at least";
  if (operator === "lte") return "at most";
  if (operator === "gt") return "greater than";
  if (operator === "lt") return "less than";
  if (operator === "contains") return "contains";
  if (operator === "not-contains") return "does not contain";
  if (operator === "is") return "is";
  return "equals";
}


function uniqueTokens(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function workstationOsTokens(value: string): string[] {
  const os = String(value || "").replace(/[®™]/g, "").replace(/\(R\)|\(TM\)/gi, "").trim();
  if (!os) return ["unknown-workstation-os"];
  if (/\bWindows\s*8(?:\.1)?\b/i.test(os)) return ["windows-8"];
  if (/\bWindows\s*10\b/i.test(os)) {
    const tokens = ["windows-10"];
    if (/\bHome\b/i.test(os) && !/\b(?:Pro|Professional|Enterprise|Education)\b/i.test(os)) tokens.push("windows-10-home");
    if (/\b(?:Pro|Professional)\b/i.test(os)) tokens.push("windows-10-pro");
    return tokens;
  }
  if (/\bWindows\s*11\b/i.test(os)) {
    const tokens = ["windows-11"];
    if (/\bHome\b/i.test(os) && !/\b(?:Pro|Professional|Enterprise|Education)\b/i.test(os)) tokens.push("windows-11-home");
    if (/\b(?:Pro|Professional)\b/i.test(os)) tokens.push("windows-11-pro");
    return tokens;
  }
  if (/\bmac(?:os| os)|os\s*x\b/i.test(os)) return ["macos"];
  if (/\blinux\b|ubuntu|debian|fedora|centos|red hat/i.test(os)) return ["linux"];
  return ["other-workstation-os"];
}

function serverOsTokens(value: string): string[] {
  const os = String(value || "").replace(/[®™]/g, "").replace(/\(R\)|\(TM\)/gi, "").trim();
  if (!os) return ["unknown-server-os"];
  if (/\b(?:Windows\s+)?Server\s*2008(?:\s*R2)?\b/i.test(os)) return ["windows-server-2008"];
  if (/\b(?:Windows\s+)?Server\s*2012(?:\s*R2)?\b/i.test(os)) return ["windows-server-2012"];
  if (/\b(?:Windows\s+)?Server\s*2016\b/i.test(os)) return ["windows-server-2016"];
  if (/\b(?:Windows\s+)?Server\s*2019\b/i.test(os)) return ["windows-server-2019"];
  if (/\b(?:Windows\s+)?Server\s*2022\b/i.test(os)) return ["windows-server-2022"];
  if (/\b(?:Windows\s+)?Server\s*2025\b/i.test(os)) return ["windows-server-2025"];
  return ["other-server-os"];
}

function dateAgeDays(value: string, now: Date): number | null {
  if (!value) return null;
  const raw = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

export function buildSegmentClientMetrics(dataset: CompassDataset, clientId: string, now = new Date()): SegmentClientMetrics | null {
  const client = dataset.clients.find((item) => item.id === clientId);
  if (!client) return null;
  const devices = dataset.devices.filter((device) => device.clientId === clientId);
  const summary = dataset.summaries.find((item) => item.clientId === clientId);
  return {
    clientId,
    clientName: client.name,
    managedAssets: devices.length,
    replaceNow: devices.filter((device) => device.lifecycle === "replace-now").length,
    planSoon: devices.filter((device) => device.lifecycle === "plan-soon").length,
    healthy: devices.filter((device) => device.lifecycle === "current").length,
    physicalServers: devices.filter((device) => device.deviceType === "physical-server").length,
    virtualServers: devices.filter((device) => device.deviceType === "virtual-server").length,
    workstations: devices.filter((device) => device.deviceType === "physical-workstation" || device.deviceType === "virtual-workstation").length,
    physicalServerOs: uniqueTokens(devices.filter((device) => device.deviceType === "physical-server").flatMap((device) => serverOsTokens(device.osName))),
    virtualServerOs: uniqueTokens(devices.filter((device) => device.deviceType === "virtual-server").flatMap((device) => serverOsTokens(device.osName))),
    workstationOs: uniqueTokens(devices.filter((device) => device.deviceType === "physical-workstation" || device.deviceType === "virtual-workstation").flatMap((device) => workstationOsTokens(device.osName))),
    estimatedValue: Math.max(0, Number(summary?.totalEstimatedValue || 0)),
    priorityScore: Math.max(0, Number(summary?.priorityScore || 0)),
    accountReviewAgeDays: dateAgeDays(client.lastAccountReview, now),
    quoteAgeDays: dateAgeDays(client.lastQuoteDate, now),
    quoted: Boolean(client.quoted || client.lastQuoteDate),
    activityTracked: Boolean(client.captainsLog?.recentActivity?.length || client.captainsLog?.openTasks?.length),
    assignedOwner: client.assignedOwner || "",
    city: client.city || "",
    state: client.state || "",
    market: client.market || "",
    industry: client.industry || "",
    tags: client.tags || [],
    locations: dataset.locations.filter((location) => location.clientId === clientId).map((location) => location.name).filter(Boolean),
    lastAccountReview: client.lastAccountReview || "",
    lastQuoteDate: client.lastQuoteDate || "",
  };
}

function numericMetric(metrics: SegmentClientMetrics, field: SegmentRuleField): number | null {
  if (field === "managed-assets") return metrics.managedAssets;
  if (field === "replace-now") return metrics.replaceNow;
  if (field === "plan-soon") return metrics.planSoon;
  if (field === "healthy") return metrics.healthy;
  if (field === "physical-servers") return metrics.physicalServers;
  if (field === "workstations") return metrics.workstations;
  if (field === "estimated-value") return metrics.estimatedValue;
  if (field === "priority-score") return metrics.priorityScore;
  if (field === "account-review-age-days") return metrics.accountReviewAgeDays;
  if (field === "quote-age-days") return metrics.quoteAgeDays;
  return null;
}

function evaluateNumber(actual: number | null, operator: SegmentRuleOperator, raw: string): boolean {
  if (actual === null) return false;
  const expected = Number(raw);
  if (!Number.isFinite(expected)) return false;
  if (operator === "gte") return actual >= expected;
  if (operator === "lte") return actual <= expected;
  if (operator === "gt") return actual > expected;
  if (operator === "lt") return actual < expected;
  return actual === expected;
}

function normalizedText(value: string): string {
  return String(value || "").trim().toLowerCase();
}

export function segmentRuleMatches(rule: SegmentRule, metrics: SegmentClientMetrics): boolean {
  const kind = segmentFieldKind(rule.field);
  if (kind === "number") return evaluateNumber(numericMetric(metrics, rule.field), rule.operator, rule.value);
  if (kind === "os") {
    const actual = rule.field === "server-os" ? metrics.physicalServerOs
      : rule.field === "virtual-server-os" ? metrics.virtualServerOs
      : metrics.workstationOs;
    return actual.includes(rule.value);
  }
  if (kind === "boolean") {
    const actual = rule.field === "quoted" ? metrics.quoted : metrics.activityTracked;
    const expected = ["1", "true", "yes", "y"].includes(normalizedText(rule.value));
    return actual === expected;
  }
  const actual = rule.field === "assigned-owner" ? metrics.assignedOwner
    : rule.field === "city" ? metrics.city
    : rule.field === "state" ? metrics.state
    : rule.field === "market" ? metrics.market
    : rule.field === "industry" ? metrics.industry
    : rule.field === "client-tags" ? metrics.tags.join(" ")
    : rule.field === "location-contains" ? metrics.locations.join(" ")
    : metrics.clientName;
  const left = normalizedText(actual);
  const right = normalizedText(rule.value);
  if (!right) return false;
  if (rule.operator === "not-contains") return !left.includes(right);
  if (rule.operator === "eq") return left === right;
  return left.includes(right);
}

export function segmentIncludesClient(segment: SegmentDefinition, metrics: SegmentClientMetrics): boolean {
  if (segment.excludeClientIds.includes(metrics.clientId)) return false;
  if (segment.includeClientIds.includes(metrics.clientId)) return true;
  if (!segment.rules.length) return false;
  const matches = segment.rules.map((rule) => segmentRuleMatches(rule, metrics));
  return segment.matchMode === "any" ? matches.some(Boolean) : matches.every(Boolean);
}

function aggregateClients(clients: SegmentClientMetrics[], config: CompassConfig): SegmentAggregate {
  const reviewDueDays = Math.max(1, config.thresholds.accountReviewDueMonths || 6) * 30.4375;
  return clients.reduce<SegmentAggregate>((aggregate, client) => ({
    clientCount: aggregate.clientCount + 1,
    estimatedValue: aggregate.estimatedValue + client.estimatedValue,
    replaceNow: aggregate.replaceNow + client.replaceNow,
    planSoon: aggregate.planSoon + client.planSoon,
    healthy: aggregate.healthy + client.healthy,
    managedAssets: aggregate.managedAssets + client.managedAssets,
    physicalServers: aggregate.physicalServers + client.physicalServers,
    workstations: aggregate.workstations + client.workstations,
    reviewsDue: aggregate.reviewsDue + (client.accountReviewAgeDays === null || client.accountReviewAgeDays >= reviewDueDays ? 1 : 0),
    openQuotes: aggregate.openQuotes + (client.quoted ? 1 : 0),
    activityTracked: aggregate.activityTracked + (client.activityTracked ? 1 : 0),
  }), { clientCount: 0, estimatedValue: 0, replaceNow: 0, planSoon: 0, healthy: 0, managedAssets: 0, physicalServers: 0, workstations: 0, reviewsDue: 0, openQuotes: 0, activityTracked: 0 });
}

export function buildSegmentSnapshot(segment: SegmentDefinition, dataset: CompassDataset | null, config: CompassConfig, now = new Date()): SegmentSnapshot {
  if (!dataset) return { segment, clients: [], aggregate: aggregateClients([], config) };
  const clients = dataset.clients
    .map((client) => buildSegmentClientMetrics(dataset, client.id, now))
    .filter((metrics): metrics is SegmentClientMetrics => Boolean(metrics))
    .filter((metrics) => segmentIncludesClient(segment, metrics))
    .sort((left, right) => right.replaceNow - left.replaceNow || right.estimatedValue - left.estimatedValue || left.clientName.localeCompare(right.clientName));
  return { segment, clients, aggregate: aggregateClients(clients, config) };
}

export function buildSegmentSnapshots(segments: SegmentDefinition[], dataset: CompassDataset | null, config: CompassConfig, now = new Date()): SegmentSnapshot[] {
  return segments.slice().sort((left, right) => left.order - right.order || left.title.localeCompare(right.title)).map((segment) => buildSegmentSnapshot(segment, dataset, config, now));
}

export function segmentStatValue(aggregate: SegmentAggregate, stat: SegmentStatId): number {
  if (stat === "estimated-value") return aggregate.estimatedValue;
  if (stat === "replace-now") return aggregate.replaceNow;
  if (stat === "plan-soon") return aggregate.planSoon;
  if (stat === "healthy") return aggregate.healthy;
  if (stat === "managed-assets") return aggregate.managedAssets;
  if (stat === "physical-servers") return aggregate.physicalServers;
  if (stat === "workstations") return aggregate.workstations;
  if (stat === "reviews-due") return aggregate.reviewsDue;
  if (stat === "open-quotes") return aggregate.openQuotes;
  return aggregate.activityTracked;
}

export function formatSegmentStat(stat: SegmentStatId, value: number): string {
  if (stat === "estimated-value") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  return Math.round(value).toLocaleString();
}

export function segmentRuleSummary(rule: SegmentRule): string {
  const field = SEGMENT_RULE_FIELDS.find((item) => item.id === rule.field)?.label ?? rule.field;
  const kind = segmentFieldKind(rule.field);
  const value = kind === "boolean"
    ? (["1", "true", "yes", "y"].includes(normalizedText(rule.value)) ? "Yes" : "No")
    : kind === "os"
      ? (segmentOsOptions(rule.field).find((option) => option.value === rule.value)?.label ?? rule.value)
      : rule.value;
  return `${field} ${segmentOperatorLabel(rule.operator)} ${value}`;
}
