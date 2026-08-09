"use client";

import { InterfacePolishRuntimeV10939 } from "./interface-polish-runtime-v10939";
import { MapCompassRuntimeV10934 } from "./map-compass-runtime-v10934";
import { MapHardwareSyncStampV10946 } from "./map-hardware-sync-stamp-v10946";
import { MapInteractionPolishV10932 } from "./map-interaction-polish-v10932";
import { MapModeControllerV10945 } from "./map-mode-controller-v10945";
import { MapSegmentDrawerV10931 } from "./map-segment-drawer-v10931";
import { MapSelectionGroupBridge } from "./map-selection-group-bridge";
import { ReportCompanyDetailsBridge } from "./report-company-details-bridge";

/**
 * Root-level Client Compass behavior that needs to survive route changes.
 *
 * The individual runtimes are intentionally composed here instead of in the
 * root layout so release-era implementation names stay out of application
 * shell wiring. This is the single place to retire/replace those internals.
 */
export function ClientCompassRuntime() {
  return <>
    <MapSelectionGroupBridge />
    <MapSegmentDrawerV10931 />
    <MapInteractionPolishV10932 />
    <MapModeControllerV10945 />
    <MapCompassRuntimeV10934 />
    <MapHardwareSyncStampV10946 />
    <InterfacePolishRuntimeV10939 />
    <ReportCompanyDetailsBridge />
  </>;
}
