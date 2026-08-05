import type {
  CompassCardCategory,
  CompassCardDefinition,
  CompassCardMetric,
  CompassCardSignal,
  CompassClient,
  CompassClientSummary,
  CompassConfig,
  CompassDataset,
  CompassDevice,
  CompassDeviceType,
  CompassFinding,
  CompassImportPreview,
  CompassImportSummary,
  CompassLifecycle,
  CompassLocation,
  CompassOpportunity,
  OrganizationResolutions,
  ParsedCompassImport,
  RawCompassRow,
  DiskVolumeCondition,
} from "./types";

export const COMPASS_CALCULATION_VERSION = 2;

export function normalizeOrganizationName(value: string): string {
  return value.trim().toLowerCase().replace(/[.,'’`]/g, "").replace(/&/g, "and").replace(/\s+/g, " ");
}

function slug(value: string): string {
  const normalized = normalizeOrganizationName(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || "unknown";
}

function clean(value: string | null | undefined): string { return String(value ?? "").trim().replace(/\s+/g, " "); }

function parseDate(value: string): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date;
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!match) return null;
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  const parsed = new Date(Date.UTC(year, Number(match[1]) - 1, Number(match[2])));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isoDate(value: string): string {
  const parsed = parseDate(value);
  return parsed ? parsed.toISOString() : "";
}

function ageInYears(value: string, now: Date): number | null {
  const parsed = parseDate(value);
  if (!parsed) return null;
  return Math.max(0, (now.getTime() - parsed.getTime()) / 31557600000);
}

function futureMonths(value: string, now: Date): number | null {
  const parsed = parseDate(value);
  if (!parsed) return null;
  return (parsed.getTime() - now.getTime()) / 2629800000;
}

function detectVirtualPlatform(text: string): string {
  const value = text.toLowerCase();
  if (/hyper-v|microsoft virtual|virtual machine/.test(value)) return "Microsoft Hyper-V";
  if (/vmware/.test(value)) return "VMware";
  if (/virtualbox/.test(value)) return "VirtualBox";
  if (/qemu|kvm|virtio/.test(value)) return "QEMU/KVM";
  if (/xen/.test(value)) return "Xen";
  return "";
}

export function classifyDevice(row: Pick<RawCompassRow, "deviceName" | "deviceModel" | "videoCard" | "osName">): { deviceType: CompassDeviceType; isVirtual: boolean; virtualizationPlatform: string } {
  const combined = [row.deviceName, row.deviceModel, row.videoCard, row.osName].join(" ");
  const platform = detectVirtualPlatform(combined);
  const isVirtual = Boolean(platform) || /virtual\s+(machine|server|desktop)|vmware|virtualbox|qemu|kvm|xen|virtio/i.test(combined);
  const serverOs = /windows\s+server|server\s+20\d\d|server\s+200\d|ubuntu\s+server|red hat enterprise linux|centos\s+server/i.test(row.osName);
  const serverHardware = /poweredge|proliant|thinksystem|rack\s*server|tower\s*server|\bserver\b/i.test(row.deviceModel);
  const serverName = /(?:^|[-_])(server|srv|dc)(?:[-_]?\d+)?(?:$|[-_])/i.test(row.deviceName) || /domain controller/i.test(row.deviceName);
  const isServer = serverOs || serverHardware || serverName;
  const workstationOs = /windows|mac\s*os|macos|chrome\s*os|ubuntu|linux/i.test(row.osName);
  const workstationHardware = /optiplex|latitude|precision|prodesk|elitedesk|thinkcentre|thinkpad|desktop|laptop|workstation|macbook|imac|surface/i.test(row.deviceModel);
  const workstationName = /(?:^|[-_])(front|op|hyg|office|reception|doctor|laptop|desktop|pc)(?:$|[-_]?\d+)/i.test(row.deviceName);
  if (isServer && isVirtual) return { deviceType: "virtual-server", isVirtual, virtualizationPlatform: platform || "Virtual machine" };
  if (isServer) return { deviceType: "physical-server", isVirtual, virtualizationPlatform: "" };
  if (isVirtual) return { deviceType: "virtual-workstation", isVirtual, virtualizationPlatform: platform || "Virtual machine" };
  if (workstationOs || workstationHardware || workstationName) return { deviceType: "physical-workstation", isVirtual: false, virtualizationPlatform: "" };
  return { deviceType: "unknown", isVirtual: false, virtualizationPlatform: "" };
}

function rawRowActivity(row: RawCompassRow): number {
  const values = [parseDate(row.lastUptime), parseDate(row.lastLogin)].filter((date): date is Date => Boolean(date));
  return values.length ? Math.max(...values.map((date) => date.getTime())) : 0;
}

function rawRowCompleteness(row: RawCompassRow): number {
  return [row.stableId, row.location, row.lastUptime, row.videoCard, row.warrantyStart, row.warrantyEnd, row.lastLogin, row.memoryGiB, row.osName, row.deviceStatus, row.diskVolumeUsage, row.deviceModel].filter((value) => clean(value)).length;
}

function preferredRawRow(current: RawCompassRow, candidate: RawCompassRow): RawCompassRow {
  const currentActivity = rawRowActivity(current);
  const candidateActivity = rawRowActivity(candidate);
  if (candidateActivity !== currentActivity) return candidateActivity > currentActivity ? candidate : current;
  const currentCompleteness = rawRowCompleteness(current);
  const candidateCompleteness = rawRowCompleteness(candidate);
  if (candidateCompleteness !== currentCompleteness) return candidateCompleteness > currentCompleteness ? candidate : current;
  return candidate.rowNumber >= current.rowNumber ? candidate : current;
}

function collapseRawRows(rows: RawCompassRow[], keyFor: (row: RawCompassRow, index: number) => string): RawCompassRow[] {
  const grouped = new Map<string, RawCompassRow>();
  rows.forEach((row, index) => {
    const key = keyFor(row, index);
    const current = grouped.get(key);
    grouped.set(key, current ? preferredRawRow(current, row) : row);
  });
  return [...grouped.values()];
}

export function deduplicateRawRows(rows: RawCompassRow[]): RawCompassRow[] {
  const stableCollapsed = collapseRawRows(rows, (row, index) => {
    const organization = normalizeOrganizationName(row.organization);
    const stableId = slug(clean(row.stableId));
    return clean(row.stableId) ? `${organization}::stable::${stableId}` : `${organization}::row::${index}`;
  });
  return collapseRawRows(stableCollapsed, (row) => `${normalizeOrganizationName(row.organization)}::name::${slug(clean(row.deviceName))}`);
}

function storageUnitToGb(value: number, unit: string): number {
  return /t/i.test(unit) ? value * 1024 : value;
}

function roundOne(value: number): number { return Math.round(value * 10) / 10; }

function storageLabel(value: string, fallback: string): string {
  const cleanLabel = value.trim().replace(/^Name:\s*/i, "").replace(/^['\"]|['\"]$/g, "");
  if (!cleanLabel) return fallback;
  if (/^[A-Za-z]$/.test(cleanLabel)) return `${cleanLabel.toUpperCase()}:`;
  return cleanLabel.length <= 32 ? cleanLabel : cleanLabel.slice(0, 32);
}

function classifyVolume(
  base: Omit<DiskVolumeCondition, "state" | "excludedReason" | "isSystem">,
  config: CompassConfig,
  deviceType: CompassDeviceType,
): DiskVolumeCondition {
  const normalizedLabel = base.label.toLowerCase().replace(/\s+/g, " ").trim();
  const isSystem = /^(c:|\/|system|system drive)$/.test(normalizedLabel);
  const excludedByName = /recovery|restore|efi|reserved|system reserved|oem|diagnostic|utility|winre|boot/i.test(normalizedLabel);
  const excludedBySize = base.totalGb !== null && base.totalGb > 0 && base.totalGb < config.thresholds.storageMinimumVolumeGb;
  const excludedReason = excludedByName ? "Recovery or utility partition" : excludedBySize ? `Volume smaller than ${config.thresholds.storageMinimumVolumeGb} GB` : "";
  if (excludedReason) return { ...base, isSystem, state: "unknown", excludedReason };

  const used = base.usedPercent;
  const free = base.freeGb;
  const isServer = deviceType === "physical-server" || deviceType === "virtual-server";
  const isWorkstation = deviceType === "physical-workstation" || deviceType === "virtual-workstation";
  let state: DiskVolumeCondition["state"] = "healthy";

  const criticalSystemFree = isSystem && free !== null && free < config.thresholds.storageSystemCriticalFreeGb;
  const criticalBalanced = used !== null && used >= config.thresholds.storageCriticalPercent && free !== null && free < config.thresholds.storageCriticalFreeGb;
  const criticalServerPercentOnly = isServer && used !== null && used >= Math.max(95, config.thresholds.storageCriticalPercent) && free === null;
  const criticalPercentOnly = used !== null && used >= Math.max(97, config.thresholds.storageCriticalPercent + 5) && free === null;
  if (criticalSystemFree || criticalBalanced || criticalServerPercentOnly || criticalPercentOnly) state = "critical";
  else {
    const watchSystemFree = isSystem && isWorkstation && free !== null && free < config.thresholds.storageSystemWatchFreeGb;
    const watchBalanced = used !== null && used >= config.thresholds.storageWatchPercent && free !== null && free < config.thresholds.storageWatchFreeGb;
    const watchServer = isServer && used !== null && used >= config.thresholds.storageWatchPercent && (free === null || free < config.thresholds.storageWatchFreeGb);
    const watchPercentOnly = used !== null && used >= Math.max(90, config.thresholds.storageWatchPercent + 8) && free === null;
    if (watchSystemFree || watchBalanced || watchServer || watchPercentOnly) state = "watch";
    else if (used === null && free === null) state = "unknown";
  }
  return { ...base, isSystem, state, excludedReason: "" };
}

export function parseDiskVolumes(value: string, config: CompassConfig, deviceType: CompassDeviceType = "unknown"): DiskVolumeCondition[] {
  const text = String(value ?? "").replace(/\r?\n/g, ", ").trim();
  if (!text) return [];
  const parsed: Array<Omit<DiskVolumeCondition, "state" | "excludedReason" | "isSystem">> = [];

  const scalePadPattern = /Name:\s*"?([^"/]+?)"?\s*\/(?:.*?\/)?\s*Capacity:\s*"?[^"/]*?\((\d+(?:\.\d+)?)\s*(TiB|GiB|TB|GB)\)"?\s*\/.*?Usage\s*%:\s*"?(\d+(?:\.\d+)?)%/gi;
  for (const match of text.matchAll(scalePadPattern)) {
    const totalGb = storageUnitToGb(Number(match[2]), match[3]);
    const usedPercent = Number(match[4]);
    const usedGb = totalGb * usedPercent / 100;
    parsed.push({ label: storageLabel(match[1], `Volume ${parsed.length + 1}`), usedPercent: roundOne(usedPercent), usedGb: roundOne(usedGb), totalGb: roundOne(totalGb), freeGb: roundOne(Math.max(0, totalGb - usedGb)) });
  }

  if (!parsed.length) {
    const slashPattern = /(?:^|[,;|]\s*|\s+(?=[A-Za-z]:\s*\d))\s*([A-Za-z]:|\/|[A-Za-z][A-Za-z0-9 _-]{1,30}:|Volume\s+[^,;|]+|Disk\s+[^,;|]+)?\s*(\d+(?:\.\d+)?)\s*(TiB|GiB|TB|GB)?\s*\/\s*(\d+(?:\.\d+)?)\s*(TiB|GiB|TB|GB)?(?:\s*\((\d+(?:\.\d+)?)\s*%\))?/gi;
    for (const match of text.matchAll(slashPattern)) {
      const usedUnit = match[3] || match[5] || "GB";
      const totalUnit = match[5] || match[3] || "GB";
      const usedGb = storageUnitToGb(Number(match[2]), usedUnit);
      const totalGb = storageUnitToGb(Number(match[4]), totalUnit);
      if (!Number.isFinite(usedGb) || !Number.isFinite(totalGb) || totalGb <= 0) continue;
      const usedPercent = Number.isFinite(Number(match[6])) ? Number(match[6]) : usedGb / totalGb * 100;
      parsed.push({ label: storageLabel(match[1] || "", `Volume ${parsed.length + 1}`), usedPercent: roundOne(usedPercent), usedGb: roundOne(usedGb), totalGb: roundOne(totalGb), freeGb: roundOne(Math.max(0, totalGb - usedGb)) });
    }
  }

  if (!parsed.length) {
    const freePattern = /(?:^|[,;|]\s*)([A-Za-z]:|\/|[A-Za-z][A-Za-z0-9 _-]{1,30}:|Volume\s+[^,;|]+|Disk\s+[^,;|]+)?\s*(\d+(?:\.\d+)?)\s*(TiB|GiB|TB|GB)\s+free\s+(?:of|out of)\s+(\d+(?:\.\d+)?)\s*(TiB|GiB|TB|GB)/gi;
    for (const match of text.matchAll(freePattern)) {
      const freeGb = storageUnitToGb(Number(match[2]), match[3]);
      const totalGb = storageUnitToGb(Number(match[4]), match[5]);
      if (!Number.isFinite(freeGb) || !Number.isFinite(totalGb) || totalGb <= 0) continue;
      const usedGb = Math.max(0, totalGb - freeGb);
      parsed.push({ label: storageLabel(match[1] || "", `Volume ${parsed.length + 1}`), usedPercent: roundOne(usedGb / totalGb * 100), usedGb: roundOne(usedGb), totalGb: roundOne(totalGb), freeGb: roundOne(freeGb) });
    }
  }

  if (!parsed.length) {
    const segments = text.split(/[,;|](?=\s*(?:[A-Za-z]:|Volume|Disk|\/))/).map((item) => item.trim()).filter(Boolean);
    for (const [index, segment] of (segments.length ? segments : [text]).entries()) {
      const label = storageLabel(segment.match(/(?:^|\s)([A-Za-z]:|\/|Volume\s+[^,;(]+|Disk\s+[^,;(]+)/i)?.[1] || "", `Volume ${index + 1}`);
      const percentages = [...segment.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((match) => Number(match[1])).filter(Number.isFinite);
      const usedPercent = percentages.length ? Math.max(...percentages) : null;
      parsed.push({ label, usedPercent: usedPercent === null ? null : roundOne(usedPercent), usedGb: null, totalGb: null, freeGb: null });
    }
  }

  return parsed.map((volume) => classifyVolume(volume, config, deviceType));
}

function modelIsIdentifiable(model: string): boolean {
  const value = clean(model).toLowerCase();
  return Boolean(value) && !/^(unknown|n\/a|na|none|default string|system product name|to be filled by o\.e\.m\.?|not reported|not included)$/.test(value) && !/virtual machine/.test(value);
}

function warrantyExpired(value: string, now: Date): boolean {
  const parsed = parseDate(value);
  return Boolean(parsed && parsed.getTime() < now.getTime());
}

function activityDate(device: Pick<CompassDevice, "lastUptime" | "lastLogin">): Date | null {
  const values = [parseDate(device.lastUptime), parseDate(device.lastLogin)].filter((date): date is Date => Boolean(date));
  return values.length ? new Date(Math.max(...values.map((date) => date.getTime()))) : null;
}

export function isDeviceStale(device: Pick<CompassDevice, "lastUptime" | "lastLogin">, config: CompassConfig, now = new Date()): boolean {
  const latest = activityDate(device);
  if (!latest) return false;
  return now.getTime() - latest.getTime() >= config.thresholds.staleDeviceMonths * 2629800000;
}

export function isDeviceInactive(device: Pick<CompassDevice, "status">): boolean {
  const value = clean(device.status ?? "").toLowerCase();
  if (!value) return false;
  return /inactive|disabled|archived|retired|decommissioned|deactivated/.test(value) || /^(false|no|0)$/.test(value);
}

function lifecycleFromValues(
  deviceType: CompassDeviceType,
  isVirtual: boolean,
  model: string,
  warrantyStart: string,
  warrantyEnd: string,
  lastUptime: string,
  lastLogin: string,
  status: string,
  config: CompassConfig,
  now: Date,
): CompassLifecycle {
  if (isVirtual || deviceType === "unknown" || !modelIsIdentifiable(model)) return "unknown";
  const age = ageInYears(warrantyStart, now);
  if (age === null) return "unknown";
  if (deviceType === "physical-server") {
    if (age >= config.thresholds.serverCriticalYears || (age >= config.thresholds.serverExpiredWarrantyCriticalYears && warrantyExpired(warrantyEnd, now))) return "replace-now";
    const months = futureMonths(warrantyEnd, now);
    if (age >= config.thresholds.serverPlanningYears || (age >= config.thresholds.serverWarrantyPlanningMinYears && months !== null && months >= 0 && months <= config.thresholds.warrantyPlanningMonths)) return "plan-soon";
    return "current";
  }
  if (deviceType !== "physical-workstation") return "unknown";
  if (isDeviceInactive({ status }) || isDeviceStale({ lastUptime, lastLogin }, config, now)) return "unknown";
  if (age >= config.thresholds.workstationReplaceNowYears || (age >= config.thresholds.workstationExpiredWarrantyReplaceYears && warrantyExpired(warrantyEnd, now))) return "replace-now";
  const months = futureMonths(warrantyEnd, now);
  if (age >= config.thresholds.workstationPlanSoonYears || (age >= 4 && months !== null && months >= 0 && months <= config.thresholds.warrantyPlanningMonths)) return "plan-soon";
  return "current";
}

function lifecycleFor(row: RawCompassRow, classification: ReturnType<typeof classifyDevice>, config: CompassConfig, now: Date): CompassLifecycle {
  return lifecycleFromValues(classification.deviceType, classification.isVirtual, row.deviceModel, row.warrantyStart, row.warrantyEnd, row.lastUptime, row.lastLogin, row.deviceStatus, config, now);
}

function clientIdFor(name: string): string { return `client-${slug(name)}`; }
function locationIdFor(clientId: string, name: string): string { return `${clientId}-location-${slug(name || "Main")}`; }

function manualClient(existing: CompassClient | undefined, id: string, name: string, aliases: string[], importedAt: string): CompassClient {
  return {
    id,
    name: existing?.name || clean(name),
    aliases: [...new Set([...(existing?.aliases ?? []), ...aliases].map(clean).filter(Boolean))],
    primaryContact: existing?.primaryContact ?? "",
    assignedOwner: existing?.assignedOwner ?? "",
    lastAccountReview: existing?.lastAccountReview ?? "",
    lastProjectMapping: existing?.lastProjectMapping ?? "",
    nextFollowUp: existing?.nextFollowUp ?? "",
    workflowStatus: existing?.workflowStatus ?? "Needs Review",
    internalNote: existing?.internalNote ?? "",
    lastDataRefresh: importedAt,
  };
}

function finding(id: string, device: CompassDevice, category: CompassCardSignal | string, severity: CompassFinding["severity"], title: string, explanation: string, valueCategory: CompassFinding["valueCategory"]): CompassFinding {
  return { id, clientId: device.clientId, deviceId: device.id, category, severity, title, explanation, scoreContribution: 0, valueCategory };
}

export function findingsForDevice(device: CompassDevice, config: CompassConfig, now = new Date()): CompassFinding[] {
  const findings: CompassFinding[] = [];
  const os = device.osName.toLowerCase();
  const isServer = device.deviceType === "physical-server" || device.deviceType === "virtual-server";
  const isWorkstation = device.deviceType === "physical-workstation" || device.deviceType === "virtual-workstation";
  const stale = isDeviceStale(device, config, now);
  const inactive = isDeviceInactive(device);
  const age = ageInYears(device.warrantyStart, now);
  const identifiable = modelIsIdentifiable(device.model);
  const expired = warrantyExpired(device.warrantyEnd, now);

  if (isServer && /server\s+2012(?:\s*r2)?/.test(os)) findings.push(finding(`${device.id}-server-2012`, device, "server-2012", "critical", "Windows Server 2012 requires immediate modernization", `${device.name} is running ${device.osName || "Windows Server 2012"}.`, "critical-server"));
  else if (isServer && /server\s+2016/.test(os)) findings.push(finding(`${device.id}-server-2016`, device, "server-2016", "planning", "Windows Server 2016 planning trigger", `${device.name} should enter server modernization planning.`, "server-planning"));
  else if (isServer && /server\s+(2000|2003|2008|2011)/.test(os)) findings.push(finding(`${device.id}-unsupported-server-os`, device, "unsupported-server-os", "critical", "Unsupported server operating system", `${device.name} is running ${device.osName}.`, "critical-server"));

  if (/windows\s+10/.test(os) && !stale && !inactive) {
    const classification = device.deviceType === "physical-workstation" ? "physical workstation" : device.deviceType === "virtual-workstation" ? "virtual workstation" : "server-like device requiring classification review";
    findings.push(finding(`${device.id}-windows-10-active`, device, "windows-10-active", "high", "Active Windows 10 device", `${device.name} is an active ${classification} running ${device.osName}.`, "windows-10"));
  }
  if (isWorkstation && /windows\s+11\s+home/.test(os) && !stale && !inactive) findings.push(finding(`${device.id}-windows-11-home`, device, "windows-11-home", "planning", "Windows 11 Home edition", `${device.name} is using a Home edition operating system.`, "workstation-lifecycle"));

  if (!device.isVirtual && device.deviceType === "physical-server" && identifiable && age !== null) {
    if (age >= config.thresholds.serverCriticalYears) findings.push(finding(`${device.id}-server-age-critical`, device, "server-age-critical", "critical", "Physical server is seven years or older", `${device.name} is ${age.toFixed(1)} years from its recorded warranty start.`, "critical-server"));
    else if (age >= config.thresholds.serverExpiredWarrantyCriticalYears && expired) findings.push(finding(`${device.id}-server-age-warranty-critical`, device, "server-age-warranty-critical", "critical", "Physical server is six-plus years old with expired warranty", `${device.name} is ${age.toFixed(1)} years old and its recorded warranty has expired.`, "critical-server"));
    else if (age >= config.thresholds.serverPlanningYears && age < config.thresholds.serverCriticalYears) findings.push(finding(`${device.id}-server-age-planning`, device, "server-age-planning", "planning", "Physical server lifecycle planning", `${device.name} is ${age.toFixed(1)} years from its recorded warranty start.`, "server-planning"));

    const months = futureMonths(device.warrantyEnd, now);
    if (device.lifecycle !== "replace-now" && age >= config.thresholds.serverWarrantyPlanningMinYears && months !== null && months >= 0 && months <= config.thresholds.warrantyPlanningMonths) {
      findings.push(finding(`${device.id}-server-warranty-upcoming`, device, "server-warranty-upcoming", "planning", "Server warranty expires within twelve months", `${device.name}'s warranty expires in approximately ${Math.max(0, Math.ceil(months))} months.`, "server-planning"));
    }
  }

  if (!device.isVirtual && device.deviceType === "physical-workstation" && identifiable && !stale && !inactive) {
    if (device.lifecycle === "replace-now") findings.push(finding(`${device.id}-replace-now`, device, "replace-now", "high", "Replace Now workstation", `${device.name} meets the configured replacement criteria.`, "workstation-lifecycle"));
    else if (device.lifecycle === "plan-soon") findings.push(finding(`${device.id}-plan-soon`, device, "plan-soon", "planning", "Plan Soon workstation", `${device.name} meets the configured planning criteria.`, "workstation-lifecycle"));
  }

  const criticalStorage = device.diskVolumes.some((volume) => volume.state === "critical");
  const watchStorage = !criticalStorage && device.diskVolumes.some((volume) => volume.state === "watch");
  if (criticalStorage) {
    findings.push(finding(`${device.id}-critical-storage`, device, "critical-storage", "high", "Critical storage capacity", `${device.name} has a non-utility volume meeting critical free-space and utilization criteria.`, "storage"));
    if (isServer) findings.push(finding(`${device.id}-critical-server-storage`, device, "critical-server-storage", "critical", "Critical server-storage condition", `${device.name} has a critical server volume that warrants immediate review.`, "critical-server"));
  } else if (watchStorage) findings.push(finding(`${device.id}-watch-storage`, device, "watch-storage", "watch", "Storage capacity needs attention", `${device.name} has a non-utility volume meeting watch-level free-space and utilization criteria.`, "storage"));

  const warrantyEnd = parseDate(device.warrantyEnd);
  if (!device.isVirtual && warrantyEnd && warrantyEnd.getTime() < now.getTime()) {
    if (device.deviceType === "physical-server") findings.push(finding(`${device.id}-expired-server-warranty`, device, "expired-server-warranty", "watch", "Expired physical-server warranty", `${device.name}'s recorded warranty has expired.`, "server-planning"));
    else if (device.deviceType === "physical-workstation" && !stale && !inactive) findings.push(finding(`${device.id}-expired-workstation-warranty`, device, "expired-workstation-warranty", "watch", "Expired physical-workstation warranty", `${device.name}'s recorded warranty has expired.`, "workstation-lifecycle"));
  }
  return findings;
}

function aggregateClientFindings(devices: CompassDevice[], findings: CompassFinding[], config: CompassConfig, now: Date): CompassFinding[] {
  const result = [...findings];
  const clientIds = [...new Set(devices.map((device) => device.clientId))];
  for (const clientId of clientIds) {
    const clientDevices = devices.filter((device) => device.clientId === clientId);
    const criticalIds = new Set(findings.filter((item) => item.clientId === clientId && ["server-2012", "unsupported-server-os", "server-age-critical", "server-age-warranty-critical", "critical-server-storage"].includes(item.category)).map((item) => item.deviceId));
    const olderServers = clientDevices.filter((device) => {
      if (device.deviceType !== "physical-server" || device.isVirtual || criticalIds.has(device.id) || !modelIsIdentifiable(device.model)) return false;
      const age = ageInYears(device.warrantyStart, now);
      return age !== null && age >= config.thresholds.serverPlanningYears;
    });
    if (olderServers.length >= 2) {
      for (const device of olderServers) result.push(finding(`${device.id}-server-consolidation`, device, "server-consolidation", "planning", "Older physical servers may be consolidated", `${olderServers.length} noncritical physical servers are at least ${config.thresholds.serverPlanningYears} years old.`, "server-planning"));
    }
  }
  return result;
}

function generateFindings(devices: CompassDevice[], config: CompassConfig, now: Date): CompassFinding[] {
  return assignScoreContributions(aggregateClientFindings(devices, devices.flatMap((device) => findingsForDevice(device, config, now)), config, now), config);
}

function count(findings: CompassFinding[], ...categories: string[]): number { return findings.filter((item) => categories.includes(item.category)).length; }
function capped(value: number, cap: number): number { return Math.min(value, cap); }
function firstAdditional(total: number, first: number, additional: number, cap: number): number { return total ? capped(first + Math.max(0, total - 1) * additional, cap) : 0; }

export function scoreClient(findings: CompassFinding[], config: CompassConfig): { score: number; tier: CompassClientSummary["priorityTier"]; topDrivers: string[]; contributions: Record<string, number> } {
  const contributions: Record<string, number> = {};
  const add = (label: string, value: number) => { if (value > 0) contributions[label] = value; };
  const s = config.score;
  const c2012 = count(findings, "server-2012", "unsupported-server-os");
  add(c2012 === 1 ? "1 critical unsupported server OS" : `${c2012} critical unsupported server OS instances`, firstAdditional(c2012, s.server2012First, s.server2012Additional, s.server2012Cap));
  const c2016 = count(findings, "server-2016");
  add(c2016 === 1 ? "1 Windows Server 2016 instance" : `${c2016} Windows Server 2016 instances`, firstAdditional(c2016, s.server2016First, s.server2016Additional, s.server2016Cap));
  const categories: Array<[string[], string, number, number]> = [
    [["server-age-planning", "server-warranty-upcoming"], "physical server lifecycle planning", s.serverAgePlanningEach, s.serverAgePlanningCap],
    [["server-age-critical", "server-age-warranty-critical"], "physical server beyond lifecycle", s.serverAgeCriticalEach, s.serverAgeCriticalCap],
    [["windows-10-active", "windows-10"], "Windows 10 devices", s.windows10Each, s.windows10Cap],
    [["windows-11-home"], "Windows 11 Home devices", s.windows11HomeEach, s.windows11HomeCap],
    [["replace-now"], "Replace Now workstations", s.replaceNowEach, s.replaceNowCap],
    [["plan-soon"], "Plan Soon workstations", s.planSoonEach, s.planSoonCap],
    [["critical-storage"], "critical-storage devices", s.criticalStorageEach, s.criticalStorageCap],
    [["watch-storage"], "watch-storage devices", s.watchStorageEach, s.watchStorageCap],
    [["expired-server-warranty"], "expired server warranties", s.expiredServerWarrantyEach, s.expiredServerWarrantyCap],
    [["expired-workstation-warranty"], "expired workstation warranties", s.expiredWorkstationWarrantyEach, s.expiredWorkstationWarrantyCap],
  ];
  for (const [signals, label, each, cap] of categories) {
    const total = count(findings, ...signals);
    add(`${total} ${label}`, capped(total * each, cap));
  }
  const ordered = Object.entries(contributions).sort((a, b) => b[1] - a[1]);
  const score = Math.min(100, Math.round(ordered.reduce((sum, [, value]) => sum + value, 0)));
  const tier = score >= 75 ? "Critical" : score >= 50 ? "High" : score >= 25 ? "Planning" : "Monitor";
  return { score, tier, topDrivers: ordered.slice(0, 3).map(([label]) => label), contributions };
}

export function assignScoreContributions(findings: CompassFinding[], config: CompassConfig): CompassFinding[] {
  const result = findings.map((item) => ({ ...item, scoreContribution: 0 }));
  const assignGroup = (categories: string[], first: number, additional: number, cap: number) => {
    const group = result.filter((item) => categories.includes(item.category));
    let remaining = cap;
    group.forEach((item, index) => {
      const desired = index === 0 ? first : additional;
      const contribution = Math.max(0, Math.min(desired, remaining));
      item.scoreContribution = contribution;
      remaining -= contribution;
    });
  };
  const assignEach = (categories: string[], each: number, cap: number) => {
    let remaining = cap;
    result.filter((item) => categories.includes(item.category)).forEach((item) => {
      const contribution = Math.max(0, Math.min(each, remaining));
      item.scoreContribution = contribution;
      remaining -= contribution;
    });
  };
  const s = config.score;
  assignGroup(["server-2012", "unsupported-server-os"], s.server2012First, s.server2012Additional, s.server2012Cap);
  assignGroup(["server-2016"], s.server2016First, s.server2016Additional, s.server2016Cap);
  assignEach(["server-age-planning", "server-warranty-upcoming"], s.serverAgePlanningEach, s.serverAgePlanningCap);
  assignEach(["server-age-critical", "server-age-warranty-critical"], s.serverAgeCriticalEach, s.serverAgeCriticalCap);
  assignEach(["windows-10-active", "windows-10"], s.windows10Each, s.windows10Cap);
  assignEach(["windows-11-home"], s.windows11HomeEach, s.windows11HomeCap);
  assignEach(["replace-now"], s.replaceNowEach, s.replaceNowCap);
  assignEach(["plan-soon"], s.planSoonEach, s.planSoonCap);
  assignEach(["critical-storage"], s.criticalStorageEach, s.criticalStorageCap);
  assignEach(["watch-storage"], s.watchStorageEach, s.watchStorageCap);
  assignEach(["expired-server-warranty"], s.expiredServerWarrantyEach, s.expiredServerWarrantyCap);
  assignEach(["expired-workstation-warranty"], s.expiredWorkstationWarrantyEach, s.expiredWorkstationWarrantyCap);
  return result;
}

function contingency(value: number, config: CompassConfig): number { return Math.round(value * (1 + config.value.planningContingencyPercent / 100)); }

function serverValue(devices: CompassDevice[], config: CompassConfig, manualFallback = false): { value: number; keys: string[] } {
  const physical = devices.filter((device) => device.deviceType === "physical-server").length;
  const virtual = devices.filter((device) => device.deviceType === "virtual-server").length;
  const baseValues = [...Array(physical)].map(() => config.value.standardServerReplacement).concat([...Array(virtual)].map(() => config.value.advancedServerMigration));
  if (!baseValues.length && manualFallback) baseValues.push(config.value.standardServerReplacement);
  const total = baseValues.reduce((sum, value, index) => sum + value * (index === 0 ? 1 : config.value.multiServerAdditionalMultiplier), 0);
  return { value: contingency(total, config), keys: ["standardServerReplacement", "advancedServerMigration", "multiServerAdditionalMultiplier", "planningContingencyPercent"] };
}

function workstationValue(devices: CompassDevice[], config: CompassConfig): { value: number; keys: string[] } {
  const physical = devices.filter((device) => device.deviceType === "physical-workstation").length;
  const virtual = devices.filter((device) => device.deviceType === "virtual-workstation").length;
  const total = physical * (config.value.standardWorkstationModernization + config.value.workstationDeploymentAllowance) + virtual * config.value.virtualOsRemediation;
  return { value: contingency(total, config), keys: ["standardWorkstationModernization", "workstationDeploymentAllowance", "virtualOsRemediation", "planningContingencyPercent"] };
}

function signalLabel(signal: CompassCardSignal): string {
  const labels: Record<CompassCardSignal, string> = {
    "server-2012": "Windows Server 2012 / 2012 R2",
    "unsupported-server-os": "server OS older than 2012",
    "server-age-critical": "physical server 7+ years old",
    "server-age-warranty-critical": "physical server 6+ with expired warranty",
    "critical-server-storage": "critical server storage",
    "server-2016": "Windows Server 2016",
    "server-age-planning": "physical server aged 5–6 years",
    "server-warranty-upcoming": "server warranty expiring within 12 months",
    "server-consolidation": "multiple older physical servers",
    "windows-10-active": "active Windows 10 devices",
    "windows-11-home": "Windows 11 Home devices",
    "replace-now": "Replace Now physical workstations",
    "plan-soon": "Plan Soon physical workstations",
    "critical-storage": "critical-storage devices",
    "watch-storage": "watch-storage devices",
    "expired-server-warranty": "expired server warranties",
    "expired-workstation-warranty": "expired workstation warranties",
  };
  return labels[signal];
}

function estimateForCard(card: CompassCardDefinition, ids: string[], devices: CompassDevice[], findings: CompassFinding[], config: CompassConfig, manual: boolean): { value: number; keys: string[] } {
  const affected = ids.map((id) => devices.find((device) => device.id === id)).filter((device): device is CompassDevice => Boolean(device));
  if (card.estimateMode === "server") return serverValue(affected, config, manual);
  if (card.estimateMode === "workstation") return workstationValue(affected, config);
  if (card.estimateMode === "storage") {
    const critical = findings.some((item) => ids.includes(item.deviceId) && item.category === "critical-storage");
    return { value: contingency(config.value.storageRemediation * (critical ? 1.25 : 1), config), keys: ["storageRemediation", "planningContingencyPercent"] };
  }
  if (card.estimateMode === "fixed") return { value: contingency(card.fixedEstimate, config), keys: ["customFixedEstimate", "planningContingencyPercent"] };
  return { value: 0, keys: [] };
}

function signalOpportunity(card: CompassCardDefinition, clientId: string, findings: CompassFinding[], devices: CompassDevice[], config: CompassConfig): CompassOpportunity | null {
  const enabledRules = card.rules.filter((rule) => rule.enabled);
  const excludedIds = new Set(findings.filter((item) => card.excludeSignals.includes(item.category as CompassCardSignal)).map((item) => item.deviceId));
  const matches = enabledRules.map((rule) => {
    const ids = [...new Set(findings.filter((item) => item.category === rule.signal && !excludedIds.has(item.deviceId)).map((item) => item.deviceId))];
    return { rule, ids, qualifies: ids.length >= Math.max(1, rule.minimumDevices) };
  });
  const manual = card.manualClientIds.includes(clientId);
  const rulesQualify = enabledRules.length > 0 && (card.matchMode === "all" ? matches.every((match) => match.qualifies) : matches.some((match) => match.qualifies));
  if (!rulesQualify && !manual) return null;
  const qualifyingMatches = card.matchMode === "all" ? matches : matches.filter((match) => match.qualifies);
  const ids = [...new Set(qualifyingMatches.flatMap((match) => match.ids))];
  const drivers = qualifyingMatches.map((match) => `${match.ids.length} ${signalLabel(match.rule.signal)}`);
  if (manual) drivers.unshift("Manually confirmed project need");
  const estimate = estimateForCard(card, ids, devices, findings, config, manual);
  return {
    clientId,
    cardCategory: card.id,
    affectedDeviceIds: ids,
    drivers: [...new Set(drivers)].slice(0, 6),
    estimatedValue: estimate.value,
    confidence: manual && !ids.length ? "low" : ids.length ? "medium" : "low",
    assumptionKeys: estimate.keys,
  };
}

function deduplicatedValueForOpportunities(clientId: string, opportunities: CompassOpportunity[], cards: CompassCardDefinition[], devices: CompassDevice[], locations: CompassLocation[], config: CompassConfig): number {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const serverIds = new Set<string>();
  const workstationIds = new Set<string>();
  let storage = false;
  let fixed = 0;
  let manualServer = false;
  for (const opportunity of opportunities) {
    const card = cardById.get(opportunity.cardCategory);
    if (!card) continue;
    if (card.estimateMode === "server") {
      opportunity.affectedDeviceIds.forEach((id) => serverIds.add(id));
      if (!opportunity.affectedDeviceIds.length && opportunity.drivers.some((driver) => /manually confirmed/i.test(driver))) manualServer = true;
    } else if (card.estimateMode === "workstation") opportunity.affectedDeviceIds.forEach((id) => workstationIds.add(id));
    else if (card.estimateMode === "storage") storage = true;
    else if (card.estimateMode === "fixed") fixed += opportunity.estimatedValue;
  }
  const serverEstimate = serverValue([...serverIds].map((id) => devices.find((device) => device.id === id)).filter((device): device is CompassDevice => Boolean(device)), config, manualServer).value;
  const workstationEstimate = workstationValue([...workstationIds].map((id) => devices.find((device) => device.id === id)).filter((device): device is CompassDevice => Boolean(device)), config).value;
  const storageEstimate = storage ? contingency(config.value.storageRemediation, config) : 0;
  const siteCount = new Set(locations.filter((location) => location.clientId === clientId).map((location) => location.id)).size;
  const multiSite = opportunities.length && siteCount > 1 ? config.value.multisiteAdjustment : 0;
  return Math.round(serverEstimate + workstationEstimate + storageEstimate + fixed + multiSite);
}

export function opportunitiesForClient(clientId: string, findings: CompassFinding[], devices: CompassDevice[], locations: CompassLocation[], config: CompassConfig): { opportunities: CompassOpportunity[]; totalEstimatedValue: number } {
  const cards = config.cards.filter((card) => card.enabled).sort((a, b) => a.order - b.order);
  const signalCards = cards.filter((card) => card.criteriaType === "signals");
  const opportunities = signalCards.flatMap((card) => {
    const opportunity = signalOpportunity(card, clientId, findings, devices, config);
    return opportunity ? [opportunity] : [];
  });
  const rollupCards = cards.filter((card) => card.criteriaType === "rollup");
  for (const card of rollupCards) {
    const sources = opportunities.filter((opportunity) => card.sourceCardIds.includes(opportunity.cardCategory));
    const manual = card.manualClientIds.includes(clientId);
    if (!sources.length && !manual) continue;
    const affectedDeviceIds = [...new Set(sources.flatMap((opportunity) => opportunity.affectedDeviceIds))];
    const value = card.estimateMode === "deduplicated" ? deduplicatedValueForOpportunities(clientId, sources, cards, devices, locations, config) : estimateForCard(card, affectedDeviceIds, devices, findings, config, manual).value;
    opportunities.push({
      clientId,
      cardCategory: card.id,
      affectedDeviceIds,
      drivers: manual && !sources.length ? ["Manually confirmed project need"] : sources.map((opportunity) => cards.find((source) => source.id === opportunity.cardCategory)?.title ?? opportunity.cardCategory),
      estimatedValue: value,
      confidence: manual && !sources.length ? "low" : "medium",
      assumptionKeys: ["deduplicatedOpportunityValue"],
    });
  }
  const primaryRollup = rollupCards.find((card) => card.id === "all") ?? rollupCards[0];
  const rollupOpportunity = primaryRollup ? opportunities.find((opportunity) => opportunity.cardCategory === primaryRollup.id) : null;
  const totalEstimatedValue = rollupOpportunity?.estimatedValue ?? deduplicatedValueForOpportunities(clientId, opportunities.filter((opportunity) => signalCards.some((card) => card.id === opportunity.cardCategory)), cards, devices, locations, config);
  return { opportunities, totalEstimatedValue };
}

function uniqueOrganizationNames(rows: RawCompassRow[]): string[] {
  const names = new Map<string, string>();
  for (const row of rows) {
    const name = clean(row.organization);
    const normalized = normalizeOrganizationName(name);
    if (normalized && !names.has(normalized)) names.set(normalized, name);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

function organizationResolution(resolutions: OrganizationResolutions, organization: string) {
  if (resolutions[organization]) return resolutions[organization];
  const normalized = normalizeOrganizationName(organization);
  const matchingKey = Object.keys(resolutions).find((key) => normalizeOrganizationName(key) === normalized);
  return matchingKey ? resolutions[matchingKey] : undefined;
}

function resolveClient(existing: CompassDataset | null, organization: string, resolutions: OrganizationResolutions): { id: string; name: string; aliases: string[] } | null {
  const resolution = organizationResolution(resolutions, organization);
  if (!resolution || resolution.mode === "unresolved") return null;
  if (resolution.mode === "existing") {
    const client = existing?.clients.find((item) => item.id === resolution.clientId);
    return client ? { id: client.id, name: client.name, aliases: [organization] } : null;
  }
  return { id: clientIdFor(organization), name: clean(organization), aliases: [] };
}

export function defaultOrganizationResolutions(parsed: ParsedCompassImport, existing: CompassDataset | null): OrganizationResolutions {
  const resolutions: OrganizationResolutions = {};
  const clients = existing?.clients ?? [];
  for (const organization of uniqueOrganizationNames(parsed.rows)) {
    const normalized = normalizeOrganizationName(organization);
    const matches = clients.filter((client) => normalizeOrganizationName(client.name) === normalized || client.aliases.some((alias) => normalizeOrganizationName(alias) === normalized));
    resolutions[organization] = matches.length === 1 ? { mode: "existing", clientId: matches[0].id } : { mode: "unresolved" };
  }
  return resolutions;
}

function calculateSummaries(clients: CompassClient[], devices: CompassDevice[], locations: CompassLocation[], findings: CompassFinding[], config: CompassConfig): CompassClientSummary[] {
  return clients.map((client) => {
    const clientFindings = findings.filter((item) => item.clientId === client.id);
    const score = scoreClient(clientFindings, config);
    const result = opportunitiesForClient(client.id, clientFindings, devices.filter((device) => device.clientId === client.id), locations, config);
    return { clientId: client.id, clientName: client.name, priorityScore: score.score, priorityTier: score.tier, topDrivers: score.topDrivers, totalEstimatedValue: result.totalEstimatedValue, opportunities: result.opportunities };
  });
}

export function buildImportPreview(parsed: ParsedCompassImport, existing: CompassDataset | null, resolutions: OrganizationResolutions, config: CompassConfig, now = new Date()): CompassImportPreview {
  const importedAt = now.toISOString();
  const organizations = uniqueOrganizationNames(parsed.rows);
  const unresolvedOrganizations = organizations.filter((organization) => !organizationResolution(resolutions, organization) || organizationResolution(resolutions, organization)?.mode === "unresolved");
  let matchedOrganizations = 0;
  let newOrganizations = 0;
  for (const organization of organizations) {
    const resolution = organizationResolution(resolutions, organization);
    if (resolution?.mode === "existing") matchedOrganizations += 1;
    if (resolution?.mode === "new") newOrganizations += 1;
  }
  const uniqueRows = deduplicateRawRows(parsed.rows);
  const previewDevices = uniqueRows.map((row) => {
    const classification = classifyDevice(row);
    return { row, classification, volumes: parseDiskVolumes(row.diskVolumeUsage, config, classification.deviceType) };
  });
  const osConcernCount = previewDevices.filter(({ row, classification }) => {
    const os = row.osName.toLowerCase();
    const isServer = classification.deviceType === "physical-server" || classification.deviceType === "virtual-server";
    return (isServer && /server\s+(2000|2003|2008|2011|2012|2016)/.test(os)) || /windows\s+10/.test(os) || /windows\s+11\s+home/.test(os);
  }).length;
  const storageConcernCount = previewDevices.filter(({ volumes }) => volumes.some((volume) => volume.state === "critical" || volume.state === "watch")).length;
  const baseSummary: CompassImportSummary = {
    totalRows: parsed.totalRows,
    organizationsDetected: organizations.length,
    matchedOrganizations,
    unmatchedOrganizations: unresolvedOrganizations.length,
    newOrganizations,
    devicesDetected: previewDevices.length,
    physicalServers: previewDevices.filter(({ classification }) => classification.deviceType === "physical-server").length,
    virtualMachines: previewDevices.filter(({ classification }) => classification.isVirtual).length,
    workstations: previewDevices.filter(({ classification }) => classification.deviceType === "physical-workstation" || classification.deviceType === "virtual-workstation").length,
    rejectedRows: parsed.rejectedRows,
    osConcerns: osConcernCount,
    storageConcerns: storageConcernCount,
  };
  if (unresolvedOrganizations.length) return { summary: baseSummary, organizations, unresolvedOrganizations, dataset: null };

  const existingById = new Map((existing?.clients ?? []).map((client) => [client.id, client]));
  const clientsById = new Map<string, CompassClient>();
  const locationsById = new Map<string, CompassLocation>();
  const devicesById = new Map<string, CompassDevice>();
  for (const row of uniqueRows) {
    if (!row.organization || !row.deviceName) continue;
    const target = resolveClient(existing, row.organization, resolutions);
    if (!target) continue;
    const existingClient = clientsById.get(target.id) ?? existingById.get(target.id);
    clientsById.set(target.id, manualClient(existingClient, target.id, target.name, target.aliases, importedAt));
    const locationName = clean(row.location) || "Main Location";
    const locationId = locationIdFor(target.id, locationName);
    locationsById.set(locationId, { id: locationId, clientId: target.id, name: locationName });
    const classification = classifyDevice(row);
    const stable = clean(row.stableId) || clean(row.deviceName);
    const deviceId = `${target.id}-device-${slug(stable)}`;
    const device: CompassDevice = {
      id: deviceId,
      clientId: target.id,
      locationId,
      name: clean(row.deviceName),
      organization: clean(row.organization),
      deviceType: classification.deviceType,
      isVirtual: classification.isVirtual,
      virtualizationPlatform: classification.virtualizationPlatform,
      model: clean(row.deviceModel),
      videoCard: clean(row.videoCard),
      osName: clean(row.osName),
      status: clean(row.deviceStatus),
      memoryGiB: Number.isFinite(Number(row.memoryGiB)) ? Number(row.memoryGiB) : null,
      diskVolumeSource: clean(row.diskVolumeUsage),
      diskVolumes: parseDiskVolumes(row.diskVolumeUsage, config, classification.deviceType),
      warrantyStart: isoDate(row.warrantyStart),
      warrantyEnd: isoDate(row.warrantyEnd),
      lastUptime: isoDate(row.lastUptime),
      lastLogin: isoDate(row.lastLogin),
      lifecycle: lifecycleFor(row, classification, config, now),
      source: parsed.sourceName,
    };
    devicesById.set(deviceId, device);
  }
  for (const existingClient of existing?.clients ?? []) {
    if (!clientsById.has(existingClient.id)) clientsById.set(existingClient.id, existingClient);
  }
  const devices = [...devicesById.values()];
  const locations = [...locationsById.values()];
  const clients = [...clientsById.values()];
  const findings = generateFindings(devices, config, now);
  const summaries = calculateSummaries(clients, devices, locations, findings, config);
  const summary: CompassImportSummary = {
    ...baseSummary,
    devicesDetected: devices.length,
    physicalServers: devices.filter((device) => device.deviceType === "physical-server").length,
    virtualMachines: devices.filter((device) => device.isVirtual).length,
    workstations: devices.filter((device) => device.deviceType === "physical-workstation" || device.deviceType === "virtual-workstation").length,
    osConcerns: findings.filter((item) => ["server-2012", "unsupported-server-os", "server-2016", "windows-10-active", "windows-11-home"].includes(item.category)).length,
    storageConcerns: findings.filter((item) => ["critical-storage", "watch-storage"].includes(item.category)).length,
  };
  return { summary, organizations, unresolvedOrganizations: [], dataset: { schemaVersion: 1, calculationVersion: COMPASS_CALCULATION_VERSION, clients, locations, devices, findings, summaries, importedAt, importSourceName: parsed.sourceName, importSummary: summary } };
}

const FALLBACK_CARD_TITLES: Array<[CompassCardCategory, string]> = [
  ["all", "Clients Needing Projects"],
  ["critical-server", "Critical Server Projects"],
  ["server-planning", "Server Planning"],
  ["windows-10", "Windows 10 Refresh"],
  ["workstation-lifecycle", "Workstation Lifecycle"],
  ["storage", "Storage Attention"],
];

export function cardMetrics(dataset: CompassDataset | null, config?: CompassConfig): CompassCardMetric[] {
  const cards = config?.cards.filter((card) => card.enabled).sort((a, b) => a.order - b.order) ?? FALLBACK_CARD_TITLES.map(([id, title], order) => ({ id, title, order }));
  if (!dataset) return cards.map((card) => ({ id: card.id, title: card.title, count: 0, affectedDeviceCount: 0, value: 0, clients: [] }));
  return cards.map((card) => {
    const qualifying = dataset.summaries.filter((summary) => summary.opportunities.some((opportunity) => opportunity.cardCategory === card.id));
    const clients = qualifying.map((summary) => {
      const opportunity = summary.opportunities.find((item) => item.cardCategory === card.id);
      return { clientId: summary.clientId, name: summary.clientName, driver: opportunity?.drivers.slice(0, 2).join(" · ") || "Current technical opportunity", estimate: opportunity?.estimatedValue ?? 0, score: summary.priorityScore, tier: summary.priorityTier };
    }).sort((a, b) => b.score - a.score || b.estimate - a.estimate);
    const affectedDeviceCount = new Set(qualifying.flatMap((summary) => summary.opportunities.filter((opportunity) => opportunity.cardCategory === card.id).flatMap((opportunity) => opportunity.affectedDeviceIds))).size;
    const value = clients.reduce((sum, client) => sum + client.estimate, 0);
    return { id: card.id, title: card.title, count: clients.length, affectedDeviceCount, value, clients };
  });
}

function normalizeLegacyVolume(volume: Partial<DiskVolumeCondition>, config: CompassConfig, deviceType: CompassDeviceType, index: number): DiskVolumeCondition {
  const usedPercent = typeof volume.usedPercent === "number" && Number.isFinite(volume.usedPercent) ? volume.usedPercent : null;
  const usedGb = typeof volume.usedGb === "number" && Number.isFinite(volume.usedGb) ? volume.usedGb : null;
  const totalGb = typeof volume.totalGb === "number" && Number.isFinite(volume.totalGb) ? volume.totalGb : null;
  const freeGb = typeof volume.freeGb === "number" && Number.isFinite(volume.freeGb) ? volume.freeGb : totalGb !== null && usedGb !== null ? Math.max(0, totalGb - usedGb) : null;
  return classifyVolume({ label: clean(volume.label ?? "") || `Volume ${index + 1}`, usedPercent, usedGb, totalGb, freeGb }, config, deviceType);
}

export function recalculateDataset(dataset: CompassDataset, config: CompassConfig, now = new Date()): CompassDataset {
  const devices = dataset.devices.map((source) => {
    const deviceType = source.deviceType ?? "unknown";
    const isVirtual = Boolean(source.isVirtual);
    const diskVolumeSource = typeof source.diskVolumeSource === "string" ? source.diskVolumeSource : "";
    const diskVolumes = diskVolumeSource
      ? parseDiskVolumes(diskVolumeSource, config, deviceType)
      : (Array.isArray(source.diskVolumes) ? source.diskVolumes : []).map((volume, index) => normalizeLegacyVolume(volume, config, deviceType, index));
    const device: CompassDevice = {
      ...source,
      deviceType,
      isVirtual,
      status: source.status ?? "",
      diskVolumeSource,
      diskVolumes,
      lifecycle: lifecycleFromValues(deviceType, isVirtual, source.model ?? "", source.warrantyStart ?? "", source.warrantyEnd ?? "", source.lastUptime ?? "", source.lastLogin ?? "", source.status ?? "", config, now),
    };
    return device;
  });
  const findings = generateFindings(devices, config, now);
  const summaries = calculateSummaries(dataset.clients, devices, dataset.locations, findings, config);
  const summary = {
    ...dataset.importSummary,
    devicesDetected: devices.length,
    physicalServers: devices.filter((device) => device.deviceType === "physical-server").length,
    virtualMachines: devices.filter((device) => device.isVirtual).length,
    workstations: devices.filter((device) => device.deviceType === "physical-workstation" || device.deviceType === "virtual-workstation").length,
    osConcerns: findings.filter((item) => ["server-2012", "unsupported-server-os", "server-2016", "windows-10-active", "windows-11-home"].includes(item.category)).length,
    storageConcerns: findings.filter((item) => ["critical-storage", "watch-storage"].includes(item.category)).length,
  };
  return { ...dataset, calculationVersion: COMPASS_CALCULATION_VERSION, devices, findings, summaries, importSummary: summary };
}
