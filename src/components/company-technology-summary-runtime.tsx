"use client";

import { useEffect, useRef } from "react";
import { captainsLogCloudRest, getCaptainsLogCloudAuthSnapshot } from "@/lib/compass/captains-log-cloud";
import { useCompassState } from "@/lib/compass/store";
import type { CompassDataset } from "@/lib/compass/types";

const CACHE_KEY = "client_compass.company_technology_summary.v1";
const BATCH_SIZE = 200;

type SafeTechnologySummary = {
  company_id: string;
  healthy_count: number;
  planning_count: number;
  replace_count: number;
  estimated_replacement_need: number;
  last_quote_date: string | null;
  snapshot_updated_at: string;
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

function safeRows(dataset: CompassDataset): SafeTechnologySummary[] {
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
    const companyId = String(client.companyId || "").trim();
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

async function publish(dataset: CompassDataset): Promise<void> {
  const auth = getCaptainsLogCloudAuthSnapshot();
  if (!auth.configured || !auth.signedIn) return;

  const cache = readCache();
  const rows = safeRows(dataset).filter((row) => cache[row.company_id] !== fingerprint(row));
  if (!rows.length) return;

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    await captainsLogCloudRest("POST", "rpc/upsert_company_technology_summaries", { p_summaries: batch });
    for (const row of batch) cache[row.company_id] = fingerprint(row);
    writeCache(cache);
  }
}

export function CompanyTechnologySummaryRuntime() {
  const { dataset, ready } = useCompassState();
  const inFlight = useRef(false);
  const queued = useRef(false);

  useEffect(() => {
    if (!ready || !dataset?.clients.length) return;
    let cancelled = false;
    const run = async () => {
      if (inFlight.current) {
        queued.current = true;
        return;
      }
      inFlight.current = true;
      try {
        do {
          queued.current = false;
          await publish(dataset);
        } while (!cancelled && queued.current);
      } catch (cause) {
        if (typeof console !== "undefined") console.debug("Safe company technology summary publish deferred", cause);
      } finally {
        inFlight.current = false;
      }
    };
    const timer = window.setTimeout(() => { if (!cancelled) void run(); }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [dataset, ready]);

  return null;
}
