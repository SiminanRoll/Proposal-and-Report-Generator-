"use client";

import { useCallback, useEffect } from "react";
import { getCaptainsLogCloudAuthSnapshot, captainsLogCloudRest } from "@/lib/compass/captains-log-cloud";

const POLL_MS = 10 * 60 * 1000;
let activeRelationshipReconcile: Promise<void> | null = null;

async function reconcileCompassClientRelationships(): Promise<void> {
  if (activeRelationshipReconcile) return activeRelationshipReconcile;

  activeRelationshipReconcile = (async () => {
    const auth = getCaptainsLogCloudAuthSnapshot();
    if (!auth.configured || !auth.signedIn) return;

    // This RPC is intentionally one-way: it marks canonical companies that already
    // carry a client_compass external mapping as clients. It never reads Supabase
    // companies into the Compass dataset and cannot create Compass records.
    await captainsLogCloudRest<number>("POST", "rpc/reconcile_client_compass_relationships", {});
  })().catch((cause) => {
    const message = String(cause instanceof Error ? cause.message : cause || "").toLowerCase();
    if (!["404", "42883", "42p01", "schema cache", "function"].some((token) => message.includes(token))) {
      if (typeof console !== "undefined") console.debug("Client relationship reconciliation deferred", cause);
    }
  }).finally(() => {
    activeRelationshipReconcile = null;
  });

  return activeRelationshipReconcile;
}

export function CompanyRelationshipRuntime() {
  const reconcile = useCallback(() => reconcileCompassClientRelationships(), []);

  useEffect(() => {
    // CompanyIdentityRuntime starts first; this slightly later pass marks every
    // durable client_compass mapping as client after UUID reconciliation finishes.
    const startup = window.setTimeout(() => void reconcile(), 2600);
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
