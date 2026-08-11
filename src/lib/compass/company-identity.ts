"use client";

import { captainsLogCloudRest } from "./captains-log-cloud";
import type { CompassClient } from "./types";

export const COMPANY_IDENTITY_CACHE_KEY = "client_compass.company_identity.v2";
export const COMPANY_IDENTITY_SCHEMA_READY_KEY = "client_compass.company_identity.schema.v1";
const MAX_ROWS = 20000;

type JsonMap = Record<string, unknown>;

type CompanyRow = {
  id?: string;
  display_name?: string;
  normalized_name?: string;
  updated_at?: string;
};

type AliasRow = {
  company_id?: string;
  alias_name?: string;
};

type ExternalIdRow = {
  company_id?: string;
  source?: string;
  external_id?: string;
};

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

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value));
}

function canStore(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function setSchemaReady(ready: boolean): void {
  if (!canStore()) return;
  if (ready) window.localStorage.setItem(COMPANY_IDENTITY_SCHEMA_READY_KEY, "1");
  else window.localStorage.removeItem(COMPANY_IDENTITY_SCHEMA_READY_KEY);
}

export function companyIdentitySchemaReady(): boolean {
  return canStore() && window.localStorage.getItem(COMPANY_IDENTITY_SCHEMA_READY_KEY) === "1";
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

function loadCache(): CompanyIdentity[] {
  if (!canStore()) return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(COMPANY_IDENTITY_CACHE_KEY) || "[]") as unknown;
    return Array.isArray(raw)
      ? raw.filter((item): item is CompanyIdentity => Boolean(item && typeof item === "object" && isUuid((item as CompanyIdentity).companyId)))
      : [];
  } catch {
    return [];
  }
}

function saveCache(items: CompanyIdentity[]): CompanyIdentity[] {
  const next = items.filter((item) => isUuid(item.companyId)).slice(-MAX_ROWS);
  if (canStore()) window.localStorage.setItem(COMPANY_IDENTITY_CACHE_KEY, JSON.stringify(next));
  return next;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(text).filter(Boolean))];
}

function externalIdsFor(source: string, rows: ExternalIdRow[], companyId: string): string[] {
  return unique(rows.filter((row) => text(row.company_id) === companyId && text(row.source) === source).map((row) => text(row.external_id)));
}

export async function refreshCompanyIdentityRegistry(): Promise<CompanyIdentity[]> {
  try {
    const [companies, aliases, externalIds] = await Promise.all([
      captainsLogCloudRest<CompanyRow[]>("GET", "companies", undefined, {
        select: "id,display_name,normalized_name,updated_at",
        order: "display_name.asc",
        limit: String(MAX_ROWS),
      }),
      captainsLogCloudRest<AliasRow[]>("GET", "company_aliases", undefined, {
        select: "company_id,alias_name",
        order: "created_at.asc",
        limit: String(MAX_ROWS),
      }),
      captainsLogCloudRest<ExternalIdRow[]>("GET", "company_external_ids", undefined, {
        select: "company_id,source,external_id",
        order: "created_at.asc",
        limit: String(MAX_ROWS),
      }),
    ]);

    const aliasRows = Array.isArray(aliases) ? aliases : [];
    const externalRows = Array.isArray(externalIds) ? externalIds : [];
    const identities = (Array.isArray(companies) ? companies : [])
      .filter((row) => isUuid(row.id))
      .map((row): CompanyIdentity => {
        const companyId = text(row.id);
        return {
          companyId,
          canonicalName: text(row.display_name),
          normalizedName: normalizeUniversalCompanyName(text(row.normalized_name || row.display_name)),
          aliases: unique(aliasRows.filter((alias) => text(alias.company_id) === companyId).map((alias) => text(alias.alias_name))),
          clientCompassClientIds: externalIdsFor("client_compass", externalRows, companyId),
          captainsLogProspectIds: externalIdsFor("captains_log_prospect", externalRows, companyId),
          hubspotCompanyIds: externalIdsFor("hubspot_company", externalRows, companyId),
          companyInstanceIds: externalIdsFor("captains_log_company_instance", externalRows, companyId),
          updatedAt: text(row.updated_at),
        };
      });
    setSchemaReady(true);
    return saveCache(identities);
  } catch (cause) {
    setSchemaReady(false);
    throw cause;
  }
}

function identityMatchesClient(identity: CompanyIdentity, client: Pick<CompassClient, "id" | "name" | "aliases"> & { companyId?: string }): boolean {
  if (client.companyId && identity.companyId === client.companyId) return true;
  if (identity.clientCompassClientIds.includes(client.id)) return true;
  const names = [client.name, ...(client.aliases ?? [])].map(normalizeUniversalCompanyName).filter(Boolean);
  if (names.includes(identity.normalizedName)) return true;
  return identity.aliases.map(normalizeUniversalCompanyName).some((alias) => names.includes(alias));
}

function identityAlreadyCurrent(
  identity: CompanyIdentity,
  client: Pick<CompassClient, "id" | "name" | "aliases"> & { companyId?: string },
): boolean {
  if (!identity.clientCompassClientIds.includes(client.id)) return false;
  if (isUuid(client.companyId) && client.companyId !== identity.companyId) return false;
  const knownNames = new Set([
    identity.normalizedName,
    normalizeUniversalCompanyName(identity.canonicalName),
    ...identity.aliases.map(normalizeUniversalCompanyName),
  ].filter(Boolean));
  return [client.name, ...(client.aliases ?? [])]
    .map(normalizeUniversalCompanyName)
    .filter(Boolean)
    .every((name) => knownNames.has(name));
}

function connectivityFailure(cause: unknown): boolean {
  const message = String(cause instanceof Error ? cause.message : cause || "").toLowerCase();
  return [
    "failed to fetch",
    "network",
    "connection",
    "timeout",
    "supabase auth",
    "session refresh",
    " 500",
    " 502",
    " 503",
    " 504",
    " 520",
    " 522",
    " 524",
  ].some((token) => message.includes(token));
}

export function companyIdentityForClient(
  client: Pick<CompassClient, "id" | "name" | "aliases"> & { companyId?: string },
  identities = loadCache(),
): CompanyIdentity | null {
  if (client.companyId && isUuid(client.companyId)) {
    const direct = identities.find((item) => item.companyId === client.companyId);
    if (direct) return direct;
  }
  const byLegacyId = identities.find((item) => item.clientCompassClientIds.includes(client.id));
  if (byLegacyId) return byLegacyId;
  const candidates = identities.filter((item) => identityMatchesClient(item, client));
  return candidates.length === 1 ? candidates[0] : null;
}

async function ensureIdentityRpc(client: Pick<CompassClient, "id" | "name" | "aliases">): Promise<string> {
  const companyId = await captainsLogCloudRest<string>("POST", "rpc/ensure_company_identity", {
    p_display_name: client.name,
    p_aliases: unique(client.aliases ?? []),
    p_source: "client_compass",
    p_external_id: client.id,
  });
  if (!isUuid(companyId)) throw new Error(`Supabase did not return a valid company UUID for ${client.name}.`);
  setSchemaReady(true);
  return text(companyId);
}

export async function backfillLegacyCompanyIds(): Promise<JsonMap> {
  const result = await captainsLogCloudRest<JsonMap>("POST", "rpc/backfill_company_ids", {});
  return result && typeof result === "object" && !Array.isArray(result) ? result : {};
}

export async function ensureCompanyIdentityForClient(
  client: Pick<CompassClient, "id" | "name" | "aliases"> & { companyId?: string },
  registry?: CompanyIdentity[],
): Promise<CompanyIdentity> {
  let identities = registry ?? await refreshCompanyIdentityRegistry();
  let identity = companyIdentityForClient(client, identities);

  // A durable Client Compass mapping plus current names means there is nothing to
  // rewrite. Only new/missing/renamed identities need the RPC.
  if (identity && identityAlreadyCurrent(identity, client)) return identity;

  const companyId = await ensureIdentityRpc(client);
  if (identity?.companyId !== companyId) {
    identities = await refreshCompanyIdentityRegistry();
    identity = identities.find((item) => item.companyId === companyId) ?? companyIdentityForClient({ ...client, companyId }, identities);
  }
  if (!identity) {
    identities = await refreshCompanyIdentityRegistry();
    identity = identities.find((item) => item.companyId === companyId) ?? null;
  }
  if (!identity) throw new Error(`Supabase created ${companyId} for ${client.name}, but the company registry could not read it back.`);
  return identity;
}

export async function ensureCompanyIdentitiesForClients(
  clients: Array<Pick<CompassClient, "id" | "name" | "aliases"> & { companyId?: string }>,
): Promise<Map<string, CompanyIdentity>> {
  let registry = await refreshCompanyIdentityRegistry();
  const result = new Map<string, CompanyIdentity>();
  const companyIdByClient = new Map<string, string>();
  let wroteIdentity = false;

  for (const client of clients) {
    const existing = companyIdentityForClient(client, registry);
    if (existing && identityAlreadyCurrent(existing, client)) {
      result.set(client.id, existing);
      continue;
    }

    try {
      const companyId = await ensureIdentityRpc(client);
      companyIdByClient.set(client.id, companyId);
      wroteIdentity = true;
    } catch (cause) {
      // One transport/auth failure means the backend is unavailable for the whole
      // batch. Stop immediately instead of turning every client into another retry.
      if (typeof console !== "undefined") console.debug("Universal company ID deferred", client.name, cause);
      if (connectivityFailure(cause)) break;
    }
  }

  if (!wroteIdentity) return result;

  // Only run the legacy backfill after this pass actually created/refreshed an
  // identity. Established clients no longer generate background write traffic.
  try { await backfillLegacyCompanyIds(); }
  catch (cause) {
    if (typeof console !== "undefined") console.debug("Legacy company ID backfill deferred", cause);
    if (connectivityFailure(cause)) return result;
  }

  registry = await refreshCompanyIdentityRegistry();
  for (const client of clients) {
    if (result.has(client.id)) continue;
    const expectedId = companyIdByClient.get(client.id) || (isUuid(client.companyId) ? client.companyId : "");
    const identity = expectedId
      ? registry.find((item) => item.companyId === expectedId) ?? null
      : companyIdentityForClient(client, registry);
    if (identity) result.set(client.id, identity);
  }
  return result;
}
