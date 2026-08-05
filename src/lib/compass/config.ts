import type { CompassConfig } from "./types";

export const DEFAULT_COMPASS_CONFIG: CompassConfig = {
  score: {
    server2012First: 50,
    server2012Additional: 10,
    server2012Cap: 70,
    server2016First: 25,
    server2016Additional: 5,
    server2016Cap: 40,
    serverAgePlanningEach: 15,
    serverAgePlanningCap: 30,
    serverAgeCriticalEach: 25,
    serverAgeCriticalCap: 50,
    windows10Each: 3,
    windows10Cap: 30,
    windows11HomeEach: 2,
    windows11HomeCap: 12,
    replaceNowEach: 4,
    replaceNowCap: 24,
    planSoonEach: 1,
    planSoonCap: 10,
    criticalStorageEach: 4,
    criticalStorageCap: 16,
    watchStorageEach: 1,
    watchStorageCap: 6,
    expiredServerWarrantyEach: 8,
    expiredServerWarrantyCap: 16,
    expiredWorkstationWarrantyEach: 1,
    expiredWorkstationWarrantyCap: 8,
  },
  value: {
    standardServerReplacement: 45000,
    advancedServerMigration: 18000,
    multiServerAdditionalMultiplier: 0.75,
    standardWorkstationModernization: 2500,
    workstationDeploymentAllowance: 450,
    virtualOsRemediation: 750,
    storageRemediation: 7500,
    multisiteAdjustment: 5000,
    planningContingencyPercent: 10,
  },
  thresholds: {
    workstationPlanSoonYears: 4,
    workstationReplaceNowYears: 5,
    serverPlanningYears: 5,
    serverCriticalYears: 7,
    storageWatchPercent: 80,
    storageCriticalPercent: 90,
  },
};

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeCompassConfig(value: unknown): CompassConfig {
  if (!value || typeof value !== "object") return structuredClone(DEFAULT_COMPASS_CONFIG);
  const candidate = value as Partial<CompassConfig>;
  const score = candidate.score ?? {} as CompassConfig["score"];
  const valuation = candidate.value ?? {} as CompassConfig["value"];
  const thresholds = candidate.thresholds ?? {} as CompassConfig["thresholds"];
  return {
    score: Object.fromEntries(Object.entries(DEFAULT_COMPASS_CONFIG.score).map(([key, fallback]) => [key, finite(score[key as keyof typeof score], fallback)])) as unknown as CompassConfig["score"],
    value: Object.fromEntries(Object.entries(DEFAULT_COMPASS_CONFIG.value).map(([key, fallback]) => [key, finite(valuation[key as keyof typeof valuation], fallback)])) as unknown as CompassConfig["value"],
    thresholds: Object.fromEntries(Object.entries(DEFAULT_COMPASS_CONFIG.thresholds).map(([key, fallback]) => [key, finite(thresholds[key as keyof typeof thresholds], fallback)])) as unknown as CompassConfig["thresholds"],
  };
}
