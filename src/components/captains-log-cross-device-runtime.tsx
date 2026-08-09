"use client";

import { useEffect } from "react";
import { getCaptainsLogCloudAuthSnapshot, captainsLogCloudRest } from "@/lib/compass/captains-log-cloud";
import { mergeCaptainsLogSyncIntoClient, syncClientsFromCaptainsLog } from "@/lib/compass/captains-log-bridge";
import { ensureCompanyIdentitiesForClients } from "@/lib/compass/company-identity";
import { loadCompassDataset, saveCompassDataset } from "@/lib/compass/store";
import type { CompassClient } from "@/lib/compass/types";

type JsonMap = Record<string, unknown>;
type DeltaTaskRow = { event_id?: string; inserted_at?: string; company_id?: string; metadata?: JsonMap };
type DeltaCallRow = { event_id?: string; inserted_at?: string; company_id?: string; payload?: JsonMap };
type CursorState = { taskCursor: string; callCursor: string; fingerprint: string; account: string };

const CURSOR_KEY = "client-compass.captains-log-auto-sync.v5";
const SYNC_INTERVAL_MS = 180_000;
const FOCUS_THROTTLE_MS = 15_000;
const OVERLAP_MS = 10_000;
const PAGE_SIZE = 500;
const MAX_DELTA_ROWS = 10_000;

function text(value: unknown): string { return String(value ?? "").trim(); }
function record(value: unknown): JsonMap { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonMap : {}; }

function fingerprint(clients: CompassClient[]): string {
  return clients.map((client) => `${client.id}:${client.companyId || ""}`).sort().join("|");
}

function readCursor(): CursorState | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CURSOR_KEY) || "null") as Partial<CursorState> | null;
    if (!parsed?.taskCursor || !parsed.callCursor || !parsed.fingerprint || !parsed.account) return null;
    return { taskCursor: text(parsed.taskCursor), callCursor: text(parsed.callCursor), fingerprint: text(parsed.fingerprint), account: text(parsed.account) };
  } catch { return null; }
}

function saveCursor(cursor: CursorState): void {
  try { window.localStorage.setItem(CURSOR_KEY, JSON.stringify(cursor)); } catch { /* local cursor only */ }
}

function overlapCursor(value: string): string {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(Math.max(0, ms - OVERLAP_MS)).toISOString() : value;
}

async function fetchDelta<T>(path: string, cursor: string, params: Record<string, string>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < MAX_DELTA_ROWS; offset += PAGE_SIZE) {
    const page = await captainsLogCloudRest<T[]>("GET", path, undefined, {
      ...params,
      inserted_at: `gte.${overlapCursor(cursor)}`,
      order: "inserted_at.asc",
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (!Array.isArray(page)) break;
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function taskCompanyId(row: DeltaTaskRow): string {
  const meta = record(row.metadata);
  const patch = record(meta.patch);
  const mobile = record(meta.mobile_context);
  return text(row.company_id || patch.company_id || meta.company_id || mobile.company_id);
}

function callCompanyId(row: DeltaCallRow): string {
  const payload = record(row.payload);
  const prospect = record(payload.prospect);
  const salesTask = record(payload.sales_task);
  const activity = record(payload.activity);
  const extra = record(payload.extra);
  return text(row.company_id || payload.company_id || salesTask.company_id || prospect.company_id || activity.company_id || extra.company_id);
}

async function attachCompanyIdentities(dataset: Awaited<ReturnType<typeof loadCompassDataset>>) {
  if (!dataset?.clients.length) return dataset;
  const identities = await ensureCompanyIdentitiesForClients(dataset.clients);
  let changed = false;
  const clients = dataset.clients.map((client) => {
    const identity = identities.get(client.id);
    if (!identity || client.companyId === identity.companyId) return client;
    changed = true;
    return {
      ...client,
      companyId: identity.companyId,
      captainsLog: client.captainsLog ? { ...client.captainsLog, companyId: identity.companyId } : client.captainsLog,
    };
  });
  if (!changed) return dataset;
  const next = { ...dataset, clients };
  await saveCompassDataset(next);
  return next;
}

async function refreshClients(dataset: NonNullable<Awaited<ReturnType<typeof loadCompassDataset>>>, targetIds?: Set<string>) {
  const target = targetIds?.size
    ? dataset.clients.filter((client) => client.companyId && targetIds.has(client.companyId))
    : dataset.clients;
  if (!target.length) return dataset;

  const batch = await syncClientsFromCaptainsLog(target.map((client) => ({
    clientId: client.id,
    company: client.name,
    aliases: client.aliases || [],
    companyId: client.companyId,
  })));
  const byId = new Map(batch.results.filter((result) => result.client_id).map((result) => [result.client_id as string, result]));
  let changed = false;
  const clients = dataset.clients.map((client) => {
    const result = byId.get(client.id);
    if (!result) return client;
    const merged = mergeCaptainsLogSyncIntoClient(client, result);
    if (JSON.stringify(merged) !== JSON.stringify(client)) changed = true;
    return merged;
  });
  if (!changed) return dataset;
  const next = { ...dataset, clients };
  await saveCompassDataset(next);
  return next;
}

export function CaptainsLogCrossDeviceRuntime() {
  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let lastRunAt = 0;

    const sync = async (urgent = false) => {
      const now = Date.now();
      if (disposed || inFlight || now - lastRunAt < (urgent ? FOCUS_THROTTLE_MS : SYNC_INTERVAL_MS - 2_000)) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const auth = getCaptainsLogCloudAuthSnapshot();
      if (!auth.configured || !auth.signedIn) return;
      let dataset = await loadCompassDataset();
      if (!dataset?.clients.length || disposed) return;
      inFlight = true;
      lastRunAt = now;

      try {
        dataset = await attachCompanyIdentities(dataset);
        if (!dataset?.clients.length) return;
        const account = auth.userId || auth.email;
        const currentFingerprint = fingerprint(dataset.clients);
        let cursor = readCursor();

        // v5 intentionally starts with a clean UUID-only rebuild. This purges any
        // stale task/activity projections created by the old fuzzy matcher.
        if (!cursor || cursor.fingerprint !== currentFingerprint || cursor.account !== account) {
          dataset = await refreshClients(dataset);
          const baseline = new Date(Date.now() - OVERLAP_MS).toISOString();
          cursor = { taskCursor: baseline, callCursor: baseline, fingerprint: fingerprint(dataset.clients), account };
          saveCursor(cursor);
          return;
        }

        const nextCursor = new Date(Date.now() - 1_000).toISOString();
        const [taskRows, callRows] = await Promise.all([
          fetchDelta<DeltaTaskRow>("task_events", cursor.taskCursor, {
            select: "event_id,inserted_at,company_id,metadata",
          }),
          fetchDelta<DeltaCallRow>("app_events", cursor.callCursor, {
            select: "event_id,inserted_at,company_id,payload",
            event_type: "eq.call_mode_event",
          }),
        ]);

        const affectedCompanyIds = new Set<string>();
        taskRows.forEach((row) => { const companyId = taskCompanyId(row); if (companyId) affectedCompanyIds.add(companyId); });
        callRows.forEach((row) => { const companyId = callCompanyId(row); if (companyId) affectedCompanyIds.add(companyId); });

        // Rows with no UUID are deliberately ignored here. They are legacy data and
        // may only be recovered by the bridge's exact-name migration fallback.
        if (affectedCompanyIds.size) dataset = await refreshClients(dataset, affectedCompanyIds);

        saveCursor({
          taskCursor: nextCursor,
          callCursor: nextCursor,
          fingerprint: fingerprint(dataset.clients),
          account,
        });
      } catch (cause) {
        if (typeof console !== "undefined") console.debug("Captain's Log UUID sync deferred", cause);
      } finally {
        inFlight = false;
      }
    };

    const onFocus = () => { void sync(true); };
    const onVisibility = () => { if (document.visibilityState === "visible") void sync(true); };
    const onOnline = () => { void sync(true); };
    const startup = window.setTimeout(() => { void sync(true); }, 900);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void sync(false); }, SYNC_INTERVAL_MS);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      window.clearTimeout(startup);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
