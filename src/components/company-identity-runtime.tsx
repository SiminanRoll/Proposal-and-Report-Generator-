"use client";

import { useCallback, useEffect } from "react";
import { getCaptainsLogCloudAuthSnapshot } from "@/lib/compass/captains-log-cloud";
import { resolveCompassCompanyIdsBulk } from "@/lib/compass/company-identity-bulk";
import { loadCompassDataset, saveCompassDataset } from "@/lib/compass/store";

const POLL_MS = 30 * 60 * 1000;
const MIN_RECONCILE_MS = 5 * 60 * 1000;

let activeIdentityReconcile: Promise<void> | null = null;
let lastIdentityReconcileAt = 0;

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? "").trim());
}

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

    // Established clients already carry the durable UUID in the Compass dataset.
    // Routine reconciliation therefore performs zero Supabase identity reads.
    const missing = dataset.clients.filter((client) => !isUuid(client.companyId));
    if (!missing.length) return;

    const resolved = await resolveCompassCompanyIdsBulk(missing);
    if (!resolved.size) return;

    let changed = false;
    const clients = dataset.clients.map((client) => {
      const companyId = resolved.get(client.id);
      if (!companyId || client.companyId === companyId) return client;
      changed = true;
      return {
        ...client,
        companyId,
        captainsLog: client.captainsLog ? { ...client.captainsLog, companyId } : client.captainsLog,
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
