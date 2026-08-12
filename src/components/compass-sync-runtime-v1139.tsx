"use client";

import { useEffect } from "react";
import { COMPASS_SYNC_STATUS_EVENT, CompassSyncRuntime as DeltaCompassSyncRuntime } from "./compass-sync-runtime";
import { getCaptainsLogCloudAuthSnapshot } from "@/lib/compass/captains-log-cloud";
import { syncAccountReviewTasks } from "@/lib/compass/captains-log-account-review-sync";
import { mergeCaptainsLogSyncIntoClient, syncClientsFromCaptainsLog } from "@/lib/compass/captains-log-bridge";
import { syncClientsFromCompassCurrentState } from "@/lib/compass/captains-log-current-state";
import { loadCompassDataset, saveCompassDataset } from "@/lib/compass/store";
import type { CompassClient } from "@/lib/compass/types";

const HYDRATION_KEY = "client-compass.captains-log-full-hydration.v3";
const STARTUP_DELAY_MS = 1_800;
const ACCOUNT_REVIEW_REPAIR_INTERVAL_MS = 3 * 60_000;

type SyncStatusDetail = {
  status?: string;
  reason?: string;
};

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? "").trim());
}

function fingerprint(clients: CompassClient[]): string {
  return clients.map((client) => `${client.id}:${client.companyId || ""}`).sort().join("|");
}

function hydrationMarker(account: string, clients: CompassClient[]): string {
  return `${account}|${fingerprint(clients)}`;
}

export function CompassSyncRuntimeV1139() {
  useEffect(() => {
    let disposed = false;
    let hydrating = false;
    let reviewRepairInFlight = false;
    let lastReviewRepairAt = 0;

    const repairAccountReviews = async (discover = false) => {
      if (disposed || hydrating || reviewRepairInFlight) return;
      const now = Date.now();
      reviewRepairInFlight = true;
      try {
        const auth = getCaptainsLogCloudAuthSnapshot();
        if (!auth.configured || !auth.signedIn || disposed) return;
        const dataset = await loadCompassDataset();
        if (!dataset?.clients.length || disposed) return;
        const repaired = await syncAccountReviewTasks(dataset, { discover });
        if (repaired.changed && !disposed) await saveCompassDataset(repaired.dataset);
        lastReviewRepairAt = now;
      } finally {
        reviewRepairInFlight = false;
      }
    };

    const onSyncStatus = (event: Event) => {
      const detail = (event as CustomEvent<SyncStatusDetail>).detail ?? {};
      if (detail.status !== "idle") return;
      const foreground = detail.reason === "startup" || detail.reason === "focus" || detail.reason === "visible" || detail.reason === "online";
      if (!foreground && Date.now() - lastReviewRepairAt < ACCOUNT_REVIEW_REPAIR_INTERVAL_MS) return;
      void repairAccountReviews(false).catch((cause) => {
        if (typeof console !== "undefined") console.debug("Captain's Log Account Review repair deferred", cause);
      });
    };

    window.addEventListener(COMPASS_SYNC_STATUS_EVENT, onSyncStatus);

    const timer = window.setTimeout(() => {
      void (async () => {
        const auth = getCaptainsLogCloudAuthSnapshot();
        if (!auth.configured || !auth.signedIn || disposed) return;

        const dataset = await loadCompassDataset();
        if (!dataset?.clients.length || disposed) return;

        const account = String(auth.userId || auth.email || "").trim();
        if (!account) return;
        const marker = hydrationMarker(account, dataset.clients);
        try {
          if (window.localStorage.getItem(HYDRATION_KEY) === marker) return;
        } catch {
          // Local marker is an optimization only; hydration remains safe without it.
        }

        const target = dataset.clients.filter((client) => isUuid(client.companyId));
        if (!target.length) return;
        hydrating = true;

        const inputs = target.map((client) => ({
          clientId: client.id,
          company: client.name,
          aliases: client.aliases || [],
          companyId: client.companyId,
        }));

        const batch = await syncClientsFromCompassCurrentState(inputs) ?? await syncClientsFromCaptainsLog(inputs);
        if (disposed) return;
        const byId = new Map(batch.results.filter((result) => result.client_id).map((result) => [result.client_id as string, result]));

        let changed = false;
        const clients = dataset.clients.map((client) => {
          const result = byId.get(client.id);
          if (!result) return client;
          const merged = mergeCaptainsLogSyncIntoClient(client, result);
          const safeMerged = {
            ...merged,
            lastSalesInteraction: client.lastSalesInteraction,
            technicalConsultant: client.technicalConsultant,
          };
          if (JSON.stringify(safeMerged) !== JSON.stringify(client)) changed = true;
          return safeMerged;
        });

        const hydratedDataset = changed ? { ...dataset, clients } : dataset;
        const repaired = await syncAccountReviewTasks(hydratedDataset, { discover: true });
        if (disposed) return;
        if (repaired.changed || changed) await saveCompassDataset(repaired.dataset);
        lastReviewRepairAt = Date.now();
        try { window.localStorage.setItem(HYDRATION_KEY, marker); } catch { /* local marker only */ }
      })().catch((cause) => {
        if (typeof console !== "undefined") console.debug("Captain's Log full hydration deferred", cause);
      }).finally(() => {
        hydrating = false;
      });
    }, STARTUP_DELAY_MS);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.removeEventListener(COMPASS_SYNC_STATUS_EVENT, onSyncStatus);
    };
  }, []);

  return <DeltaCompassSyncRuntime />;
}
