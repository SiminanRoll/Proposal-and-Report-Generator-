import type { Project } from "@/lib/projects/types";
import { normalizeCompassConfig } from "@/lib/compass/config";
import {
  classifyTechnicalLifecycle,
  technicalLifecycleToReport,
  type TechnicalThresholds,
} from "@/lib/technical-truth";
import {
  compassLocationSnapshots as coreCompassLocationSnapshots,
  compassProjectPackages as coreCompassProjectPackages,
  lifecycleDevices as coreLifecycleDevices,
  lifecycleSummary as coreLifecycleSummary,
  reportReferenceDate as coreReportReferenceDate,
  sortLifecycleDevices,
  type ClientReportDevice,
  type LifecycleSummary,
} from "./client-report-data-core";

export * from "./client-report-data-core";

const COMPASS_CONFIG_KEY = "client-compass.configuration.v1";

function currentLifecycleThresholds(): TechnicalThresholds | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COMPASS_CONFIG_KEY);
    if (!raw) return null;
    return normalizeCompassConfig(JSON.parse(raw) as unknown).thresholds;
  } catch {
    return null;
  }
}

function lifecycleDeviceType(device: ClientReportDevice): "physical-server" | "physical-workstation" | null {
  if (device.type === "server" || device.type === "backup-server") return "physical-server";
  if (device.type === "workstation") return "physical-workstation";
  return null;
}

function applyCurrentLifecyclePolicy(
  project: Project,
  device: ClientReportDevice,
  thresholds: TechnicalThresholds | null,
): ClientReportDevice {
  const deviceType = lifecycleDeviceType(device);
  if (!deviceType || !thresholds) return device;
  const age = Number(device.age);
  if (!Number.isFinite(age) || age <= 0) return device;

  const lifecycle = classifyTechnicalLifecycle({
    deviceType,
    isVirtual: false,
    model: device.model || "Known hardware",
    ageYears: age,
    warrantyEnd: device.warrantyExpires,
  }, thresholds, coreReportReferenceDate(project));

  return { ...device, lifecycleStatus: technicalLifecycleToReport(lifecycle) };
}

/**
 * Client-facing lifecycle status must follow the saved Compass lifecycle policy.
 * The generator already carries the authoritative inventory age; do not replace
 * that real age with a generic age band or reclassify it with legacy defaults.
 */
export function lifecycleDevices(project: Project): ClientReportDevice[] {
  const thresholds = currentLifecycleThresholds();
  return coreLifecycleDevices(project).map((device) => applyCurrentLifecyclePolicy(project, device, thresholds));
}

export function inventoryReportDevices(project: Project): ClientReportDevice[] {
  return lifecycleDevices(project).filter((device) => device.type !== "network");
}

export function reportableLifecycleDevices(project: Project): ClientReportDevice[] {
  return inventoryReportDevices(project).filter((device) =>
    (device.type === "server" || device.type === "backup-server" || device.type === "workstation")
    && device.lifecycleStatus !== "unknown"
  );
}

export function replacementDevices(project: Project): ClientReportDevice[] {
  return sortLifecycleDevices(reportableLifecycleDevices(project)).filter((device) => device.lifecycleStatus === "overdue");
}

export function lifecycleSummary(project: Project): LifecycleSummary {
  const inventory = inventoryReportDevices(project);
  const physicalDevices = inventory.filter((device) => device.type === "server" || device.type === "backup-server" || device.type === "workstation");
  if (!physicalDevices.length) return coreLifecycleSummary(project);

  const current = physicalDevices.filter((device) => device.lifecycleStatus === "current").length;
  const dueSoon = physicalDevices.filter((device) => device.lifecycleStatus === "due-soon").length;
  const overdue = physicalDevices.filter((device) => device.lifecycleStatus === "overdue").length;
  const unknown = physicalDevices.filter((device) => device.lifecycleStatus === "unknown").length;
  const assessed = current + dueSoon + overdue;
  return {
    total: physicalDevices.length,
    inventoryTotal: inventory.length,
    assessed,
    current,
    dueSoon,
    overdue,
    unknown,
    healthyPercentage: assessed ? Math.round((current / assessed) * 100) : 0,
  };
}

export function compassLocationSnapshots(project: Project): ReturnType<typeof coreCompassLocationSnapshots> {
  const snapshots = coreCompassLocationSnapshots(project);
  const devices = lifecycleDevices(project);
  return snapshots.map((snapshot) => {
    const ids = new Set(snapshot.deviceIds);
    const matched = devices.filter((device) =>
      (device.sourceDeviceId && ids.has(device.sourceDeviceId))
      || (device.sourceDeviceName && ids.has(device.sourceDeviceName))
      || ids.has(device.name)
    );
    if (!matched.length) return snapshot;
    return {
      ...snapshot,
      replaceNow: matched.filter((device) => device.lifecycleStatus === "overdue").length,
      planSoon: matched.filter((device) => device.lifecycleStatus === "due-soon").length,
    };
  });
}

function formattedAge(age: number): string {
  const rounded = age >= 10 ? Math.round(age) : Math.round(age * 10) / 10;
  return `${rounded} years old`;
}

function serverAgeDriver(devices: ClientReportDevice[]): string {
  const ages = devices.map((device) => Number(device.age)).filter((age) => Number.isFinite(age) && age > 0);
  if (!ages.length) return "";
  const oldest = Math.max(...ages);
  const status = devices.some((device) => device.lifecycleStatus === "overdue")
    ? "Replace now"
    : devices.some((device) => device.lifecycleStatus === "due-soon")
      ? "Plan soon"
      : "Healthy now";
  return devices.length === 1
    ? `1 physical server · ${formattedAge(oldest)} · ${status}`
    : `${devices.length} physical servers · oldest ${formattedAge(oldest)} · ${status}`;
}

function packageServers(
  item: ReturnType<typeof coreCompassProjectPackages>[number],
  devices: ClientReportDevice[],
): ClientReportDevice[] {
  if (item.category !== "server-replacement") return [];
  const ids = new Set(item.deviceIds);
  const matched = devices.filter((device) =>
    (device.type === "server" || device.type === "backup-server")
    && ((device.sourceDeviceId && ids.has(device.sourceDeviceId)) || ids.has(device.name) || (device.sourceDeviceName && ids.has(device.sourceDeviceName)))
  );
  if (matched.length) return matched;
  const allServers = devices.filter((device) => device.type === "server" || device.type === "backup-server");
  return allServers.length === 1 ? allServers : [];
}

function clientFacingProjectPackages(project: Project): ReturnType<typeof coreCompassProjectPackages> {
  const devices = lifecycleDevices(project);
  return coreCompassProjectPackages(project).map((item) => {
    if (item.source !== "technical-findings" || item.category !== "server-replacement") return item;
    const servers = packageServers(item, devices);
    if (!servers.length) return item;
    const actualAge = serverAgeDriver(servers);
    const drivers = item.technicalDrivers.filter((driver) => !/physical servers?.*(?:years?|lifecycle)/i.test(driver));
    if (actualAge) drivers.unshift(actualAge);
    const critical = servers.some((device) => device.lifecycleStatus === "overdue");
    return {
      ...item,
      title: critical ? "Priority server modernization" : item.title,
      technicalDrivers: drivers,
    };
  });
}

/**
 * Project packages are an internal planning/estimation representation. Once a
 * client review has tailored decisions or an agreed next step, client-facing
 * report and presentation surfaces must use those saved decisions instead of
 * inferred package drivers, device counts, and generic ownership defaults.
 */
export function compassProjectPackages(project: Project): ReturnType<typeof coreCompassProjectPackages> {
  const outcome = project.reviewOutcome;
  const hasTailoredPlan = Boolean(
    outcome
      && outcome.status !== "not-reviewed"
      && (outcome.agreedNextStep.trim() || outcome.items.some((item) => item.includeInReport && (item.title.trim() || item.clientFacingNote.trim()))),
  );
  return hasTailoredPlan ? [] : clientFacingProjectPackages(project);
}
