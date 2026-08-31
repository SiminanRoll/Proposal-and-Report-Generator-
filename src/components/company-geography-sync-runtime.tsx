"use client";

import { useEffect } from "react";
import { syncClientCompassCompanyGeography } from "@/lib/compass/company-geography-sync";
import { useCompassState } from "@/lib/compass/store";

export function CompanyGeographySyncRuntime() {
  const { dataset, ready } = useCompassState();

  useEffect(() => {
    if (!ready || !dataset?.clients.length) return;
    let cancelled = false;
    let retry: number | null = null;

    const sync = async () => {
      try {
        await syncClientCompassCompanyGeography(dataset.clients);
      } catch (cause) {
        if (typeof console !== "undefined") console.debug("Canonical company geography sync deferred", cause);
        if (!cancelled) retry = window.setTimeout(() => { void sync(); }, 30000);
      }
    };

    void sync();
    return () => {
      cancelled = true;
      if (retry !== null) window.clearTimeout(retry);
    };
  }, [dataset, ready]);

  return null;
}
