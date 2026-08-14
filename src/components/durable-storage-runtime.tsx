"use client";

import { useEffect } from "react";
import { recoverCloudDatabaseIfNeeded, saveCloudDatabaseSnapshotNow } from "@/lib/compass/cloud-snapshot";
import { restoreCaptainsLogCloudLocalCache, saveCaptainsLogCloudLocalCacheNow } from "@/lib/compass/captains-log-cloud-local-cache";
import { recoverDurableDatabaseIfNeeded, saveDurableDatabaseMirrorNow } from "@/lib/compass/durable-storage";
import { recoverLocalRecoverySnapshotIfNeeded, saveLocalRecoverySnapshotNow } from "@/lib/compass/local-recovery-cache";

const SAVE_EVENTS = [
  "client-compass-data-changed",
  "client-compass-segments-changed",
  "client-compass-map-lens-changed",
  "advantage-projects-changed",
  "storage",
];

const LOCAL_SAVE_DEBOUNCE_MS = 1800;
const LOCAL_SAVE_INTERVAL_MS = 120_000;
const CONNECTION_CACHE_INTERVAL_MS = 30_000;
const CLOUD_SAVE_INTERVAL_MS = 30 * 60_000;
const CLOUD_FAILURE_BACKOFF_MS = 5 * 60_000;
const CLOUD_CHECK_INTERVAL_MS = 60_000;

async function recoverProtectedDatabase(): Promise<void> {
  await restoreCaptainsLogCloudLocalCache().catch(() => false);

  const folderRecovered = await recoverDurableDatabaseIfNeeded().catch(() => false);
  if (folderRecovered) return;

  const browserRecovered = await recoverLocalRecoverySnapshotIfNeeded().catch(() => false);
  if (browserRecovered) return;

  await recoverCloudDatabaseIfNeeded().catch(() => false);
}

export function DurableStorageRuntime() {
  useEffect(() => {
    let localTimer = 0;
    let disposed = false;
    let cloudDirty = false;
    let cloudSaveInFlight = false;
    let lastCloudSaveAt = Date.now();
    let nextCloudAttemptAt = lastCloudSaveAt + CLOUD_SAVE_INTERVAL_MS;

    const saveLocalNow = () => {
      if (disposed) return;
      void Promise.allSettled([
        saveLocalRecoverySnapshotNow(),
        saveDurableDatabaseMirrorNow(),
        saveCaptainsLogCloudLocalCacheNow(),
      ]);
    };

    const scheduleLocalSave = () => {
      if (disposed) return;
      window.clearTimeout(localTimer);
      localTimer = window.setTimeout(saveLocalNow, LOCAL_SAVE_DEBOUNCE_MS);
    };

    const onDataChanged = () => {
      cloudDirty = true;
      scheduleLocalSave();
    };

    const maybeSaveCloud = async () => {
      const now = Date.now();
      if (disposed || !cloudDirty || cloudSaveInFlight || now < nextCloudAttemptAt) return;

      cloudSaveInFlight = true;
      try {
        await saveCloudDatabaseSnapshotNow();
        cloudDirty = false;
        lastCloudSaveAt = Date.now();
        nextCloudAttemptAt = lastCloudSaveAt + CLOUD_SAVE_INTERVAL_MS;
      } catch {
        nextCloudAttemptAt = Date.now() + CLOUD_FAILURE_BACKOFF_MS;
      } finally {
        cloudSaveInFlight = false;
      }
    };

    void recoverProtectedDatabase().finally(scheduleLocalSave);

    for (const eventName of SAVE_EVENTS) window.addEventListener(eventName, onDataChanged);

    const localInterval = window.setInterval(scheduleLocalSave, LOCAL_SAVE_INTERVAL_MS);
    const connectionCacheInterval = window.setInterval(() => { void saveCaptainsLogCloudLocalCacheNow(); }, CONNECTION_CACHE_INTERVAL_MS);
    const cloudInterval = window.setInterval(() => { void maybeSaveCloud(); }, CLOUD_CHECK_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") saveLocalNow();
    };
    const onPageHide = () => { saveLocalNow(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      disposed = true;
      window.clearTimeout(localTimer);
      window.clearInterval(localInterval);
      window.clearInterval(connectionCacheInterval);
      window.clearInterval(cloudInterval);
      for (const eventName of SAVE_EVENTS) window.removeEventListener(eventName, onDataChanged);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return null;
}
