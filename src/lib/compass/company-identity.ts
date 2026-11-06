"use client";

import type { CompassClient } from "./types";

/**
 * Client Compass's former Supabase universal-company registry is retired.
 * GHL is now the CRM source of truth for business/contact matching. Its IDs
 * are verified through the authenticated DigitalOcean GHL reader, never
 * by assuming a legacy Supabase company UUID is a GHL business ID.
 *
 * Local inventory/name/alias matching remains available for Ninja imports.
 * These compatibility exports no longer read, create, backfill, or update
 * any external database.
 */
export const COMPANY_IDENTITY_CACHE_KEY = "client_compass.company_identity.v2";
export const COMPANY_IDENTITY_SCHEMA_READY_KEY = "client_compass.company_identity.schema.v1";

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

export function normalizeUniversalCompanyName(value: string): string {
  return String(value ?? "")
    .trim().toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(llc|pllc|pc|inc|corp|corporation|company|co)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** No legacy Supabase registry is a current authenticated identity source. */
export function companyIdentitySchemaReady(): boolean {
  return false;
}

/** Explicitly supplied local snapshot matching only, never auto-verified GHL. */
export function companyIdentityForClient(
  client: Pick<CompassClient, "id" | "name" | "aliases"> & { companyId?: string },
  identities: CompanyIdentity[] = [],
): CompanyIdentity | null {
  if (!identities.length) return null;
  const direct = identities.filter((identity) =>
    identity.clientCompassClientIds.includes(client.id) ||
    (client.companyId && identity.companyId === client.companyId));
  if (direct.length === 1) return direct[0];
  if (direct.length > 1) return null;
  const names = new Set([client.name, ...(client.aliases ?? [])]
    .map(normalizeUniversalCompanyName).filter(Boolean));
  const matches = identities.filter((identity) =>
    [identity.normalizedName, identity.canonicalName, ...identity.aliases]
      .map(normalizeUniversalCompanyName)
      .some((name) => name && names.has(name)));
  return matches.length === 1 ? matches[0] : null;
}

/** Previously refreshed a Supabase registry. No backend access remains. */
export async function refreshCompanyIdentityRegistry(): Promise<CompanyIdentity[]> {
  return [];
}

/** Previously backfilled Supabase company UUIDs. Explicitly retired. */
export async function backfillLegacyCompanyIds(): Promise<Record<string, unknown>> {
  return {};
}

/** Never create a new Supabase identity during Compass import. */
export async function ensureCompanyIdentityForClient(
  client: Pick<CompassClient, "id" | "name" | "aliases"> & { companyId?: string },
  registry: CompanyIdentity[] = [],
): Promise<CompanyIdentity> {
  const identity = companyIdentityForClient(client, registry);
  if (identity) return identity;
  throw new Error("Legacy cloud identity creation is retired. Verify an existing business through the GHL task reader.");
}

/** Preserves the Ninja import callsite without Supabase identity RPC writes. */
export async function ensureCompanyIdentitiesForClients(
  _clients: Array<Pick<CompassClient, "id" | "name" | "aliases"> & { companyId?: string }>,
): Promise<Map<string, CompanyIdentity>> {
  return new Map();
}
