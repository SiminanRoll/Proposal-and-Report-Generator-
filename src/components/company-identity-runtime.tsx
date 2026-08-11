"use client";

import { useCallback, useEffect } from "react";
import { getCaptainsLogCloudAuthSnapshot } from "@/lib/compass/captains-log-cloud";
import { ensureCompanyIdentitiesForClients } from "@/lib/compass/company-identity";
import { loadCompassDataset, saveCompassDataset } from "@/lib/compass/store";

const POLL_MS = 30 * 60 * 1000;
const MIN_RECONCILE_MS = 5 * 60 * 1000;

// Module-wide guards: React remounts, route transitions, visibility changes, and
// multiple mounted runtimes in the same page must not turn identity maintenance
// into repeated Supabase sweeps.
let activeIdentityReconcile: Promise<void> | null = null;
let lastIdentityReconcileAt = 0;

async function reconcileCompanyIdentities(force = false): Promise<void> {
  if (activeIdentityReconcile) return activeIdentityReconcile;
  const now = Date.now();
  if (!force && lastIdentityReconcileAt && now - lastIdentityReconcileAt < MIN_RECONCILE_MS) return;
  lastIdentityReconcileAt = now;

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
  const reconcile = useCallback((force = false) => reconcileCompanyIdentities(force), []);

  useEffect(() => {
    const startup = window.setTimeout(() => void reconcile(true), 1200);
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
