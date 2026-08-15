"use client";

import { useEffect, useRef } from "react";
import { captainsLogCloudRest, getCaptainsLogCloudAuthSnapshot } from "@/lib/compass/captains-log-cloud";
import { resolveCompassCompanyIdsBulk } from "@/lib/compass/company-identity-bulk";
import { useCompassState } from "@/lib/compass/store";
import type { CompassDataset } from "@/lib/compass/types";

const CACHE_KEY = "client_compass.company_technology_summary.v3";
const BATCH_SIZE = 200;
const RETRY_POLL_MS = 30_000;

type SafeTechnologySummary = {
  company_id: string;
  healthy_count: number;
  planning_count: number;
  replace_count: number;
  estimated_replacement_need: number;
  last_quote_date: string | null;
  snapshot_updated_at: string;
};

type PublishResponse = {
  ok?: boolean;
  processed?: number;
  recorded?: number;
  stale_ignored?: number;
};

type CachedFingerprints = Record<string, string>;

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? "").trim());
}

function readCache(): CachedFingerprints {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as CachedFingerprints : {};
  } catch {
    return {};
  }
}

function writeCache(cache: CachedFingerprints): void {
  try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* best-effort dedupe only */ }
}

function dateOnly(value: unknown): string | null {
  const match = String(value ?? "").trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function snapshotTimestamp(dataset: CompassDataset): string {
  for (const raw of [dataset.calculatedAt, dataset.importedAt]) {
    const ms = Date.parse(String(raw || ""));
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}

async function safeRows(dataset: CompassDataset): Promise<SafeTechnologySummary[]> {
  // The publisher owns its identity resolution. It must not depend on another
  // runtime having persisted client.companyId first, otherwise a valid local
  // Ninja dataset can remain permanently unpublished in Supabase.
  const resolved = await resolveCompassCompanyIdsBulk(dataset.clients);

  const counts = new Map<string, { healthy: number; planning: number; replace: number }>();
  for (const device of dataset.devices) {
    if (device.deviceType !== "physical-workstation") continue;
    const current = counts.get(device.clientId) || { healthy: 0, planning: 0, replace: 0 };
    if (device.lifecycle === "current") current.healthy += 1;
    else if (device.lifecycle === "plan-soon") current.planning += 1;
    else if (device.lifecycle === "replace-now") current.replace += 1;
    counts.set(device.clientId, current);
  }

  const estimates = new Map(dataset.summaries.map((summary) => [summary.clientId, Math.max(0, Number(summary.totalEstimatedValue || 0))]));
  const updatedAt = snapshotTimestamp(dataset);
  return dataset.clients.flatMap((client) => {
    const existingId = String(client.companyId || "").trim();
    const resolvedId = String(resolved.get(client.id) || "").trim();
    const companyId = isUuid(existingId) ? existingId : resolvedId;
    if (!isUuid(companyId)) return [];
    const health = counts.get(client.id) || { healthy: 0, planning: 0, replace: 0 };
    return [{
      company_id: companyId,
      healthy_count: health.healthy,
      planning_count: health.planning,
      replace_count: health.replace,
      estimated_replacement_need: estimates.get(client.id) || 0,
      last_quote_date: dateOnly(client.lastQuoteDate),
      snapshot_updated_at: updatedAt,
    }];
  });
}

function fingerprint(row: SafeTechnologySummary): string {
  return [
    row.snapshot_updated_at,
    row.healthy_count,
    row.planning_count,
    row.replace_count,
    row.estimated_replacement_need.toFixed(2),
    row.last_quote_date || "",
  ].join("|");
}

function scopedFingerprintKey(userId: string, companyId: string): string {
  return `${userId}:${companyId}`;
}

async function publish(dataset: CompassDataset): Promise<void> {
  const auth = getCaptainsLogCloudAuthSnapshot();
  if (!auth.configured || !auth.signedIn || !auth.userId) return;

  const cache = readCache();
  const rows = (await safeRows(dataset)).filter((row) => cache[scopedFingerprintKey(auth.userId, row.company_id)] !== fingerprint(row));
  if (!rows.length) return;

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const result = await captainsLogCloudRest<PublishResponse>("POST", "rpc/upsert_company_technology_summaries", { p_summaries: batch });
    const processed = Number(result?.processed ?? -1);
    const accepted = Number(result?.recorded ?? 0) + Number(result?.stale_ignored ?? 0);
    if (!result?.ok || processed !== batch.length || accepted !== batch.length) {
      throw new Error(`Supabase technology summary publish was not confirmed (${processed}/${batch.length} processed, ${accepted} accepted).`);
    }
    for (const row of batch) cache[scopedFingerprintKey(auth.userId, row.company_id)] = fingerprint(row);
    writeCache(cache);
  }
}

export function CompanyTechnologySummaryRuntime() {
  const { dataset, ready } = useCompassState();
  const inFlight = useRef(false);
  const queued = useRef(false);
  const latestDataset = useRef<CompassDataset | null>(dataset || null);

  useEffect(() => {
    latestDataset.current = dataset || null;
    if (!ready || !dataset?.clients.length) return;

    let disposed = false;
    const run = async () => {
      if (disposed) return;
      if (inFlight.current) {
        queued.current = true;
        return;
      }
      inFlight.current = true;
      try {
        do {
          queued.current = false;
          const current = latestDataset.current;
          if (current?.clients.length) await publish(current);
        } while (queued.current && !disposed);
      } catch (cause) {
        if (typeof console !== "undefined") console.debug("Safe company technology summary publish deferred", cause);
      } finally {
        inFlight.current = false;
      }
    };

    const trigger = () => { if (!disposed) void run(); };
    const onVisibility = () => { if (document.visibilityState === "visible") trigger(); };
    const timer = window.setTimeout(trigger, 350);
    const interval = window.setInterval(trigger, RETRY_POLL_MS);
    window.addEventListener("focus", trigger);
    window.addEventListener("online", trigger);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("focus", trigger);
      window.removeEventListener("online", trigger);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [dataset, ready]);

  return null;
}
