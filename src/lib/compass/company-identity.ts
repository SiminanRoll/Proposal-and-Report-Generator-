"use client";

import type { CompassClient } from "./types";

/**
 * Client Compass company-identity compatibility API.
 *
 * The old universal-company UUID registry used Captain's Log/Supabase and is
 * retired for this app. Do not infer that any of those UUIDs are GHL business
 * IDs. The import wizard's local Compass/Ninja matching remains available,
 * while the separate authenticated GHL read panel verifies existing GHL
 * business/contact IDs. No network call or cloud fallback exists here.
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

type MinimalClient = Pick<CompassClient, "id" | "name" | "aliases"> & { companyId?: string };

export function companyIdentitySchemaReady(): boolean {
  // The removed Supabase identity registry can never be considered ready.
  return false;
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

/**
 * Pure lookup for explicitly supplied records only. Does not load an old
 * cached Supabase registry and does not silently learn fuzzy identity links.
 */
export function companyIdentityForClient(
  client: MinimalClient,
  identities: CompanyIdentity[] = [],
): CompanyIdentity | null {
  const direct = identities.filter((identity) =>
    identity.clientCompassClientIds.includes(client.id) ||
    (client.companyId && identity.companyId === client.companyId));
  return direct.length === 1 ? direct[0] : null;
}

/**
 * The prior remote registry is no longer fetched. The import preview keeps
 * working using actual local Compass clients and their alias history.
 */
export async function refreshCompanyIdentityRegistry(): Promise<CompanyIdentity[]> {
  return [];
}

/** Legacy operation retired. Never write to Captain's Log or Supabase. */
export async function backfillLegacyCompanyIds(): Promise<Record<string, never>> {
  return {};
}

/** Legacy operation retired. Do not generate identity UUIDs for GHL. */
export async function ensureCompanyIdentityForClient(_client: MinimalClient): Promise<CompanyIdentity> {
  throw new Error("Legacy cloud identity creation is retired. Verify an existing GHL business and contact instead.");
}

/** Legacy bulk operation retired. Never create identities in another backend. */
export async function ensureCompanyIdentitiesForClients(
  _clients: MinimalClient[],
): Promise<Map<string, CompanyIdentity>> {
  return new Map();
}
