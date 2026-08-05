import type { RawCompassRow } from "./types";

export type CompassImportField = Exclude<keyof RawCompassRow, "rowNumber">;

export const COMPASS_HEADER_ALIASES: Record<CompassImportField, readonly string[]> = {
  deviceName: ["Device", "Display Name", "Device Name", "Computer Name", "Computer"],
  organization: ["Organization", "Client", "Company", "Customer"],
  location: ["Location", "Site", "Office"],
  stableId: ["Agent ID", "Ninja Agent ID", "Device ID", "Serial Number", "BIOS Serial Number"],
  lastUptime: ["Last Uptime", "Last Uptime_formatted", "Last Online", "Last Check In", "Last Update"],
  videoCard: ["Video Card", "Graphics Card", "Display Adapter"],
  warrantyStart: ["Warranty Start Date", "Warranty Start Date_formatted", "Manufacturer Fulfillment Date", "Purchase Date"],
  warrantyEnd: ["Warranty End Date", "Warranty End Date_formatted", "Warranty Expiration", "Warranty Expiry"],
  lastLogin: ["Last Login", "Last User Login"],
  memoryGiB: ["Memory Capacity GiB", "Memory GiB", "Memory", "RAM"],
  osName: ["OS Name", "Operating System", "OS"],
  deviceStatus: ["Device Status", "Agent Status", "Status", "Active", "Is Active"],
  diskVolumeUsage: ["Disk Volume Usage", "Disk Volume Usage_formatted", "Volume Usage", "Disk Usage"],
  deviceModel: ["Device Model", "System Model", "Computer Model", "Model"],
};

export function normalizeCompassHeader(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
}

export function mapCompassHeaders(row: unknown[]): Partial<Record<CompassImportField, number>> {
  const normalized = row.map(normalizeCompassHeader);
  const result: Partial<Record<CompassImportField, number>> = {};
  for (const [field, aliases] of Object.entries(COMPASS_HEADER_ALIASES) as Array<[CompassImportField, readonly string[]]>) {
    const aliasSet = new Set(aliases.map(normalizeCompassHeader));
    const index = normalized.findIndex((value) => aliasSet.has(value));
    if (index >= 0) result[field] = index;
  }
  return result;
}

export function compassHeaderScore(map: Partial<Record<CompassImportField, number>>): number {
  return (map.deviceName !== undefined ? 5 : 0) + (map.organization !== undefined ? 5 : 0) + (map.osName !== undefined ? 2 : 0) + (map.deviceModel !== undefined ? 2 : 0) + Object.keys(map).length;
}
