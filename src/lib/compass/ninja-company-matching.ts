"use client";

import type { CompassClient, CompassDataset, OrganizationResolutions } from "./types";

export const NINJA_ORGANIZATION_MAP_KEY = "client-compass.ninja-organization-map.v1";

export function ninjaCompanyMatchKey(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

export function uniqueNinjaClientMatch(
  organization: string,
  clients: Array<Pick<CompassClient, "id" | "name" | "aliases">>,
): string | null {
  const key = ninjaCompanyMatchKey(organization);
  if (!key) return null;
  const matches = clients.filter((client) => [client.name, ...(client.aliases ?? [])]
    .some((name) => ninjaCompanyMatchKey(name) === key));
  const uniqueIds = [...new Set(matches.map((client) => client.id))];
  return uniqueIds.length === 1 ? uniqueIds[0] : null;
}

function canStore(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadNinjaOrganizationMappings(): Record<string, string> {
  if (!canStore()) return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(NINJA_ORGANIZATION_MAP_KEY) || "{}") as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw as Record<string, unknown>)
      .map(([key, value]) => [ninjaCompanyMatchKey(key), String(value ?? "").trim()] as const)
      .filter(([key, value]) => Boolean(key && value)));
  } catch {
    return {};
  }
}

export function applyRememberedNinjaOrganizationMappings(
  base: OrganizationResolutions,
  dataset: CompassDataset | null,
): OrganizationResolutions {
  if (!dataset) return base;
  const remembered = loadNinjaOrganizationMappings();
  if (!Object.keys(remembered).length) return base;
  const validClientIds = new Set(dataset.clients.map((client) => client.id));
  const next: OrganizationResolutions = { ...base };
  for (const [organization, resolution] of Object.entries(next)) {
    if (resolution.mode !== "unresolved") continue;
    const clientId = remembered[ninjaCompanyMatchKey(organization)];
    if (clientId && validClientIds.has(clientId)) next[organization] = { mode: "existing", clientId };
  }
  return next;
}

export function rememberNinjaOrganizationMappings(
  mappings: Array<{ organization: string; clientId: string }>,
): void {
  if (!canStore() || !mappings.length) return;
  const next = loadNinjaOrganizationMappings();
  for (const mapping of mappings) {
    const key = ninjaCompanyMatchKey(mapping.organization);
    const clientId = String(mapping.clientId ?? "").trim();
    if (key && clientId) next[key] = clientId;
  }
  window.localStorage.setItem(NINJA_ORGANIZATION_MAP_KEY, JSON.stringify(next));
  window.dispatchEvent(new StorageEvent("storage", { key: NINJA_ORGANIZATION_MAP_KEY, newValue: JSON.stringify(next) }));
}
