"use client";

import { useEffect } from "react";
import { CompassSyncRuntime as DeltaCompassSyncRuntime } from "./compass-sync-runtime";
import { getCaptainsLogCloudAuthSnapshot } from "@/lib/compass/captains-log-cloud";
import { mergeCaptainsLogSyncIntoClient, syncClientsFromCaptainsLog } from "@/lib/compass/captains-log-bridge";
import { syncClientsFromCompassCurrentState } from "@/lib/compass/captains-log-current-state";
import { loadCompassDataset, saveCompassDataset } from "@/lib/compass/store";
import type { CompassClient } from "@/lib/compass/types";

const HYDRATION_KEY = "client-compass.captains-log-full-hydration.v1";
const STARTUP_DELAY_MS = 1_800;

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

        if (changed) await saveCompassDataset({ ...dataset, clients });
        try { window.localStorage.setItem(HYDRATION_KEY, marker); } catch { /* local marker only */ }
      })().catch((cause) => {
        if (typeof console !== "undefined") console.debug("Captain's Log full hydration deferred", cause);
      });
    }, STARTUP_DELAY_MS);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, []);

  return <DeltaCompassSyncRuntime />;
}
