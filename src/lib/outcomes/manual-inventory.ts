import type { ExtractedFact, Project, ProjectManualInventoryDevice } from "@/lib/projects/types";
import { classifyTechnicalOsSupport } from "@/lib/technical-truth";

const SOURCE_ID = "manual-inventory";

function fact(project: Project, key: string): ExtractedFact | undefined {
  return project.intelligence.facts.find((item) => item.key === key);
}

function upsertFact(project: Project, facts: ExtractedFact[], key: string, label: string, value: string | number | boolean | string[], category: ExtractedFact["category"], evidence: string): ExtractedFact[] {
  const existing = fact(project, key);
  const next: ExtractedFact = existing
    ? { ...existing, value, confidence: "high", evidence }
    : { id: `manual-${key.replace(/[^a-z0-9]+/gi, "-")}`, key, label, value, category, confidence: "high", sourceFileId: SOURCE_ID, evidence };
  const index = facts.findIndex((item) => item.key === key);
  if (index >= 0) facts[index] = next; else facts.push(next);
  return facts;
}

function cleanDevice(device: ProjectManualInventoryDevice, index: number): ProjectManualInventoryDevice {
  return {
    ...device,
    id: String(device.id || `manual-device-${index + 1}`).trim(),
    name: String(device.name || `Device ${index + 1}`).trim(),
    type: ["server", "backup-server", "workstation", "vm", "network"].includes(device.type) ? device.type : "workstation",
    user: String(device.user || "").trim(),
    lastCheckIn: String(device.lastCheckIn || "").trim(),
    make: String(device.make || "").trim(),
    serial: String(device.serial || "").trim(),
    model: String(device.model || "").trim(),
    os: String(device.os || "").trim(),
    age: Number.isFinite(Number(device.age)) ? Math.max(0, Number(device.age)) : 0,
    purchased: String(device.purchased || "").trim(),
    warrantyExpires: String(device.warrantyExpires || "").trim(),
    ram: String(device.ram || "").trim(),
    cpu: String(device.cpu || "").trim(),
    storage: String(device.storage || "").trim(),
    storageUsage: String(device.storageUsage || "").trim(),
    storagePercent: Number.isFinite(Number(device.storagePercent)) ? Math.max(0, Number(device.storagePercent)) : 0,
    storageFreeGb: Number.isFinite(Number(device.storageFreeGb)) ? Math.max(0, Number(device.storageFreeGb)) : 0,
    graphics: String(device.graphics || "").trim(),
    location: String(device.location || "").trim(),
    lifecycleStatus: ["current", "due-soon", "overdue", "unknown"].includes(device.lifecycleStatus) ? device.lifecycleStatus : "unknown",
  };
}

export function withManualInventory(project: Project, input: ProjectManualInventoryDevice[]): Project {
  const devices = input.map(cleanDevice);
  const physical = devices.filter((device) => device.type === "server" || device.type === "backup-server" || device.type === "workstation");
  const current = physical.filter((device) => device.lifecycleStatus === "current").length;
  const dueSoon = physical.filter((device) => device.lifecycleStatus === "due-soon").length;
  const overdue = physical.filter((device) => device.lifecycleStatus === "overdue").length;
  const unknown = physical.filter((device) => device.lifecycleStatus === "unknown").length;
  const osStatuses = devices.filter((device) => device.type !== "network").map((device) => classifyTechnicalOsSupport(device.os));
  const supported = osStatuses.filter((status) => status === "supported").length;
  const endingSoon = osStatuses.filter((status) => status === "ending-soon").length;
  const unsupported = osStatuses.filter((status) => status === "unsupported").length;
  const evidence = "Manual hardware inventory correction saved in Client Compass; this inventory is authoritative for this report.";
  const facts = project.intelligence.facts.map((item) => ({ ...item }));

  upsertFact(project, facts, "compass.authoritativeInventory", "Authoritative inventory", true, "lifecycle", evidence);
  upsertFact(project, facts, "compass.authoritativeInventoryTotal", "Authoritative inventory total", devices.length, "lifecycle", evidence);
  upsertFact(project, facts, "scalepad.totalAssets", "Total managed assets", devices.length, "lifecycle", evidence);
  upsertFact(project, facts, "scalepad.sourceReportedTotal", "Inventory total", devices.length, "lifecycle", evidence);
  upsertFact(project, facts, "scalepad.parsedInventoryTotal", "Generator inventory total", devices.length, "lifecycle", evidence);
  upsertFact(project, facts, "scalepad.servers", "Primary servers", devices.filter((device) => device.type === "server").length, "lifecycle", evidence);
  upsertFact(project, facts, "scalepad.backupServers", "Cloud Plus backup servers", devices.filter((device) => device.type === "backup-server").length, "lifecycle", evidence);
  upsertFact(project, facts, "scalepad.workstations", "Workstations", devices.filter((device) => device.type === "workstation").length, "lifecycle", evidence);
  upsertFact(project, facts, "scalepad.vms", "Virtual machines", devices.filter((device) => device.type === "vm").length, "lifecycle", evidence);
  upsertFact(project, facts, "scalepad.networkDevices", "Network devices", devices.filter((device) => device.type === "network").length, "lifecycle", evidence);
  upsertFact(project, facts, "scalepad.replacement.current", "Current devices", current, "lifecycle", evidence);
  upsertFact(project, facts, "scalepad.replacement.dueSoon", "Devices due soon", dueSoon, "lifecycle", evidence);
  upsertFact(project, facts, "scalepad.replacement.overdue", "Devices overdue", overdue, "lifecycle", evidence);
  upsertFact(project, facts, "scalepad.replacement.unknown", "Assets under review", unknown, "lifecycle", evidence);
  upsertFact(project, facts, "scalepad.os.supported", "Operating systems supported", supported, "lifecycle", evidence);
  upsertFact(project, facts, "scalepad.os.endingSoon", "Operating systems needing planning", endingSoon, "lifecycle", evidence);
  upsertFact(project, facts, "scalepad.os.unsupported", "Operating systems unsupported", unsupported, "lifecycle", evidence);
  upsertFact(project, facts, "scalepad.inventory", "Device inventory", devices.map((device) => JSON.stringify({ ...device, authoritative: true, sourceDeviceId: device.id, sourceDeviceName: device.name, sourceName: "Manual inventory" })), "lifecycle", evidence);

  return {
    ...project,
    manualInventory: { updatedAt: new Date().toISOString(), devices },
    intelligence: { ...project.intelligence, facts },
    updatedAt: new Date().toISOString(),
  };
}

export function withoutManualInventory(project: Project): Project {
  const { manualInventory: _manualInventory, ...rest } = project;
  return rest as Project;
}
