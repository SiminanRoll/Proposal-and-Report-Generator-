import type { RawCompassRow } from "./types";

export type CompassImportField = Exclude<keyof RawCompassRow, "rowNumber">;

export const COMPASS_HEADER_ALIASES: Record<CompassImportField, readonly string[]> = {
  deviceName: ["Device", "Display Name", "Device Name", "Computer Name", "Computer"],
  organization: ["Organization", "Client", "Company", "Customer"],
  location: ["Location", "Site", "Office"],
  stableId: ["Agent ID", "Ninja Agent ID", "Device ID", "Serial Number", "BIOS Serial Number"],
  lastUptime: ["Last Uptime_formatted", "Last Uptime", "Last Online", "Last Check In", "Last Update"],
  processor: ["Processor", "CPU", "Processor Name", "CPU Model"],
  videoCard: ["Video Card", "Graphics Card", "Display Adapter"],
  warrantyStart: ["Warranty Start Date_formatted", "Warranty Start Date", "Manufacturer Fulfillment Date", "Purchase Date"],
  warrantyEnd: ["Warranty End Date_formatted", "Warranty Expiration Date_formatted", "Warranty End Date", "Warranty Expiration Date", "Warranty Expiration", "Warranty Expiry"],
  lastLogin: ["Last Login", "Last User Login"],
  memoryGiB: ["Memory Capacity GiB", "Memory GiB", "Memory", "RAM"],
  osName: ["OS Name", "Operating System", "OS"],
  deviceStatus: ["Device Status", "Agent Status", "Status", "Active", "Is Active"],
  diskVolumeUsage: ["Disk Volume Usage_formatted", "Disk Volume Usage", "Volume Usage", "Disk Usage"],
  sourceDeviceType: ["Device Type", "Ninja Device Type", "Asset Type"],
  deviceModel: ["Device Model", "System Model", "Computer Model", "Model"],
  purchaseDate: ["Purchase Date", "Purchased Date", "Acquisition Date"],
};

export function normalizeCompassHeader(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
}

export function mapCompassHeaders(row: unknown[]): Partial<Record<CompassImportField, number>> {
  const normalized = row.map(normalizeCompassHeader);
  const result: Partial<Record<CompassImportField, number>> = {};
  for (const [field, aliases] of Object.entries(COMPASS_HEADER_ALIASES) as Array<[CompassImportField, readonly string[]]>) {
    // Match by alias priority rather than physical column position. Ninja exports
    // can reorder columns, and when both raw and *_formatted fields are present
    // the formatted/specific value should win regardless of where it appears.
    let index = -1;
    for (const alias of aliases) {
      index = normalized.indexOf(normalizeCompassHeader(alias));
      if (index >= 0) break;
    }
    if (index >= 0) result[field] = index;
  }
  return result;
}

export function compassHeaderScore(map: Partial<Record<CompassImportField, number>>): number {
  return (map.deviceName !== undefined ? 5 : 0) + (map.organization !== undefined ? 5 : 0) + (map.osName !== undefined ? 2 : 0) + (map.deviceModel !== undefined ? 2 : 0) + Object.keys(map).length;
}
