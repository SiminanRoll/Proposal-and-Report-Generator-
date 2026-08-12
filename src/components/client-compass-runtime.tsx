"use client";

import { ClientActivityRuntime } from "./client-activity-runtime";
import { ClientWorkspaceLayoutRuntime } from "./client-workspace-layout-runtime";
import { ClientWorkspacePolishRuntime } from "./client-workspace-polish-runtime";
import { CompassSyncRuntimeV1139 } from "./compass-sync-runtime-v1139";
import { DurableStorageRuntime } from "./durable-storage-runtime";
import { InterfacePolishRuntimeV10939 } from "./interface-polish-runtime-v10939";
import { MapCompassRuntimeV10934 } from "./map-compass-runtime-v10934";
import { MapDisplayRuntime } from "./map-display-runtime";
import { MapHardwareSyncStampV10946 } from "./map-hardware-sync-stamp-v10946";
import { MapInteractionPolishV10932 } from "./map-interaction-polish-v10932";
import { MapModeControllerV10945 } from "./map-mode-controller-v10945";
import { MapSegmentDrawerV10931 } from "./map-segment-drawer-v10931";
import { MapSelectionGroupBridge } from "./map-selection-group-bridge";
import { MapStatsIntegrityRuntime } from "./map-stats-integrity-runtime";
import { MapTwoStateToggleRuntime } from "./map-two-state-toggle-runtime";
import { MapUiRuntime } from "./map-ui-runtime";
import { ReportCompanyDetailsBridge } from "./report-company-details-bridge";
import { WorkbenchQualificationRuntime } from "./workbench-qualification-runtime";
import { WorkbenchRuntime } from "./workbench-runtime";

export function ClientCompassRuntime() {
  return <>
    <DurableStorageRuntime />
    <CompassSyncRuntimeV1139 />
    <MapSelectionGroupBridge />
    <MapSegmentDrawerV10931 />
    <MapInteractionPolishV10932 />
    <MapModeControllerV10945 />
    <MapTwoStateToggleRuntime />
    <MapCompassRuntimeV10934 />
    <MapStatsIntegrityRuntime />
    <MapDisplayRuntime />
    <MapHardwareSyncStampV10946 />
    <MapUiRuntime />
    <InterfacePolishRuntimeV10939 />
    <ClientActivityRuntime />
    <ClientWorkspaceLayoutRuntime />
    <ClientWorkspacePolishRuntime />
    <ReportCompanyDetailsBridge />
    <WorkbenchQualificationRuntime />
    <WorkbenchRuntime />
  </>;
}
