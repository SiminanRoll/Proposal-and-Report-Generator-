"use client";

import { captainsLogCloudRest } from "./captains-log-cloud";
import type { CompassClient } from "./types";

type IdentityClient = Pick<CompassClient, "id" | "name" | "aliases"> & { companyId?: string };
type BulkIdentityRow = { client_id?: string; company_id?: string; display_name?: string };
type CachedIdentity = {
  companyId?: string;
  canonicalName?: string;
  normalizedName?: string;
  aliases?: string[];
  clientCompassClientIds?: string[];
  [key: string]: unknown;
};

const CACHE_KEY = "client_compass.company_identity.v2";
const SCHEMA_READY_KEY = "client_compass.company_identity.schema.v1";
const MAX_CACHE_ROWS = 20_000;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value));
}

function canStore(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeCompanyName(value: string): string {
  return text(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(llc|pllc|pc|inc|corp|corporation|company|co)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rpcUnavailable(cause: unknown, functionName: string): boolean {
  const message = String(cause instanceof Error ? cause.message : cause || "").toLowerCase();
  return message.includes("pgrst202")
    || message.includes("42883")
    || message.includes("schema cache")
    || message.includes("could not find the function")
    || (message.includes("404") && message.includes(functionName.toLowerCase()));
}

function readCache(): CachedIdentity[] {
  if (!canStore()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is CachedIdentity => Boolean(item && typeof item === "object")) : [];
  } catch {
    return [];
  }
}

function cachedCompanyId(clientId: string, cache = readCache()): string {
  const match = cache.find((item) => Array.isArray(item.clientCompassClientIds) && item.clientCompassClientIds.includes(clientId));
  return isUuid(match?.companyId) ? text(match?.companyId) : "";
}

function saveCache(clients: IdentityClient[], resolved: Map<string, string>): void {
  if (!canStore() || !resolved.size) return;
  const cache = readCache();
  const byCompanyId = new Map(cache.filter((item) => isUuid(item.companyId)).map((item) => [text(item.companyId), item]));

  for (const client of clients) {
    const companyId = resolved.get(client.id);
    if (!companyId || !isUuid(companyId)) continue;
    const current = byCompanyId.get(companyId) || {};
    const clientIds = new Set(Array.isArray(current.clientCompassClientIds) ? current.clientCompassClientIds.map(text).filter(Boolean) : []);
    clientIds.add(client.id);
    byCompanyId.set(companyId, {
      ...current,
      companyId,
      canonicalName: client.name,
      normalizedName: normalizeCompanyName(client.name),
      aliases: [...new Set([client.name, ...(client.aliases || []), ...(Array.isArray(current.aliases) ? current.aliases : [])].map(text).filter(Boolean))],
      clientCompassClientIds: [...clientIds],
    });
  }

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify([...byCompanyId.values()].slice(-MAX_CACHE_ROWS)));
    window.localStorage.setItem(SCHEMA_READY_KEY, "1");
  } catch {
    // Cache acceleration is optional; durable Compass data remains authoritative.
  }
}

async function lookupExistingMappings(clientIds: string[]): Promise<Map<string, string>> {
  const wanted = [...new Set(clientIds.map(text).filter(Boolean))];
  const result = new Map<string, string>();
  const chunkSize = 100;
  for (let offset = 0; offset < wanted.length; offset += chunkSize) {
    const chunk = wanted.slice(offset, offset + chunkSize);
    const rows = await captainsLogCloudRest<Array<{ company_id?: string; external_id?: string }>>("GET", "company_external_ids", undefined, {
      select: "company_id,external_id",
      source: "eq.client_compass",
      external_id: `in.(${chunk.map((id) => JSON.stringify(id)).join(",")})`,
      limit: String(chunk.length),
    });
    for (const row of Array.isArray(rows) ? rows : []) {
      const clientId = text(row.external_id);
      const companyId = text(row.company_id);
      if (chunk.includes(clientId) && isUuid(companyId)) result.set(clientId, companyId);
    }
  }
  return result;
}

async function ensureIndividually(clients: IdentityClient[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (const client of clients) {
    const companyId = text(await captainsLogCloudRest<string>("POST", "rpc/ensure_company_identity", {
      p_display_name: client.name,
      p_aliases: Array.isArray(client.aliases) ? client.aliases.filter(Boolean) : [],
      p_source: "client_compass",
      p_external_id: client.id,
    }));
    if (isUuid(companyId)) result.set(client.id, companyId);
  }
  return result;
}

/**
 * Resolve Client Compass records to universal company UUIDs with one Supabase call.
 * Existing UUIDs and the local identity cache win first, so routine sync performs
 * no identity request once the client book is established.
 */
export async function resolveCompassCompanyIdsBulk(clients: IdentityClient[]): Promise<Map<string, string>> {
  const cleaned = clients
    .map((client) => ({ ...client, id: text(client.id), name: text(client.name), companyId: text(client.companyId) }))
    .filter((client) => client.id && client.name);
  const result = new Map<string, string>();
  const cache = readCache();

  for (const client of cleaned) {
    if (isUuid(client.companyId)) result.set(client.id, client.companyId);
    else {
      const cached = cachedCompanyId(client.id, cache);
      if (cached) result.set(client.id, cached);
    }
  }

  let missing = cleaned.filter((client) => !result.has(client.id));
  if (!missing.length) return result;

  try {
    const rows = await captainsLogCloudRest<BulkIdentityRow[]>("POST", "rpc/resolve_client_compass_companies", {
      p_clients: missing.map((client) => ({
        client_id: client.id,
        display_name: client.name,
        aliases: Array.isArray(client.aliases) ? client.aliases.filter(Boolean) : [],
      })),
    });
    for (const row of Array.isArray(rows) ? rows : []) {
      const clientId = text(row.client_id);
      const companyId = text(row.company_id);
      if (clientId && isUuid(companyId)) result.set(clientId, companyId);
    }
  } catch (cause) {
    if (!rpcUnavailable(cause, "resolve_client_compass_companies")) throw cause;

    // Compatibility path for a Supabase project that has not received the Phase 1
    // RPC yet. It is still cheaper than downloading the full company/alias registry.
    const mapped = await lookupExistingMappings(missing.map((client) => client.id));
    for (const [clientId, companyId] of mapped) result.set(clientId, companyId);
    missing = missing.filter((client) => !result.has(client.id));
    if (missing.length) {
      const created = await ensureIndividually(missing);
      for (const [clientId, companyId] of created) result.set(clientId, companyId);
    }
  }

  saveCache(cleaned, result);
  return result;
}
