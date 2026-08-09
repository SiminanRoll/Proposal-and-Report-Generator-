"use client";

import { useCallback, useEffect, useRef } from "react";
import { getCaptainsLogCloudAuthSnapshot } from "@/lib/compass/captains-log-cloud";
import { loadCloudReviewStates, resolutionFromCloudState, saveCloudReviewState, saveFormalReviewDateToCloud } from "@/lib/compass/review-state-cloud";
import { dateOnly, formalAccountReviewDate } from "@/lib/compass/review-state";
import { loadCompassDataset, saveCompassDataset } from "@/lib/compass/store";
import { loadWorkbenchState, saveWorkbenchState, type WorkbenchReviewResolution } from "@/lib/compass/workbench";

const POLL_MS = 3 * 60 * 1000;

function time(value: string): number {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sameResolution(left: WorkbenchReviewResolution | undefined, right: WorkbenchReviewResolution | null): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.disposition === right.disposition
    && left.date === right.date
    && left.activityThrough === right.activityThrough
    && left.nextReviewDate === right.nextReviewDate
    && left.note === right.note
    && left.resolvedAt === right.resolvedAt;
}

export function ReviewStateRuntime() {
  const busyRef = useRef(false);

  const reconcile = useCallback(async () => {
    if (busyRef.current) return;
    const auth = getCaptainsLogCloudAuthSnapshot();
    if (!auth.configured || !auth.signedIn) return;
    const dataset = await loadCompassDataset();
    if (!dataset?.clients.length || !dataset.clients.some((client) => client.companyId)) return;

    busyRef.current = true;
    try {
      const cloudRows = await loadCloudReviewStates();
      const cloudByCompany = new Map(cloudRows.map((row) => [row.company_id, row]));
      const workbench = loadWorkbenchState();
      const resolutions = { ...(workbench.resolutions ?? {}) };
      let workbenchChanged = false;
      let datasetChanged = false;

      const clients = dataset.clients.map((client) => {
        if (!client.companyId) return client;
        const cloud = cloudByCompany.get(client.companyId);
        const localResolution = resolutions[client.id];

        if (!cloud) {
          if (localResolution) {
            void saveCloudReviewState(client, localResolution).catch((cause) => {
              if (typeof console !== "undefined") console.debug("Review state publish deferred", client.name, cause);
            });
          } else {
            const formalDate = formalAccountReviewDate(client);
            if (formalDate) {
              void saveFormalReviewDateToCloud(client, formalDate).catch((cause) => {
                if (typeof console !== "undefined") console.debug("Formal review seed deferred", client.name, cause);
              });
            }
          }
          return client;
        }

        const cloudResolution = resolutionFromCloudState(cloud);
        if (localResolution && time(localResolution.resolvedAt) > time(cloud.updated_at)) {
          void saveCloudReviewState(client, localResolution).catch((cause) => {
            if (typeof console !== "undefined") console.debug("Review state publish deferred", client.name, cause);
          });
        } else if (cloudResolution && !sameResolution(localResolution, cloudResolution)) {
          resolutions[client.id] = cloudResolution;
          workbenchChanged = true;
        }

        const completedDate = dateOnly(String(cloud.last_completed_review_date || ""));
        const next = {
          ...client,
          lastAccountReview: completedDate || client.lastAccountReview,
          accountReviewStatus: String(cloud.review_status || ""),
          accountReviewCycleResolvedDate: dateOnly(String(cloud.cycle_resolved_date || "")),
          accountReviewActivityThrough: dateOnly(String(cloud.reviewed_activity_through || "")),
          accountReviewNextDate: dateOnly(String(cloud.next_review_date || "")),
          accountReviewDisposition: String(cloud.disposition || ""),
          accountReviewStateNote: String(cloud.note || ""),
          accountReviewStateUpdatedAt: String(cloud.updated_at || ""),
        };

        if (
          next.lastAccountReview !== client.lastAccountReview
          || next.accountReviewStatus !== client.accountReviewStatus
          || next.accountReviewCycleResolvedDate !== client.accountReviewCycleResolvedDate
          || next.accountReviewActivityThrough !== client.accountReviewActivityThrough
          || next.accountReviewNextDate !== client.accountReviewNextDate
          || next.accountReviewDisposition !== client.accountReviewDisposition
          || next.accountReviewStateNote !== client.accountReviewStateNote
          || next.accountReviewStateUpdatedAt !== client.accountReviewStateUpdatedAt
        ) datasetChanged = true;
        return next;
      });

      if (datasetChanged) await saveCompassDataset({ ...dataset, clients });
      if (workbenchChanged) saveWorkbenchState({ ...workbench, resolutions, updatedAt: new Date().toISOString() });
    } catch (cause) {
      if (typeof console !== "undefined") console.debug("Shared review state reconciliation deferred", cause);
    } finally {
      busyRef.current = false;
    }
  }, []);

  useEffect(() => {
    const startup = window.setTimeout(() => void reconcile(), 1800);
    const interval = window.setInterval(() => void reconcile(), POLL_MS);
    const visible = () => { if (document.visibilityState === "visible") void reconcile(); };
    const online = () => void reconcile();
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", online);
    return () => {
      window.clearTimeout(startup);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", online);
    };
  }, [reconcile]);

  return null;
}
