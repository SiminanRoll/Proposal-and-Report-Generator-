"use client";

import { usePathname } from "next/navigation";
import { ClientWorkspaceLayoutRuntime } from "./client-workspace-layout-runtime";
import { ClientWorkspacePolishRuntime } from "./client-workspace-polish-runtime";
import { CompanyInventoryCorrectionRuntime } from "./company-inventory-correction-runtime";
import { DurableStorageRuntime } from "./durable-storage-runtime";
import { GlobalLifecyclePolicyRuntime } from "./global-lifecycle-policy-runtime";
import { HardwareForwardFillRuntime } from "./hardware-forward-fill-runtime";
import { InterfacePolishRuntimeV10939 } from "./interface-polish-runtime-v10939";
import { MapCompassRuntimeV10934 } from "./map-compass-runtime-v10934";
import { MapDisplayRuntime } from "./map-display-runtime";
import { MapDonutSelectionBridge } from "./map-donut-selection-bridge";
import { MapHardwareSyncStampV10946 } from "./map-hardware-sync-stamp-v10946";
import { MapInteractionPolishV10932 } from "./map-interaction-polish-v10932";
import { MapModeControllerV10945 } from "./map-mode-controller-v10945";
import { MapSegmentDrawerV10931 } from "./map-segment-drawer-v10931";
import { MapSelectionGroupBridge } from "./map-selection-group-bridge";
import { MapStatsIntegrityRuntime } from "./map-stats-integrity-runtime";
import { MapTwoStateToggleRuntime } from "./map-two-state-toggle-runtime";
import { MapUiRuntime } from "./map-ui-runtime";
import { PresentationMotionRuntime } from "./presentation-motion-runtime";
import { ReportCompanyDetailsBridge } from "./report-company-details-bridge";
import { WorkbenchQualificationRuntime } from "./workbench-qualification-runtime";
import { WorkbenchRuntime } from "./workbench-runtime";

/**
 * GHL-only transition: deliberately do not mount the former Supabase
 * auto-sign-in, task polling, company geography/technology cloud publishers
 * or Captain's Log task-writing activity overlay. Local report, inventory,
 * map, presentation and Workbench functionality remains mounted.
 *
 * The /content route is an intentionally isolated collaboration workspace and
 * must not mount the normal Compass DOM/runtime behaviors around it.
 */
export function ClientCompassRuntime() {
  const pathname = usePathname();
  if (pathname === "/content" || pathname.startsWith("/content/")) return null;

  return <>
    <DurableStorageRuntime />
    <GlobalLifecyclePolicyRuntime />
    <HardwareForwardFillRuntime />
    <CompanyInventoryCorrectionRuntime />
    <MapSelectionGroupBridge />
    <MapDonutSelectionBridge />
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
    <ClientWorkspaceLayoutRuntime />
    <ClientWorkspacePolishRuntime />
    <PresentationMotionRuntime />
    <ReportCompanyDetailsBridge />
    <WorkbenchQualificationRuntime />
    <WorkbenchRuntime />
  </>;
}
