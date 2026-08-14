"use client";

import { useEffect, useRef } from "react";
import { recalculateDataset } from "@/lib/compass/engine";
import { saveCompassConfigAndDataset, useCompassState } from "@/lib/compass/store";
import { WORKSTATION_PLAN_SOON_YEARS, WORKSTATION_REPLACE_NOW_YEARS } from "@/lib/technical-truth";

const POLICY_STAMP_KEY = "client-compass.lifecycle-policy.v2";
const POLICY_STAMP = `${WORKSTATION_PLAN_SOON_YEARS}-plan-${WORKSTATION_REPLACE_NOW_YEARS}-replace`;

/**
 * Keeps the stored Compass snapshot aligned with the same lifecycle policy used
 * by report ingestion and presentation generation. This also repairs existing
 * browser configs that were saved with the temporary 5/7-year workstation
 * defaults.
 */
export function GlobalLifecyclePolicyRuntime() {
  const { dataset, config, ready, refresh } = useCompassState();
  const applying = useRef(false);

  useEffect(() => {
    if (!ready || applying.current || typeof window === "undefined") return;

    const thresholdsWrong = config.thresholds.workstationPlanSoonYears !== WORKSTATION_PLAN_SOON_YEARS
      || config.thresholds.workstationReplaceNowYears !== WORKSTATION_REPLACE_NOW_YEARS
      || config.thresholds.workstationExpiredWarrantyReplaceYears !== WORKSTATION_REPLACE_NOW_YEARS;
    const snapshotNeedsPolicyRefresh = Boolean(dataset) && window.localStorage.getItem(POLICY_STAMP_KEY) !== POLICY_STAMP;
    if (!thresholdsWrong && !snapshotNeedsPolicyRefresh) return;

    applying.current = true;
    const nextConfig = {
      ...config,
      thresholds: {
        ...config.thresholds,
        workstationPlanSoonYears: WORKSTATION_PLAN_SOON_YEARS,
        workstationReplaceNowYears: WORKSTATION_REPLACE_NOW_YEARS,
        workstationExpiredWarrantyReplaceYears: WORKSTATION_REPLACE_NOW_YEARS,
      },
    };
    const nextDataset = dataset ? recalculateDataset(dataset, nextConfig) : null;

    void saveCompassConfigAndDataset(nextConfig, nextDataset)
      .then(async () => {
        window.localStorage.setItem(POLICY_STAMP_KEY, POLICY_STAMP);
        await refresh();
      })
      .finally(() => { applying.current = false; });
  }, [config, dataset, ready, refresh]);

  return null;
}
