"use client";

import { ClientActivityRuntime } from "./client-activity-runtime";
import { ClientWorkspaceLayoutRuntime } from "./client-workspace-layout-runtime";
import { ClientWorkspacePolishRuntime } from "./client-workspace-polish-runtime";
import { CompassSyncRuntime } from "./compass-sync-runtime";
import { DurableStorageRuntime } from "./durable-storage-runtime";
import { InterfacePolishRuntimeV10939 } from "./interface-polish-runtime-v10939";
import { MapCompassRuntimeV10934 } from "./map-compass-runtime-v10934";
import { MapDisplayRuntime } from "./map-display-runtime";
import { MapHardwareSyncStampV10946 } from "./map-hardware-sync-stamp-v10946";
import { MapInteractionPolishV10932 } from "./map-interaction-polish-v10932";
import { MapModeControllerV10945 } from "./map-mode-controller-v10945";
import { MapNeedIntegrityRuntime } from "./map-need-integrity-runtime";
import { MapSalesActivityRuntime } from "./map-sales-activity-runtime";
import { MapSegmentDrawerV10931 } from "./map-segment-drawer-v10931";
import { MapSelectionGroupBridge } from "./map-selection-group-bridge";
import { MapUiRuntime } from "./map-ui-runtime";
import { ReportCompanyDetailsBridge } from "./report-company-details-bridge";
import { WorkbenchRuntime } from "./workbench-runtime";

export function ClientCompassRuntime() {
  return <>
    <DurableStorageRuntime />
    <CompassSyncRuntime />
    <MapSelectionGroupBridge />
    <MapSegmentDrawerV10931 />
    <MapInteractionPolishV10932 />
    <MapModeControllerV10945 />
    <MapNeedIntegrityRuntime />
    <MapCompassRuntimeV10934 />
    <MapDisplayRuntime />
    <MapHardwareSyncStampV10946 />
    <MapSalesActivityRuntime />
    <MapUiRuntime />
    <InterfacePolishRuntimeV10939 />
    <ClientActivityRuntime />
    <ClientWorkspaceLayoutRuntime />
    <ClientWorkspacePolishRuntime />
    <ReportCompanyDetailsBridge />
    <WorkbenchRuntime />
  </>;
}
