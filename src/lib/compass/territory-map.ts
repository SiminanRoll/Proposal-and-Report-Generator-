import { filterCompassDatasetForMapLens } from "@/lib/segments/map-lens";
import type { CompassClient, CompassDataset } from "./types";

export type TerritoryHealth = "replace-now" | "plan-soon" | "healthy";
export type TerritoryNeedBasis = "value" | "server" | "server-workstations";

export interface TerritoryMapCriteria {
  includeReplaceNow: boolean;
  includePlanSoon: boolean;
  minimumEstimatedValue: number;
  valueFollowsNeed: boolean;
  needBasis: TerritoryNeedBasis;
}

export const DEFAULT_TERRITORY_MAP_CRITERIA: TerritoryMapCriteria = {
  includeReplaceNow: true,
  includePlanSoon: false,
  minimumEstimatedValue: 13_000,
  valueFollowsNeed: true,
  needBasis: "value",
};

export interface TerritoryClientMetric {
  clientId: string;
  clientName: string;
  state: string;
  city: string;
  health: TerritoryHealth;
  estimatedValue: number;
  hasServerProject: boolean;
  workstationCount: number;
  inferredTerritory: boolean;
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
  inferredClientCount: number;
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
    inferredClientCount: number;
  };
}

const TERRITORY_COLORS = [
  "#46c7ff",
  "#7f6cff",
  "#ff9d45",
  "#34d399",
  "#ff6685",
  "#35dfc7",
  "#b270ff",
  "#f4c64f",
  "#3d9cff",
  "#ff7958",
  "#78d69f",
  "#d06ae8",
  "#ffb34f",
  "#27c4b8",
  "#6d8cff",
  "#ef72aa",
];

const TECHNICAL_WORKFLOW_CARDS = new Set(["reviews-due", "quote-needed"]);
const SERVER_PROJECT_CARDS = new Set(["critical-server", "server-planning"]);

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash);
}

export function territoryColor(identity: string): string {
  return TERRITORY_COLORS[hashString(identity.toLowerCase()) % TERRITORY_COLORS.length];
}

function initials(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export function territoryShortName(name: string, state: string): string {
  const clean = normalized(name);
  const prefix = state ? new RegExp(`^${escapeRegExp(state)}\\s*[-–—]\\s*`, "i") : null;
  const withoutState = prefix ? clean.replace(prefix, "") : clean;
  if (!withoutState || withoutState.toUpperCase() === state.toUpperCase()) return state.toUpperCase();

  const key = withoutState.toLowerCase().replace(/\s+/g, " ").trim();
  const shorthand = key === "jacksonville" ? "JAX"
    : key === "central east" ? "CE"
      : key === "central west" ? "CW"
        : key === "southeast" ? "SE"
          : /chi\s*-?\s*n/.test(key) ? "N"
            : /chi\s*-?\s*s/.test(key) ? "S"
              : key === "north" || key === "northern" ? "N"
                : key === "south" || key === "southern" ? "S"
                  : key === "east" ? "E"
                    : key === "west" ? "W"
                      : key === "central" ? "C"
                        : initials(withoutState) || withoutState.slice(0, 3).toUpperCase();
  return `${state.toUpperCase()} ${shorthand}`;
}

function suppliedTerritoryName(state: string, suppliedTerritory: string): string | null {
  const clean = normalized(suppliedTerritory);
  if (!clean) return null;
  const stateOnly = new RegExp(`^${escapeRegExp(state)}$`, "i");
  const stateTerritory = new RegExp(`^${escapeRegExp(state)}\\s*[-–—]\\s*.+$`, "i");
  if (stateOnly.test(clean) || stateTerritory.test(clean)) return clean;
  return null;
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

export function territoryClientMatchesNeed(
  client: Pick<TerritoryClientMetric, "health" | "estimatedValue" | "hasServerProject" | "workstationCount">,
  criteria: TerritoryMapCriteria,
): boolean {
  // One definition everywhere: Need is a Replace Now client that also meets
  // the configured project qualification. Yellow Plan Soon is context only.
  if (client.health !== "replace-now") return false;
  if (criteria.needBasis === "server") return client.hasServerProject;
  if (criteria.needBasis === "server-workstations") return client.hasServerProject || client.workstationCount >= 5;
  return client.estimatedValue >= Math.max(0, criteria.minimumEstimatedValue || 0);
}

function dominantName(counts: Map<string, number> | undefined): string {
  if (!counts) return "";
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? "";
}

function incrementNestedCount(target: Map<string, Map<string, number>>, key: string, territory: string) {
  const counts = target.get(key) ?? new Map<string, number>();
  counts.set(territory, (counts.get(territory) ?? 0) + 1);
  target.set(key, counts);
}

function primaryState(stateCounts: Map<string, number>): string {
  return [...stateCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? "";
}

interface TerritoryAssignment {
  client: CompassClient;
  state: string;
  territoryName: string;
  inferred: boolean;
}

export function buildTerritoryMapSnapshot(dataset: CompassDataset, criteria: TerritoryMapCriteria = DEFAULT_TERRITORY_MAP_CRITERIA): TerritoryMapSnapshot {
  const mapDataset = filterCompassDatasetForMapLens(dataset);
  const effectiveCriteria = criteria;
  const summaries = new Map(mapDataset.summaries.map((summary) => [summary.clientId, summary]));
  const validAssignments: TerritoryAssignment[] = [];
  const unresolved: { client: CompassClient; state: string }[] = [];
  const stateTerritoryCounts = new Map<string, Map<string, number>>();
  const cityTerritoryCounts = new Map<string, Map<string, number>>();

  for (const client of mapDataset.clients) {
    const state = normalized(client.state).toUpperCase();
    if (!state) continue;
    const territoryName = suppliedTerritoryName(state, client.market);
    if (!territoryName) {
      unresolved.push({ client, state });
      continue;
    }
    validAssignments.push({ client, state, territoryName, inferred: false });
    incrementNestedCount(stateTerritoryCounts, state, territoryName);
    const city = normalized(client.city).toLowerCase();
    if (city) incrementNestedCount(cityTerritoryCounts, `${state}|${city}`, territoryName);
  }

  const assignments = [...validAssignments];
  for (const item of unresolved) {
    const city = normalized(item.client.city).toLowerCase();
    const cityMatch = city ? dominantName(cityTerritoryCounts.get(`${item.state}|${city}`)) : "";
    const stateMatch = dominantName(stateTerritoryCounts.get(item.state));
    assignments.push({
      client: item.client,
      state: item.state,
      territoryName: cityMatch || stateMatch || item.state,
      inferred: true,
    });
  }

  const buckets = new Map<string, { name: string; stateCounts: Map<string, number>; clients: TerritoryClientMetric[] }>();
  for (const assignment of assignments) {
    const id = `${assignment.state}|${assignment.territoryName.toLowerCase()}`;
    const health = classifyClient(assignment.client.id, mapDataset);
    const summary = summaries.get(assignment.client.id);
    const estimatedValue = Math.max(0, summary?.totalEstimatedValue ?? 0);
    const clientDevices = mapDataset.devices.filter((device) => device.clientId === assignment.client.id);
    const workstationCount = clientDevices.filter((device) => device.deviceType === "physical-workstation").length;
    const hasServerProject = Boolean(summary?.opportunities.some((opportunity) => SERVER_PROJECT_CARDS.has(opportunity.cardCategory) && opportunity.estimatedValue > 0));
    const bucket = buckets.get(id) ?? { name: assignment.territoryName, stateCounts: new Map<string, number>(), clients: [] };
    bucket.stateCounts.set(assignment.state, (bucket.stateCounts.get(assignment.state) ?? 0) + 1);
    bucket.clients.push({
      clientId: assignment.client.id,
      clientName: assignment.client.name,
      state: assignment.state,
      city: assignment.client.city,
      health,
      estimatedValue,
      hasServerProject,
      workstationCount,
      inferredTerritory: assignment.inferred,
    });
    buckets.set(id, bucket);
  }

  const territories = [...buckets.entries()].map(([id, bucket]) => {
    const primary = primaryState(bucket.stateCounts);
    const replaceNow = bucket.clients.filter((client) => client.health === "replace-now").length;
    const planSoon = bucket.clients.filter((client) => client.health === "plan-soon").length;
    const healthy = bucket.clients.filter((client) => client.health === "healthy").length;
    const clientsInNeed = bucket.clients.filter((client) => territoryClientMatchesNeed(client, effectiveCriteria)).length;
    const estimatedValue = bucket.clients.reduce((sum, client) => sum + (territoryClientMatchesNeed(client, effectiveCriteria) ? client.estimatedValue : 0), 0);
    const inferredClientCount = bucket.clients.filter((client) => client.inferredTerritory).length;
    const metric: TerritoryMetric = {
      id,
      name: bucket.name,
      shortName: territoryShortName(bucket.name, primary),
      primaryState: primary,
      states: [...bucket.stateCounts.keys()].sort(),
      color: territoryColor(id),
      clientCount: bucket.clients.length,
      clientsInNeed,
      estimatedValue,
      replaceNow,
      planSoon,
      healthy,
      inferredClientCount,
      clients: [...bucket.clients].sort((left, right) => Number(right.inferredTerritory) - Number(left.inferredTerritory) || right.estimatedValue - left.estimatedValue || left.clientName.localeCompare(right.clientName)),
      unassigned: false,
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
      inferredClientCount: territories.reduce((sum, territory) => sum + territory.inferredClientCount, 0),
    },
  };
}
