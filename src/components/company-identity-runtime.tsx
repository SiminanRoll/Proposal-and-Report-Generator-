"use client";

import { useCallback, useEffect, useRef } from "react";
import { getCaptainsLogCloudAuthSnapshot } from "@/lib/compass/captains-log-cloud";
import { ensureCompanyIdentitiesForClients } from "@/lib/compass/company-identity";
import { loadCompassDataset, saveCompassDataset } from "@/lib/compass/store";

const POLL_MS = 10 * 60 * 1000;

export function CompanyIdentityRuntime() {
  const busyRef = useRef(false);

  const reconcile = useCallback(async () => {
    if (busyRef.current) return;
    const auth = getCaptainsLogCloudAuthSnapshot();
    if (!auth.configured || !auth.signedIn) return;
    const dataset = await loadCompassDataset();
    if (!dataset?.clients.length) return;

    busyRef.current = true;
    try {
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
      if (changed) await saveCompassDataset({ ...dataset, clients });
    } catch (cause) {
      if (typeof console !== "undefined") console.debug("Company identity reconciliation deferred", cause);
    } finally {
      busyRef.current = false;
    }
  }, []);

  useEffect(() => {
    const startup = window.setTimeout(() => void reconcile(), 1200);
    const interval = window.setInterval(() => void reconcile(), POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void reconcile(); };
    const onOnline = () => void reconcile();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      window.clearTimeout(startup);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [reconcile]);

  return null;
}
