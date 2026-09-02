import * as XLSX from "xlsx";
import { buildImportPreview, recalculateDataset } from "./engine";
import { compassHeaderScore, mapCompassHeaders, type CompassImportField } from "./headers";
import type { CompassConfig, CompassDataset, CompassDevice, CompassLocation, ParsedCompassImport, RawCompassRow } from "./types";
import { isTechnicalInactive, isTechnicalStale, technicalActivityDate } from "@/lib/technical-truth";

const STORAGE_KEY = "client-compass.company-inventory-corrections.v1";

export interface CompanyInventoryCorrectionSnapshot {
  clientId: string;
  clientName: string;
  sourceName: string;
  sourceOrganization: string;
  updatedAt: string;
  devices: CompassDevice[];
  locations: CompassLocation[];
}

export interface PreparedCompanyInventoryCorrection {
  dataset: CompassDataset;
  snapshot: CompanyInventoryCorrectionSnapshot;
  deviceCount: number;
  sourceOrganization: string;
}

type CorrectionStore = Record<string, CompanyInventoryCorrectionSnapshot>;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function cell(row: unknown[], index: number | undefined): string {
  return index === undefined ? "" : clean(row[index]);
}

function normalizeOrganization(value: string): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function correctionStore(): CorrectionStore {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as CorrectionStore;
  } catch {
    return {};
  }
}

function writeCorrectionStore(store: CorrectionStore): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  // Same-tab localStorage writes do not fire the native storage event. Emit it
  // so the existing durable recovery mirror captures inventory corrections too.
  window.dispatchEvent(new Event("storage"));
}

export function loadCompanyInventoryCorrections(): CorrectionStore {
  return correctionStore();
}

export function companyInventoryCorrectionFor(clientId: string): CompanyInventoryCorrectionSnapshot | null {
  return correctionStore()[clientId] ?? null;
}

export function saveCompanyInventoryCorrection(snapshot: CompanyInventoryCorrectionSnapshot): void {
  const store = correctionStore();
  store[snapshot.clientId] = structuredClone(snapshot);
  writeCorrectionStore(store);
}

export function clearCompanyInventoryCorrection(clientId: string): void {
  const store = correctionStore();
  if (!(clientId in store)) return;
  delete store[clientId];
  writeCorrectionStore(store);
}

export function latestDeviceActivity(device: Pick<CompassDevice, "lastUptime" | "lastLogin">): Date | null {
  return technicalActivityDate(device.lastUptime, device.lastLogin);
}

export function possiblyInactiveDevice(device: Pick<CompassDevice, "lastUptime" | "lastLogin" | "status">, config: CompassConfig, now = new Date()): boolean {
  if (isTechnicalInactive(device.status)) return false;
  return isTechnicalStale(device.lastUptime, device.lastLogin, now, config.thresholds.staleDeviceMonths);
}

/**
 * Company-level inventory imports deliberately need only a Device column.
 * Organization is optional because the company has already been selected in
 * Client Compass. If an Organization column is present, more than one source
 * organization is rejected so a full multi-client export cannot accidentally
 * be assigned to one company.
 */
export async function parseCompanyInventorySpreadsheet(file: File, targetCompanyName: string): Promise<ParsedCompassImport> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false, dense: false });
  let best: { headerIndex: number; map: Partial<Record<CompassImportField, number>>; rows: unknown[][]; score: number } | null = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false, blankrows: false });
    for (let index = 0; index < Math.min(rows.length, 40); index += 1) {
      const map = mapCompassHeaders(rows[index]);
      if (map.deviceName === undefined) continue;
      const score = compassHeaderScore(map);
      if (!best || score > best.score) best = { headerIndex: index, map, rows, score };
    }
  }

  if (!best || best.map.deviceName === undefined) {
    throw new Error("No supported device header row was found. Include at least a Device or Device Name column.");
  }

  const sourceRows = best.rows.slice(best.headerIndex + 1);
  const rows: RawCompassRow[] = [];
  let rejectedRows = 0;
  sourceRows.forEach((row, offset) => {
    const hasAnyValue = row.some((value) => clean(value));
    if (!hasAnyValue) return;
    const deviceName = cell(row, best?.map.deviceName);
    if (!deviceName) {
      rejectedRows += 1;
      return;
    }
    rows.push({
      rowNumber: best!.headerIndex + offset + 2,
      organization: cell(row, best?.map.organization),
      location: cell(row, best?.map.location),
      stableId: cell(row, best?.map.stableId),
      deviceName,
      deviceModel: cell(row, best?.map.deviceModel),
      processor: cell(row, best?.map.processor),
      videoCard: cell(row, best?.map.videoCard),
      osName: cell(row, best?.map.osName),
      deviceStatus: cell(row, best?.map.deviceStatus),
      memoryGiB: cell(row, best?.map.memoryGiB),
      diskVolumeUsage: cell(row, best?.map.diskVolumeUsage),
      sourceDeviceType: cell(row, best?.map.sourceDeviceType),
      warrantyStart: cell(row, best?.map.warrantyStart),
      warrantyEnd: cell(row, best?.map.warrantyEnd),
      lastUptime: cell(row, best?.map.lastUptime),
      lastLogin: cell(row, best?.map.lastLogin),
      purchaseDate: cell(row, best?.map.purchaseDate),
    });
  });

  if (!rows.length) throw new Error("The spreadsheet contains no device rows to import.");

  const organizations = new Map<string, string>();
  for (const row of rows) {
    const organization = clean(row.organization);
    const normalized = normalizeOrganization(organization);
    if (normalized && !organizations.has(normalized)) organizations.set(normalized, organization);
  }
  if (organizations.size > 1) {
    throw new Error("This file contains more than one organization. Use a single-company inventory export for a company-level correction.");
  }
  const sourceOrganization = [...organizations.values()][0] || clean(targetCompanyName);
  const completedRows = rows.map((row) => ({ ...row, organization: clean(row.organization) || sourceOrganization || clean(targetCompanyName) }));
  const detectedHeaders = Object.entries(best.map).filter(([, index]) => index !== undefined).map(([field]) => field);
  return { sourceName: file.name, rows: completedRows, totalRows: completedRows.length + rejectedRows, rejectedRows, detectedHeaders };
}

export function prepareCompanyInventoryCorrection(
  dataset: CompassDataset,
  clientId: string,
  parsed: ParsedCompassImport,
  config: CompassConfig,
  now = new Date(),
): PreparedCompanyInventoryCorrection {
  const client = dataset.clients.find((item) => item.id === clientId);
  if (!client) throw new Error("The selected company could not be found in the current Client Compass dataset.");
  if (!parsed.rows.length) throw new Error("The selected file contains no device rows.");

  const organizations = new Map<string, string>();
  for (const row of parsed.rows) {
    const organization = clean(row.organization);
    const normalized = normalizeOrganization(organization);
    if (normalized && !organizations.has(normalized)) organizations.set(normalized, organization);
  }
  if (organizations.size > 1) {
    throw new Error("This file contains more than one organization. A company-level correction can replace only one company's inventory.");
  }
  const sourceOrganization = [...organizations.values()][0] || client.name;

  // This import is already scoped to a selected company. Do not ask the normal
  // organization resolver to infer the relationship again from punctuation,
  // legal suffixes, or a source-system organization label. Route every row
  // through a private token that resolves only to the selected client.
  const selectedCompanyToken = `__client_compass_inventory_target_${client.id}__`;
  const scoped: ParsedCompassImport = {
    ...parsed,
    rows: parsed.rows.map((row) => ({ ...row, organization: selectedCompanyToken })),
  };
  const miniExisting: CompassDataset = {
    ...dataset,
    clients: [client],
    locations: [],
    devices: [],
    findings: [],
    summaries: [],
  };
  const preview = buildImportPreview(
    scoped,
    miniExisting,
    { [selectedCompanyToken]: { mode: "existing", clientId } },
    config,
    now,
  );
  if (!preview.dataset || preview.unresolvedOrganizations.length) {
    throw new Error("Client Compass could not assign the imported devices to the selected company.");
  }
  const importedDevices = preview.dataset.devices
    .filter((device) => device.clientId === clientId)
    .map((device) => ({ ...device, organization: client.name }));
  const importedLocations = preview.dataset.locations.filter((location) => location.clientId === clientId);
  if (!importedDevices.length) throw new Error("No usable devices were found in the selected file.");

  const updatedAt = now.toISOString();
  const merged: CompassDataset = {
    ...dataset,
    clients: dataset.clients.map((item) => item.id === clientId ? { ...item, lastDataRefresh: updatedAt } : item),
    devices: [...dataset.devices.filter((device) => device.clientId !== clientId), ...importedDevices],
    locations: [...dataset.locations.filter((location) => location.clientId !== clientId), ...importedLocations],
  };
  const next = recalculateDataset(merged, config, now);
  const snapshot: CompanyInventoryCorrectionSnapshot = {
    clientId,
    clientName: client.name,
    sourceName: parsed.sourceName,
    sourceOrganization,
    updatedAt,
    devices: structuredClone(importedDevices),
    locations: structuredClone(importedLocations),
  };
  return { dataset: next, snapshot, deviceCount: importedDevices.length, sourceOrganization };
}

function deviceReferenceShape(device: CompassDevice) {
  return {
    id: device.id,
    clientId: device.clientId,
    locationId: device.locationId,
    name: device.name,
    organization: device.organization,
    deviceType: device.deviceType,
    isVirtual: device.isVirtual,
    virtualizationPlatform: device.virtualizationPlatform,
    model: device.model,
    processor: device.processor ?? "",
    videoCard: device.videoCard,
    osName: device.osName,
    status: device.status,
    memoryGiB: device.memoryGiB,
    sourceDeviceType: device.sourceDeviceType ?? "",
    purchaseDate: device.purchaseDate ?? "",
    diskVolumeSource: device.diskVolumeSource,
    warrantyStart: device.warrantyStart,
    warrantyEnd: device.warrantyEnd,
    lastUptime: device.lastUptime,
    lastLogin: device.lastLogin,
    source: device.source,
  };
}

function snapshotMatchesDataset(dataset: CompassDataset, snapshot: CompanyInventoryCorrectionSnapshot): boolean {
  // Lifecycle and parsed storage states are recalculated over time/config changes,
  // so compare only the source/reference fields that define the imported device.
  const currentDevices = dataset.devices.filter((device) => device.clientId === snapshot.clientId).map(deviceReferenceShape).sort((a, b) => a.id.localeCompare(b.id));
  const expectedDevices = snapshot.devices.map(deviceReferenceShape).sort((a, b) => a.id.localeCompare(b.id));
  const currentLocations = dataset.locations.filter((location) => location.clientId === snapshot.clientId).sort((a, b) => a.id.localeCompare(b.id));
  const expectedLocations = [...snapshot.locations].sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(currentDevices) === JSON.stringify(expectedDevices) && JSON.stringify(currentLocations) === JSON.stringify(expectedLocations);
}

/**
 * Manual company corrections remain authoritative across later full inventory
 * refreshes until the user explicitly releases the correction. This is what
 * turns the one-company import into a durable reference point instead of a
 * one-session patch.
 */
export function restoreStoredCompanyInventoryCorrections(dataset: CompassDataset, config: CompassConfig, now = new Date()): { dataset: CompassDataset; changed: boolean } {
  const store = correctionStore();
  const snapshots = Object.values(store).filter((snapshot) => dataset.clients.some((client) => client.id === snapshot.clientId));
  const needingRestore = snapshots.filter((snapshot) => !snapshotMatchesDataset(dataset, snapshot));
  if (!needingRestore.length) return { dataset, changed: false };

  const correctedClientIds = new Set(needingRestore.map((snapshot) => snapshot.clientId));
  const devices = dataset.devices.filter((device) => !correctedClientIds.has(device.clientId));
  const locations = dataset.locations.filter((location) => !correctedClientIds.has(location.clientId));
  for (const snapshot of needingRestore) {
    devices.push(...structuredClone(snapshot.devices));
    locations.push(...structuredClone(snapshot.locations));
  }
  const clients = dataset.clients.map((client) => {
    const snapshot = needingRestore.find((item) => item.clientId === client.id);
    return snapshot ? { ...client, lastDataRefresh: snapshot.updatedAt } : client;
  });
  return { dataset: recalculateDataset({ ...dataset, clients, devices, locations }, config, now), changed: true };
}
