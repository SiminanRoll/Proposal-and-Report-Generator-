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
import {
  classifyTechnicalDevice,
  classifyTechnicalLifecycle,
  classifyTechnicalStorageVolume,
  isTechnicalInactive,
  isTechnicalModelIdentifiable,
  isTechnicalStale,
  parseTechnicalDate,
  parseTechnicalStorageVolumes,
  technicalAgeYears,
  technicalFutureMonths,
  technicalOsSignals,
  technicalWarrantyExpired,
} from "../technical-truth";

export const COMPASS_CALCULATION_VERSION = 5;

function emptyReviewOutcome(): CompassClient["reviewOutcome"] {
  return {
    status: "not-reviewed",
    reviewedAt: "",
    meetingSummary: "",
    agreedNextStep: "",
    reportTitle: "",
    executiveSummary: "",
    presentationConcerns: [],
    clientConcern: "",
    items: [],
    lastUpdatedAt: "",
  };
}

export function compassConfigFingerprint(config: CompassConfig): string {
  const payload = JSON.stringify({
    score: config.score,
    value: config.value,
    thresholds: config.thresholds,
    coverage: { minimumWorkstations: config.coverage?.minimumWorkstations ?? 5 },
    cards: config.cards.map((card) => ({
      id: card.id,
      enabled: card.enabled,
      order: card.order,
      criteriaType: card.criteriaType,
      workflowRule: card.workflowRule,
      workflowMonths: card.workflowMonths,
      matchMode: card.matchMode,
      rules: card.rules.map((rule) => ({ signal: rule.signal, minimumDevices: rule.minimumDevices, enabled: rule.enabled })),
      sourceCardIds: card.sourceCardIds,
      excludeSignals: card.excludeSignals,
      estimateMode: card.estimateMode,
      fixedEstimate: card.fixedEstimate,
      manualClientIds: [...card.manualClientIds].sort(),
    })),
  });
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `cfg-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function normalizeOrganizationName(value: string): string {
  return value.trim().toLowerCase().replace(/[.,'’`]/g, "").replace(/&/g, "and").replace(/\s*[-–—]\s*/g, "-").replace(/\s+/g, " ");
}

function slug(value: string): string {
  const normalized = normalizeOrganizationName(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || "unknown";
}

function clean(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F-\u009F\uE000-\uF8FF\uFFFE\uFFFF]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*([._-])\s*/g, "$1")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .trim();
}

function cleanOrganizationDisplay(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F-\u009F\uE000-\uF8FF\uFFFE\uFFFF]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedDeviceIdentity(value: string): string {
  return clean(value).toLowerCase();
}

function shortIdentityHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 8);
}

function parseDate(value: string): Date | null {
  return parseTechnicalDate(value);
}

function isoDate(value: string): string {
  const parsed = parseDate(value);
  return parsed ? parsed.toISOString() : "";
}

function ageInYears(value: string, now: Date): number | null {
  return technicalAgeYears(value, now);
}

function futureMonths(value: string, now: Date): number | null {
  return technicalFutureMonths(value, now);
}

export function classifyDevice(row: Pick<RawCompassRow, "deviceName" | "deviceModel" | "videoCard" | "osName">): { deviceType: CompassDeviceType; isVirtual: boolean; virtualizationPlatform: string } {
  const classification = classifyTechnicalDevice({
    name: row.deviceName,
    model: row.deviceModel,
    graphics: row.videoCard,
    os: row.osName,
  });
  const deviceType: CompassDeviceType = classification.deviceType === "network" ? "unknown" : classification.deviceType;
  return { deviceType, isVirtual: classification.isVirtual, virtualizationPlatform: classification.virtualizationPlatform };
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

const RAW_DEVICE_IDENTITY_FIELDS: Array<keyof Pick<RawCompassRow, "location" | "deviceModel" | "osName" | "warrantyStart" | "warrantyEnd" | "videoCard" | "memoryGiB" | "lastLogin">> = [
  "location",
  "deviceModel",
  "osName",
  "warrantyStart",
  "warrantyEnd",
  "videoCard",
  "memoryGiB",
  "lastLogin",
];

function rawRowsCompatible(first: RawCompassRow, second: RawCompassRow): boolean {
  const firstStable = normalizedDeviceIdentity(first.stableId);
  const secondStable = normalizedDeviceIdentity(second.stableId);
  let comparable = 0;
  for (const field of RAW_DEVICE_IDENTITY_FIELDS) {
    const firstValue = normalizedDeviceIdentity(first[field]);
    const secondValue = normalizedDeviceIdentity(second[field]);
    if (!firstValue || !secondValue) continue;
    comparable += 1;
    if (firstValue !== secondValue) return false;
  }
  if (firstStable && secondStable && firstStable !== secondStable) return comparable >= 3;
  return true;
}

function mergeCompatibleRawRows(first: RawCompassRow, second: RawCompassRow): RawCompassRow {
  const preferred = preferredRawRow(first, second);
  return { ...preferred, stableId: clean(first.stableId) || clean(second.stableId) };
}

function rawRowFallbackIdentity(row: RawCompassRow): string {
  const details = RAW_DEVICE_IDENTITY_FIELDS.map((field) => normalizedDeviceIdentity(row[field])).join("|");
  return `${normalizedDeviceIdentity(row.deviceName)}::${shortIdentityHash(details || `row:${row.rowNumber}`)}`;
}

export function deduplicateRawRows(rows: RawCompassRow[]): RawCompassRow[] {
  const stableCollapsed = collapseRawRows(rows, (row, index) => {
    const organization = normalizeOrganizationName(row.organization);
    const stableId = slug(clean(row.stableId));
    return clean(row.stableId) ? `${organization}::stable::${stableId}` : `${organization}::row::${index}`;
  });
  const result: RawCompassRow[] = [];
  for (const row of stableCollapsed) {
    const organization = normalizeOrganizationName(row.organization);
    const name = normalizedDeviceIdentity(row.deviceName);
    const existingIndex = result.findIndex((candidate) => normalizeOrganizationName(candidate.organization) === organization
      && normalizedDeviceIdentity(candidate.deviceName) === name
      && rawRowsCompatible(candidate, row));
    if (existingIndex >= 0) result[existingIndex] = mergeCompatibleRawRows(result[existingIndex], row);
    else result.push(row);
  }
  return result;
}

export function parseDiskVolumes(value: string, config: CompassConfig, deviceType: CompassDeviceType = "unknown"): DiskVolumeCondition[] {
  return parseTechnicalStorageVolumes(value, config.thresholds, deviceType) as DiskVolumeCondition[];
}

function modelIsIdentifiable(model: string): boolean {
  return isTechnicalModelIdentifiable(model);
}

function warrantyExpired(value: string, now: Date): boolean {
  return technicalWarrantyExpired(value, now);
}

export function isDeviceStale(device: Pick<CompassDevice, "lastUptime" | "lastLogin">, config: CompassConfig, now = new Date()): boolean {
  return isTechnicalStale(device.lastUptime, device.lastLogin, now, config.thresholds.staleDeviceMonths);
}

export function isDeviceInactive(device: Pick<CompassDevice, "status">): boolean {
  return isTechnicalInactive(device.status);
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
  return classifyTechnicalLifecycle({
    deviceType,
    isVirtual,
    model,
    warrantyStart,
    warrantyEnd,
    lastUptime,
    lastLogin,
    status,
  }, config.thresholds, now) as CompassLifecycle;
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
    aliases: [...new Set([...(existing?.aliases ?? []), ...aliases].map(cleanOrganizationDisplay).filter(Boolean))],
    city: existing?.city ?? "",
    state: existing?.state ?? "",
    market: existing?.market ?? "",
    industry: existing?.industry ?? "",
    tags: existing?.tags ? [...existing.tags] : [],
    primaryContact: existing?.primaryContact ?? "",
    primaryContactRole: existing?.primaryContactRole ?? "",
    primaryContactEmail: existing?.primaryContactEmail ?? "",
    primaryContactPhone: existing?.primaryContactPhone ?? "",
    assignedOwner: existing?.assignedOwner ?? "",
    lastAccountReview: existing?.lastAccountReview ?? "",
    lastSalesInteraction: existing?.lastSalesInteraction ?? "",
    lastQuoteDate: existing?.lastQuoteDate ?? "",
    quoted: existing?.quoted ?? false,
    nextFollowUp: existing?.nextFollowUp ?? "",
    workflowStatus: existing?.workflowStatus === "Project Mapping Needed" ? "Quote Needed" : existing?.workflowStatus ?? "Needs Review",
    internalNote: existing?.internalNote ?? "",
    reviewOutcome: existing?.reviewOutcome ?? emptyReviewOutcome(),
    lastDataRefresh: importedAt,
    captainsLog: existing?.captainsLog ? structuredClone(existing.captainsLog) : undefined,
  };
}

function finding(id: string, device: CompassDevice, category: CompassCardSignal | string, severity: CompassFinding["severity"], title: string, explanation: string, valueCategory: CompassFinding["valueCategory"]): CompassFinding {
  return { id, clientId: device.clientId, deviceId: device.id, category, severity, title, explanation, scoreContribution: 0, valueCategory };
}

export function findingsForDevice(device: CompassDevice, config: CompassConfig, now = new Date()): CompassFinding[] {
  const findings: CompassFinding[] = [];
  const osSignals = technicalOsSignals(device.osName);
  const isServer = device.deviceType === "physical-server" || device.deviceType === "virtual-server";
  const isWorkstation = device.deviceType === "physical-workstation" || device.deviceType === "virtual-workstation";
  const stale = isDeviceStale(device, config, now);
  const inactive = isDeviceInactive(device);
  const age = ageInYears(device.warrantyStart, now);
  const identifiable = modelIsIdentifiable(device.model);
  const expired = warrantyExpired(device.warrantyEnd, now);

  if (isServer && osSignals.server2012) findings.push(finding(`${device.id}-server-2012`, device, "server-2012", "critical", "Windows Server 2012 requires immediate modernization", `${device.name} is running ${device.osName || "Windows Server 2012"}.`, "critical-server"));
  else if (isServer && osSignals.server2016) findings.push(finding(`${device.id}-server-2016`, device, "server-2016", "planning", "Windows Server 2016 planning trigger", `${device.name} should enter server modernization planning.`, "server-planning"));
  else if (isServer && osSignals.legacyServer) findings.push(finding(`${device.id}-unsupported-server-os`, device, "unsupported-server-os", "critical", "Unsupported server operating system", `${device.name} is running ${device.osName}.`, "critical-server"));

  if ((osSignals.windows8 || osSignals.windows10) && !stale && !inactive) {
    const classification = device.deviceType === "physical-workstation" ? "physical workstation" : device.deviceType === "virtual-workstation" ? "virtual workstation" : "server-like device requiring classification review";
    const osLabel = osSignals.windows8 ? "Windows 8 / 8.1" : "Windows 10";
    findings.push(finding(`${device.id}-windows-10-active`, device, "windows-10-active", "high", `Active end-of-support ${osLabel} device`, `${device.name} is an active ${classification} running ${device.osName}.`, "windows-10"));
  }
  if (isWorkstation && osSignals.windows11Home && !stale && !inactive) findings.push(finding(`${device.id}-windows-11-home`, device, "windows-11-home", "planning", "Windows 11 Home edition", `${device.name} is using a Home edition operating system.`, "workstation-lifecycle"));

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

function monthsSince(value: string, now: Date): number | null {
  const parsed = parseDate(value);
  if (!parsed) return null;
  return Math.max(0, (now.getTime() - parsed.getTime()) / 2629800000);
}

function workflowOpportunity(
  card: CompassCardDefinition,
  client: CompassClient,
  technicalOpportunities: CompassOpportunity[],
  technicalTotal: number,
  config: CompassConfig,
  now: Date,
): CompassOpportunity | null {
  const manual = card.manualClientIds.includes(client.id);
  const affectedDeviceIds = [...new Set(technicalOpportunities.flatMap((opportunity) => opportunity.affectedDeviceIds))];
  if (card.workflowRule === "reviews-due") {
    const elapsed = monthsSince(client.lastAccountReview, now);
    const interval = Math.max(1, card.workflowMonths || config.thresholds.accountReviewDueMonths);
    const due = elapsed === null || elapsed >= interval;
    if (!due && !manual) return null;
    const drivers = manual
      ? ["Manually marked for account review"]
      : elapsed === null
        ? ["Account review not recorded"]
        : [`Last account review was ${Math.floor(elapsed)} months ago`];
    return {
      clientId: client.id,
      cardCategory: card.id,
      affectedDeviceIds,
      drivers,
      estimatedValue: technicalTotal,
      confidence: client.lastAccountReview ? "high" : "medium",
      assumptionKeys: ["workflowOpportunityValue"],
    };
  }
  if (card.workflowRule === "quote-needed") {
    const technicalCategoryCount = technicalOpportunities.filter((opportunity) => config.cards.some((candidate) => candidate.id === opportunity.cardCategory && candidate.criteriaType === "signals")).length;
    const hasProjectOpportunity = technicalOpportunities.some((opportunity) => opportunity.cardCategory === "all") || technicalCategoryCount > 0;
    if ((!hasProjectOpportunity || client.quoted) && !manual) return null;
    return {
      clientId: client.id,
      cardCategory: card.id,
      affectedDeviceIds,
      drivers: manual ? ["Manually marked as needing a quote"] : [`${technicalCategoryCount} current project categor${technicalCategoryCount === 1 ? "y" : "ies"} not yet quoted`],
      estimatedValue: technicalTotal,
      confidence: "high",
      assumptionKeys: ["workflowOpportunityValue"],
    };
  }
  return manual ? { clientId: client.id, cardCategory: card.id, affectedDeviceIds, drivers: ["Manually confirmed workflow need"], estimatedValue: technicalTotal, confidence: "low", assumptionKeys: ["workflowOpportunityValue"] } : null;
}

export function opportunitiesForClient(clientId: string, findings: CompassFinding[], devices: CompassDevice[], locations: CompassLocation[], config: CompassConfig, client?: CompassClient, now = new Date()): { opportunities: CompassOpportunity[]; totalEstimatedValue: number } {
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
  if (client) {
    const technicalOpportunities = [...opportunities];
    for (const card of cards.filter((candidate) => candidate.criteriaType === "workflow")) {
      const opportunity = workflowOpportunity(card, client, technicalOpportunities, totalEstimatedValue, config, now);
      if (opportunity) opportunities.push(opportunity);
    }
  }
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

function calculateSummaries(clients: CompassClient[], devices: CompassDevice[], locations: CompassLocation[], findings: CompassFinding[], config: CompassConfig, now = new Date()): CompassClientSummary[] {
  return clients.map((client) => {
    const clientFindings = findings.filter((item) => item.clientId === client.id);
    const score = scoreClient(clientFindings, config);
    const result = opportunitiesForClient(client.id, clientFindings, devices.filter((device) => device.clientId === client.id), locations, config, client, now);
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
    const stable = clean(row.stableId);
    const deviceIdentity = stable ? `stable:${slug(stable)}` : `name:${rawRowFallbackIdentity(row)}`;
    const deviceId = `${target.id}-device-${slug(stable || row.deviceName)}-${shortIdentityHash(deviceIdentity)}`;
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
  const summaries = calculateSummaries(clients, devices, locations, findings, config, now);
  const summary: CompassImportSummary = {
    ...baseSummary,
    devicesDetected: devices.length,
    physicalServers: devices.filter((device) => device.deviceType === "physical-server").length,
    virtualMachines: devices.filter((device) => device.isVirtual).length,
    workstations: devices.filter((device) => device.deviceType === "physical-workstation" || device.deviceType === "virtual-workstation").length,
    osConcerns: findings.filter((item) => ["server-2012", "unsupported-server-os", "server-2016", "windows-10-active", "windows-11-home"].includes(item.category)).length,
    storageConcerns: findings.filter((item) => ["critical-storage", "watch-storage"].includes(item.category)).length,
  };
  return {
    summary,
    organizations,
    unresolvedOrganizations: [],
    dataset: {
      schemaVersion: 1,
      calculationVersion: COMPASS_CALCULATION_VERSION,
      calculationFingerprint: compassConfigFingerprint(config),
      calculatedAt: importedAt,
      clients,
      locations,
      devices,
      findings,
      summaries,
      importedAt,
      importSourceName: parsed.sourceName,
      importSummary: summary,
    },
  };
}

const FALLBACK_CARD_TITLES: Array<[CompassCardCategory, string]> = [
  ["all", "Clients Needing Projects"],
  ["critical-server", "Critical Server Projects"],
  ["server-planning", "Server Planning"],
  ["windows-10", "Windows 10 Refresh"],
  ["workstation-lifecycle", "Workstation Lifecycle"],
  ["storage", "Storage Attention"],
  ["reviews-due", "Reviews Due"],
  ["quote-needed", "Quote Needed"],
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
  return classifyTechnicalStorageVolume({ label: clean(volume.label ?? "") || `Volume ${index + 1}`, usedPercent, usedGb, totalGb, freeGb }, config.thresholds, deviceType) as DiskVolumeCondition;
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
  const summaries = calculateSummaries(dataset.clients, devices, dataset.locations, findings, config, now);
  const summary = {
    ...dataset.importSummary,
    devicesDetected: devices.length,
    physicalServers: devices.filter((device) => device.deviceType === "physical-server").length,
    virtualMachines: devices.filter((device) => device.isVirtual).length,
    workstations: devices.filter((device) => device.deviceType === "physical-workstation" || device.deviceType === "virtual-workstation").length,
    osConcerns: findings.filter((item) => ["server-2012", "unsupported-server-os", "server-2016", "windows-10-active", "windows-11-home"].includes(item.category)).length,
    storageConcerns: findings.filter((item) => ["critical-storage", "watch-storage"].includes(item.category)).length,
  };
  return {
    ...dataset,
    calculationVersion: COMPASS_CALCULATION_VERSION,
    calculationFingerprint: compassConfigFingerprint(config),
    calculatedAt: now.toISOString(),
    devices,
    findings,
    summaries,
    importSummary: summary,
  };
}
