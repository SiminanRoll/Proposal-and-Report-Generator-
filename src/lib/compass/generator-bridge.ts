import type { CompassDataset, CompassDevice, CompassFinding } from "./types";
import type { ExtractedFact, FileAnalysis, FindingCandidate, SourceFileRecord } from "@/lib/projects/types";

export interface CompassGeneratorPrefill {
  clientId: string;
  clientName: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
  context: string;
  sourceRecords: Record<string, SourceFileRecord[]>;
}

function normalizedReportDeviceName(value: string): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F-\u009F\uE000-\uF8FF\uFFFE\uFFFF]+/g, "-")
    .replace(/\s*([._-])\s*/g, "$1")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .trim();
}

function fact(input: Omit<ExtractedFact, "id"> & { id?: string }): ExtractedFact {
  return { id: input.id ?? `compass-fact-${input.key}`, ...input };
}

function finding(input: Omit<FindingCandidate, "id"> & { id?: string }): FindingCandidate {
  return { id: input.id ?? `compass-finding-${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, ...input };
}

function dateOnly(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function ageYears(value: string, now: Date): number {
  if (!value) return 0;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 0;
  return Math.max(0, Math.round(((now.getTime() - parsed.getTime()) / 31557600000) * 10) / 10);
}

function osStatus(os: string): "supported" | "ending-soon" | "unsupported" | "unknown" {
  if (!os.trim()) return "unknown";
  if (/windows\s*10/i.test(os) || /server\s*2012/i.test(os) || /server\s*(2000|2003|2008|2011)/i.test(os)) return "unsupported";
  if (/server\s*2016/i.test(os) || (/windows\s*11/i.test(os) && /\bhome\b/i.test(os))) return "ending-soon";
  return "supported";
}

function lifecycleStatus(device: CompassDevice): "current" | "due-soon" | "overdue" | "unknown" {
  if (device.isVirtual || device.deviceType === "unknown") return "unknown";
  if (device.lifecycle === "replace-now") return "overdue";
  if (device.lifecycle === "plan-soon") return "due-soon";
  if (device.lifecycle === "current") return "current";
  return "unknown";
}

function reportDeviceType(device: CompassDevice): "server" | "workstation" | "vm" {
  if (device.isVirtual || device.deviceType === "virtual-server" || device.deviceType === "virtual-workstation") return "vm";
  if (device.deviceType === "physical-server") return "server";
  return "workstation";
}

function storageText(device: CompassDevice): { storage: string; usage: string; percent: number; freeGb: number } {
  const included = device.diskVolumes.filter((volume) => !volume.excludedReason);
  const storage = included.map((volume) => `${volume.label} ${volume.totalGb !== null ? `${volume.totalGb} GB` : "size unknown"}`).join("; ");
  const usage = included.map((volume) => {
    const parts = [volume.usedPercent !== null ? `${volume.usedPercent}% used` : "usage unknown"];
    if (volume.freeGb !== null) parts.push(`${volume.freeGb} GB free`);
    return `${volume.label} ${parts.join(" · ")}`;
  }).join("; ");
  const percentages = included.map((volume) => volume.usedPercent).filter((value): value is number => value !== null);
  const freeValues = included.map((volume) => volume.freeGb).filter((value): value is number => value !== null);
  return {
    storage,
    usage,
    percent: percentages.length ? Math.max(...percentages) : 0,
    freeGb: freeValues.length ? Math.min(...freeValues) : 0,
  };
}

function inventoryRecord(device: CompassDevice, location: string, now: Date): string {
  const storage = storageText(device);
  return JSON.stringify({
    type: reportDeviceType(device),
    name: normalizedReportDeviceName(device.name),
    sourceDeviceId: device.id,
    sourceDeviceName: device.name,
    sourceName: device.source || "Ninja / Client Compass",
    authoritative: true,
    user: "",
    lastCheckIn: dateOnly(device.lastUptime || device.lastLogin),
    make: "",
    serial: "",
    model: device.deviceType === "unknown" ? `Classification review — ${device.model || "model not reported"}` : device.model,
    os: device.osName,
    age: ageYears(device.warrantyStart, now),
    purchased: dateOnly(device.warrantyStart),
    warrantyExpires: dateOnly(device.warrantyEnd),
    ram: device.memoryGiB === null ? "" : `${device.memoryGiB} GB`,
    cpu: "",
    storage: storage.storage,
    storageUsage: storage.usage,
    storagePercent: storage.percent,
    storageFreeGb: storage.freeGb,
    graphics: device.videoCard,
    location,
    lifecycleStatus: lifecycleStatus(device),
    osStatus: osStatus(device.osName),
  });
}

function findingsForReport(findings: CompassFinding[], sourceFileId: string): FindingCandidate[] {
  const unsupported = findings.filter((item) => ["server-2012", "unsupported-server-os", "windows-10-active"].includes(item.category));
  const planningOs = findings.filter((item) => ["server-2016", "windows-11-home"].includes(item.category));
  const replaceNow = findings.filter((item) => ["server-age-critical", "server-age-warranty-critical", "replace-now"].includes(item.category));
  const planSoon = findings.filter((item) => ["server-age-planning", "server-warranty-upcoming", "plan-soon"].includes(item.category));
  const storage = findings.filter((item) => ["critical-storage", "watch-storage", "critical-server-storage"].includes(item.category));
  const result: FindingCandidate[] = [];
  if (replaceNow.length) result.push(finding({ category: "lifecycle", title: `${replaceNow.length} device${replaceNow.length === 1 ? " is" : "s are"} in Replace Now scope`, clientSummary: "These physical systems should be prioritized by business impact so replacement can be planned before a failure.", severity: "priority", sourceFileId, evidence: replaceNow.map((item) => item.explanation).join("; ") }));
  if (planSoon.length) result.push(finding({ category: "planning", title: `${planSoon.length} device${planSoon.length === 1 ? " is" : "s are"} approaching lifecycle planning`, clientSummary: "These systems are not immediate emergencies, but budgeting and timing should be discussed during the next technology review.", severity: "attention", sourceFileId, evidence: planSoon.map((item) => item.explanation).join("; ") }));
  if (unsupported.length) result.push(finding({ category: "lifecycle", title: `${unsupported.length} operating system${unsupported.length === 1 ? " needs" : "s need"} support remediation`, clientSummary: "Unsupported operating systems should be included in the near-term upgrade or replacement plan.", severity: "priority", sourceFileId, evidence: unsupported.map((item) => item.explanation).join("; ") }));
  if (planningOs.length) result.push(finding({ category: "planning", title: `${planningOs.length} operating system${planningOs.length === 1 ? " needs" : "s need"} forward planning`, clientSummary: "These operating systems should be reviewed for modernization timing or business-edition alignment.", severity: "attention", sourceFileId, evidence: planningOs.map((item) => item.explanation).join("; ") }));
  if (storage.length) result.push(finding({ category: "operations", title: `${storage.length} device${storage.length === 1 ? " needs" : "s need"} storage-capacity attention`, clientSummary: "Review cleanup, archiving, or storage expansion before limited free space affects daily work.", severity: storage.some((item) => /critical/i.test(item.category)) ? "priority" : "attention", sourceFileId, evidence: storage.map((item) => item.explanation).join("; ") }));
  return result;
}

export function buildCompassGeneratorPrefill(dataset: CompassDataset, clientId: string, now = new Date()): CompassGeneratorPrefill | null {
  const client = dataset.clients.find((item) => item.id === clientId);
  const summary = dataset.summaries.find((item) => item.clientId === clientId);
  if (!client || !summary) return null;
  const devices = dataset.devices.filter((device) => device.clientId === clientId);
  const clientFindings = dataset.findings.filter((item) => item.clientId === clientId);
  const locationById = new Map(dataset.locations.map((location) => [location.id, location.name]));
  const sourceFileId = `compass-source-${client.id}`;
  const inventory = devices.map((device) => inventoryRecord(device, locationById.get(device.locationId) ?? "", now));
  const physical = devices.filter((device) => !device.isVirtual && (device.deviceType === "physical-server" || device.deviceType === "physical-workstation"));
  const servers = devices.filter((device) => device.deviceType === "physical-server").length;
  const workstations = devices.filter((device) => device.deviceType === "physical-workstation").length;
  const vms = devices.filter((device) => device.isVirtual).length;
  const current = physical.filter((device) => device.lifecycle === "current").length;
  const dueSoon = physical.filter((device) => device.lifecycle === "plan-soon").length;
  const overdue = physical.filter((device) => device.lifecycle === "replace-now").length;
  const unknown = physical.filter((device) => device.lifecycle === "unknown").length;
  const osSupported = devices.filter((device) => osStatus(device.osName) === "supported").length;
  const osEndingSoon = devices.filter((device) => osStatus(device.osName) === "ending-soon").length;
  const osUnsupported = devices.filter((device) => osStatus(device.osName) === "unsupported").length;
  const locations = [...new Set(devices.map((device) => locationById.get(device.locationId)).filter((value): value is string => Boolean(value)))];
  const storageWatch = devices.filter((device) => device.diskVolumes.some((volume) => volume.state === "watch")).map((device) => device.name);
  const storageCritical = devices.filter((device) => device.diskVolumes.some((volume) => volume.state === "critical")).map((device) => device.name);
  const replaceNames = physical.filter((device) => device.lifecycle === "replace-now").map((device) => device.name);
  const planNames = physical.filter((device) => device.lifecycle === "plan-soon").map((device) => device.name);
  const warrantyExpired = physical.filter((device) => device.warrantyEnd && new Date(device.warrantyEnd).getTime() < now.getTime()).map((device) => device.name);
  const facts: ExtractedFact[] = [
    fact({ key: "compass.clientId", label: "Client Compass client ID", value: client.id, category: "client", confidence: "high", sourceFileId, evidence: "Current Client Compass client record" }),
    fact({ key: "compass.importedAt", label: "Client Compass import timestamp", value: dataset.importedAt, category: "planning", confidence: "high", sourceFileId, evidence: "Current committed Client Compass snapshot" }),
    fact({ key: "compass.calculatedAt", label: "Client Compass calculation timestamp", value: dataset.calculatedAt || dataset.importedAt, category: "planning", confidence: "high", sourceFileId, evidence: "Current Client Compass scoring and criteria calculation" }),
    fact({ key: "compass.sourceName", label: "Client Compass import source", value: dataset.importSourceName, category: "planning", confidence: "high", sourceFileId, evidence: "Current committed Client Compass snapshot" }),
    fact({ key: "compass.authoritativeInventory", label: "Authoritative inventory", value: true, category: "lifecycle", confidence: "high", sourceFileId, evidence: "Ninja inventory committed in Client Compass is authoritative for device identity and scope" }),
    fact({ key: "compass.authoritativeInventoryTotal", label: "Authoritative inventory total", value: devices.length, category: "lifecycle", confidence: "high", sourceFileId, evidence: "Every current Client Compass device record for this client" }),
    fact({ key: "compass.authoritativeDeviceIds", label: "Authoritative device IDs", value: devices.map((device) => device.id), category: "lifecycle", confidence: "high", sourceFileId, evidence: "Stable Client Compass device identities passed to the report generator" }),
    fact({ key: "scalepad.reportPeriod", label: "Lifecycle report period", value: dateOnly(dataset.importedAt), category: "planning", confidence: "high", sourceFileId, evidence: `Committed Client Compass snapshot from ${dataset.importSourceName}` }),
    fact({ key: "scalepad.totalAssets", label: "Hardware assets", value: devices.length, category: "lifecycle", confidence: "high", sourceFileId, evidence: "All current servers, workstations, and virtual machines in the committed snapshot" }),
    fact({ key: "scalepad.physicalAssets", label: "Physical lifecycle assets", value: physical.length, category: "lifecycle", confidence: "high", sourceFileId, evidence: "Physical servers and physical workstations in the committed snapshot" }),
    fact({ key: "scalepad.sourceReportedTotal", label: "Committed snapshot device total", value: devices.length, category: "lifecycle", confidence: "high", sourceFileId, evidence: "Current Client Compass device records for this client" }),
    fact({ key: "scalepad.parsedInventoryTotal", label: "Generator inventory total", value: inventory.length, category: "lifecycle", confidence: "high", sourceFileId, evidence: "Device records passed into the report generator" }),
    fact({ key: "scalepad.servers", label: "Primary servers", value: servers, category: "lifecycle", confidence: "high", sourceFileId, evidence: "Client Compass physical-server classification" }),
    fact({ key: "scalepad.backupServers", label: "Cloud Plus backup servers", value: 0, category: "backup", confidence: "medium", sourceFileId, evidence: "No dedicated Cloud Plus BDR role is available in the current Ninja columns" }),
    fact({ key: "scalepad.workstations", label: "Workstations", value: workstations, category: "lifecycle", confidence: "high", sourceFileId, evidence: "Client Compass physical-workstation classification" }),
    fact({ key: "scalepad.vms", label: "Virtual machines", value: vms, category: "lifecycle", confidence: "high", sourceFileId, evidence: "Client Compass virtual-machine classification" }),
    fact({ key: "scalepad.networkDevices", label: "Network devices", value: 0, category: "network", confidence: "medium", sourceFileId, evidence: "Network devices are not represented in the current Ninja device model" }),
    fact({ key: "scalepad.locations", label: "Locations", value: locations, category: "planning", confidence: "high", sourceFileId, evidence: "Committed location mappings" }),
    fact({ key: "scalepad.replacement.current", label: "Current devices", value: current, category: "lifecycle", confidence: "high", sourceFileId, evidence: "Current Client Compass lifecycle classification" }),
    fact({ key: "scalepad.replacement.dueSoon", label: "Devices due soon", value: dueSoon, category: "lifecycle", confidence: "high", sourceFileId, evidence: "Plan Soon physical devices" }),
    fact({ key: "scalepad.replacement.overdue", label: "Devices overdue", value: overdue, category: "lifecycle", confidence: "high", sourceFileId, evidence: "Replace Now physical devices" }),
    fact({ key: "scalepad.replacement.unknown", label: "Assets under review", value: unknown, category: "lifecycle", confidence: "high", sourceFileId, evidence: "Physical devices without enough lifecycle data" }),
    fact({ key: "scalepad.os.supported", label: "Operating systems supported", value: osSupported, category: "lifecycle", confidence: "high", sourceFileId, evidence: "Operating-system classification from the committed snapshot" }),
    fact({ key: "scalepad.os.endingSoon", label: "Operating systems ending soon", value: osEndingSoon, category: "lifecycle", confidence: "high", sourceFileId, evidence: "Server 2016 and Windows 11 Home planning rules" }),
    fact({ key: "scalepad.os.unsupported", label: "Operating systems unsupported", value: osUnsupported, category: "lifecycle", confidence: "high", sourceFileId, evidence: "Windows 10 and unsupported server OS rules" }),
    fact({ key: "scalepad.inventory", label: "Device inventory", value: inventory, category: "lifecycle", confidence: inventory.length ? "high" : "medium", sourceFileId, evidence: "Current Client Compass client/device model" }),
    fact({ key: "scalepad.replaceNow", label: "Replace now", value: replaceNames, category: "planning", confidence: "high", sourceFileId, evidence: "Replace Now lifecycle classification" }),
    fact({ key: "scalepad.planSoon", label: "Plan soon", value: planNames, category: "planning", confidence: "high", sourceFileId, evidence: "Plan Soon lifecycle classification" }),
    fact({ key: "scalepad.warrantyExpired", label: "Warranty expired", value: warrantyExpired, category: "lifecycle", confidence: "high", sourceFileId, evidence: "Warranty End Date in the committed snapshot" }),
    fact({ key: "scalepad.storage.reported", label: "Devices with disk usage reported", value: devices.filter((device) => device.diskVolumes.length).length, category: "operations", confidence: "high", sourceFileId, evidence: "Disk Volume Usage in the committed snapshot" }),
    fact({ key: "scalepad.storage.watch", label: "Devices to watch for storage", value: storageWatch, category: "operations", confidence: "high", sourceFileId, evidence: "Client Compass storage thresholds" }),
    fact({ key: "scalepad.storage.critical", label: "Devices with critical storage pressure", value: storageCritical, category: "operations", confidence: "high", sourceFileId, evidence: "Client Compass storage thresholds" }),
  ];
  const analysis: FileAnalysis = {
    sourceType: "scalepad",
    confidence: devices.length ? "high" : "medium",
    title: `${client.name} — Client Compass current snapshot`,
    summary: `${devices.length} current devices flowed directly from the committed ${dataset.importSourceName || "Ninja"} snapshot into the report generator.`,
    facts,
    findingCandidates: findingsForReport(clientFindings, sourceFileId),
    highlights: [
      `${servers} physical server${servers === 1 ? "" : "s"}`,
      `${workstations} physical workstation${workstations === 1 ? "" : "s"}`,
      `${vms} virtual machine${vms === 1 ? "" : "s"}`,
      `${overdue} Replace Now and ${dueSoon} Plan Soon physical devices`,
    ],
    warnings: ["This managed-client snapshot supplies lifecycle and inventory data. Attach the current Huntress report for security activity and response details."],
    rawTextPreview: `Client Compass current snapshot for ${client.name}; imported ${dataset.importedAt}; source ${dataset.importSourceName}.`,
    analyzedAt: now.toISOString(),
  };
  const source: SourceFileRecord = {
    id: sourceFileId,
    name: `Client Compass — ${client.name} current snapshot`,
    mimeType: "application/x-client-compass-snapshot",
    size: 0,
    addedAt: dataset.importedAt || now.toISOString(),
    status: "processed",
    analysis,
  };
  const memberships = summary.opportunities.map((opportunity) => opportunity.cardCategory).filter((category) => category !== "reviews-due" && category !== "quote-needed");
  return {
    clientId: client.id,
    clientName: client.name,
    contactName: client.primaryContact,
    contactRole: client.primaryContactRole,
    contactEmail: client.primaryContactEmail,
    contactPhone: client.primaryContactPhone,
    context: `Client Compass Priority ${summary.priorityScore} — ${summary.priorityTier}. ${summary.topDrivers.join("; ")}. Current opportunity categories: ${memberships.join(", ") || "none"}.`,
    sourceRecords: { "scalepad-pdf": [source] },
  };
}
