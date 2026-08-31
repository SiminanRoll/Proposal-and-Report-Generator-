"use client";

import { useEffect, useRef } from "react";
import { syncClientCompassCompanyGeography } from "@/lib/compass/company-geography-sync";
import { useCompassState } from "@/lib/compass/store";
import type { CompassDataset } from "@/lib/compass/types";

const RETRY_POLL_MS = 30_000;

export function CompanyGeographySyncRuntime() {
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
          if (current?.clients.length) await syncClientCompassCompanyGeography(current.clients);
        } while (queued.current && !disposed);
      } catch (cause) {
        if (typeof console !== "undefined") console.debug("Canonical company geography sync deferred", cause);
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
