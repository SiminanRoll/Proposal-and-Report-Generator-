"use client";

import { APP_VERSION } from "@/lib/app-version";
import {
  buildDurableDatabaseSnapshot,
  isDurableDatabaseSnapshot,
  restoreDurableDatabaseSnapshot,
  type DurableDatabaseSnapshot,
} from "./durable-storage";
import { captainsLogCloudRest, getCaptainsLogCloudAuthSnapshot } from "./captains-log-cloud";
import { loadCompassDataset } from "./store";

export const CLOUD_SNAPSHOT_STATUS_EVENT = "client-compass-cloud-snapshot-status";

const TABLE = "client_compass_user_snapshots";

interface CloudSnapshotRow {
  snapshot: DurableDatabaseSnapshot;
  saved_at: string;
  app_version: string;
  source_app: string;
}

export interface CloudSnapshotStatus {
  configured: boolean;
  signedIn: boolean;
  protected: boolean;
  lastSavedAt: string;
  appVersion: string;
  error: string;
}

function hasMeaningfulLocalDataset(value: Awaited<ReturnType<typeof loadCompassDataset>>): boolean {
  return Boolean(value && (value.clients.length > 0 || value.devices.length > 0));
}

function withoutLocalFileBlobs(snapshot: DurableDatabaseSnapshot): DurableDatabaseSnapshot {
  if (!snapshot.sourceFiles?.length) return snapshot;
  const { sourceFiles: _sourceFiles, ...cloudSafe } = snapshot;
  return cloudSafe;
}

function dispatchStatus(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CLOUD_SNAPSHOT_STATUS_EVENT));
}

async function loadCloudSnapshotRow(): Promise<CloudSnapshotRow | null> {
  const auth = getCaptainsLogCloudAuthSnapshot();
  if (!auth.signedIn) return null;
  const rows = await captainsLogCloudRest<CloudSnapshotRow[]>("GET", TABLE, undefined, {
    select: "snapshot,saved_at,app_version,source_app",
    order: "saved_at.desc",
    limit: "1",
  });
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || !isDurableDatabaseSnapshot(row.snapshot)) return null;
  return row;
}

export async function getCloudSnapshotStatus(): Promise<CloudSnapshotStatus> {
  const auth = getCaptainsLogCloudAuthSnapshot();
  if (!auth.configured || !auth.signedIn) {
    return {
      configured: auth.configured,
      signedIn: auth.signedIn,
      protected: false,
      lastSavedAt: "",
      appVersion: "",
      error: "",
    };
  }

  try {
    const row = await loadCloudSnapshotRow();
    return {
      configured: true,
      signedIn: true,
      protected: Boolean(row),
      lastSavedAt: row?.saved_at || "",
      appVersion: row?.app_version || "",
      error: "",
    };
  } catch (cause) {
    return {
      configured: true,
      signedIn: true,
      protected: false,
      lastSavedAt: "",
      appVersion: "",
      error: cause instanceof Error ? cause.message : "Cloud recovery status is unavailable.",
    };
  }
}

export async function saveCloudDatabaseSnapshotNow(): Promise<CloudSnapshotStatus> {
  const auth = getCaptainsLogCloudAuthSnapshot();
  if (!auth.signedIn) return getCloudSnapshotStatus();

  const snapshot = withoutLocalFileBlobs(await buildDurableDatabaseSnapshot());
  await captainsLogCloudRest<null>("POST", TABLE, [{
    schema_version: 1,
    snapshot,
    saved_at: snapshot.savedAt,
    app_version: APP_VERSION,
    source_app: "client_compass",
  }], { on_conflict: "user_id" }, "resolution=merge-duplicates,return=minimal");
  dispatchStatus();
  return {
    configured: true,
    signedIn: true,
    protected: true,
    lastSavedAt: snapshot.savedAt,
    appVersion: APP_VERSION,
    error: "",
  };
}

export async function recoverCloudDatabaseIfNeeded(): Promise<boolean> {
  const auth = getCaptainsLogCloudAuthSnapshot();
  if (!auth.signedIn) return false;
  if (hasMeaningfulLocalDataset(await loadCompassDataset())) return false;

  const row = await loadCloudSnapshotRow();
  if (!row || !isDurableDatabaseSnapshot(row.snapshot)) return false;
  await restoreDurableDatabaseSnapshot(row.snapshot);
  dispatchStatus();
  return true;
}
