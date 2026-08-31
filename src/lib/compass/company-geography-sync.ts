"use client";

import { captainsLogCloudRest, getCaptainsLogCloudAuthSnapshot } from "./captains-log-cloud";
import type { CompassClient } from "./types";

const GEOGRAPHY_FINGERPRINT_KEY = "client_compass.company_geography.fingerprint.v2";
const BATCH_SIZE = 200;

type GeographyClient = Pick<CompassClient, "id" | "city" | "state">;
type SyncResult = { received?: number; matched?: number; updated?: number };

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function canStore(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function geographyRows(clients: GeographyClient[]) {
  return clients
    .map((client) => ({
      external_id: text(client.id),
      city: text(client.city),
      state: text(client.state).toUpperCase(),
    }))
    .filter((row) => row.external_id && (row.city || row.state))
    .sort((left, right) => left.external_id.localeCompare(right.external_id));
}

function fingerprint(rows: Array<{ external_id: string; city: string; state: string }>): string {
  let hash = 2166136261;
  const value = rows.map((row) => `${row.external_id}|${row.city}|${row.state}`).join("\n");
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${rows.length}:${(hash >>> 0).toString(16)}`;
}

function scopedFingerprintKey(userId: string): string {
  return `${GEOGRAPHY_FINGERPRINT_KEY}:${userId}`;
}

export async function syncClientCompassCompanyGeography(clients: GeographyClient[]): Promise<number> {
  const auth = getCaptainsLogCloudAuthSnapshot();
  if (!auth.configured || !auth.signedIn || !auth.userId) return 0;

  const rows = geographyRows(clients);
  if (!rows.length) return 0;

  const nextFingerprint = fingerprint(rows);
  const cacheKey = scopedFingerprintKey(auth.userId);
  if (canStore() && window.localStorage.getItem(cacheKey) === nextFingerprint) return 0;

  let totalUpdated = 0;
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const result = await captainsLogCloudRest<SyncResult>(
      "POST",
      "rpc/sync_client_compass_company_geography_bulk",
      { p_rows: batch },
    );

    const received = Math.max(0, Number(result?.received ?? -1) || 0);
    const matched = Math.max(0, Number(result?.matched ?? -1) || 0);
    if (received !== batch.length || matched !== batch.length) {
      throw new Error(`Supabase geography publish was not confirmed (${received}/${batch.length} received, ${matched}/${batch.length} exact IDs matched).`);
    }
    totalUpdated += Math.max(0, Number(result?.updated ?? 0) || 0);
  }

  if (canStore()) window.localStorage.setItem(cacheKey, nextFingerprint);
  return totalUpdated;
}
