"use client";

import { captainsLogCloudRest } from "./captains-log-cloud";
import type { CompassClient } from "./types";

export const COMPANY_IDENTITY_EVENT_TYPE = "company_identity_event";
export const COMPANY_IDENTITY_SCHEMA = "company_identity_v1";
const CACHE_KEY = "client_compass.company_identity.v1";
const MAX_ROWS = 10000;

type JsonMap = Record<string, unknown>;

export interface CompanyIdentity {
  companyId: string;
  canonicalName: string;
  normalizedName: string;
  aliases: string[];
  clientCompassClientIds: string[];
  captainsLogProspectIds: string[];
  hubspotCompanyIds: string[];
  companyInstanceIds: string[];
  updatedAt: string;
}

type CompanyIdentityRow = {
  event_id?: string;
  event_type?: string;
  payload?: JsonMap;
  created_at?: string;
  inserted_at?: string;
};

function record(value: unknown): JsonMap {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonMap : {};
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(text).filter(Boolean))];
}

export function normalizeUniversalCompanyName(value: string): string {
  return text(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(llc|pllc|pc|inc|corp|corporation|company|co)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashIdentityKey(value: string): string {
  let a = 2166136261;
  let b = 2246822519;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    a ^= code;
    a = Math.imul(a, 16777619);
    b ^= code + index;
    b = Math.imul(b, 3266489917);
  }
  return `${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}

function provisionalCompanyId(key: string): string {
  return `company_${hashIdentityKey(key)}`;
}

function cacheAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function loadCache(): CompanyIdentity[] {
  if (!cacheAvailable()) return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((item): item is CompanyIdentity => Boolean(item && typeof item === "object" && text((item as CompanyIdentity).companyId))) : [];
  } catch {
    return [];
  }
}

function saveCache(items: CompanyIdentity[]): CompanyIdentity[] {
  const next = items.slice(-MAX_ROWS);
  if (cacheAvailable()) window.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  return next;
}

function identityFromRow(row: CompanyIdentityRow): CompanyIdentity | null {
  if (text(row.event_type) !== COMPANY_IDENTITY_EVENT_TYPE) return null;
  const payload = record(row.payload);
  if (text(payload.schema) !== COMPANY_IDENTITY_SCHEMA) return null;
  const companyId = text(payload.company_id);
  if (!companyId) return null;
  const legacy = record(payload.legacy_ids);
  const canonicalName = text(payload.canonical_name);
  const normalizedName = normalizeUniversalCompanyName(text(payload.normalized_name) || canonicalName);
  return {
    companyId,
    canonicalName,
    normalizedName,
    aliases: stringList(payload.aliases),
    clientCompassClientIds: stringList(legacy.client_compass_client_ids),
    captainsLogProspectIds: stringList(legacy.captains_log_prospect_ids),
    hubspotCompanyIds: stringList(legacy.hubspot_company_ids),
    companyInstanceIds: stringList(legacy.company_instance_ids),
    updatedAt: text(payload.occurred_at || row.created_at || row.inserted_at),
  };
}

function mergeIdentities(items: CompanyIdentity[]): CompanyIdentity[] {
  const byId = new Map<string, CompanyIdentity>();
  for (const incoming of items) {
    const existing = byId.get(incoming.companyId);
    if (!existing) {
      byId.set(incoming.companyId, { ...incoming });
      continue;
    }
    const newer = incoming.updatedAt >= existing.updatedAt ? incoming : existing;
    byId.set(incoming.companyId, {
      companyId: incoming.companyId,
      canonicalName: newer.canonicalName || existing.canonicalName || incoming.canonicalName,
      normalizedName: newer.normalizedName || existing.normalizedName || incoming.normalizedName,
      aliases: [...new Set([...existing.aliases, ...incoming.aliases])],
      clientCompassClientIds: [...new Set([...existing.clientCompassClientIds, ...incoming.clientCompassClientIds])],
      captainsLogProspectIds: [...new Set([...existing.captainsLogProspectIds, ...incoming.captainsLogProspectIds])],
      hubspotCompanyIds: [...new Set([...existing.hubspotCompanyIds, ...incoming.hubspotCompanyIds])],
      companyInstanceIds: [...new Set([...existing.companyInstanceIds, ...incoming.companyInstanceIds])],
      updatedAt: newer.updatedAt,
    });
  }
  return [...byId.values()];
}

export async function refreshCompanyIdentityRegistry(): Promise<CompanyIdentity[]> {
  const rows = await captainsLogCloudRest<CompanyIdentityRow[]>("GET", "app_events", undefined, {
    select: "event_id,event_type,payload,created_at,inserted_at",
    event_type: `eq.${COMPANY_IDENTITY_EVENT_TYPE}`,
    order: "created_at.asc,event_id.asc",
    limit: String(MAX_ROWS),
  });
  const identities = mergeIdentities((Array.isArray(rows) ? rows : []).map(identityFromRow).filter((item): item is CompanyIdentity => Boolean(item)));
  return saveCache(identities);
}

function identityMatchesClient(identity: CompanyIdentity, client: Pick<CompassClient, "id" | "name" | "aliases"> & { companyId?: string }): boolean {
  if (client.companyId && identity.companyId === client.companyId) return true;
  if (identity.clientCompassClientIds.includes(client.id)) return true;
  const names = [client.name, ...(client.aliases ?? [])].map(normalizeUniversalCompanyName).filter(Boolean);
  return names.includes(identity.normalizedName) || identity.aliases.map(normalizeUniversalCompanyName).some((alias) => names.includes(alias));
}

export function companyIdentityForClient(client: Pick<CompassClient, "id" | "name" | "aliases"> & { companyId?: string }, identities = loadCache()): CompanyIdentity | null {
  if (client.companyId) {
    const direct = identities.find((item) => item.companyId === client.companyId);
    if (direct) return direct;
  }
  const byLegacyId = identities.find((item) => item.clientCompassClientIds.includes(client.id));
  if (byLegacyId) return byLegacyId;
  const candidates = identities.filter((item) => identityMatchesClient(item, client));
  return candidates.length === 1 ? candidates[0] : null;
}

function claimKey(client: Pick<CompassClient, "id" | "name">): string {
  const normalized = normalizeUniversalCompanyName(client.name);
  return normalized ? `name:${normalized}` : `compass:${client.id}`;
}

async function publishIdentityClaim(client: Pick<CompassClient, "id" | "name" | "aliases">): Promise<void> {
  const key = claimKey(client);
  const companyId = provisionalCompanyId(key);
  const normalized = normalizeUniversalCompanyName(client.name);
  const now = new Date().toISOString();
  const eventId = `company_identity:${hashIdentityKey(key)}`;
  const row = {
    event_id: eventId,
    event_type: COMPANY_IDENTITY_EVENT_TYPE,
    payload: {
      schema: COMPANY_IDENTITY_SCHEMA,
      event_kind: "identity_claim",
      occurred_at: now,
      company_id: companyId,
      canonical_name: client.name,
      normalized_name: normalized,
      aliases: [...new Set([client.name, ...(client.aliases ?? [])].map(text).filter(Boolean))],
      legacy_ids: {
        client_compass_client_ids: [client.id],
        captains_log_prospect_ids: [],
        hubspot_company_ids: [],
        company_instance_ids: [],
      },
      source_app: "client_compass",
    },
  };
  await captainsLogCloudRest<null>("POST", "app_events", [row], { on_conflict: "event_id" }, "resolution=ignore-duplicates,return=minimal");
}

async function publishCompassLink(identity: CompanyIdentity, client: Pick<CompassClient, "id" | "name" | "aliases">): Promise<void> {
  if (identity.clientCompassClientIds.includes(client.id)) return;
  const now = new Date().toISOString();
  const eventId = `company_identity_link:${identity.companyId}:${hashIdentityKey(`compass:${client.id}`)}`;
  const row = {
    event_id: eventId,
    event_type: COMPANY_IDENTITY_EVENT_TYPE,
    payload: {
      schema: COMPANY_IDENTITY_SCHEMA,
      event_kind: "identity_link",
      occurred_at: now,
      company_id: identity.companyId,
      canonical_name: identity.canonicalName || client.name,
      normalized_name: identity.normalizedName || normalizeUniversalCompanyName(client.name),
      aliases: [...new Set([...identity.aliases, client.name, ...(client.aliases ?? [])].map(text).filter(Boolean))],
      legacy_ids: {
        client_compass_client_ids: [...new Set([...identity.clientCompassClientIds, client.id])],
        captains_log_prospect_ids: identity.captainsLogProspectIds,
        hubspot_company_ids: identity.hubspotCompanyIds,
        company_instance_ids: identity.companyInstanceIds,
      },
      source_app: "client_compass",
    },
  };
  await captainsLogCloudRest<null>("POST", "app_events", [row], { on_conflict: "event_id" }, "resolution=ignore-duplicates,return=minimal");
}

export async function ensureCompanyIdentityForClient(client: Pick<CompassClient, "id" | "name" | "aliases"> & { companyId?: string }, registry?: CompanyIdentity[]): Promise<CompanyIdentity> {
  let identities = registry ?? await refreshCompanyIdentityRegistry();
  let identity = companyIdentityForClient(client, identities);
  if (!identity) {
    await publishIdentityClaim(client);
    identities = await refreshCompanyIdentityRegistry();
    identity = companyIdentityForClient(client, identities);
  }
  if (!identity) throw new Error(`Supabase could not establish a universal company ID for ${client.name}.`);
  if (!identity.clientCompassClientIds.includes(client.id)) {
    await publishCompassLink(identity, client);
    identities = await refreshCompanyIdentityRegistry();
    identity = companyIdentityForClient(client, identities) ?? identity;
  }
  return identity;
}

export async function ensureCompanyIdentitiesForClients(clients: Array<Pick<CompassClient, "id" | "name" | "aliases"> & { companyId?: string }>): Promise<Map<string, CompanyIdentity>> {
  let registry = await refreshCompanyIdentityRegistry();
  const result = new Map<string, CompanyIdentity>();
  for (const client of clients) {
    let identity = companyIdentityForClient(client, registry);
    if (!identity) {
      await publishIdentityClaim(client);
      registry = await refreshCompanyIdentityRegistry();
      identity = companyIdentityForClient(client, registry);
    }
    if (!identity) continue;
    if (!identity.clientCompassClientIds.includes(client.id)) {
      await publishCompassLink(identity, client);
      registry = await refreshCompanyIdentityRegistry();
      identity = companyIdentityForClient(client, registry) ?? identity;
    }
    result.set(client.id, identity);
  }
  return result;
}
