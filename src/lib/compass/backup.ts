"use client";

import * as XLSX from "xlsx";
import { APP_VERSION } from "@/lib/app-version";
import { loadSegments, saveSegments } from "@/lib/segments/store";
import type { SegmentDefinition } from "@/lib/segments/types";
import { normalizeCompassConfig } from "./config";
import { normalizeOrganizationName, recalculateDataset } from "./engine";
import { loadCompassConfig, loadCompassDataset, saveCompassConfigAndDataset } from "./store";
import type { CompassClient, CompassConfig, CompassDataset, CompassDevice, CompassImportSummary, CompassLocation } from "./types";

export type CompassBackupMode = "metadata" | "full";

const BACKUP_FORMAT = "client-compass-master-backup";
const BACKUP_SCHEMA_VERSION = 1;
const RESTORE_SHEET = "__RESTORE__";
const CLIENTS_SHEET = "Clients";
const INVENTORY_SHEET = "Inventory";
const SUMMARY_SHEET = "Backup Summary";
const SEGMENTS_SHEET = "Segments";
const JSON_CHUNK_SIZE = 30_000;

interface CompassMasterBackupPayload {
  format: typeof BACKUP_FORMAT;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  mode: CompassBackupMode;
  createdAt: string;
  appVersion: string;
  config: CompassConfig;
  segments: SegmentDefinition[];
  snapshot: {
    importedAt: string;
    importSourceName: string;
    importSummary: CompassImportSummary;
    clients: CompassClient[];
    locations: CompassLocation[];
    devices: CompassDevice[];
  };
}

export interface CompassBackupPreview {
  mode: CompassBackupMode;
  createdAt: string;
  appVersion: string;
  clientCount: number;
  deviceCount: number;
  segmentCount: number;
  sourceName: string;
}

export interface CompassBackupReadResult {
  payload: CompassMasterBackupPayload;
  preview: CompassBackupPreview;
}

export interface CompassBackupRestoreResult extends CompassBackupPreview {
  mergedIntoExistingInventory: boolean;
}

function backupFileName(mode: CompassBackupMode): string {
  const date = new Date().toISOString().slice(0, 10);
  return `Client Compass ${mode === "full" ? "Full" : "Metadata"} Backup ${date}.xlsx`;
}

function splitList(value: unknown): string[] {
  return String(value ?? "").split(/[;|]/).map((item) => item.trim()).filter(Boolean);
}

function booleanValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["true", "yes", "y", "1", "quoted"].includes(normalized);
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function clientsForSheet(clients: CompassClient[]) {
  return clients.map((client) => ({
    "Client ID": client.id,
    "Client Name": client.name,
    "Aliases": client.aliases.join("; "),
    "City": client.city,
    "State": client.state,
    "Market": client.market,
    "Industry": client.industry,
    "Tags": client.tags.join("; "),
    "Primary Contact": client.primaryContact,
    "Contact Role": client.primaryContactRole,
    "Contact Email": client.primaryContactEmail,
    "Contact Phone": client.primaryContactPhone,
    "Assigned Owner": client.assignedOwner,
    "Last Account Review": client.lastAccountReview,
    "Last Sales Interaction": client.lastSalesInteraction,
    "Last Quote Date": client.lastQuoteDate,
    "Quoted": client.quoted ? "Yes" : "No",
    "Next Follow Up": client.nextFollowUp,
    "Workflow Status": client.workflowStatus,
    "Internal Note": client.internalNote,
    "Record Review Needed": client.recordReviewNeeded ? "Yes" : "No",
    "Record Review Reason": client.recordReviewReason ?? "",
    "Review Status": client.reviewOutcome.status,
    "Reviewed At": client.reviewOutcome.reviewedAt,
    "Meeting Summary": client.reviewOutcome.meetingSummary,
    "Agreed Next Step": client.reviewOutcome.agreedNextStep,
    "Report Title": client.reviewOutcome.reportTitle,
    "Executive Summary": client.reviewOutcome.executiveSummary,
    "Last Data Refresh": client.lastDataRefresh,
    "Captain's Log Matched": client.captainsLog?.matched ? "Yes" : "No",
    "Captain's Log Company": client.captainsLog?.linkedCompany ?? "",
    "Captain's Log Synced At": client.captainsLog?.syncedAt ?? "",
    "Captain's Log Open Tasks": client.captainsLog?.openTaskCount ?? 0,
    "Captain's Log Activity Records": client.captainsLog?.recentActivity?.length ?? 0,
  }));
}

function inventoryForSheet(devices: CompassDevice[], locations: CompassLocation[]) {
  const locationById = new Map(locations.map((location) => [location.id, location.name]));
  return devices.map((device) => ({
    "Device ID": device.id,
    "Client ID": device.clientId,
    "Location": locationById.get(device.locationId) ?? device.locationId,
    "Device Name": device.name,
    "Organization": device.organization,
    "Type": device.deviceType,
    "Virtual": device.isVirtual ? "Yes" : "No",
    "Virtualization Platform": device.virtualizationPlatform,
    "Model": device.model,
    "Video Card": device.videoCard,
    "Operating System": device.osName,
    "Status": device.status,
    "Memory GiB": device.memoryGiB ?? "",
    "Disk Volume Source": device.diskVolumeSource,
    "Warranty Start": device.warrantyStart,
    "Warranty End": device.warrantyEnd,
    "Last Uptime": device.lastUptime,
    "Last Login": device.lastLogin,
    "Lifecycle": device.lifecycle,
    "Source": device.source,
  }));
}

function segmentsForSheet(segments: SegmentDefinition[]) {
  return segments.map((segment) => ({
    "Segment ID": segment.id,
    "Title": segment.title,
    "Description": segment.description,
    "Color": segment.color,
    "Icon": segment.icon,
    "Match Mode": segment.matchMode,
    "Rules": JSON.stringify(segment.rules),
    "Included Client IDs": segment.includeClientIds.join("; "),
    "Excluded Client IDs": segment.excludeClientIds.join("; "),
    "Stats": segment.stats.join("; "),
    "Order": segment.order,
    "Updated At": segment.updatedAt,
  }));
}

function addPayloadSheet(workbook: XLSX.WorkBook, payload: CompassMasterBackupPayload): void {
  const json = JSON.stringify(payload);
  const rows: string[][] = [[BACKUP_FORMAT], [String(BACKUP_SCHEMA_VERSION)]];
  for (let offset = 0; offset < json.length; offset += JSON_CHUNK_SIZE) rows.push([json.slice(offset, offset + JSON_CHUNK_SIZE)]);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), RESTORE_SHEET);
  const sheetIndex = workbook.SheetNames.indexOf(RESTORE_SHEET);
  workbook.Workbook ??= {};
  workbook.Workbook.Sheets ??= workbook.SheetNames.map(() => ({}));
  workbook.Workbook.Sheets[sheetIndex] = { ...(workbook.Workbook.Sheets[sheetIndex] ?? {}), Hidden: 2 };
}

function makeWorkbook(payload: CompassMasterBackupPayload): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    ["Client Compass master backup"],
    ["Backup type", payload.mode === "full" ? "Full — client data + inventory" : "Metadata — client data without inventory"],
    ["Created", payload.createdAt],
    ["App version", payload.appVersion],
    ["Clients", payload.snapshot.clients.length],
    ["Devices", payload.snapshot.devices.length],
    ["Segments", payload.segments.length],
    ["Source snapshot", payload.snapshot.importSourceName],
    [],
    ["Restore notes"],
    [payload.mode === "full"
      ? "A full restore replaces the current Client Compass client snapshot, including inventory."
      : "A metadata restore brings back client details, workflow/history, settings, and segments while preserving current inventory when it exists."],
  ]);
  summary["!cols"] = [{ wch: 24 }, { wch: 78 }];
  XLSX.utils.book_append_sheet(workbook, summary, SUMMARY_SHEET);

  const clients = XLSX.utils.json_to_sheet(clientsForSheet(payload.snapshot.clients));
  clients["!cols"] = Array.from({ length: 34 }, (_, index) => ({ wch: index === 1 ? 36 : index >= 24 && index <= 27 ? 42 : 20 }));
  XLSX.utils.book_append_sheet(workbook, clients, CLIENTS_SHEET);

  const segments = XLSX.utils.json_to_sheet(segmentsForSheet(payload.segments));
  segments["!cols"] = Array.from({ length: 12 }, (_, index) => ({ wch: index === 6 ? 60 : 22 }));
  XLSX.utils.book_append_sheet(workbook, segments, SEGMENTS_SHEET);

  if (payload.mode === "full") {
    const inventory = XLSX.utils.json_to_sheet(inventoryForSheet(payload.snapshot.devices, payload.snapshot.locations));
    inventory["!cols"] = Array.from({ length: 20 }, (_, index) => ({ wch: [3, 4, 8, 9, 10, 13].includes(index) ? 32 : 18 }));
    XLSX.utils.book_append_sheet(workbook, inventory, INVENTORY_SHEET);
  }

  addPayloadSheet(workbook, payload);
  return workbook;
}

function makePayload(mode: CompassBackupMode, dataset: CompassDataset, config: CompassConfig, segments: SegmentDefinition[]): CompassMasterBackupPayload {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    mode,
    createdAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    config: normalizeCompassConfig(config),
    segments,
    snapshot: {
      importedAt: dataset.importedAt,
      importSourceName: dataset.importSourceName,
      importSummary: dataset.importSummary,
      clients: dataset.clients,
      locations: mode === "full" ? dataset.locations : [],
      devices: mode === "full" ? dataset.devices : [],
    },
  };
}

export async function exportCompassMasterBackup(mode: CompassBackupMode): Promise<void> {
  const dataset = await loadCompassDataset();
  if (!dataset) throw new Error("There is no Client Compass client dataset to back up yet.");
  const payload = makePayload(mode, dataset, loadCompassConfig(), loadSegments());
  XLSX.writeFile(makeWorkbook(payload), backupFileName(mode), { compression: true });
}

function validPayload(value: unknown): value is CompassMasterBackupPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<CompassMasterBackupPayload>;
  return payload.format === BACKUP_FORMAT
    && payload.schemaVersion === BACKUP_SCHEMA_VERSION
    && (payload.mode === "metadata" || payload.mode === "full")
    && Boolean(payload.snapshot && Array.isArray(payload.snapshot.clients) && Array.isArray(payload.snapshot.devices) && Array.isArray(payload.snapshot.locations))
    && Boolean(payload.config)
    && Array.isArray(payload.segments);
}

function readEmbeddedPayload(workbook: XLSX.WorkBook): CompassMasterBackupPayload {
  const sheet = workbook.Sheets[RESTORE_SHEET];
  if (!sheet) throw new Error("This workbook is not a Client Compass master backup. Use a backup created from Settings > Backup & restore.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  if (text(rows[0]?.[0]) !== BACKUP_FORMAT) throw new Error("This backup uses an unrecognized Client Compass format.");
  const json = rows.slice(2).map((row) => text(row[0])).join("");
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!validPayload(parsed)) throw new Error("The backup payload is incomplete or incompatible.");
    return parsed;
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes("backup payload")) throw cause;
    throw new Error("The Client Compass backup payload could not be read. The file may be damaged.");
  }
}

function overlayEditableClientRows(payload: CompassMasterBackupPayload, workbook: XLSX.WorkBook): CompassMasterBackupPayload {
  const sheet = workbook.Sheets[CLIENTS_SHEET];
  if (!sheet) return payload;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (!rows.length) return payload;
  const byId = new Map(payload.snapshot.clients.map((client) => [client.id, client]));
  const byName = new Map(payload.snapshot.clients.map((client) => [normalizeOrganizationName(client.name), client]));
  const updates = new Map<string, CompassClient>();

  for (const row of rows) {
    const id = text(row["Client ID"]);
    const nameKey = normalizeOrganizationName(text(row["Client Name"]));
    const existing = byId.get(id) ?? byName.get(nameKey);
    if (!existing) continue;
    const reviewOutcome = {
      ...existing.reviewOutcome,
      status: text(row["Review Status"]) || existing.reviewOutcome.status,
      reviewedAt: text(row["Reviewed At"]),
      meetingSummary: text(row["Meeting Summary"]),
      agreedNextStep: text(row["Agreed Next Step"]),
      reportTitle: text(row["Report Title"]),
      executiveSummary: text(row["Executive Summary"]),
    } as CompassClient["reviewOutcome"];
    updates.set(existing.id, {
      ...existing,
      name: text(row["Client Name"]) || existing.name,
      aliases: splitList(row["Aliases"]),
      city: text(row["City"]),
      state: text(row["State"]),
      market: text(row["Market"]),
      industry: text(row["Industry"]),
      tags: splitList(row["Tags"]),
      primaryContact: text(row["Primary Contact"]),
      primaryContactRole: text(row["Contact Role"]),
      primaryContactEmail: text(row["Contact Email"]),
      primaryContactPhone: text(row["Contact Phone"]),
      assignedOwner: text(row["Assigned Owner"]),
      lastAccountReview: text(row["Last Account Review"]),
      lastSalesInteraction: text(row["Last Sales Interaction"]),
      lastQuoteDate: text(row["Last Quote Date"]),
      quoted: booleanValue(row["Quoted"]),
      nextFollowUp: text(row["Next Follow Up"]),
      workflowStatus: text(row["Workflow Status"]),
      internalNote: text(row["Internal Note"]),
      recordReviewNeeded: booleanValue(row["Record Review Needed"]),
      recordReviewReason: text(row["Record Review Reason"]),
      reviewOutcome,
      lastDataRefresh: text(row["Last Data Refresh"]),
    });
  }

  return {
    ...payload,
    snapshot: {
      ...payload.snapshot,
      clients: payload.snapshot.clients.map((client) => updates.get(client.id) ?? client),
    },
  };
}

export async function readCompassMasterBackup(file: File): Promise<CompassBackupReadResult> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const payload = overlayEditableClientRows(readEmbeddedPayload(workbook), workbook);
  const preview: CompassBackupPreview = {
    mode: payload.mode,
    createdAt: payload.createdAt,
    appVersion: payload.appVersion,
    clientCount: payload.snapshot.clients.length,
    deviceCount: payload.snapshot.devices.length,
    segmentCount: payload.segments.length,
    sourceName: payload.snapshot.importSourceName,
  };
  return { payload, preview };
}

function emptyInventorySummary(summary: CompassImportSummary): CompassImportSummary {
  return {
    ...summary,
    devicesDetected: 0,
    physicalServers: 0,
    virtualMachines: 0,
    workstations: 0,
    osConcerns: 0,
    storageConcerns: 0,
  };
}

function restoredDataset(payload: CompassMasterBackupPayload, current: CompassDataset | null, config: CompassConfig): { dataset: CompassDataset; mergedIntoExistingInventory: boolean } {
  if (payload.mode === "full") {
    const next: CompassDataset = {
      schemaVersion: 1,
      clients: payload.snapshot.clients,
      locations: payload.snapshot.locations,
      devices: payload.snapshot.devices,
      findings: [],
      summaries: [],
      importedAt: payload.snapshot.importedAt || payload.createdAt,
      importSourceName: payload.snapshot.importSourceName || "Client Compass full restore",
      importSummary: payload.snapshot.importSummary,
    };
    return { dataset: recalculateDataset(next, config), mergedIntoExistingInventory: false };
  }

  if (!current) {
    const next: CompassDataset = {
      schemaVersion: 1,
      clients: payload.snapshot.clients,
      locations: [],
      devices: [],
      findings: [],
      summaries: [],
      importedAt: payload.snapshot.importedAt || payload.createdAt,
      importSourceName: `${payload.snapshot.importSourceName || "Client Compass"} — metadata restore`,
      importSummary: emptyInventorySummary(payload.snapshot.importSummary),
    };
    return { dataset: recalculateDataset(next, config), mergedIntoExistingInventory: false };
  }

  const currentById = new Map(current.clients.map((client) => [client.id, client]));
  const currentByName = new Map<string, CompassClient>();
  for (const client of current.clients) {
    currentByName.set(normalizeOrganizationName(client.name), client);
    for (const alias of client.aliases) currentByName.set(normalizeOrganizationName(alias), client);
  }
  const matchedCurrentIds = new Set<string>();
  const restoredClients = payload.snapshot.clients.map((backedUp) => {
    const currentClient = currentById.get(backedUp.id) ?? currentByName.get(normalizeOrganizationName(backedUp.name));
    if (!currentClient) return backedUp;
    matchedCurrentIds.add(currentClient.id);
    return {
      ...backedUp,
      id: currentClient.id,
      aliases: [...new Set([...backedUp.aliases, ...currentClient.aliases])],
    };
  });
  for (const client of current.clients) if (!matchedCurrentIds.has(client.id)) restoredClients.push(client);

  const next: CompassDataset = {
    ...current,
    clients: restoredClients,
    importedAt: current.importedAt,
    importSourceName: current.importSourceName,
  };
  return { dataset: recalculateDataset(next, config), mergedIntoExistingInventory: current.devices.length > 0 };
}

export async function restoreCompassMasterBackup(payload: CompassMasterBackupPayload): Promise<CompassBackupRestoreResult> {
  if (!validPayload(payload)) throw new Error("The selected Client Compass backup is no longer valid.");
  const config = normalizeCompassConfig(payload.config);
  const current = await loadCompassDataset();
  const restored = restoredDataset(payload, current, config);
  await saveCompassConfigAndDataset(config, restored.dataset);
  saveSegments(payload.segments);
  return {
    mode: payload.mode,
    createdAt: payload.createdAt,
    appVersion: payload.appVersion,
    clientCount: restored.dataset.clients.length,
    deviceCount: restored.dataset.devices.length,
    segmentCount: payload.segments.length,
    sourceName: restored.dataset.importSourceName,
    mergedIntoExistingInventory: restored.mergedIntoExistingInventory,
  };
}
