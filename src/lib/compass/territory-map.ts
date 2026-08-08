import type { CompassDataset } from "./types";

export type TerritoryHealth = "replace-now" | "plan-soon" | "healthy";

export interface TerritoryClientMetric {
  clientId: string;
  clientName: string;
  state: string;
  health: TerritoryHealth;
  estimatedValue: number;
}

export interface TerritoryMetric {
  id: string;
  name: string;
  shortName: string;
  primaryState: string;
  states: string[];
  color: string;
  clientCount: number;
  clientsInNeed: number;
  estimatedValue: number;
  replaceNow: number;
  planSoon: number;
  healthy: number;
  clients: TerritoryClientMetric[];
  unassigned: boolean;
}

export interface TerritoryMapSnapshot {
  territories: TerritoryMetric[];
  states: string[];
  totals: {
    clients: number;
    clientsInNeed: number;
    estimatedValue: number;
    replaceNow: number;
    planSoon: number;
    healthy: number;
  };
}

const TERRITORY_COLORS = [
  "#2f80ed",
  "#7b61ff",
  "#f2994a",
  "#27ae60",
  "#eb5757",
  "#56a6d8",
  "#bb6bd9",
  "#219653",
  "#d59a22",
  "#2d9cdb",
  "#6f9f86",
  "#9b51e0",
  "#d97058",
  "#218f8f",
  "#496fb3",
  "#b65f86",
];

const TECHNICAL_WORKFLOW_CARDS = new Set(["reviews-due", "quote-needed"]);

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash);
}

export function territoryColor(name: string, unassigned = false): string {
  if (unassigned) return "#94a3b8";
  return TERRITORY_COLORS[hashString(name.toLowerCase()) % TERRITORY_COLORS.length];
}

export function territoryShortName(name: string, state: string): string {
  const clean = normalized(name);
  const prefix = state ? new RegExp(`^${state.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[-–—]\\s*`, "i") : null;
  const withoutState = prefix ? clean.replace(prefix, "") : clean;
  const compact = withoutState
    .replace(/Central East/gi, "Central E")
    .replace(/Central West/gi, "Central W")
    .replace(/North(?:ern)?/gi, "North")
    .replace(/South(?:ern)?/gi, "South");
  return compact.length > 15 ? `${compact.slice(0, 13).trimEnd()}…` : compact;
}

function classifyClient(clientId: string, dataset: CompassDataset): TerritoryHealth {
  const devices = dataset.devices.filter((device) => device.clientId === clientId);
  const findings = dataset.findings.filter((finding) => finding.clientId === clientId);
  const summary = dataset.summaries.find((item) => item.clientId === clientId);

  if (devices.some((device) => device.lifecycle === "replace-now" && !device.isVirtual)) return "replace-now";
  if (findings.some((finding) => finding.severity === "critical" || finding.severity === "high")) return "replace-now";

  const hasTechnicalOpportunity = Boolean(summary?.opportunities.some((opportunity) => !TECHNICAL_WORKFLOW_CARDS.has(opportunity.cardCategory) && opportunity.estimatedValue > 0));
  if (devices.some((device) => device.lifecycle === "plan-soon" && !device.isVirtual)) return "plan-soon";
  if (findings.some((finding) => finding.severity === "planning" || finding.severity === "watch")) return "plan-soon";
  if (hasTechnicalOpportunity) return "plan-soon";
  return "healthy";
}

function primaryState(stateCounts: Map<string, number>): string {
  return [...stateCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? "";
}

export function buildTerritoryMapSnapshot(dataset: CompassDataset): TerritoryMapSnapshot {
  const summaries = new Map(dataset.summaries.map((summary) => [summary.clientId, summary]));
  const buckets = new Map<string, { name: string; unassigned: boolean; stateCounts: Map<string, number>; clients: TerritoryClientMetric[] }>();

  for (const client of dataset.clients) {
    const state = normalized(client.state).toUpperCase();
    if (!state) continue;
    const suppliedTerritory = normalized(client.market);
    const unassigned = !suppliedTerritory;
    const name = suppliedTerritory || `${state} - Unassigned`;
    const id = name.toLowerCase();
    const health = classifyClient(client.id, dataset);
    const estimatedValue = Math.max(0, summaries.get(client.id)?.totalEstimatedValue ?? 0);
    const bucket = buckets.get(id) ?? { name, unassigned, stateCounts: new Map<string, number>(), clients: [] };
    bucket.stateCounts.set(state, (bucket.stateCounts.get(state) ?? 0) + 1);
    bucket.clients.push({ clientId: client.id, clientName: client.name, state, health, estimatedValue });
    buckets.set(id, bucket);
  }

  const territories = [...buckets.entries()].map(([id, bucket]) => {
    const primary = primaryState(bucket.stateCounts);
    const replaceNow = bucket.clients.filter((client) => client.health === "replace-now").length;
    const planSoon = bucket.clients.filter((client) => client.health === "plan-soon").length;
    const healthy = bucket.clients.filter((client) => client.health === "healthy").length;
    const metric: TerritoryMetric = {
      id,
      name: bucket.name,
      shortName: territoryShortName(bucket.name, primary),
      primaryState: primary,
      states: [...bucket.stateCounts.keys()].sort(),
      color: territoryColor(bucket.name, bucket.unassigned),
      clientCount: bucket.clients.length,
      clientsInNeed: replaceNow + planSoon,
      estimatedValue: bucket.clients.reduce((sum, client) => sum + client.estimatedValue, 0),
      replaceNow,
      planSoon,
      healthy,
      clients: [...bucket.clients].sort((left, right) => right.estimatedValue - left.estimatedValue || left.clientName.localeCompare(right.clientName)),
      unassigned: bucket.unassigned,
    };
    return metric;
  }).sort((left, right) => right.estimatedValue - left.estimatedValue || right.clientsInNeed - left.clientsInNeed || left.name.localeCompare(right.name));

  return {
    territories,
    states: [...new Set(territories.flatMap((territory) => territory.states))].sort(),
    totals: {
      clients: territories.reduce((sum, territory) => sum + territory.clientCount, 0),
      clientsInNeed: territories.reduce((sum, territory) => sum + territory.clientsInNeed, 0),
      estimatedValue: territories.reduce((sum, territory) => sum + territory.estimatedValue, 0),
      replaceNow: territories.reduce((sum, territory) => sum + territory.replaceNow, 0),
      planSoon: territories.reduce((sum, territory) => sum + territory.planSoon, 0),
      healthy: territories.reduce((sum, territory) => sum + territory.healthy, 0),
    },
  };
}
