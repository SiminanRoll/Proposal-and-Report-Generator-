import type { ExtractedFact, Project } from "@/lib/projects/types";
import {
  classifyTechnicalDevice,
  classifyTechnicalLifecycle,
  classifyTechnicalOsSupport,
  classifyTechnicalStorage,
  classifyTechnicalWarranty,
  normalizeTechnicalDeviceName,
  normalizedTechnicalIdentity,
  technicalLifecycleToReport,
  type TechnicalDeviceType,
  type TechnicalFieldSources,
} from "@/lib/technical-truth";

export interface ClientReportDevice {
  type: "server" | "backup-server" | "workstation" | "vm" | "network";
  name: string;
  user: string;
  lastCheckIn: string;
  make: string;
  serial: string;
  model: string;
  os: string;
  age: number;
  purchased: string;
  warrantyExpires: string;
  ram: string;
  cpu: string;
  storage: string;
  storageUsage: string;
  storagePercent: number;
  storageFreeGb: number;
  graphics: string;
  location: string;
  lifecycleStatus: "current" | "due-soon" | "overdue" | "unknown";
  osStatus: "supported" | "ending-soon" | "unsupported" | "unknown";
  sourceDeviceId?: string;
  sourceDeviceName?: string;
  sourceName?: string;
  authoritative?: boolean;
  sourceDetails?: TechnicalFieldSources;
}

export interface LifecycleSummary {
  total: number;
  inventoryTotal: number;
  assessed: number;
  current: number;
  dueSoon: number;
  overdue: number;
  unknown: number;
  healthyPercentage: number;
}

export interface InventoryReconciliation {
  passed: boolean;
  sourceTotal: number;
  inventoryTotal: number;
  expected: { servers: number; backupServers: number; workstations: number; vms: number; networkDevices: number };
  observed: { servers: number; backupServers: number; workstations: number; vms: number; networkDevices: number };
  suspiciousNames: string[];
  messages: string[];
  informationalMessages: string[];
  authoritative: boolean;
}

export type WarrantyStatus = "in-warranty" | "ending-soon" | "out-of-warranty" | "unknown";
export type StorageStatus = "healthy" | "watch" | "critical" | "unknown";
export type OsSupportStatus = ClientReportDevice["osStatus"];

export interface StorageAttentionSummary {
  reported: number;
  healthy: number;
  watch: number;
  critical: number;
  attention: number;
}

export interface OsSupportSummary {
  reported: number;
  supported: number;
  planning: number;
  endOfSupport: number;
  unknown: number;
  attention: number;
}

export interface SecurityIncidentDetail {
  device: string;
  threat: string;
  actions: string[];
  status: string;
}

export interface WarrantySummary {
  inWarranty: number;
  endingSoon: number;
  outOfWarranty: number;
  unknown: number;
  totalKnown: number;
}

export function isCloudPlusBdrDevice(device: Pick<ClientReportDevice, "name" | "make" | "model">): boolean {
  const identity = `${device.name ?? ""} ${device.make ?? ""} ${device.model ?? ""}`;
  return /CP[\s_-]?BDR/i.test(identity)
    || /CPBR/i.test(identity)
    || /CLOUD\s*PLUS\s*BDR/i.test(identity)
    || /\bEQUUS\b/i.test(identity);
}

export function isServerClassDevice(device: Pick<ClientReportDevice, "type">): boolean {
  return device.type === "server" || device.type === "backup-server";
}

export function isVirtualMachineDevice(device: Pick<ClientReportDevice, "type" | "name" | "make" | "model" | "os" | "graphics">): boolean {
  if (device.type === "vm") return true;
  return classifyTechnicalDevice({
    name: device.name,
    make: device.make,
    model: device.model,
    os: device.os,
    graphics: device.graphics,
  }).isVirtual;
}

export function deviceTypeLabel(type: ClientReportDevice["type"]): string {
  if (type === "server") return "Primary server";
  if (type === "backup-server") return "Cloud Plus backup server";
  if (type === "workstation") return "Workstation";
  if (type === "vm") return "Virtual machine";
  return "Network device";
}

export function deviceTypeLabelForDevice(device: Pick<ClientReportDevice, "type" | "os">): string {
  if (device.type === "vm" && /server/i.test(device.os ?? "")) return "Virtual server";
  return deviceTypeLabel(device.type);
}

export function classifyOsSupport(os: string): OsSupportStatus {
  return classifyTechnicalOsSupport(os);
}

export function osSupportStatus(device: Pick<ClientReportDevice, "os" | "osStatus">): OsSupportStatus {
  const detected = classifyOsSupport(device.os);
  return detected === "unknown" ? device.osStatus : detected;
}

export function osSupportStatusLabel(value: OsSupportStatus): string {
  if (value === "unsupported") return "End of support";
  if (value === "ending-soon") return "Planning concern";
  if (value === "supported") return "Supported";
  return "Not reported";
}

export function osSupportReason(device: Pick<ClientReportDevice, "os" | "osStatus">): string {
  const os = String(device.os ?? "");
  const status = osSupportStatus(device);
  if (status === "unsupported" && /Windows\s*10/i.test(os)) return "Windows 10 is end of support";
  if (status === "unsupported" && /Server\s*2012/i.test(os)) return "Server 2012 is end of support";
  if (status === "ending-soon" && /Server\s*2016/i.test(os)) return "Plan for the Server 2016 support transition";
  if (status === "ending-soon" && /Windows\s*11/i.test(os) && /\bHome\b/i.test(os)) return "Windows 11 Home is not the business Pro edition";
  if (status === "supported") return "Supported operating system";
  return "Operating-system support could not be confirmed";
}

function cleanClientDeviceName(value: string): string {
  return normalizeTechnicalDeviceName(value);
}

export function clientDeviceDisplayName(device: Pick<ClientReportDevice, "type" | "name">): string {
  if (device.type === "backup-server") return "CloudPlusBDR";
  const name = cleanClientDeviceName(device.name) || device.name;
  return device.type === "vm" ? `${name} (Virtual Machine)` : name;
}

function normalizedDeviceType(value: unknown): ClientReportDevice["type"] | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (/^(?:backup[ -]?server|cloud plus bdr|bdr)$/.test(normalized)) return "backup-server";
  if (/^servers?$/.test(normalized)) return "server";
  if (/^workstations?$/.test(normalized)) return "workstation";
  if (/^(?:vm|virtual machine)s?$/.test(normalized)) return "vm";
  if (/^(?:network|network device)s?$/.test(normalized)) return "network";
  return null;
}

function normalizedAge(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function reportTechnicalDeviceType(type: ClientReportDevice["type"]): TechnicalDeviceType {
  if (type === "server" || type === "backup-server") return "physical-server";
  if (type === "workstation") return "physical-workstation";
  if (type === "vm") return "virtual-workstation";
  if (type === "network") return "network";
  return "unknown";
}

function normalizedLifecycleStatus(device: Pick<ClientReportDevice, "type" | "age" | "lifecycleStatus" | "model" | "warrantyExpires">): ClientReportDevice["lifecycleStatus"] {
  if (device.type !== "server" && device.type !== "backup-server" && device.type !== "workstation") return device.lifecycleStatus;
  const lifecycle = classifyTechnicalLifecycle({
    deviceType: reportTechnicalDeviceType(device.type ?? "workstation"),
    isVirtual: false,
    model: device.model || "Known hardware",
    ageYears: normalizedAge(device.age),
    warrantyEnd: device.warrantyExpires,
  });
  return technicalLifecycleToReport(lifecycle);
}

function normalizedSerialIdentity(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizedDeviceNameIdentity(value: string): string {
  return normalizedTechnicalIdentity(value);
}

function deviceCompleteness(device: ClientReportDevice): number {
  return [device.user, device.lastCheckIn, device.make, device.serial, device.model, device.os, device.purchased, device.warrantyExpires, device.ram, device.cpu, device.storage, device.storageUsage, device.graphics, device.location]
    .filter((value) => Boolean(String(value ?? "").trim())).length;
}

function checkInTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function preferredDevice(first: ClientReportDevice, second: ClientReportDevice): ClientReportDevice {
  const firstCheckIn = checkInTimestamp(first.lastCheckIn);
  const secondCheckIn = checkInTimestamp(second.lastCheckIn);
  if (secondCheckIn !== firstCheckIn) return secondCheckIn > firstCheckIn ? second : first;
  return deviceCompleteness(second) > deviceCompleteness(first) ? second : first;
}

function deduplicateLifecycleDevices(devices: ClientReportDevice[]): ClientReportDevice[] {
  const unique = new Map<string, ClientReportDevice>();
  for (const device of devices) {
    const name = normalizedDeviceNameIdentity(device.name);
    const serial = normalizedSerialIdentity(device.serial);
    const key = serial ? `${device.type}:serial:${serial}` : `${device.type}:name:${name}`;
    const existing = unique.get(key);
    unique.set(key, existing ? preferredDevice(existing, device) : device);
  }
  return [...unique.values()];
}

function fact(project: Project, key: string): ExtractedFact | undefined {
  return project.intelligence.facts.find((item) => item.key === key);
}

export function factNumber(project: Project, key: string): number {
  const value = fact(project, key)?.value;
  if (typeof value === "number") return value;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function factText(project: Project, key: string): string {
  const value = fact(project, key)?.value;
  return Array.isArray(value) ? value.join(", ") : String(value ?? "");
}

export function factStrings(project: Project, key: string): string[] {
  const value = fact(project, key)?.value;
  if (Array.isArray(value)) return value.map(String);
  return value === undefined || value === "" ? [] : [String(value)];
}

export function lifecycleDevices(project: Project): ClientReportDevice[] {
  const devices = factStrings(project, "scalepad.inventory").flatMap((entry) => {
    try {
      const parsed = JSON.parse(entry) as Partial<ClientReportDevice> & { type?: unknown; age?: unknown };
      const parsedType = normalizedDeviceType(parsed.type);
      if (!parsed.name || !parsedType) return [];
      const type = isVirtualMachineDevice({
        type: parsedType,
        name: String(parsed.name),
        make: String(parsed.make ?? ""),
        model: String(parsed.model ?? ""),
        os: String(parsed.os ?? ""),
        graphics: String(parsed.graphics ?? ""),
      })
        ? "vm"
        : isCloudPlusBdrDevice({ name: String(parsed.name), make: String(parsed.make ?? ""), model: String(parsed.model ?? "") })
          ? "backup-server"
          : parsedType;
      const device = {
        user: "",
        lastCheckIn: "",
        make: "",
        serial: "",
        model: "",
        os: "",
        purchased: "",
        warrantyExpires: "",
        ram: "",
        cpu: "",
        storage: "",
        storageUsage: "",
        storagePercent: 0,
        storageFreeGb: 0,
        graphics: "",
        location: "",
        lifecycleStatus: "unknown",
        osStatus: "unknown",
        ...parsed,
        name: cleanClientDeviceName(String(parsed.name)),
        type,
        age: normalizedAge(parsed.age),
      } as ClientReportDevice;
      device.lifecycleStatus = device.type === "vm" || device.type === "network" ? "unknown" : normalizedLifecycleStatus(device);
      device.osStatus = classifyOsSupport(device.os);
      return [device];
    } catch {
      return [];
    }
  });
  const authoritative = devices.filter((device) => device.authoritative);
  if (authoritative.length) {
    const unique = new Map<string, ClientReportDevice>();
    for (const device of authoritative) {
      const key = device.sourceDeviceId || `${device.type}:${device.location}:${device.name}`;
      if (!unique.has(key)) unique.set(key, device);
    }
    return [...unique.values()];
  }
  return deduplicateLifecycleDevices(devices);
}

const DEVICE_TYPE_PRIORITY: Record<ClientReportDevice["type"], number> = {
  server: 0,
  "backup-server": 1,
  workstation: 2,
  vm: 3,
  network: 4,
};

const LIFECYCLE_PRIORITY: Record<ClientReportDevice["lifecycleStatus"], number> = {
  overdue: 0,
  "due-soon": 1,
  unknown: 2,
  current: 3,
};

function normalizedLocation(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function sortLifecycleDevices(devices: ClientReportDevice[]): ClientReportDevice[] {
  return devices.slice().sort((a, b) => {
    // Keep server-class systems first, then group each device class by site.
    // Within a site, the systems needing attention appear before healthy systems,
    // with the oldest device first. Blank locations sort after named sites.
    const type = DEVICE_TYPE_PRIORITY[a.type] - DEVICE_TYPE_PRIORITY[b.type];
    if (type !== 0) return type;
    const aLocation = normalizedLocation(a.location);
    const bLocation = normalizedLocation(b.location);
    if (aLocation !== bLocation) {
      if (!aLocation) return 1;
      if (!bLocation) return -1;
      return aLocation.localeCompare(bLocation);
    }
    const status = LIFECYCLE_PRIORITY[a.lifecycleStatus] - LIFECYCLE_PRIORITY[b.lifecycleStatus];
    if (status !== 0) return status;
    const age = (b.age || 0) - (a.age || 0);
    if (age !== 0) return age;
    return a.name.localeCompare(b.name);
  });
}

export function sortLifecycleDevicesByPriority(devices: ClientReportDevice[]): ClientReportDevice[] {
  return devices.slice().sort((a, b) => {
    const aStatusPriority = a.type === "vm" && a.lifecycleStatus === "unknown" ? 4 : LIFECYCLE_PRIORITY[a.lifecycleStatus];
    const bStatusPriority = b.type === "vm" && b.lifecycleStatus === "unknown" ? 4 : LIFECYCLE_PRIORITY[b.lifecycleStatus];
    const status = aStatusPriority - bStatusPriority;
    if (status !== 0) return status;
    const type = DEVICE_TYPE_PRIORITY[a.type] - DEVICE_TYPE_PRIORITY[b.type];
    if (type !== 0) return type;
    const aLocation = normalizedLocation(a.location);
    const bLocation = normalizedLocation(b.location);
    if (aLocation !== bLocation) {
      if (!aLocation) return 1;
      if (!bLocation) return -1;
      return aLocation.localeCompare(bLocation);
    }
    const age = (b.age || 0) - (a.age || 0);
    if (age !== 0) return age;
    return a.name.localeCompare(b.name);
  });
}

function parsedStoragePercent(device: Pick<ClientReportDevice, "storageUsage" | "storagePercent">): number {
  const explicit = Number(device.storagePercent);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const percentages = [...String(device.storageUsage ?? "").matchAll(/(\d+(?:\.\d+)?)%/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  return percentages.length ? Math.max(...percentages) : 0;
}

export function storageStatus(device: Pick<ClientReportDevice, "storageUsage" | "storagePercent" | "storageFreeGb"> & { type?: ClientReportDevice["type"] }): StorageStatus {
  return classifyTechnicalStorage({
    storageUsage: device.storageUsage,
    storagePercent: device.storagePercent,
    storageFreeGb: device.storageFreeGb,
  }, undefined, device.type ? reportTechnicalDeviceType(device.type) : "unknown");
}

export function storageStatusLabel(status: StorageStatus): string {
  if (status === "critical") return "Critical";
  if (status === "watch") return "Watch";
  if (status === "healthy") return "Healthy";
  return "Not reported";
}

export function storageUsageSummary(device: Pick<ClientReportDevice, "storage" | "storageUsage">): string {
  return String(device.storageUsage || device.storage || "").trim();
}

export function storageAttentionDevices(project: Project): ClientReportDevice[] {
  return sortLifecycleDevicesByPriority(inventoryReportDevices(project).filter((device) => {
    const status = storageStatus(device);
    return status === "watch" || status === "critical";
  })).sort((a, b) => {
    const aStatus = storageStatus(a) === "critical" ? 0 : 1;
    const bStatus = storageStatus(b) === "critical" ? 0 : 1;
    if (aStatus !== bStatus) return aStatus - bStatus;
    return parsedStoragePercent(b) - parsedStoragePercent(a);
  });
}

export function storageAttentionSummary(project: Project): StorageAttentionSummary {
  const statuses = inventoryReportDevices(project).map(storageStatus).filter((status) => status !== "unknown");
  const critical = statuses.filter((status) => status === "critical").length;
  const watch = statuses.filter((status) => status === "watch").length;
  const healthy = statuses.filter((status) => status === "healthy").length;
  return { reported: statuses.length, healthy, watch, critical, attention: watch + critical };
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

export function physicalAssetCounts(project: Project): { servers: number; backupServers: number; workstations: number; total: number } {
  const devices = inventoryReportDevices(project).filter((device) => device.type === "server" || device.type === "backup-server" || device.type === "workstation");
  if (devices.length) {
    const servers = devices.filter((device) => device.type === "server").length;
    const backupServers = devices.filter((device) => device.type === "backup-server").length;
    const workstations = devices.filter((device) => device.type === "workstation").length;
    return { servers, backupServers, workstations, total: servers + backupServers + workstations };
  }
  const backupServers = Math.max(0, factNumber(project, "scalepad.backupServers"));
  const servers = Math.max(0, factNumber(project, "scalepad.servers"));
  const workstations = Math.max(0, factNumber(project, "scalepad.workstations"));
  return { servers, backupServers, workstations, total: servers + backupServers + workstations };
}

export function replacementDevices(project: Project): ClientReportDevice[] {
  return sortLifecycleDevices(reportableLifecycleDevices(project)).filter((device) => device.lifecycleStatus === "overdue");
}

export function lifecycleSummary(project: Project): LifecycleSummary {
  const inventory = inventoryReportDevices(project);
  const physicalDevices = inventory.filter((device) => device.type === "server" || device.type === "backup-server" || device.type === "workstation");
  if (physicalDevices.length) {
    const reported = {
      current: Math.max(0, factNumber(project, "scalepad.replacement.current")),
      dueSoon: Math.max(0, factNumber(project, "scalepad.replacement.dueSoon")),
      overdue: Math.max(0, factNumber(project, "scalepad.replacement.overdue")),
      unknown: Math.max(0, factNumber(project, "scalepad.replacement.unknown")),
    };
    const reportedTotal = reported.current + reported.dueSoon + reported.overdue + reported.unknown;
    const authoritative = factText(project, "compass.authoritativeInventory").toLowerCase() === "true" || inventory.some((device) => device.authoritative);
    const useReportedSummary = !authoritative && reportedTotal === physicalDevices.length && reportedTotal > 0;
    const current = useReportedSummary ? reported.current : physicalDevices.filter((device) => device.lifecycleStatus === "current").length;
    const dueSoon = useReportedSummary ? reported.dueSoon : physicalDevices.filter((device) => device.lifecycleStatus === "due-soon").length;
    const overdue = useReportedSummary ? reported.overdue : physicalDevices.filter((device) => device.lifecycleStatus === "overdue").length;
    const unknown = useReportedSummary ? reported.unknown : physicalDevices.filter((device) => device.lifecycleStatus === "unknown").length;
    const assessed = current + dueSoon + overdue;
    const healthyPercentage = assessed ? Math.round((current / assessed) * 100) : 0;
    return { total: physicalDevices.length, inventoryTotal: inventory.length, assessed, current, dueSoon, overdue, unknown, healthyPercentage };
  }

  const { total } = physicalAssetCounts(project);
  const inventoryTotal = Math.max(total, factNumber(project, "scalepad.totalAssets"));
  const reportedOverdue = Math.min(factNumber(project, "scalepad.replacement.overdue"), total);
  const reportedDueSoon = Math.min(factNumber(project, "scalepad.replacement.dueSoon"), Math.max(0, total - reportedOverdue));
  const reportedUnknown = Math.min(factNumber(project, "scalepad.replacement.unknown"), Math.max(0, total - reportedOverdue - reportedDueSoon));
  const current = Math.max(0, total - reportedOverdue - reportedDueSoon - reportedUnknown);
  const assessed = current + reportedDueSoon + reportedOverdue;
  const healthyPercentage = assessed ? Math.round((current / assessed) * 100) : 0;
  return { total, inventoryTotal, assessed, current, dueSoon: reportedDueSoon, overdue: reportedOverdue, unknown: reportedUnknown, healthyPercentage };
}

export function reportReferenceDate(project: Project): Date {
  const source = project.presentation.publishedAt || project.updatedAt || project.createdAt;
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function warrantyStatus(device: ClientReportDevice, referenceDate = new Date()): WarrantyStatus {
  return classifyTechnicalWarranty(device.warrantyExpires, referenceDate);
}

export function warrantyStatusLabel(status: WarrantyStatus): string {
  if (status === "in-warranty") return "In warranty";
  if (status === "ending-soon") return "Ending soon";
  if (status === "out-of-warranty") return "Out of warranty";
  return "Warranty unknown";
}

export function osSupportSummary(project: Project): OsSupportSummary {
  const devices = inventoryReportDevices(project).filter((device) => device.type !== "network");
  const sourceSummary = {
    supported: Math.max(0, factNumber(project, "scalepad.os.supported")),
    planning: Math.max(0, factNumber(project, "scalepad.os.endingSoon")),
    endOfSupport: Math.max(0, factNumber(project, "scalepad.os.unsupported")),
  };
  const sourceReported = sourceSummary.supported + sourceSummary.planning + sourceSummary.endOfSupport;
  if (devices.length && sourceReported > 0 && sourceReported <= devices.length) {
    const unknown = devices.length - sourceReported;
    return {
      reported: sourceReported,
      supported: sourceSummary.supported,
      planning: sourceSummary.planning,
      endOfSupport: sourceSummary.endOfSupport,
      unknown,
      attention: sourceSummary.planning + sourceSummary.endOfSupport,
    };
  }

  const statuses = devices.map(osSupportStatus);
  const supported = statuses.filter((status) => status === "supported").length;
  const planning = statuses.filter((status) => status === "ending-soon").length;
  const endOfSupport = statuses.filter((status) => status === "unsupported").length;
  const unknown = statuses.filter((status) => status === "unknown").length;
  return {
    reported: devices.length - unknown,
    supported,
    planning,
    endOfSupport,
    unknown,
    attention: planning + endOfSupport,
  };
}

export function warrantySummary(project: Project): WarrantySummary {
  const reference = reportReferenceDate(project);
  const statuses = inventoryReportDevices(project)
    .filter((device) => device.type === "server" || device.type === "backup-server" || device.type === "workstation")
    .map((device) => warrantyStatus(device, reference));
  const inWarranty = statuses.filter((status) => status === "in-warranty").length;
  const endingSoon = statuses.filter((status) => status === "ending-soon").length;
  const outOfWarranty = statuses.filter((status) => status === "out-of-warranty").length;
  const unknown = statuses.filter((status) => status === "unknown").length;
  return { inWarranty, endingSoon, outOfWarranty, unknown, totalKnown: inWarranty + endingSoon + outOfWarranty };
}

export function technicalSourceDetails(device: Pick<ClientReportDevice, "sourceName" | "sourceDetails">): Array<{ field: keyof TechnicalFieldSources; source: string }> {
  const details = device.sourceDetails ?? {};
  const fallback = String(device.sourceName ?? "").trim();
  return (["identity", "inventory", "classification", "os", "activity", "storage", "lifecycle", "warranty"] as Array<keyof TechnicalFieldSources>)
    .map((field) => ({ field, source: String(details[field] ?? fallback).trim() }))
    .filter((item) => Boolean(item.source));
}

export function graphicsSummary(value: string): string {
  const clean = value.replace(/\(R\)|\(TM\)/gi, "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > 58 ? `${clean.slice(0, 55).trim()}…` : clean;
}

export function formatMetric(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 2).replace(/\.00$/, "")}M`;
  if (value >= 1_000) return value.toLocaleString("en-US");
  return String(value);
}

function suspiciousDeviceName(value: string, authoritative = false): boolean {
  const name = cleanClientDeviceName(value);
  const unreadable = !name || /[\u0000-\u001F\u007F-\u009F\uE000-\uF8FF\uFFFE\uFFFF]/.test(value) || /^(?:(?:Last)?Check-?In|WarrantyExpiry|WarrantyExpires)/i.test(name);
  if (authoritative) return unreadable;
  const looksConcatenated = /(?:\d|[a-z])[A-Z]{2,10}-/.test(name) || /(?:FRONTDESK|VMHOST|SERVER|LAPTOP)\d?[A-Z]{3,}/i.test(name);
  return unreadable || name.length > 40 || looksConcatenated;
}

export function inventoryReconciliation(project: Project): InventoryReconciliation {
  const devices = lifecycleDevices(project);
  const authoritative = factText(project, "compass.authoritativeInventory").toLowerCase() === "true" || devices.some((device) => device.authoritative);
  const observed = {
    servers: devices.filter((device) => device.type === "server").length,
    backupServers: devices.filter((device) => device.type === "backup-server").length,
    workstations: devices.filter((device) => device.type === "workstation").length,
    vms: devices.filter((device) => device.type === "vm").length,
    networkDevices: devices.filter((device) => device.type === "network").length,
  };
  const expected = {
    servers: Math.max(0, factNumber(project, "scalepad.servers")),
    backupServers: Math.max(0, factNumber(project, "scalepad.backupServers")),
    workstations: Math.max(0, factNumber(project, "scalepad.workstations")),
    vms: Math.max(0, factNumber(project, "scalepad.vms")),
    networkDevices: Math.max(0, factNumber(project, "scalepad.networkDevices")),
  };
  const inventoryTotal = devices.length;
  const expectedCategoryTotal = expected.servers + expected.backupServers + expected.workstations + expected.vms + expected.networkDevices;
  const sourceTotal = Math.max(0, authoritative
    ? factNumber(project, "compass.authoritativeInventoryTotal") || expectedCategoryTotal
    : factNumber(project, "scalepad.sourceReportedTotal") || factNumber(project, "scalepad.totalAssets") || expectedCategoryTotal);
  const suspiciousNames = devices.filter((device) => suspiciousDeviceName(device.sourceDeviceName || device.name, authoritative)).map((device) => device.sourceDeviceName || device.name);
  const messages: string[] = [];
  const informationalMessages: string[] = [];
  if (sourceTotal && inventoryTotal !== sourceTotal) messages.push(`${authoritative ? "Ninja / Client Compass contains" : "Source reports"} ${sourceTotal} assets, but ${inventoryTotal} device records reached the report.`);
  if (expected.servers !== observed.servers) messages.push(`Server count mismatch: expected ${expected.servers}, found ${observed.servers}.`);
  if (expected.backupServers !== observed.backupServers) messages.push(`Backup-server count mismatch: expected ${expected.backupServers}, found ${observed.backupServers}.`);
  if (expected.workstations !== observed.workstations) messages.push(`Workstation count mismatch: expected ${expected.workstations}, found ${observed.workstations}.`);
  if (expected.vms !== observed.vms) messages.push(`Virtual-machine count mismatch: expected ${expected.vms}, found ${observed.vms}.`);
  if (expected.networkDevices !== observed.networkDevices) messages.push(`Network-device count mismatch: expected ${expected.networkDevices}, found ${observed.networkDevices}.`);
  if (suspiciousNames.length) messages.push(`${suspiciousNames.length} authoritative device name${suspiciousNames.length === 1 ? " needs" : "s need"} identity review.`);
  if (authoritative) {
    const lifecycleSourceTotal = factNumber(project, "lifecycleSource.totalAssets") || factNumber(project, "scalepad.totalAssets.scalepad");
    if (lifecycleSourceTotal && lifecycleSourceTotal !== inventoryTotal) informationalMessages.push(`Lifecycle enrichment reports ${lifecycleSourceTotal} assets; Ninja / Client Compass remains authoritative at ${inventoryTotal}.`);
  }
  return { passed: messages.length === 0, sourceTotal, inventoryTotal, expected, observed, suspiciousNames, messages, informationalMessages, authoritative };
}

export function securityIncidentDetails(project: Project): SecurityIncidentDetail[] {
  const parsed = factStrings(project, "huntress.incidentDetails").flatMap((entry) => {
    try {
      const value = JSON.parse(entry) as Partial<SecurityIncidentDetail>;
      const actions = Array.isArray(value.actions) ? value.actions.map(String).filter(Boolean) : [];
      if (!value.device && !value.threat && !actions.length && !value.status) return [];
      return [{
        device: String(value.device ?? "").trim(),
        threat: String(value.threat ?? "").trim(),
        actions,
        status: String(value.status ?? "").trim(),
      }];
    } catch {
      return [];
    }
  });
  if (parsed.length) return parsed;

  const devices = factStrings(project, "huntress.incidentDevices");
  const threats = factStrings(project, "huntress.incidentThreats");
  const actions = factStrings(project, "huntress.incidentResponseActions");
  const count = Math.max(devices.length, threats.length, factNumber(project, "huntress.incidentsReported"));
  return Array.from({ length: count }, (_, index) => ({
    device: devices[index] ?? devices[0] ?? "",
    threat: threats[index] ?? threats[0] ?? "",
    actions,
    status: actions.length ? "Response completed" : "Investigated by the security team",
  }));
}

export function lifecycleStatusLabel(value: ClientReportDevice["lifecycleStatus"]): string {
  if (value === "overdue") return "Replace now";
  if (value === "due-soon") return "Plan soon";
  if (value === "current") return "Healthy now";
  return "Under review";
}

export function technologyAssessmentAvailable(project: Project): boolean {
  const lifecycle = lifecycleSummary(project);
  return Boolean(
    lifecycle.total
    || inventoryReportDevices(project).length
    || factNumber(project, "environment.totalComputers")
    || factNumber(project, "security.firewallDisabled")
    || factNumber(project, "patching.affectedComputers")
    || factNumber(project, "backup.endpointMissing"),
  );
}

export function clientReportAvailable(project: Project): boolean {
  return project.type === "client-report"
    && Boolean(technologyAssessmentAvailable(project) || factNumber(project, "huntress.eventsAnalyzed"));
}
