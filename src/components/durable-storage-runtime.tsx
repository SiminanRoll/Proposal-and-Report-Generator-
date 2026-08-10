"use client";

import { useEffect } from "react";
import { recoverDurableDatabaseIfNeeded, saveDurableDatabaseMirrorNow } from "@/lib/compass/durable-storage";

const SAVE_EVENTS = [
  "client-compass-data-changed",
  "client-compass-segments-changed",
  "client-compass-map-lens-changed",
  "advantage-projects-changed",
  "storage",
];

export function DurableStorageRuntime() {
  useEffect(() => {
    let timer = 0;
    let disposed = false;

    const save = () => {
      if (disposed) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void saveDurableDatabaseMirrorNow().catch(() => {
          // Durable folder protection is best effort during background autosave.
          // Settings surfaces connection/permission problems when the user opens it.
        });
      }, 1400);
    };

    void recoverDurableDatabaseIfNeeded()
      .catch(() => false)
      .finally(save);

    for (const eventName of SAVE_EVENTS) window.addEventListener(eventName, save);

    const interval = window.setInterval(save, 30000);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void saveDurableDatabaseMirrorNow().catch(() => undefined);
    };
    const onPageHide = () => { void saveDurableDatabaseMirrorNow().catch(() => undefined); };
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
