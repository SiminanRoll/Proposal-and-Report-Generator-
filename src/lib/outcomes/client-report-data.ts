import type { ExtractedFact, Project } from "@/lib/projects/types";

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
}

export interface LifecycleSummary {
  total: number;
  current: number;
  dueSoon: number;
  overdue: number;
  unknown: number;
  healthyPercentage: number;
}

export type WarrantyStatus = "in-warranty" | "ending-soon" | "out-of-warranty" | "unknown";
export type StorageStatus = "healthy" | "watch" | "critical" | "unknown";

export interface StorageAttentionSummary {
  reported: number;
  healthy: number;
  watch: number;
  critical: number;
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

const PHYSICAL_LIFECYCLE_YEARS = {
  server: { planSoon: 4, replaceNow: 5 },
  "backup-server": { planSoon: 4, replaceNow: 5 },
  workstation: { planSoon: 4, replaceNow: 5 },
} as const;

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

export function deviceTypeLabel(type: ClientReportDevice["type"]): string {
  if (type === "server") return "Primary server";
  if (type === "backup-server") return "Cloud Plus backup server";
  if (type === "workstation") return "Workstation";
  if (type === "vm") return "Virtual machine";
  return "Network device";
}

function cleanClientDeviceName(value: string): string {
  return value
    .replace(/^(?:(?:Last)?Check-?In|WarrantyExpiry|WarrantyExpires|Expiry|Expires)+/i, "")
    .trim();
}

export function clientDeviceDisplayName(device: Pick<ClientReportDevice, "type" | "name">): string {
  if (device.type === "backup-server") return "CloudPlusBDR";
  return cleanClientDeviceName(device.name) || device.name;
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

function normalizedLifecycleStatus(device: Pick<ClientReportDevice, "type" | "age" | "lifecycleStatus">): ClientReportDevice["lifecycleStatus"] {
  if (device.type !== "server" && device.type !== "backup-server" && device.type !== "workstation") return device.lifecycleStatus;
  const age = normalizedAge(device.age);
  if (age <= 0) return "unknown";
  const threshold = PHYSICAL_LIFECYCLE_YEARS[device.type];
  if (age >= threshold.replaceNow) return "overdue";
  if (age >= threshold.planSoon) return "due-soon";
  return "current";
}

function normalizedIdentity(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
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
    const name = normalizedIdentity(device.name);
    const serial = normalizedIdentity(device.serial);
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
      const type = /virtual machine/i.test(`${parsed.make ?? ""} ${parsed.model ?? ""}`)
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
        type,
        age: normalizedAge(parsed.age),
      } as ClientReportDevice;
      device.lifecycleStatus = normalizedLifecycleStatus(device);
      return [device];
    } catch {
      return [];
    }
  });
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
    const status = LIFECYCLE_PRIORITY[a.lifecycleStatus] - LIFECYCLE_PRIORITY[b.lifecycleStatus];
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

export function storageStatus(device: Pick<ClientReportDevice, "storageUsage" | "storagePercent" | "storageFreeGb">): StorageStatus {
  const percent = parsedStoragePercent(device);
  const freeGb = Number(device.storageFreeGb);
  const hasUsage = Boolean(String(device.storageUsage ?? "").trim()) || percent > 0;
  if (!hasUsage) return "unknown";
  if (percent >= 90 || (Number.isFinite(freeGb) && freeGb > 0 && freeGb < 20)) return "critical";
  if (percent >= 80) return "watch";
  return "healthy";
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
  return sortLifecycleDevicesByPriority(reportableLifecycleDevices(project).filter((device) => {
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
  const statuses = reportableLifecycleDevices(project).map(storageStatus).filter((status) => status !== "unknown");
  const critical = statuses.filter((status) => status === "critical").length;
  const watch = statuses.filter((status) => status === "watch").length;
  const healthy = statuses.filter((status) => status === "healthy").length;
  return { reported: statuses.length, healthy, watch, critical, attention: watch + critical };
}

export function reportableLifecycleDevices(project: Project): ClientReportDevice[] {
  return lifecycleDevices(project).filter((device) =>
    (device.type === "server" || device.type === "backup-server" || device.type === "workstation")
    && device.lifecycleStatus !== "unknown"
  );
}

export function physicalAssetCounts(project: Project): { servers: number; backupServers: number; workstations: number; total: number } {
  const devices = reportableLifecycleDevices(project);
  if (devices.length) {
    const servers = devices.filter((device) => device.type === "server").length;
    const backupServers = devices.filter((device) => device.type === "backup-server").length;
    const workstations = devices.filter((device) => device.type === "workstation").length;
    return { servers, backupServers, workstations, total: servers + backupServers + workstations };
  }
  const backupServers = Math.max(0, factNumber(project, "scalepad.backupServers"));
  const reportedServers = Math.max(0, factNumber(project, "scalepad.servers"));
  const servers = reportedServers;
  const workstations = Math.max(0, factNumber(project, "scalepad.workstations"));
  return { servers, backupServers, workstations, total: servers + backupServers + workstations };
}

export function replacementDevices(project: Project): ClientReportDevice[] {
  return sortLifecycleDevices(reportableLifecycleDevices(project)).filter((device) => device.lifecycleStatus === "overdue");
}

export function lifecycleSummary(project: Project): LifecycleSummary {
  const physicalDevices = reportableLifecycleDevices(project);
  if (physicalDevices.length) {
    const current = physicalDevices.filter((device) => device.lifecycleStatus === "current").length;
    const dueSoon = physicalDevices.filter((device) => device.lifecycleStatus === "due-soon").length;
    const overdue = physicalDevices.filter((device) => device.lifecycleStatus === "overdue").length;
    const total = current + dueSoon + overdue;
    const healthyPercentage = total ? Math.round((current / total) * 100) : 0;
    return { total, current, dueSoon, overdue, unknown: 0, healthyPercentage };
  }

  const { total } = physicalAssetCounts(project);
  const reportedOverdue = Math.min(factNumber(project, "scalepad.replacement.overdue"), total);
  const reportedDueSoon = Math.min(factNumber(project, "scalepad.replacement.dueSoon"), Math.max(0, total - reportedOverdue));
  const reportedUnknown = Math.min(factNumber(project, "scalepad.replacement.unknown"), Math.max(0, total - reportedOverdue - reportedDueSoon));
  const current = Math.max(0, total - reportedOverdue - reportedDueSoon - reportedUnknown);
  const healthyPercentage = total ? Math.round((current / total) * 100) : 0;
  return { total, current, dueSoon: reportedDueSoon, overdue: reportedOverdue, unknown: reportedUnknown, healthyPercentage };
}

function parseDate(value: string): Date | null {
  const clean = value.trim();
  if (!clean || /unknown|not listed|n\/a/i.test(clean)) return null;
  const direct = new Date(clean);
  if (!Number.isNaN(direct.getTime())) return direct;
  const match = clean.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (!match) return null;
  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
  const parsed = new Date(Date.UTC(year, Number(match[1]) - 1, Number(match[2])));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function reportReferenceDate(project: Project): Date {
  const source = project.presentation.publishedAt || project.updatedAt || project.createdAt;
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function warrantyStatus(device: ClientReportDevice, referenceDate = new Date()): WarrantyStatus {
  const expires = parseDate(device.warrantyExpires);
  if (!expires) return "unknown";
  const reference = new Date(referenceDate);
  reference.setHours(0, 0, 0, 0);
  expires.setHours(0, 0, 0, 0);
  if (expires.getTime() < reference.getTime()) return "out-of-warranty";
  const endingSoon = new Date(reference);
  endingSoon.setFullYear(endingSoon.getFullYear() + 1);
  return expires.getTime() <= endingSoon.getTime() ? "ending-soon" : "in-warranty";
}

export function warrantyStatusLabel(status: WarrantyStatus): string {
  if (status === "in-warranty") return "In warranty";
  if (status === "ending-soon") return "Ending soon";
  if (status === "out-of-warranty") return "Out of warranty";
  return "Warranty unknown";
}

export function warrantySummary(project: Project): WarrantySummary {
  const reference = reportReferenceDate(project);
  const statuses = reportableLifecycleDevices(project).map((device) => warrantyStatus(device, reference));
  const inWarranty = statuses.filter((status) => status === "in-warranty").length;
  const endingSoon = statuses.filter((status) => status === "ending-soon").length;
  const outOfWarranty = statuses.filter((status) => status === "out-of-warranty").length;
  const unknown = statuses.filter((status) => status === "unknown").length;
  return { inWarranty, endingSoon, outOfWarranty, unknown, totalKnown: inWarranty + endingSoon + outOfWarranty };
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

export function clientReportAvailable(project: Project): boolean {
  const lifecycle = lifecycleSummary(project);
  return project.type === "client-report"
    && Boolean(lifecycle.total || factNumber(project, "huntress.eventsAnalyzed"));
}
