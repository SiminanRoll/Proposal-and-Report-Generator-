"use client";

import { CaptainsLogCrossDeviceRuntime } from "./captains-log-cross-device-runtime";
import { ClientActivityRuntime } from "./client-activity-runtime";
import { ClientWorkspacePolishRuntime } from "./client-workspace-polish-runtime";
import { CompanyIdentityRuntime } from "./company-identity-runtime";
import { CompanyRelationshipRuntime } from "./company-relationship-runtime";
import { DurableStorageRuntime } from "./durable-storage-runtime";
import { InterfacePolishRuntimeV10939 } from "./interface-polish-runtime-v10939";
import { MapCompassRuntimeV10934 } from "./map-compass-runtime-v10934";
import { MapDisplayRuntime } from "./map-display-runtime";
import { MapHardwareSyncStampV10946 } from "./map-hardware-sync-stamp-v10946";
import { MapInteractionPolishV10932 } from "./map-interaction-polish-v10932";
import { MapModeControllerV10945 } from "./map-mode-controller-v10945";
import { MapSegmentDrawerV10931 } from "./map-segment-drawer-v10931";
import { MapSelectionGroupBridge } from "./map-selection-group-bridge";
import { MapUiRuntime } from "./map-ui-runtime";
import { ReportCompanyDetailsBridge } from "./report-company-details-bridge";
import { ReviewStateRuntime } from "./review-state-runtime";
import { WorkbenchRuntime } from "./workbench-runtime";

export function ClientCompassRuntime() {
  return <>
    <DurableStorageRuntime />
    <CompanyIdentityRuntime />
    <CompanyRelationshipRuntime />
    <CaptainsLogCrossDeviceRuntime />
    <ReviewStateRuntime />
    <MapSelectionGroupBridge />
    <MapSegmentDrawerV10931 />
    <MapInteractionPolishV10932 />
    <MapModeControllerV10945 />
    <MapCompassRuntimeV10934 />
    <MapDisplayRuntime />
    <MapHardwareSyncStampV10946 />
    <MapUiRuntime />
    <InterfacePolishRuntimeV10939 />
    <ClientActivityRuntime />
    <ClientWorkspacePolishRuntime />
    <ReportCompanyDetailsBridge />
    <WorkbenchRuntime />
  </>;
}
