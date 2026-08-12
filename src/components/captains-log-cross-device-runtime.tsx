"use client";

import { useEffect } from "react";
import { getCaptainsLogCloudAuthSnapshot, captainsLogCloudRest } from "@/lib/compass/captains-log-cloud";
import { mergeCaptainsLogSyncIntoClient, syncClientsFromCaptainsLog } from "@/lib/compass/captains-log-bridge";
import { syncClientsFromCompassCurrentState } from "@/lib/compass/captains-log-current-state";
import { resolveCompassCompanyIdsBulk } from "@/lib/compass/company-identity-bulk";
import { loadCompassDataset, saveCompassDataset } from "@/lib/compass/store";
import type { CompassClient } from "@/lib/compass/types";

type ChangedCompanyRow = { company_id?: string; changed_at?: string };
type DeltaRow = { event_id?: string; inserted_at?: string; company_id?: string };
type CursorState = { cursor: string; fingerprint: string; account: string };

const CURSOR_KEY = "client-compass.captains-log-auto-sync.v7";
const SYNC_INTERVAL_MS = 180_000;
const FOCUS_THROTTLE_MS = 15_000;
const OVERLAP_MS = 10_000;
const PAGE_SIZE = 500;
const MAX_DELTA_ROWS = 10_000;

function text(value: unknown): string { return String(value ?? "").trim(); }
function isUuid(value: unknown): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value)); }

function fingerprint(clients: CompassClient[]): string {
  return clients.map((client) => `${client.id}:${client.companyId || ""}`).sort().join("|");
}

function readCursor(): CursorState | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CURSOR_KEY) || "null") as Partial<CursorState> | null;
    if (!parsed?.cursor || !parsed.fingerprint || !parsed.account) return null;
    return { cursor: text(parsed.cursor), fingerprint: text(parsed.fingerprint), account: text(parsed.account) };
  } catch { return null; }
}

function saveCursor(cursor: CursorState): void {
  try { window.localStorage.setItem(CURSOR_KEY, JSON.stringify(cursor)); } catch { /* local cursor only */ }
}

function overlapCursor(value: string): string {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(Math.max(0, ms - OVERLAP_MS)).toISOString() : value;
}

function rpcUnavailable(cause: unknown): boolean {
  const message = String(cause instanceof Error ? cause.message : cause || "").toLowerCase();
  return message.includes("pgrst202")
    || message.includes("42883")
    || message.includes("schema cache")
    || message.includes("could not find the function")
    || (message.includes("404") && message.includes("client_compass_changed_company_ids"));
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

async function changedCompanyIds(cursor: string): Promise<Set<string>> {
  try {
    const rows = await captainsLogCloudRest<ChangedCompanyRow[]>("POST", "rpc/client_compass_changed_company_ids", {
      p_since: overlapCursor(cursor),
      p_limit: MAX_DELTA_ROWS,
    });
    return new Set((Array.isArray(rows) ? rows : []).map((row) => text(row.company_id)).filter(isUuid));
  } catch (cause) {
    if (!rpcUnavailable(cause)) throw cause;

    // Compatibility fallback while the Phase 1 SQL is being installed. Only the
    // UUID and timestamp are transferred; historical metadata/payload is not.
    const [taskRows, callRows] = await Promise.all([
      fetchDelta<DeltaRow>("task_events", cursor, { select: "event_id,inserted_at,company_id" }),
      fetchDelta<DeltaRow>("app_events", cursor, { select: "event_id,inserted_at,company_id", event_type: "eq.call_mode_event" }),
    ]);
    return new Set([...taskRows, ...callRows].map((row) => text(row.company_id)).filter(isUuid));
  }
}

async function attachCompanyIdentities(dataset: Awaited<ReturnType<typeof loadCompassDataset>>) {
  if (!dataset?.clients.length) return dataset;
  const missing = dataset.clients.filter((client) => !isUuid(client.companyId));
  if (!missing.length) return dataset;

  const resolved = await resolveCompassCompanyIdsBulk(missing);
  let changed = false;
  const clients = dataset.clients.map((client) => {
    const companyId = resolved.get(client.id);
    if (!companyId || client.companyId === companyId) return client;
    changed = true;
    return {
      ...client,
      companyId,
      captainsLog: client.captainsLog ? { ...client.captainsLog, companyId } : client.captainsLog,
    };
  });
  if (!changed) return dataset;
  const next = { ...dataset, clients };
  await saveCompassDataset(next);
  return next;
}

async function refreshClients(dataset: NonNullable<Awaited<ReturnType<typeof loadCompassDataset>>>, targetIds: Set<string>) {
  if (!targetIds.size) return dataset;
  const target = dataset.clients.filter((client) => client.companyId && targetIds.has(client.companyId));
  if (!target.length) return dataset;

  const inputs = target.map((client) => ({
    clientId: client.id,
    company: client.name,
    aliases: client.aliases || [],
    companyId: client.companyId,
  }));
  const batch = await syncClientsFromCompassCurrentState(inputs) ?? await syncClientsFromCaptainsLog(inputs);
  const byId = new Map(batch.results.filter((result) => result.client_id).map((result) => [result.client_id as string, result]));
  let changed = false;
  const clients = dataset.clients.map((client) => {
    const result = byId.get(client.id);
    if (!result) return client;
    const merged = mergeCaptainsLogSyncIntoClient(client, result);
    // Last Sales Activity belongs to TC coverage data, not Captain's Log coordination.
    const safeMerged = { ...merged, lastSalesInteraction: client.lastSalesInteraction };
    if (JSON.stringify(safeMerged) !== JSON.stringify(client)) changed = true;
    return safeMerged;
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

        // New installs or client-book changes establish a fresh baseline only.
        // They never trigger a historical Captain's Log scan.
        if (!cursor || cursor.fingerprint !== currentFingerprint || cursor.account !== account) {
          cursor = { cursor: new Date(Date.now() - OVERLAP_MS).toISOString(), fingerprint: currentFingerprint, account };
          saveCursor(cursor);
          return;
        }

        const nextCursor = new Date(Date.now() - 1_000).toISOString();
        const affectedCompanyIds = await changedCompanyIds(cursor.cursor);
        if (affectedCompanyIds.size) dataset = await refreshClients(dataset, affectedCompanyIds);

        saveCursor({ cursor: nextCursor, fingerprint: fingerprint(dataset.clients), account });
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
