"use client";

import { useEffect } from "react";
import { recoverCloudDatabaseIfNeeded, saveCloudDatabaseSnapshotNow } from "@/lib/compass/cloud-snapshot";
import { recoverDurableDatabaseIfNeeded, saveDurableDatabaseMirrorNow } from "@/lib/compass/durable-storage";

const SAVE_EVENTS = [
  "client-compass-data-changed",
  "client-compass-segments-changed",
  "client-compass-map-lens-changed",
  "advantage-projects-changed",
  "storage",
];

async function recoverProtectedDatabase(): Promise<void> {
  const localRecovered = await recoverDurableDatabaseIfNeeded().catch(() => false);
  if (!localRecovered) await recoverCloudDatabaseIfNeeded().catch(() => false);
}

async function saveProtectedDatabase(): Promise<void> {
  await Promise.allSettled([
    saveDurableDatabaseMirrorNow(),
    saveCloudDatabaseSnapshotNow(),
  ]);
}

export function DurableStorageRuntime() {
  useEffect(() => {
    let timer = 0;
    let disposed = false;

    const save = () => {
      if (disposed) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void saveProtectedDatabase();
      }, 1800);
    };

    void recoverProtectedDatabase().finally(save);

    for (const eventName of SAVE_EVENTS) window.addEventListener(eventName, save);

    const interval = window.setInterval(save, 120000);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void saveProtectedDatabase();
    };
    const onPageHide = () => { void saveProtectedDatabase(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.clearInterval(interval);
      for (const eventName of SAVE_EVENTS) window.removeEventListener(eventName, save);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return null;
}
