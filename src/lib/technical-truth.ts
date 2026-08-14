// Canonical public entry point for Client Compass lifecycle truth.
//
// The implementation remains in technical-truth/index.ts, but every application
// import of @/lib/technical-truth resolves through this file first. Workstation
// lifecycle ages are Advantage policy, not per-screen presentation choices:
// 4+ years enters planning and 5+ years is replacement.

export * from "./technical-truth/index";

import {
  DEFAULT_TECHNICAL_THRESHOLDS as IMPLEMENTATION_DEFAULTS,
  TECHNICAL_TRUTH_VERSION as IMPLEMENTATION_VERSION,
  classifyTechnicalLifecycle as classifyTechnicalLifecycleImplementation,
  type TechnicalLifecycle,
  type TechnicalLifecycleInput,
  type TechnicalThresholds,
} from "./technical-truth/index";

export const WORKSTATION_PLAN_SOON_YEARS = 4;
export const WORKSTATION_REPLACE_NOW_YEARS = 5;

export const DEFAULT_TECHNICAL_THRESHOLDS: TechnicalThresholds = {
  ...IMPLEMENTATION_DEFAULTS,
  workstationPlanSoonYears: WORKSTATION_PLAN_SOON_YEARS,
  workstationReplaceNowYears: WORKSTATION_REPLACE_NOW_YEARS,
  workstationExpiredWarrantyReplaceYears: WORKSTATION_REPLACE_NOW_YEARS,
};

// Bump the public truth version so adapters that record this value distinguish
// reports produced under the corrected 4-year-plan / 5-year-replace policy.
export const TECHNICAL_TRUTH_VERSION = IMPLEMENTATION_VERSION + 1;

export function globalTechnicalThresholds(thresholds: TechnicalThresholds = DEFAULT_TECHNICAL_THRESHOLDS): TechnicalThresholds {
  return {
    ...thresholds,
    workstationPlanSoonYears: WORKSTATION_PLAN_SOON_YEARS,
    workstationReplaceNowYears: WORKSTATION_REPLACE_NOW_YEARS,
    workstationExpiredWarrantyReplaceYears: WORKSTATION_REPLACE_NOW_YEARS,
  };
}

export function classifyTechnicalLifecycle(
  input: TechnicalLifecycleInput,
  thresholds: TechnicalThresholds = DEFAULT_TECHNICAL_THRESHOLDS,
  referenceDate = new Date(),
): TechnicalLifecycle {
  return classifyTechnicalLifecycleImplementation(input, globalTechnicalThresholds(thresholds), referenceDate);
}
