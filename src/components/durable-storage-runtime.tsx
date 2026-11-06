"use client";

import { useEffect } from "react";
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

async function recoverProtectedDatabase(): Promise<void> {
  const folderRecovered = await recoverDurableDatabaseIfNeeded().catch(() => false);
  if (folderRecovered) return;

  await recoverLocalRecoverySnapshotIfNeeded().catch(() => false);
}

export function DurableStorageRuntime() {
  useEffect(() => {
    let localTimer = 0;
    let disposed = false;

    const saveLocalNow = () => {
      if (disposed) return;
      void Promise.allSettled([
        saveLocalRecoverySnapshotNow(),
        saveDurableDatabaseMirrorNow(),
      ]);
    };

    const scheduleLocalSave = () => {
      if (disposed) return;
      window.clearTimeout(localTimer);
      localTimer = window.setTimeout(saveLocalNow, LOCAL_SAVE_DEBOUNCE_MS);
    };

    const onDataChanged = () => { scheduleLocalSave(); };

    void recoverProtectedDatabase().finally(scheduleLocalSave);

    for (const eventName of SAVE_EVENTS) window.addEventListener(eventName, onDataChanged);

    const localInterval = window.setInterval(scheduleLocalSave, LOCAL_SAVE_INTERVAL_MS);

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
      for (const eventName of SAVE_EVENTS) window.removeEventListener(eventName, onDataChanged);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return null;
}
