export type TechnicalDeviceType = "physical-server" | "virtual-server" | "physical-workstation" | "virtual-workstation" | "network" | "unknown";
export type TechnicalLifecycle = "current" | "plan-soon" | "replace-now" | "unknown";
export type TechnicalReportLifecycle = "current" | "due-soon" | "overdue" | "unknown";
export type TechnicalOsSupport = "supported" | "ending-soon" | "unsupported" | "unknown";
export type TechnicalWarranty = "in-warranty" | "ending-soon" | "out-of-warranty" | "unknown";
export type TechnicalStorageState = "healthy" | "watch" | "critical" | "unknown";
export type TechnicalServerUrgency = "critical" | "planning" | "none";

export const TECHNICAL_TRUTH_VERSION = 1;

export interface TechnicalOsSignals {
  windows10: boolean;
  windows11Home: boolean;
  server2012: boolean;
  legacyServer: boolean;
  server2016: boolean;
}
export type TechnicalSourceKind = "ninja" | "compass" | "scalepad" | "rft" | "proposal" | "huntress" | "hipaa" | "review-outcome" | "supporting" | "unknown";

export interface TechnicalThresholds {
  workstationPlanSoonYears: number;
  workstationReplaceNowYears: number;
  workstationExpiredWarrantyReplaceYears: number;
  serverPlanningYears: number;
  serverCriticalYears: number;
  serverExpiredWarrantyCriticalYears: number;
  serverWarrantyPlanningMinYears: number;
  warrantyPlanningMonths: number;
  staleDeviceMonths: number;
  storageWatchPercent: number;
  storageCriticalPercent: number;
  storageSystemWatchFreeGb: number;
  storageSystemCriticalFreeGb: number;
  storageWatchFreeGb: number;
  storageCriticalFreeGb: number;
  storageMinimumVolumeGb: number;
}

export const DEFAULT_TECHNICAL_THRESHOLDS: TechnicalThresholds = {
  workstationPlanSoonYears: 5,
  workstationReplaceNowYears: 7,
  workstationExpiredWarrantyReplaceYears: 6,
  serverPlanningYears: 5,
  serverCriticalYears: 7,
  serverExpiredWarrantyCriticalYears: 6,
  serverWarrantyPlanningMinYears: 4,
  warrantyPlanningMonths: 12,
  staleDeviceMonths: 6,
  storageWatchPercent: 80,
  storageCriticalPercent: 90,
  storageSystemWatchFreeGb: 30,
  storageSystemCriticalFreeGb: 15,
  storageWatchFreeGb: 150,
  storageCriticalFreeGb: 100,
  storageMinimumVolumeGb: 8,
};

export interface TechnicalClassificationInput {
  name?: string;
  model?: string;
  graphics?: string;
  os?: string;
  role?: string;
  make?: string;
}

export interface TechnicalClassification {
  deviceType: TechnicalDeviceType;
  isVirtual: boolean;
  virtualizationPlatform: string;
  isServer: boolean;
}

export interface TechnicalLifecycleInput {
  deviceType: TechnicalDeviceType;
  isVirtual?: boolean;
  model?: string;
  warrantyStart?: string;
  warrantyEnd?: string;
  lastUptime?: string;
  lastLogin?: string;
  status?: string;
  ageYears?: number | null;
}

export interface TechnicalStorageVolume {
  label: string;
  usedPercent: number | null;
  usedGb: number | null;
  totalGb: number | null;
  freeGb: number | null;
  displayUnit?: "GB" | "TB";
  isSystem: boolean;
  state: TechnicalStorageState;
  excludedReason: string;
}

export interface TechnicalFieldSources {
  identity?: string;
  inventory?: string;
  classification?: string;
  os?: string;
  activity?: string;
  storage?: string;
  lifecycle?: string;
  warranty?: string;
}

export type TechnicalInventoryRecord = Record<string, unknown> & {
  name?: unknown;
  serial?: unknown;
  model?: unknown;
  age?: unknown;
  purchased?: unknown;
  warrantyExpires?: unknown;
  sourceDeviceId?: unknown;
  sourceDeviceName?: unknown;
  authoritative?: unknown;
  sourceName?: unknown;
  sourceDetails?: unknown;
};

export interface TechnicalInventoryMergeResult {
  inventory: TechnicalInventoryRecord[];
  enrichedDevices: number;
  unmatchedEnrichment: TechnicalInventoryRecord[];
  ambiguousEnrichment: TechnicalInventoryRecord[];
}

export function cleanTechnicalText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F-\u009F\uE000-\uF8FF\uFFFE\uFFFF]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTechnicalDeviceName(value: unknown): string {
  return cleanTechnicalText(value)
    .replace(/^(?:(?:Last)?Check-?In|WarrantyExpiry|WarrantyExpires|Expiry|Expires)+/i, "")
    .replace(/\s*([._-])\s*/g, "$1")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .trim();
}

export function normalizedTechnicalIdentity(value: unknown): string {
  return normalizeTechnicalDeviceName(value).toLowerCase();
}

export function parseTechnicalDate(value: unknown): Date | null {
  const text = cleanTechnicalText(value);
  if (!text) return null;
  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct;
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!match) return null;
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  const parsed = new Date(Date.UTC(year, Number(match[1]) - 1, Number(match[2])));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function technicalAgeYears(value: unknown, referenceDate = new Date()): number | null {
  const parsed = parseTechnicalDate(value);
  if (!parsed) return null;
  return Math.max(0, (referenceDate.getTime() - parsed.getTime()) / 31557600000);
}

export function technicalFutureMonths(value: unknown, referenceDate = new Date()): number | null {
  const parsed = parseTechnicalDate(value);
  if (!parsed) return null;
  return (parsed.getTime() - referenceDate.getTime()) / 2629800000;
}

export function technicalWarrantyExpired(value: unknown, referenceDate = new Date()): boolean {
  const parsed = parseTechnicalDate(value);
  return Boolean(parsed && parsed.getTime() < referenceDate.getTime());
}

export function classifyTechnicalWarranty(value: unknown, referenceDate = new Date(), planningMonths = DEFAULT_TECHNICAL_THRESHOLDS.warrantyPlanningMonths): TechnicalWarranty {
  const parsed = parseTechnicalDate(value);
  if (!parsed) return "unknown";
  const months = (parsed.getTime() - referenceDate.getTime()) / 2629800000;
  if (months < 0) return "out-of-warranty";
  if (months <= planningMonths) return "ending-soon";
  return "in-warranty";
}

export function detectTechnicalVirtualPlatform(value: unknown): string {
  const text = cleanTechnicalText(value).toLowerCase();
  if (/google compute engine|google cloud/.test(text)) return "Google Compute Engine";
  if (/amazon ec2|elastic compute cloud|hvm domu/.test(text)) return "Amazon EC2";
  if (/hyper-v|microsoft virtual|virtual machine/.test(text)) return "Microsoft Hyper-V";
  if (/vmware/.test(text)) return "VMware";
  if (/virtualbox/.test(text)) return "VirtualBox";
  if (/qemu|kvm|virtio|red hat qxl|bochs/.test(text)) return "QEMU/KVM";
  if (/xen/.test(text)) return "Xen";
  if (/parallels/.test(text)) return "Parallels";
  return "";
}

export function classifyTechnicalDevice(input: TechnicalClassificationInput): TechnicalClassification {
  const name = cleanTechnicalText(input.name);
  const model = cleanTechnicalText(input.model);
  const graphics = cleanTechnicalText(input.graphics);
  const os = cleanTechnicalText(input.os);
  const role = cleanTechnicalText(input.role);
  const make = cleanTechnicalText(input.make);
  const combined = [name, make, model, graphics, role, os].join(" ");
  const platform = detectTechnicalVirtualPlatform(combined);
  const isVirtual = Boolean(platform) || /virtual\s+(machine|server|desktop)|vmware|virtualbox|qemu|kvm|xen|virtio|parallels|google compute engine|amazon ec2|hvm domu|red hat qxl|bochs/i.test(combined);
  const serverOs = /windows\s+server|(?:^|\s)server\s+20\d\d|server\s+200\d|ubuntu\s+server|red hat enterprise linux|centos\s+server/i.test(os);
  const serverHardware = /poweredge|proliant|thinksystem|rack\s*server|tower\s*server|\bserver\b/i.test(`${model} ${role}`);
  const serverName = /(?:^|[-_])(server|srv|dc)(?:[-_]?\d+)?(?:$|[-_])/i.test(name) || /domain controller/i.test(name);
  const isServer = serverOs || serverHardware || serverName;
  const network = /network|switch|wireless|access point|firewall|router|gateway/i.test(role);
  const workstationOs = /windows|mac\s*os|macos|chrome\s*os|ubuntu|linux/i.test(os);
  const workstationHardware = /optiplex|latitude|precision|prodesk|elitedesk|thinkcentre|thinkpad|desktop|laptop|workstation|macbook|imac|surface/i.test(model);
  const workstationName = /(?:^|[-_])(front|op|hyg|office|reception|doctor|laptop|desktop|pc)(?:$|[-_]?\d+)/i.test(name);
  if (network) return { deviceType: "network", isVirtual: false, virtualizationPlatform: "", isServer: false };
  if (isServer && isVirtual) return { deviceType: "virtual-server", isVirtual: true, virtualizationPlatform: platform || "Virtual machine", isServer: true };
  if (isServer) return { deviceType: "physical-server", isVirtual: false, virtualizationPlatform: "", isServer: true };
  if (isVirtual) return { deviceType: "virtual-workstation", isVirtual: true, virtualizationPlatform: platform || "Virtual machine", isServer: false };
  if (workstationOs || workstationHardware || workstationName || /workstation/i.test(role)) return { deviceType: "physical-workstation", isVirtual: false, virtualizationPlatform: "", isServer: false };
  return { deviceType: "unknown", isVirtual: false, virtualizationPlatform: "", isServer: false };
}

export function isTechnicalModelIdentifiable(value: unknown): boolean {
  const model = cleanTechnicalText(value).toLowerCase();
  return Boolean(model)
    && !/^(unknown|n\/a|na|none|default string|system product name|to be filled by o\.e\.m\.?|not reported|not included)$/.test(model)
    && !/virtual machine/.test(model);
}

export function isTechnicalInactive(value: unknown): boolean {
  const status = cleanTechnicalText(value).toLowerCase();
  if (!status) return false;
  return /inactive|disabled|archived|retired|decommissioned|deactivated/.test(status) || /^(false|no|0)$/.test(status);
}

export function technicalActivityDate(lastUptime: unknown, lastLogin: unknown): Date | null {
  const values = [parseTechnicalDate(lastUptime), parseTechnicalDate(lastLogin)].filter((date): date is Date => Boolean(date));
  return values.length ? new Date(Math.max(...values.map((date) => date.getTime()))) : null;
}

export function isTechnicalStale(lastUptime: unknown, lastLogin: unknown, referenceDate = new Date(), staleMonths = DEFAULT_TECHNICAL_THRESHOLDS.staleDeviceMonths): boolean {
  const latest = technicalActivityDate(lastUptime, lastLogin);
  if (!latest) return false;
  return referenceDate.getTime() - latest.getTime() >= staleMonths * 2629800000;
}

export function technicalOsSignals(os: unknown): TechnicalOsSignals {
  const value = cleanTechnicalText(os);
  return {
    windows10: /\bWindows\s*10\b/i.test(value),
    windows11Home: /\bWindows\s*11\b/i.test(value)
      && /\bHome\b/i.test(value)
      && !/\b(?:Pro|Professional|Enterprise|Education)\b/i.test(value),
    server2012: /\b(?:Windows\s+)?Server\s*2012(?:\s*R2)?\b/i.test(value),
    legacyServer: /\b(?:Windows\s+)?Server\s*(?:2000|2003|2008|2011)\b/i.test(value),
    server2016: /\b(?:Windows\s+)?Server\s*2016\b/i.test(value),
  };
}

export function classifyTechnicalOsSupport(os: unknown): TechnicalOsSupport {
  const value = cleanTechnicalText(os);
  if (!value) return "unknown";
  const signals = technicalOsSignals(value);
  if (signals.windows10 || signals.server2012 || signals.legacyServer) return "unsupported";
  if (signals.server2016 || signals.windows11Home) return "ending-soon";
  return "supported";
}

export function classifyTechnicalLifecycle(input: TechnicalLifecycleInput, thresholds: TechnicalThresholds = DEFAULT_TECHNICAL_THRESHOLDS, referenceDate = new Date()): TechnicalLifecycle {
  const isVirtual = Boolean(input.isVirtual) || input.deviceType === "virtual-server" || input.deviceType === "virtual-workstation";
  if (isVirtual || input.deviceType === "network" || input.deviceType === "unknown" || !isTechnicalModelIdentifiable(input.model)) return "unknown";
  const age = typeof input.ageYears === "number" && Number.isFinite(input.ageYears) && input.ageYears > 0
    ? input.ageYears
    : technicalAgeYears(input.warrantyStart, referenceDate);
  if (age === null || age <= 0) return "unknown";
  if (input.deviceType === "physical-server") {
    if (age >= thresholds.serverCriticalYears || (age >= thresholds.serverExpiredWarrantyCriticalYears && technicalWarrantyExpired(input.warrantyEnd, referenceDate))) return "replace-now";
    const months = technicalFutureMonths(input.warrantyEnd, referenceDate);
    if (age >= thresholds.serverPlanningYears || (age >= thresholds.serverWarrantyPlanningMinYears && months !== null && months >= 0 && months <= thresholds.warrantyPlanningMonths)) return "plan-soon";
    return "current";
  }
  if (input.deviceType !== "physical-workstation") return "unknown";
  if (isTechnicalInactive(input.status) || isTechnicalStale(input.lastUptime, input.lastLogin, referenceDate, thresholds.staleDeviceMonths)) return "unknown";
  if (age >= thresholds.workstationReplaceNowYears || (age >= thresholds.workstationExpiredWarrantyReplaceYears && technicalWarrantyExpired(input.warrantyEnd, referenceDate))) return "replace-now";
  const months = technicalFutureMonths(input.warrantyEnd, referenceDate);
  if (age >= thresholds.workstationPlanSoonYears || (age >= 4 && months !== null && months >= 0 && months <= thresholds.warrantyPlanningMonths)) return "plan-soon";
  return "current";
}

export function technicalLifecycleToReport(value: TechnicalLifecycle): TechnicalReportLifecycle {
  if (value === "replace-now") return "overdue";
  if (value === "plan-soon") return "due-soon";
  return value;
}

export function reportLifecycleToTechnical(value: TechnicalReportLifecycle): TechnicalLifecycle {
  if (value === "overdue") return "replace-now";
  if (value === "due-soon") return "plan-soon";
  return value;
}

function storageUnitToGb(value: number, unit: string): number {
  return /t/i.test(unit) ? value * 1024 : value;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function storageLabel(value: string, fallback: string): string {
  const label = value.trim().replace(/^Name:\s*/i, "").replace(/^['\"]|['\"]$/g, "");
  if (!label) return fallback;
  if (/^[A-Za-z]$/.test(label)) return `${label.toUpperCase()}:`;
  return label.length <= 32 ? label : label.slice(0, 32);
}

export function classifyTechnicalStorageVolume(
  base: Omit<TechnicalStorageVolume, "state" | "excludedReason" | "isSystem">,
  thresholds: TechnicalThresholds,
  deviceType: TechnicalDeviceType,
): TechnicalStorageVolume {
  const normalizedLabel = base.label.toLowerCase().replace(/\s+/g, " ").trim();
  const isSystem = /^(c:|\/|system|system drive)$/.test(normalizedLabel);
  const excludedByName = /recovery|restore|efi|reserved|system reserved|oem|diagnostic|utility|winre|boot/i.test(normalizedLabel);
  const excludedBySize = base.totalGb !== null && base.totalGb > 0 && base.totalGb < thresholds.storageMinimumVolumeGb;
  const excludedReason = excludedByName ? "Recovery or utility partition" : excludedBySize ? `Volume smaller than ${thresholds.storageMinimumVolumeGb} GB` : "";
  if (excludedReason) return { ...base, isSystem, state: "unknown", excludedReason };

  const used = base.usedPercent;
  const free = base.freeGb;
  const isServer = deviceType === "physical-server" || deviceType === "virtual-server";
  const isWorkstation = deviceType === "physical-workstation" || deviceType === "virtual-workstation";
  let state: TechnicalStorageState = "healthy";
  const criticalSystemFree = isSystem && free !== null && free < thresholds.storageSystemCriticalFreeGb;
  const criticalBalanced = used !== null && used >= thresholds.storageCriticalPercent && free !== null && free < thresholds.storageCriticalFreeGb;
  const criticalServerPercentOnly = isServer && used !== null && used >= Math.max(95, thresholds.storageCriticalPercent) && free === null;
  const criticalPercentOnly = used !== null && used >= Math.max(97, thresholds.storageCriticalPercent + 5) && free === null;
  if (criticalSystemFree || criticalBalanced || criticalServerPercentOnly || criticalPercentOnly) state = "critical";
  else {
    const watchSystemFree = isSystem && isWorkstation && free !== null && free < thresholds.storageSystemWatchFreeGb;
    const watchBalanced = used !== null && used >= thresholds.storageWatchPercent && free !== null && free < thresholds.storageWatchFreeGb;
    const watchServer = isServer && used !== null && used >= thresholds.storageWatchPercent && (free === null || free < thresholds.storageWatchFreeGb);
    const watchPercentOnly = used !== null && used >= Math.max(90, thresholds.storageWatchPercent + 8) && free === null;
    if (watchSystemFree || watchBalanced || watchServer || watchPercentOnly) state = "watch";
    else if (used === null && free === null) state = "unknown";
  }
  return { ...base, isSystem, state, excludedReason: "" };
}

export function parseTechnicalStorageVolumes(value: unknown, thresholds: TechnicalThresholds = DEFAULT_TECHNICAL_THRESHOLDS, deviceType: TechnicalDeviceType = "unknown"): TechnicalStorageVolume[] {
  const text = String(value ?? "").replace(/\r?\n/g, ", ").trim();
  if (!text) return [];
  const parsed: Array<Omit<TechnicalStorageVolume, "state" | "excludedReason" | "isSystem">> = [];

  const scalePadPattern = /Name:\s*"?([^"/]+?)"?\s*\/(?:.*?\/)?\s*Capacity:\s*"?[^"/]*?\((\d+(?:\.\d+)?)\s*(TiB|GiB|TB|GB)\)"?\s*\/.*?Usage\s*%:\s*"?(\d+(?:\.\d+)?)%/gi;
  for (const match of text.matchAll(scalePadPattern)) {
    const totalGb = storageUnitToGb(Number(match[2]), match[3]);
    const usedPercent = Number(match[4]);
    const usedGb = totalGb * usedPercent / 100;
    parsed.push({ label: storageLabel(match[1], `Volume ${parsed.length + 1}`), usedPercent: roundOne(usedPercent), usedGb: roundOne(usedGb), totalGb: roundOne(totalGb), freeGb: roundOne(Math.max(0, totalGb - usedGb)), displayUnit: /t/i.test(match[3]) ? "TB" : "GB" });
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
      parsed.push({ label: storageLabel(match[1] || "", `Volume ${parsed.length + 1}`), usedPercent: roundOne(usedPercent), usedGb: roundOne(usedGb), totalGb: roundOne(totalGb), freeGb: roundOne(Math.max(0, totalGb - usedGb)), displayUnit: /t/i.test(totalUnit) ? "TB" : "GB" });
    }
  }

  if (!parsed.length) {
    const percentPattern = /(?:^|[,;|]\s*)\s*([A-Za-z]:|\/|[A-Za-z][A-Za-z0-9 _-]{1,30}:)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:used)?(?:\s*[,;|·-]\s*(\d+(?:\.\d+)?)\s*(TiB|GiB|TB|GB)\s*free)?/gi;
    for (const match of text.matchAll(percentPattern)) {
      parsed.push({ label: storageLabel(match[1] || "", `Volume ${parsed.length + 1}`), usedPercent: roundOne(Number(match[2])), usedGb: null, totalGb: null, freeGb: match[3] ? roundOne(storageUnitToGb(Number(match[3]), match[4])) : null, displayUnit: match[4] && /t/i.test(match[4]) ? "TB" : "GB" });
    }
  }

  return parsed.map((volume) => classifyTechnicalStorageVolume(volume, thresholds, deviceType));
}

export interface TechnicalStorageSummary {
  summary: string;
  percent: number;
  freeGb: number;
  volumes: TechnicalStorageVolume[];
}

function compactTechnicalStorageNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function technicalStorageDisplayLabel(value: string): string {
  const label = cleanTechnicalText(value) || "Disk";
  if (/^[A-Za-z]:$/.test(label)) return label.toUpperCase();
  return `${label.replace(/:$/, "").toUpperCase()}:`;
}

export function technicalStorageSummary(
  value: unknown,
  thresholds: TechnicalThresholds = DEFAULT_TECHNICAL_THRESHOLDS,
  deviceType: TechnicalDeviceType = "unknown",
): TechnicalStorageSummary {
  const raw = cleanTechnicalText(value);
  if (!raw) return { summary: "", percent: 0, freeGb: 0, volumes: [] };
  const volumes = parseTechnicalStorageVolumes(value, thresholds, deviceType);
  const displayable = volumes.filter((volume) => volume.usedPercent !== null && volume.totalGb !== null && volume.totalGb > 0);
  if (displayable.length) {
    const summary = displayable.map((volume) => {
      const totalGb = volume.totalGb ?? 0;
      const usedGb = volume.usedGb ?? totalGb * ((volume.usedPercent ?? 0) / 100);
      const displayAsTb = volume.displayUnit === "TB";
      const displayUsed = displayAsTb ? usedGb / 1024 : usedGb;
      const displayTotal = displayAsTb ? totalGb / 1024 : totalGb;
      const unit = displayAsTb ? "TB" : "GB";
      return `${technicalStorageDisplayLabel(volume.label)} ${compactTechnicalStorageNumber(displayUsed)} / ${compactTechnicalStorageNumber(displayTotal)} ${unit} (${compactTechnicalStorageNumber(volume.usedPercent ?? 0)}%)`;
    }).join(" · ");
    const maxPercent = Math.max(...displayable.map((volume) => volume.usedPercent ?? 0));
    const systemVolume = displayable.find((volume) => volume.isSystem || technicalStorageDisplayLabel(volume.label) === "C:") ?? displayable[0];
    return { summary, percent: maxPercent, freeGb: systemVolume.freeGb ?? 0, volumes };
  }
  const percentages = [...raw.matchAll(/(\d+(?:\.\d+)?)%/g)].map((match) => Number(match[1])).filter(Number.isFinite);
  const percent = percentages.length ? Math.max(...percentages) : 0;
  if (percent <= 0) return { summary: "", percent: 0, freeGb: 0, volumes };
  return {
    summary: raw.length > 120 ? `${raw.slice(0, 117).trim()}…` : raw,
    percent,
    freeGb: 0,
    volumes,
  };
}

export function classifyTechnicalStorage(input: { storageUsage?: unknown; storagePercent?: unknown; storageFreeGb?: unknown }, thresholds: TechnicalThresholds = DEFAULT_TECHNICAL_THRESHOLDS, deviceType: TechnicalDeviceType = "unknown"): TechnicalStorageState {
  const parsedVolumes = parseTechnicalStorageVolumes(input.storageUsage, thresholds, deviceType).filter((volume) => !volume.excludedReason);
  if (parsedVolumes.some((volume) => volume.state === "critical")) return "critical";
  if (parsedVolumes.some((volume) => volume.state === "watch")) return "watch";
  if (parsedVolumes.some((volume) => volume.state === "healthy")) return "healthy";

  const explicit = Number(input.storagePercent);
  const percentages = [...String(input.storageUsage ?? "").matchAll(/(\d+(?:\.\d+)?)%/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  const percent = Number.isFinite(explicit) && explicit > 0 ? explicit : percentages.length ? Math.max(...percentages) : 0;
  const freeGb = Number(input.storageFreeGb);
  const hasUsage = Boolean(String(input.storageUsage ?? "").trim()) || percent > 0;
  if (!hasUsage) return "unknown";
  const freeKnown = Number.isFinite(freeGb) && freeGb > 0;
  const isServer = deviceType === "physical-server" || deviceType === "virtual-server";
  const critical = percent >= thresholds.storageCriticalPercent && (!freeKnown || freeGb < thresholds.storageCriticalFreeGb);
  const watch = percent >= thresholds.storageWatchPercent && (!freeKnown || freeGb < thresholds.storageWatchFreeGb);
  if (critical || (freeKnown && freeGb < thresholds.storageSystemCriticalFreeGb)) return "critical";
  if (watch || (isServer && percent >= thresholds.storageWatchPercent)) return "watch";
  return "healthy";
}

export function classifyTechnicalServerUrgency(input: { deviceType: TechnicalDeviceType; os?: unknown; lifecycle?: TechnicalLifecycle; storage?: TechnicalStorageState }): TechnicalServerUrgency {
  if (input.deviceType !== "physical-server" && input.deviceType !== "virtual-server") return "none";
  const os = classifyTechnicalOsSupport(input.os);
  if (os === "unsupported" || input.lifecycle === "replace-now" || input.storage === "critical") return "critical";
  if (os === "ending-soon" || input.lifecycle === "plan-soon") return "planning";
  return "none";
}

export function technicalSourceLabel(kind: TechnicalSourceKind): string {
  const labels: Record<TechnicalSourceKind, string> = {
    ninja: "Ninja",
    compass: "Ninja / Client Compass",
    scalepad: "ScalePad lifecycle",
    rft: "RFT assessment",
    proposal: "Existing proposal",
    huntress: "Huntress",
    hipaa: "HIPAA review",
    "review-outcome": "Review Outcome",
    supporting: "Supporting source",
    unknown: "Source not identified",
  };
  return labels[kind];
}

export function technicalSourcePriority(projectType: string, sourceType: string, mimeType = "", fileName = ""): number {
  const compassSnapshot = mimeType === "application/x-client-compass-snapshot" || /client compass.*snapshot/i.test(fileName);
  if (projectType === "client-report") {
    if (compassSnapshot) return 1000;
    if (sourceType === "scalepad" && /\.(?:csv|tsv|xlsx|xls|xlsm|xlsb)$/i.test(fileName)) return 800;
    if (sourceType === "scalepad") return 700;
    if (sourceType === "huntress") return 600;
    if (sourceType === "rft") return 500;
    return 100;
  }
  if (projectType === "prospect-proposal" || projectType === "legacy-modernization") {
    if (sourceType === "rft") return 1000;
    if (sourceType === "tc-notes") return 650;
    if (sourceType === "supporting-document" || sourceType === "generic-pdf") return 500;
    if (sourceType === "legacy-proposal") return 300;
    return 100;
  }
  return sourceType === "rft" ? 900 : sourceType === "legacy-proposal" ? 300 : 100;
}

export function isTechnicalFactKey(key: string): boolean {
  return /^(?:scalepad\.|compass\.|environment\.(?:totalComputers|servers|workstations|operatingSystems)|security\.(?:firewallDisabled|firewallDisabledDevices)|patching\.|backup\.|applications\.|network\.cidrs)/.test(key);
}

function validInventoryDate(value: unknown): boolean {
  const parsed = parseTechnicalDate(value);
  return Boolean(parsed && parsed.getUTCFullYear() >= 2000);
}

function validLifecycleAge(value: unknown): boolean {
  const age = Number(value);
  return Number.isFinite(age) && age > 0 && age < 30;
}

function genericInventoryValue(value: unknown): boolean {
  return !cleanTechnicalText(value) || /^(?:unknown|not reported|system product name|to be filled by o\.e\.m\.)$/i.test(cleanTechnicalText(value));
}

function sourceDetails(value: unknown): TechnicalFieldSources {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as TechnicalFieldSources) };
}

function inventoryMatches(base: TechnicalInventoryRecord, candidates: TechnicalInventoryRecord[]): TechnicalInventoryRecord[] {
  const baseStableId = cleanTechnicalText(base.sourceDeviceId);
  if (baseStableId) {
    const stable = candidates.filter((candidate) => cleanTechnicalText(candidate.sourceDeviceId) === baseStableId);
    if (stable.length) return stable;
  }
  const baseSerial = normalizedTechnicalIdentity(base.serial);
  if (baseSerial) {
    const serial = candidates.filter((candidate) => normalizedTechnicalIdentity(candidate.serial) === baseSerial);
    if (serial.length) return serial;
  }
  const baseName = normalizedTechnicalIdentity(base.sourceDeviceName ?? base.name);
  const exact = candidates.filter((candidate) => normalizedTechnicalIdentity(candidate.sourceDeviceName ?? candidate.name) === baseName);
  if (exact.length) return exact;
  if (baseName.length >= 6) {
    const contained = candidates.filter((candidate) => {
      const candidateName = normalizedTechnicalIdentity(candidate.sourceDeviceName ?? candidate.name);
      return candidateName.length >= 6 && (candidateName.includes(baseName) || baseName.includes(candidateName));
    });
    if (contained.length) return contained;
  }
  const baseModel = normalizedTechnicalIdentity(base.model);
  if (baseModel.length >= 8 && !genericInventoryValue(base.model)) {
    const model = candidates.filter((candidate) => normalizedTechnicalIdentity(candidate.model) === baseModel);
    if (model.length) return model;
  }
  return [];
}

export function mergeTechnicalInventory(
  authoritativeInventory: TechnicalInventoryRecord[],
  enrichmentGroups: Array<{ label: string; inventory: TechnicalInventoryRecord[] }>,
): TechnicalInventoryMergeResult {
  const matched = new Set<TechnicalInventoryRecord>();
  const ambiguous = new Set<TechnicalInventoryRecord>();
  let enrichedDevices = 0;
  const inventory = authoritativeInventory.map((base) => {
    let merged = { ...base, sourceDetails: sourceDetails(base.sourceDetails) };
    let deviceChanged = false;
    for (const group of enrichmentGroups) {
      const available = group.inventory.filter((candidate) => !matched.has(candidate) && !ambiguous.has(candidate));
      const matches = inventoryMatches(merged, available);
      if (matches.length !== 1) {
        if (matches.length > 1) matches.forEach((item) => ambiguous.add(item));
        continue;
      }
      const enrichment = matches[0];
      matched.add(enrichment);
      let lifecycleChanged = false;
      let warrantyChanged = false;
      if (validLifecycleAge(enrichment.age)) {
        merged.age = Number(enrichment.age);
        lifecycleChanged = true;
      }
      if (validInventoryDate(enrichment.purchased)) {
        merged.purchased = enrichment.purchased;
        lifecycleChanged = true;
      }
      if (validInventoryDate(enrichment.warrantyExpires)) {
        merged.warrantyExpires = enrichment.warrantyExpires;
        warrantyChanged = true;
      }
      if (lifecycleChanged || warrantyChanged) {
        const details = sourceDetails(merged.sourceDetails);
        merged.sourceDetails = {
          ...details,
          ...(lifecycleChanged ? { lifecycle: group.label } : {}),
          ...(warrantyChanged ? { warranty: group.label } : {}),
        };
        deviceChanged = true;
      }
    }
    if (deviceChanged) enrichedDevices += 1;
    return merged;
  });
  const allEnrichment = enrichmentGroups.flatMap((group) => group.inventory);
  return {
    inventory,
    enrichedDevices,
    unmatchedEnrichment: allEnrichment.filter((item) => !matched.has(item) && !ambiguous.has(item)),
    ambiguousEnrichment: [...ambiguous],
  };
}
