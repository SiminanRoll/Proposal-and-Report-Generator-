"use client";

import { useEffect } from "react";
import { getCaptainsLogCloudAuthSnapshot, captainsLogCloudRest } from "@/lib/compass/captains-log-cloud";
import { mergeCaptainsLogSyncIntoClient, syncClientsFromCaptainsLog } from "@/lib/compass/captains-log-bridge";
import { syncClientsFromCompassCurrentState } from "@/lib/compass/captains-log-current-state";
import { resolveCompassCompanyIdsBulk } from "@/lib/compass/company-identity-bulk";
import { loadCloudReviewStates, resolutionFromCloudState, saveCloudReviewState, saveFormalReviewDateToCloud } from "@/lib/compass/review-state-cloud";
import { dateOnly, formalAccountReviewDate } from "@/lib/compass/review-state";
import { loadCompassDataset, saveCompassDataset } from "@/lib/compass/store";
import type { CompassClient, CompassDataset } from "@/lib/compass/types";
import { loadWorkbenchState, saveWorkbenchState, type WorkbenchReviewResolution } from "@/lib/compass/workbench";

type ChangedCompanyRow = { company_id?: string; changed_at?: string };
type DeltaRow = { event_id?: string; inserted_at?: string; company_id?: string };
type CursorState = { cursor: string; fingerprint: string; account: string };
type SyncReason = "startup" | "timer" | "focus" | "visible" | "online" | "queued";

const CURSOR_KEY = "client-compass.captains-log-auto-sync.v7";
const TICK_MS = 60_000;
const CAPTAINS_LOG_INTERVAL_MS = 3 * 60_000;
const REVIEW_STATE_INTERVAL_MS = 3 * 60_000;
const RELATIONSHIP_INTERVAL_MS = 10 * 60_000;
const IDENTITY_INTERVAL_MS = 30 * 60_000;
const FOREGROUND_THROTTLE_MS = 15_000;
const OVERLAP_MS = 10_000;
const PAGE_SIZE = 500;
const MAX_DELTA_ROWS = 10_000;

export const COMPASS_SYNC_STATUS_EVENT = "client-compass-sync-status";

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value));
}

function time(value: string): number {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function fingerprint(clients: CompassClient[]): string {
  return clients.map((client) => `${client.id}:${client.companyId || ""}`).sort().join("|");
}

function readCursor(): CursorState | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CURSOR_KEY) || "null") as Partial<CursorState> | null;
    if (!parsed?.cursor || !parsed.fingerprint || !parsed.account) return null;
    return { cursor: text(parsed.cursor), fingerprint: text(parsed.fingerprint), account: text(parsed.account) };
  } catch {
    return null;
  }
}

function saveCursor(cursor: CursorState): void {
  try { window.localStorage.setItem(CURSOR_KEY, JSON.stringify(cursor)); } catch { /* local cursor only */ }
}

function overlapCursor(value: string): string {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(Math.max(0, ms - OVERLAP_MS)).toISOString() : value;
}

function sameResolution(left: WorkbenchReviewResolution | undefined, right: WorkbenchReviewResolution | null): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.disposition === right.disposition
    && left.date === right.date
    && left.activityThrough === right.activityThrough
    && left.nextReviewDate === right.nextReviewDate
    && left.note === right.note
    && left.resolvedAt === right.resolvedAt;
}

function emitStatus(status: "syncing" | "idle" | "degraded", reason: SyncReason, errors: string[] = []): void {
  window.dispatchEvent(new CustomEvent(COMPASS_SYNC_STATUS_EVENT, { detail: { status, reason, errors, at: new Date().toISOString() } }));
}

function debugDeferred(area: string, cause: unknown): void {
  if (typeof console !== "undefined") console.debug(`${area} deferred`, cause);
}

function rpcUnavailable(cause: unknown, functionName: string): boolean {
  const message = String(cause instanceof Error ? cause.message : cause || "").toLowerCase();
  return message.includes("pgrst202")
    || message.includes("42883")
    || message.includes("schema cache")
    || message.includes("could not find the function")
    || (message.includes("404") && message.includes(functionName.toLowerCase()));
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
    if (!rpcUnavailable(cause, "client_compass_changed_company_ids")) throw cause;
    const [taskRows, callRows] = await Promise.all([
      fetchDelta<DeltaRow>("task_events", cursor, { select: "event_id,inserted_at,company_id" }),
      fetchDelta<DeltaRow>("app_events", cursor, { select: "event_id,inserted_at,company_id", event_type: "eq.call_mode_event" }),
    ]);
    return new Set([...taskRows, ...callRows].map((row) => text(row.company_id)).filter(isUuid));
  }
}

async function reconcileIdentities(dataset: CompassDataset): Promise<{ dataset: CompassDataset; changed: boolean }> {
  const missing = dataset.clients.filter((client) => !isUuid(client.companyId));
  if (!missing.length) return { dataset, changed: false };
  const resolved = await resolveCompassCompanyIdsBulk(missing);
  if (!resolved.size) return { dataset, changed: false };

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
  return changed ? { dataset: { ...dataset, clients }, changed: true } : { dataset, changed: false };
}

async function reconcileRelationships(): Promise<void> {
  await captainsLogCloudRest<number>("POST", "rpc/reconcile_client_compass_relationships", {});
}

async function reconcileReviewState(dataset: CompassDataset): Promise<{ dataset: CompassDataset; changed: boolean }> {
  if (!dataset.clients.some((client) => isUuid(client.companyId))) return { dataset, changed: false };

  const cloudRows = await loadCloudReviewStates();
  const cloudByCompany = new Map(cloudRows.map((row) => [row.company_id, row]));
  const workbench = loadWorkbenchState();
  const resolutions = { ...(workbench.resolutions ?? {}) };
  const publishes: Promise<unknown>[] = [];
  let workbenchChanged = false;
  let datasetChanged = false;

  const clients = dataset.clients.map((client) => {
    if (!client.companyId) return client;
    const cloud = cloudByCompany.get(client.companyId);
    const localResolution = resolutions[client.id];

    if (!cloud) {
      if (localResolution) publishes.push(saveCloudReviewState(client, localResolution));
      else {
        const formalDate = formalAccountReviewDate(client);
        if (formalDate) publishes.push(saveFormalReviewDateToCloud(client, formalDate));
      }
      return client;
    }

    const cloudResolution = resolutionFromCloudState(cloud);
    if (localResolution && time(localResolution.resolvedAt) > time(cloud.updated_at)) {
      publishes.push(saveCloudReviewState(client, localResolution));
    } else if (cloudResolution && !sameResolution(localResolution, cloudResolution)) {
      resolutions[client.id] = cloudResolution;
      workbenchChanged = true;
    }

    const completedDate = dateOnly(String(cloud.last_completed_review_date || ""));
    const next = {
      ...client,
      lastAccountReview: completedDate || client.lastAccountReview,
      accountReviewStatus: String(cloud.review_status || ""),
      accountReviewCycleResolvedDate: dateOnly(String(cloud.cycle_resolved_date || "")),
      accountReviewActivityThrough: dateOnly(String(cloud.reviewed_activity_through || "")),
      accountReviewNextDate: dateOnly(String(cloud.next_review_date || "")),
      accountReviewDisposition: String(cloud.disposition || ""),
      accountReviewStateNote: String(cloud.note || ""),
      accountReviewStateUpdatedAt: String(cloud.updated_at || ""),
    };

    if (
      next.lastAccountReview !== client.lastAccountReview
      || next.accountReviewStatus !== client.accountReviewStatus
      || next.accountReviewCycleResolvedDate !== client.accountReviewCycleResolvedDate
      || next.accountReviewActivityThrough !== client.accountReviewActivityThrough
      || next.accountReviewNextDate !== client.accountReviewNextDate
      || next.accountReviewDisposition !== client.accountReviewDisposition
      || next.accountReviewStateNote !== client.accountReviewStateNote
      || next.accountReviewStateUpdatedAt !== client.accountReviewStateUpdatedAt
    ) datasetChanged = true;
    return next;
  });

  if (publishes.length) {
    const results = await Promise.allSettled(publishes);
    results.forEach((result) => { if (result.status === "rejected") debugDeferred("Review state publish", result.reason); });
  }
  if (workbenchChanged) saveWorkbenchState({ ...workbench, resolutions, updatedAt: new Date().toISOString() });

  return datasetChanged ? { dataset: { ...dataset, clients }, changed: true } : { dataset, changed: false };
}

async function refreshCaptainsLogClients(dataset: CompassDataset, targetIds: Set<string>): Promise<{ dataset: CompassDataset; changed: boolean }> {
  if (!targetIds.size) return { dataset, changed: false };
  const target = dataset.clients.filter((client) => client.companyId && targetIds.has(client.companyId));
  if (!target.length) return { dataset, changed: false };

  const inputs = target.map((client) => ({ clientId: client.id, company: client.name, aliases: client.aliases || [], companyId: client.companyId }));
  const batch = await syncClientsFromCompassCurrentState(inputs) ?? await syncClientsFromCaptainsLog(inputs);
  const byId = new Map(batch.results.filter((result) => result.client_id).map((result) => [result.client_id as string, result]));

  let changed = false;
  const clients = dataset.clients.map((client) => {
    const result = byId.get(client.id);
    if (!result) return client;
    const merged = mergeCaptainsLogSyncIntoClient(client, result);
    const safeMerged = {
      ...merged,
      lastSalesInteraction: client.lastSalesInteraction,
      technicalConsultant: client.technicalConsultant,
    };
    if (JSON.stringify(safeMerged) !== JSON.stringify(client)) changed = true;
    return safeMerged;
  });
  return changed ? { dataset: { ...dataset, clients }, changed: true } : { dataset, changed: false };
}

async function reconcileCaptainsLog(dataset: CompassDataset, account: string): Promise<{ dataset: CompassDataset; changed: boolean }> {
  const currentFingerprint = fingerprint(dataset.clients);
  let cursor = readCursor();
  if (!cursor || cursor.fingerprint !== currentFingerprint || cursor.account !== account) {
    cursor = { cursor: new Date(Date.now() - OVERLAP_MS).toISOString(), fingerprint: currentFingerprint, account };
    saveCursor(cursor);
    return { dataset, changed: false };
  }

  const nextCursor = new Date(Date.now() - 1_000).toISOString();
  const affectedCompanyIds = await changedCompanyIds(cursor.cursor);
  const refreshed = affectedCompanyIds.size
    ? await refreshCaptainsLogClients(dataset, affectedCompanyIds)
    : { dataset, changed: false };
  saveCursor({ cursor: nextCursor, fingerprint: fingerprint(refreshed.dataset.clients), account });
  return refreshed;
}

export function CompassSyncRuntime() {
  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let queued = false;
    let lastForegroundAt = 0;
    let lastIdentityAt = 0;
    let lastRelationshipAt = 0;
    let lastReviewAt = 0;
    let lastCaptainsLogAt = 0;

    const sync = async (reason: SyncReason, bypassThrottle = false) => {
      const now = Date.now();
      const foreground = reason !== "timer";
      if (disposed) return;
      if (foreground && !bypassThrottle && now - lastForegroundAt < FOREGROUND_THROTTLE_MS) return;
      if (inFlight) {
        if (foreground) queued = true;
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      const auth = getCaptainsLogCloudAuthSnapshot();
      if (!auth.configured || !auth.signedIn) return;
      inFlight = true;
      if (foreground) lastForegroundAt = now;
      emitStatus("syncing", reason);
      const errors: string[] = [];

      try {
        let dataset = await loadCompassDataset();
        if (!dataset?.clients.length || disposed) return;
        let datasetChanged = false;

        const hasMissingIdentity = dataset.clients.some((client) => !isUuid(client.companyId));
        if (hasMissingIdentity || now - lastIdentityAt >= IDENTITY_INTERVAL_MS) {
          try {
            const result = await reconcileIdentities(dataset);
            dataset = result.dataset;
            datasetChanged ||= result.changed;
            lastIdentityAt = now;
            if (result.changed || now - lastRelationshipAt >= RELATIONSHIP_INTERVAL_MS || reason === "startup" || reason === "online") {
              try {
                await reconcileRelationships();
                lastRelationshipAt = now;
              } catch (cause) {
                errors.push("relationships");
                debugDeferred("Client relationship reconciliation", cause);
              }
            }
          } catch (cause) {
            errors.push("identity");
            debugDeferred("Company identity reconciliation", cause);
          }
        } else if (now - lastRelationshipAt >= RELATIONSHIP_INTERVAL_MS || reason === "startup" || reason === "online") {
          try {
            await reconcileRelationships();
            lastRelationshipAt = now;
          } catch (cause) {
            errors.push("relationships");
            debugDeferred("Client relationship reconciliation", cause);
          }
        }

        if (foreground || now - lastReviewAt >= REVIEW_STATE_INTERVAL_MS) {
          try {
            const result = await reconcileReviewState(dataset);
            dataset = result.dataset;
            datasetChanged ||= result.changed;
            lastReviewAt = now;
          } catch (cause) {
            errors.push("review-state");
            debugDeferred("Shared review state reconciliation", cause);
          }
        }

        if (foreground || now - lastCaptainsLogAt >= CAPTAINS_LOG_INTERVAL_MS) {
          try {
            const account = auth.userId || auth.email;
            const result = await reconcileCaptainsLog(dataset, account);
            dataset = result.dataset;
            datasetChanged ||= result.changed;
            lastCaptainsLogAt = now;
          } catch (cause) {
            errors.push("captains-log");
            debugDeferred("Captain's Log UUID sync", cause);
          }
        }

        if (datasetChanged) await saveCompassDataset(dataset);
        emitStatus(errors.length ? "degraded" : "idle", reason, errors);
      } finally {
        inFlight = false;
        if (queued && !disposed) {
          queued = false;
          window.setTimeout(() => void sync("queued", true), 150);
        }
      }
    };

    const onFocus = () => void sync("focus");
    const onVisibility = () => { if (document.visibilityState === "visible") void sync("visible"); };
    const onOnline = () => void sync("online", true);
    const startup = window.setTimeout(() => void sync("startup", true), 900);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void sync("timer"); }, TICK_MS);

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
