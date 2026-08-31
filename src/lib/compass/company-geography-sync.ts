"use client";

import { captainsLogCloudRest } from "./captains-log-cloud";
import type { CompassClient } from "./types";

const GEOGRAPHY_FINGERPRINT_KEY = "client_compass.company_geography.fingerprint.v1";

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

export async function syncClientCompassCompanyGeography(clients: GeographyClient[]): Promise<number> {
  const rows = geographyRows(clients);
  if (!rows.length) return 0;

  const nextFingerprint = fingerprint(rows);
  if (canStore() && window.localStorage.getItem(GEOGRAPHY_FINGERPRINT_KEY) === nextFingerprint) return 0;

  const result = await captainsLogCloudRest<SyncResult>(
    "POST",
    "rpc/sync_client_compass_company_geography_bulk",
    { p_rows: rows },
  );

  const received = Math.max(0, Number(result?.received ?? rows.length) || 0);
  const matched = Math.max(0, Number(result?.matched ?? 0) || 0);
  if (received > 0 && matched >= received && canStore()) {
    window.localStorage.setItem(GEOGRAPHY_FINGERPRINT_KEY, nextFingerprint);
  }
  return Math.max(0, Number(result?.updated ?? 0) || 0);
}
