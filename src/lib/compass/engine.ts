import type {
  CompassCardCategory,
  CompassCardMetric,
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

export function normalizeOrganizationName(value: string): string {
  return value.trim().toLowerCase().replace(/[.,'’`]/g, "").replace(/&/g, "and").replace(/\s+/g, " ");
}

function slug(value: string): string {
  const normalized = normalizeOrganizationName(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || "unknown";
}

function clean(value: string): string { return value.trim().replace(/\s+/g, " "); }

function parseDate(value: string): Date | null {
  const text = value.trim();
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

export function parseDiskVolumes(value: string, config: CompassConfig): DiskVolumeCondition[] {
  const text = value.trim();
  if (!text) return [];
  const segments = text.split(/[,;](?=\s*(?:[A-Za-z]:|Volume|Disk|\/))/).map((item) => item.trim()).filter(Boolean);
  const candidates = segments.length ? segments : [text];
  return candidates.map((segment, index) => {
    const label = segment.match(/(?:^|\s)([A-Za-z]:|Volume\s+[^,;(]+|Disk\s+[^,;(]+)/i)?.[1]?.trim() || `Volume ${index + 1}`;
    const percentages = [...segment.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((match) => Number(match[1])).filter(Number.isFinite);
    let usedPercent = percentages.length ? Math.max(...percentages) : null;
    if (usedPercent === null) {
      const fraction = segment.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
      if (fraction && Number(fraction[2]) > 0) usedPercent = Number(fraction[1]) / Number(fraction[2]) * 100;
    }
    const state = usedPercent === null ? "unknown" : usedPercent >= config.thresholds.storageCriticalPercent ? "critical" : usedPercent >= config.thresholds.storageWatchPercent ? "watch" : "healthy";
    return { label, usedPercent: usedPercent === null ? null : Math.round(usedPercent * 10) / 10, state };
  });
}

function lifecycleFor(row: RawCompassRow, classification: ReturnType<typeof classifyDevice>, config: CompassConfig, now: Date): CompassLifecycle {
  if (classification.isVirtual || classification.deviceType === "unknown") return "unknown";
  const age = ageInYears(row.warrantyStart, now);
  if (age === null) return "unknown";
  if (classification.deviceType === "physical-server") {
    if (age >= config.thresholds.serverCriticalYears) return "replace-now";
    if (age >= config.thresholds.serverPlanningYears) return "plan-soon";
    return "current";
  }
  if (age >= config.thresholds.workstationReplaceNowYears) return "replace-now";
  if (age >= config.thresholds.workstationPlanSoonYears) return "plan-soon";
  return "current";
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

function finding(id: string, device: CompassDevice, category: string, severity: CompassFinding["severity"], title: string, explanation: string, valueCategory: CompassFinding["valueCategory"]): CompassFinding {
  return { id, clientId: device.clientId, deviceId: device.id, category, severity, title, explanation, scoreContribution: 0, valueCategory };
}

export function findingsForDevice(device: CompassDevice, now = new Date()): CompassFinding[] {
  const findings: CompassFinding[] = [];
  const os = device.osName.toLowerCase();
  const isServer = device.deviceType === "physical-server" || device.deviceType === "virtual-server";
  const isWorkstation = device.deviceType === "physical-workstation" || device.deviceType === "virtual-workstation";
  if (isServer && /server\s+2012(?:\s*r2)?/.test(os)) findings.push(finding(`${device.id}-server-2012`, device, "server-2012", "critical", "Windows Server 2012 requires immediate modernization", `${device.name} is running ${device.osName || "Windows Server 2012"}.`, "critical-server"));
  else if (isServer && /server\s+2016/.test(os)) findings.push(finding(`${device.id}-server-2016`, device, "server-2016", "planning", "Windows Server 2016 planning trigger", `${device.name} should enter server modernization planning.`, "server-planning"));
  else if (isServer && /server\s+(2000|2003|2008|2011)/.test(os)) findings.push(finding(`${device.id}-unsupported-server-os`, device, "unsupported-server-os", "critical", "Unsupported server operating system", `${device.name} is running ${device.osName}.`, "critical-server"));
  if (isWorkstation && /windows\s+10/.test(os)) findings.push(finding(`${device.id}-windows-10`, device, "windows-10", "high", "Windows 10 modernization required", `${device.name} is running ${device.osName}.`, "windows-10"));
  if (isWorkstation && /windows\s+11\s+home/.test(os)) findings.push(finding(`${device.id}-windows-11-home`, device, "windows-11-home", "planning", "Windows 11 Home edition", `${device.name} is using a Home edition operating system.`, "workstation-lifecycle"));
  if (!device.isVirtual && device.deviceType === "physical-server" && device.lifecycle === "replace-now") findings.push(finding(`${device.id}-server-age-critical`, device, "server-age-critical", "critical", "Physical server is beyond lifecycle", `${device.name} is at least seven years from its recorded warranty start.`, "critical-server"));
  else if (!device.isVirtual && device.deviceType === "physical-server" && device.lifecycle === "plan-soon") findings.push(finding(`${device.id}-server-age-planning`, device, "server-age-planning", "planning", "Physical server lifecycle planning", `${device.name} is at least five years from its recorded warranty start.`, "server-planning"));
  if (!device.isVirtual && device.deviceType === "physical-workstation" && device.lifecycle === "replace-now") findings.push(finding(`${device.id}-replace-now`, device, "replace-now", "high", "Replace Now workstation", `${device.name} is beyond the configured workstation lifecycle threshold.`, "workstation-lifecycle"));
  else if (!device.isVirtual && device.deviceType === "physical-workstation" && device.lifecycle === "plan-soon") findings.push(finding(`${device.id}-plan-soon`, device, "plan-soon", "planning", "Plan Soon workstation", `${device.name} is approaching the configured workstation lifecycle threshold.`, "workstation-lifecycle"));
  if (device.diskVolumes.some((volume) => volume.state === "critical")) findings.push(finding(`${device.id}-critical-storage`, device, "critical-storage", "high", "Critical storage utilization", `${device.name} has at least one volume at or above the critical storage threshold.`, "storage"));
  else if (device.diskVolumes.some((volume) => volume.state === "watch")) findings.push(finding(`${device.id}-watch-storage`, device, "watch-storage", "watch", "Storage utilization needs attention", `${device.name} has at least one volume at or above the watch threshold.`, "storage"));
  const warrantyEnd = parseDate(device.warrantyEnd);
  if (!device.isVirtual && warrantyEnd && warrantyEnd.getTime() < now.getTime()) {
    const category = device.deviceType === "physical-server" ? "expired-server-warranty" : "expired-workstation-warranty";
    findings.push(finding(`${device.id}-${category}`, device, category, "watch", "Expired hardware warranty", `${device.name}'s recorded warranty has expired.`, device.deviceType === "physical-server" ? "server-planning" : "workstation-lifecycle"));
  }
  return findings;
}

function count(findings: CompassFinding[], category: string): number { return findings.filter((item) => item.category === category).length; }
function capped(value: number, cap: number): number { return Math.min(value, cap); }
function firstAdditional(total: number, first: number, additional: number, cap: number): number { return total ? capped(first + Math.max(0, total - 1) * additional, cap) : 0; }

export function scoreClient(findings: CompassFinding[], config: CompassConfig): { score: number; tier: CompassClientSummary["priorityTier"]; topDrivers: string[]; contributions: Record<string, number> } {
  const contributions: Record<string, number> = {};
  const add = (label: string, value: number) => { if (value > 0) contributions[label] = value; };
  const s = config.score;
  const c2012 = count(findings, "server-2012") + count(findings, "unsupported-server-os");
  add(c2012 === 1 ? "1 critical unsupported server OS" : `${c2012} critical unsupported server OS instances`, firstAdditional(c2012, s.server2012First, s.server2012Additional, s.server2012Cap));
  const c2016 = count(findings, "server-2016");
  add(c2016 === 1 ? "1 Windows Server 2016 instance" : `${c2016} Windows Server 2016 instances`, firstAdditional(c2016, s.server2016First, s.server2016Additional, s.server2016Cap));
  const categories: Array<[string, string, number, number]> = [
    ["server-age-planning", "physical server lifecycle planning", s.serverAgePlanningEach, s.serverAgePlanningCap],
    ["server-age-critical", "physical server beyond lifecycle", s.serverAgeCriticalEach, s.serverAgeCriticalCap],
    ["windows-10", "Windows 10 devices", s.windows10Each, s.windows10Cap],
    ["windows-11-home", "Windows 11 Home devices", s.windows11HomeEach, s.windows11HomeCap],
    ["replace-now", "Replace Now workstations", s.replaceNowEach, s.replaceNowCap],
    ["plan-soon", "Plan Soon workstations", s.planSoonEach, s.planSoonCap],
    ["critical-storage", "critical-storage devices", s.criticalStorageEach, s.criticalStorageCap],
    ["watch-storage", "watch-storage devices", s.watchStorageEach, s.watchStorageCap],
    ["expired-server-warranty", "expired server warranties", s.expiredServerWarrantyEach, s.expiredServerWarrantyCap],
    ["expired-workstation-warranty", "expired workstation warranties", s.expiredWorkstationWarrantyEach, s.expiredWorkstationWarrantyCap],
  ];
  for (const [category, label, each, cap] of categories) {
    const total = count(findings, category);
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
  const assignEach = (category: string, each: number, cap: number) => {
    let remaining = cap;
    result.filter((item) => item.category === category).forEach((item) => {
      const contribution = Math.max(0, Math.min(each, remaining));
      item.scoreContribution = contribution;
      remaining -= contribution;
    });
  };
  const s = config.score;
  assignGroup(["server-2012", "unsupported-server-os"], s.server2012First, s.server2012Additional, s.server2012Cap);
  assignGroup(["server-2016"], s.server2016First, s.server2016Additional, s.server2016Cap);
  assignEach("server-age-planning", s.serverAgePlanningEach, s.serverAgePlanningCap);
  assignEach("server-age-critical", s.serverAgeCriticalEach, s.serverAgeCriticalCap);
  assignEach("windows-10", s.windows10Each, s.windows10Cap);
  assignEach("windows-11-home", s.windows11HomeEach, s.windows11HomeCap);
  assignEach("replace-now", s.replaceNowEach, s.replaceNowCap);
  assignEach("plan-soon", s.planSoonEach, s.planSoonCap);
  assignEach("critical-storage", s.criticalStorageEach, s.criticalStorageCap);
  assignEach("watch-storage", s.watchStorageEach, s.watchStorageCap);
  assignEach("expired-server-warranty", s.expiredServerWarrantyEach, s.expiredServerWarrantyCap);
  assignEach("expired-workstation-warranty", s.expiredWorkstationWarrantyEach, s.expiredWorkstationWarrantyCap);
  return result;
}

function uniqueDevices(findings: CompassFinding[], categories: string[]): string[] {
  return [...new Set(findings.filter((item) => categories.includes(item.category)).map((item) => item.deviceId))];
}

function contingency(value: number, config: CompassConfig): number { return Math.round(value * (1 + config.value.planningContingencyPercent / 100)); }

function serverValue(devices: CompassDevice[], config: CompassConfig): { value: number; keys: string[] } {
  const physical = devices.filter((device) => device.deviceType === "physical-server").length;
  const virtual = devices.filter((device) => device.deviceType === "virtual-server").length;
  const baseValues = [...Array(physical)].map(() => config.value.standardServerReplacement).concat([...Array(virtual)].map(() => config.value.advancedServerMigration));
  const total = baseValues.reduce((sum, value, index) => sum + value * (index === 0 ? 1 : config.value.multiServerAdditionalMultiplier), 0);
  return { value: contingency(total, config), keys: ["standardServerReplacement", "advancedServerMigration", "multiServerAdditionalMultiplier", "planningContingencyPercent"] };
}

function workstationValue(devices: CompassDevice[], config: CompassConfig): { value: number; keys: string[] } {
  const physical = devices.filter((device) => device.deviceType === "physical-workstation").length;
  const virtual = devices.filter((device) => device.deviceType === "virtual-workstation").length;
  const total = physical * (config.value.standardWorkstationModernization + config.value.workstationDeploymentAllowance) + virtual * config.value.virtualOsRemediation;
  return { value: contingency(total, config), keys: ["standardWorkstationModernization", "workstationDeploymentAllowance", "virtualOsRemediation", "planningContingencyPercent"] };
}

export function opportunitiesForClient(clientId: string, findings: CompassFinding[], devices: CompassDevice[], locations: CompassLocation[], config: CompassConfig): { opportunities: CompassOpportunity[]; totalEstimatedValue: number } {
  const byId = new Map(devices.map((device) => [device.id, device]));
  const makeOpportunity = (cardCategory: CompassCardCategory, ids: string[], drivers: string[], estimatedValue: number, assumptionKeys: string[]): CompassOpportunity => ({ clientId, cardCategory, affectedDeviceIds: ids, drivers, estimatedValue, confidence: ids.length ? "medium" : "low", assumptionKeys });
  const opportunities: CompassOpportunity[] = [];
  const criticalIds = uniqueDevices(findings, ["server-2012", "unsupported-server-os", "server-age-critical"]);
  const planningIds = uniqueDevices(findings, ["server-2016", "server-age-planning", "expired-server-warranty"]);
  const windows10Ids = uniqueDevices(findings, ["windows-10"]);
  const lifecycleIds = uniqueDevices(findings, ["replace-now", "plan-soon", "windows-11-home", "expired-workstation-warranty"]);
  const storageIds = uniqueDevices(findings, ["critical-storage", "watch-storage"]);
  if (criticalIds.length) { const estimate = serverValue(criticalIds.map((id) => byId.get(id)).filter(Boolean) as CompassDevice[], config); opportunities.push(makeOpportunity("critical-server", criticalIds, findings.filter((item) => criticalIds.includes(item.deviceId) && ["server-2012", "unsupported-server-os", "server-age-critical"].includes(item.category)).map((item) => item.title), estimate.value, estimate.keys)); }
  if (planningIds.length) { const estimate = serverValue(planningIds.map((id) => byId.get(id)).filter(Boolean) as CompassDevice[], config); opportunities.push(makeOpportunity("server-planning", planningIds, findings.filter((item) => planningIds.includes(item.deviceId) && ["server-2016", "server-age-planning", "expired-server-warranty"].includes(item.category)).map((item) => item.title), estimate.value, estimate.keys)); }
  if (windows10Ids.length) { const estimate = workstationValue(windows10Ids.map((id) => byId.get(id)).filter(Boolean) as CompassDevice[], config); opportunities.push(makeOpportunity("windows-10", windows10Ids, [`${windows10Ids.length} Windows 10 device${windows10Ids.length === 1 ? "" : "s"}`], estimate.value, estimate.keys)); }
  if (lifecycleIds.length) { const estimate = workstationValue(lifecycleIds.map((id) => byId.get(id)).filter(Boolean) as CompassDevice[], config); opportunities.push(makeOpportunity("workstation-lifecycle", lifecycleIds, findings.filter((item) => lifecycleIds.includes(item.deviceId) && ["replace-now", "plan-soon", "windows-11-home", "expired-workstation-warranty"].includes(item.category)).map((item) => item.title), estimate.value, estimate.keys)); }
  if (storageIds.length) { const critical = findings.some((item) => storageIds.includes(item.deviceId) && item.category === "critical-storage"); const base = config.value.storageRemediation * (critical ? 1.25 : 1); opportunities.push(makeOpportunity("storage", storageIds, [`${storageIds.length} device${storageIds.length === 1 ? "" : "s"} with storage attention`], contingency(base, config), ["storageRemediation", "planningContingencyPercent"])); }
  const serverIds = [...new Set([...criticalIds, ...planningIds])];
  const workstationIds = [...new Set([...windows10Ids, ...lifecycleIds])];
  const serverTotal = serverIds.length ? serverValue(serverIds.map((id) => byId.get(id)).filter(Boolean) as CompassDevice[], config).value : 0;
  const workstationTotal = workstationIds.length ? workstationValue(workstationIds.map((id) => byId.get(id)).filter(Boolean) as CompassDevice[], config).value : 0;
  const storageTotal = storageIds.length ? contingency(config.value.storageRemediation * (findings.some((item) => storageIds.includes(item.deviceId) && item.category === "critical-storage") ? 1.25 : 1), config) : 0;
  const siteCount = new Set(locations.filter((location) => location.clientId === clientId).map((location) => location.id)).size;
  const multiSite = opportunities.length && siteCount > 1 ? config.value.multisiteAdjustment : 0;
  return { opportunities, totalEstimatedValue: Math.round(serverTotal + workstationTotal + storageTotal + multiSite) };
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
  const previewRows = new Map<string, RawCompassRow>();
  for (const row of parsed.rows) {
    const identity = `${normalizeOrganizationName(row.organization)}::${slug(clean(row.stableId) || clean(row.deviceName))}`;
    previewRows.set(identity, row);
  }
  const previewDevices = [...previewRows.values()].map((row) => ({ row, classification: classifyDevice(row), volumes: parseDiskVolumes(row.diskVolumeUsage, config) }));
  const osConcernCount = previewDevices.filter(({ row, classification }) => {
    const os = row.osName.toLowerCase();
    const isServer = classification.deviceType === "physical-server" || classification.deviceType === "virtual-server";
    const isWorkstation = classification.deviceType === "physical-workstation" || classification.deviceType === "virtual-workstation";
    return (isServer && /server\s+(2000|2003|2008|2011|2012|2016)/.test(os)) || (isWorkstation && (/windows\s+10/.test(os) || /windows\s+11\s+home/.test(os)));
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
  for (const row of parsed.rows) {
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
      memoryGiB: Number.isFinite(Number(row.memoryGiB)) ? Number(row.memoryGiB) : null,
      diskVolumes: parseDiskVolumes(row.diskVolumeUsage, config),
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
  const findings = assignScoreContributions(devices.flatMap((device) => findingsForDevice(device, now)), config);
  const summaries: CompassClientSummary[] = [...clientsById.values()].map((client) => {
    const clientFindings = findings.filter((item) => item.clientId === client.id);
    const score = scoreClient(clientFindings, config);
    const result = opportunitiesForClient(client.id, clientFindings, devices.filter((device) => device.clientId === client.id), locations, config);
    return { clientId: client.id, clientName: client.name, priorityScore: score.score, priorityTier: score.tier, topDrivers: score.topDrivers, totalEstimatedValue: result.totalEstimatedValue, opportunities: result.opportunities };
  });
  const summary: CompassImportSummary = {
    ...baseSummary,
    devicesDetected: devices.length,
    physicalServers: devices.filter((device) => device.deviceType === "physical-server").length,
    virtualMachines: devices.filter((device) => device.isVirtual).length,
    workstations: devices.filter((device) => device.deviceType === "physical-workstation" || device.deviceType === "virtual-workstation").length,
    osConcerns: findings.filter((item) => ["server-2012", "unsupported-server-os", "server-2016", "windows-10", "windows-11-home"].includes(item.category)).length,
    storageConcerns: findings.filter((item) => ["critical-storage", "watch-storage"].includes(item.category)).length,
  };
  return { summary, organizations, unresolvedOrganizations: [], dataset: { schemaVersion: 1, clients: [...clientsById.values()], locations, devices, findings, summaries, importedAt, importSourceName: parsed.sourceName, importSummary: summary } };
}

export function cardMetrics(dataset: CompassDataset | null): CompassCardMetric[] {
  const specs: Array<[CompassCardCategory, string]> = [
    ["all", "Clients Needing Projects"], ["critical-server", "Critical Server Projects"], ["server-planning", "Server Planning"], ["windows-10", "Windows 10 Refresh"], ["workstation-lifecycle", "Workstation Lifecycle"], ["storage", "Storage Attention"],
  ];
  if (!dataset) return specs.map(([id, title]) => ({ id, title, count: 0, affectedDeviceCount: 0, value: 0, clients: [] }));
  return specs.map(([id, title]) => {
    const qualifying = dataset.summaries.filter((summary) => id === "all" ? summary.opportunities.length > 0 : summary.opportunities.some((opportunity) => opportunity.cardCategory === id));
    const clients = qualifying.map((summary) => {
      const opportunity = id === "all" ? null : summary.opportunities.find((item) => item.cardCategory === id);
      return { clientId: summary.clientId, name: summary.clientName, driver: (id === "all" ? summary.topDrivers : opportunity?.drivers)?.slice(0, 2).join(" · ") || "Current technical opportunity", estimate: id === "all" ? summary.totalEstimatedValue : opportunity?.estimatedValue ?? 0, score: summary.priorityScore, tier: summary.priorityTier };
    }).sort((a, b) => b.score - a.score || b.estimate - a.estimate);
    const affectedDeviceCount = id === "all" ? new Set(qualifying.flatMap((summary) => summary.opportunities.flatMap((opportunity) => opportunity.affectedDeviceIds))).size : new Set(qualifying.flatMap((summary) => summary.opportunities.filter((opportunity) => opportunity.cardCategory === id).flatMap((opportunity) => opportunity.affectedDeviceIds))).size;
    const value = clients.reduce((sum, client) => sum + client.estimate, 0);
    return { id, title, count: clients.length, affectedDeviceCount, value, clients };
  });
}

export function recalculateDataset(dataset: CompassDataset, config: CompassConfig, now = new Date()): CompassDataset {
  const devices = dataset.devices.map((device) => {
    if (device.isVirtual || device.deviceType === "unknown") return { ...device, lifecycle: "unknown" as CompassLifecycle };
    const age = ageInYears(device.warrantyStart, now);
    if (age === null) return { ...device, lifecycle: "unknown" as CompassLifecycle };
    if (device.deviceType === "physical-server") return { ...device, lifecycle: age >= config.thresholds.serverCriticalYears ? "replace-now" as CompassLifecycle : age >= config.thresholds.serverPlanningYears ? "plan-soon" as CompassLifecycle : "current" as CompassLifecycle, diskVolumes: parseDiskVolumes(device.diskVolumes.map((volume) => `${volume.label} ${volume.usedPercent ?? ""}%`).join(", "), config) };
    return { ...device, lifecycle: age >= config.thresholds.workstationReplaceNowYears ? "replace-now" as CompassLifecycle : age >= config.thresholds.workstationPlanSoonYears ? "plan-soon" as CompassLifecycle : "current" as CompassLifecycle, diskVolumes: parseDiskVolumes(device.diskVolumes.map((volume) => `${volume.label} ${volume.usedPercent ?? ""}%`).join(", "), config) };
  });
  const findings = assignScoreContributions(devices.flatMap((device) => findingsForDevice(device, now)), config);
  const summaries = dataset.clients.map((client) => {
    const clientFindings = findings.filter((item) => item.clientId === client.id);
    const score = scoreClient(clientFindings, config);
    const result = opportunitiesForClient(client.id, clientFindings, devices.filter((device) => device.clientId === client.id), dataset.locations, config);
    return { clientId: client.id, clientName: client.name, priorityScore: score.score, priorityTier: score.tier, topDrivers: score.topDrivers, totalEstimatedValue: result.totalEstimatedValue, opportunities: result.opportunities };
  });
  const summary = {
    ...dataset.importSummary,
    devicesDetected: devices.length,
    physicalServers: devices.filter((device) => device.deviceType === "physical-server").length,
    virtualMachines: devices.filter((device) => device.isVirtual).length,
    workstations: devices.filter((device) => device.deviceType === "physical-workstation" || device.deviceType === "virtual-workstation").length,
    osConcerns: findings.filter((item) => ["server-2012", "unsupported-server-os", "server-2016", "windows-10", "windows-11-home"].includes(item.category)).length,
    storageConcerns: findings.filter((item) => ["critical-storage", "watch-storage"].includes(item.category)).length,
  };
  return { ...dataset, devices, findings, summaries, importSummary: summary };
}
