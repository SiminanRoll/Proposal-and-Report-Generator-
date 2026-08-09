"use client";

import { useCallback, useEffect, useRef } from "react";
import { getCaptainsLogCloudAuthSnapshot } from "@/lib/compass/captains-log-cloud";
import {
  CLIENT_REVIEW_CLOUD_EVENT,
  clientReviewStateForClient,
  refreshClientReviewCloudState,
  seedExistingReviewDatesToCloud,
  writeClientReviewState,
} from "@/lib/compass/client-review-cloud";
import { recalculateDataset } from "@/lib/compass/engine";
import { saveCompassDataset, useCompassState } from "@/lib/compass/store";
import { loadWorkbenchState } from "@/lib/compass/workbench";

const POLL_MS = 5 * 60 * 1000;

export function ClientReviewCloudRuntime() {
  const { dataset, config, refresh } = useCompassState();
  const busyRef = useRef(false);
  const migratedRef = useRef(false);

  const reconcile = useCallback(async (allowMigration = false) => {
    if (!dataset || busyRef.current) return;
    const auth = getCaptainsLogCloudAuthSnapshot();
    if (!auth.configured || !auth.signedIn) return;
    busyRef.current = true;
    try {
      await refreshClientReviewCloudState();

      if (allowMigration && !migratedRef.current) {
        migratedRef.current = true;
        await seedExistingReviewDatesToCloud(dataset.clients);

        // Carry the v1.0.9.95 Workbench-only resolutions into the shared ledger once.
        const localResolutions = loadWorkbenchState().resolutions ?? {};
        for (const client of dataset.clients) {
          if (clientReviewStateForClient(client)) continue;
          const local = localResolutions[client.id];
          if (!local) continue;
          const status = local.disposition === "client-declined" ? "declined"
            : local.disposition === "rescheduled" ? "scheduled"
              : local.disposition === "activity-reviewed" ? "activity-reviewed"
                : "completed";
          await writeClientReviewState(client, {
            status,
            disposition: local.disposition,
            lastCompletedReviewDate: local.disposition === "client-declined" || local.disposition === "activity-reviewed" || local.disposition === "rescheduled" ? client.lastAccountReview : local.date,
            reviewCycleResolvedDate: local.disposition === "client-declined" || local.disposition === "review-completed" || local.disposition === "record-corrected" ? local.date : "",
            reviewedActivityThrough: local.activityThrough,
            nextReviewDate: local.nextReviewDate,
            note: local.note,
            sourceApp: "client_compass_migration",
            deterministicKey: `workbench:${client.id}:${local.disposition}:${local.date || local.resolvedAt}`,
          });
        }
        await refreshClientReviewCloudState();
      }

      let changed = false;
      const nextClients = dataset.clients.map((client) => {
        const state = clientReviewStateForClient(client);
        if (!state) return client;
        const nextReview = state.lastCompletedReviewDate || client.lastAccountReview;
        const workflowStatus = state.status === "declined" ? "Review Declined"
          : state.status === "scheduled" ? "Review Scheduled"
            : state.status === "completed" ? "Review Completed"
              : client.workflowStatus;
        if (nextReview === client.lastAccountReview && workflowStatus === client.workflowStatus) return client;
        changed = true;
        return { ...client, lastAccountReview: nextReview, workflowStatus };
      });
      if (changed) {
        await saveCompassDataset(recalculateDataset({ ...dataset, clients: nextClients }, config));
        await refresh();
      }
    } catch {
      // The shared review lane is additive. Existing Compass data remains usable offline.
    } finally {
      busyRef.current = false;
    }
  }, [config, dataset, refresh]);

  useEffect(() => {
    if (!dataset) return;
    void reconcile(true);
    const interval = window.setInterval(() => void reconcile(false), POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void reconcile(false); };
    const onCloudChange = () => void reconcile(false);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(CLIENT_REVIEW_CLOUD_EVENT, onCloudChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(CLIENT_REVIEW_CLOUD_EVENT, onCloudChange);
    };
  }, [dataset, reconcile]);

  return null;
}
