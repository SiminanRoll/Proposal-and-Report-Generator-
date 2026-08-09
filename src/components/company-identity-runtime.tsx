"use client";

import { useCallback, useEffect } from "react";
import { getCaptainsLogCloudAuthSnapshot } from "@/lib/compass/captains-log-cloud";
import { ensureCompanyIdentitiesForClients } from "@/lib/compass/company-identity";
import { loadCompassDataset, saveCompassDataset } from "@/lib/compass/store";

const POLL_MS = 10 * 60 * 1000;

// Module-wide guard: React remounts, route transitions, or multiple mounted runtimes
// in the same page must share one reconciliation promise. Supabase also takes an
// advisory transaction lock, which protects across browser tabs/devices.
let activeIdentityReconcile: Promise<void> | null = null;

async function reconcileCompanyIdentities(): Promise<void> {
  if (activeIdentityReconcile) return activeIdentityReconcile;

  activeIdentityReconcile = (async () => {
    const auth = getCaptainsLogCloudAuthSnapshot();
    if (!auth.configured || !auth.signedIn) return;

    const dataset = await loadCompassDataset();
    if (!dataset?.clients.length) return;

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
  })().catch((cause) => {
    if (typeof console !== "undefined") console.debug("Company identity reconciliation deferred", cause);
  }).finally(() => {
    activeIdentityReconcile = null;
  });

  return activeIdentityReconcile;
}

export function CompanyIdentityRuntime() {
  const reconcile = useCallback(() => reconcileCompanyIdentities(), []);

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
