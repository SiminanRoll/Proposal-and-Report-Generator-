import * as XLSX from "xlsx";
import type { ParsedCompassImport, RawCompassRow } from "./types";

import { compassHeaderScore, mapCompassHeaders, type CompassImportField } from "./headers";

function cell(row: unknown[], index: number | undefined): string { return index === undefined ? "" : String(row[index] ?? "").trim(); }

export async function parseCompassSpreadsheet(file: File): Promise<ParsedCompassImport> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false, dense: false });
  let best: { sheetName: string; headerIndex: number; map: Partial<Record<CompassImportField, number>>; rows: unknown[][]; score: number } | null = null;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false, blankrows: false });
    for (let index = 0; index < Math.min(rows.length, 40); index += 1) {
      const map = mapCompassHeaders(rows[index]);
      const score = compassHeaderScore(map);
      if (!best || score > best.score) best = { sheetName, headerIndex: index, map, rows, score };
    }
  }
  if (!best || best.map.deviceName === undefined || best.map.organization === undefined) throw new Error("No supported Ninja device header row was found. Include at least Device and Organization columns.");
  const sourceRows = best.rows.slice(best.headerIndex + 1);
  const rows: RawCompassRow[] = [];
  let rejectedRows = 0;
  sourceRows.forEach((row, offset) => {
    const deviceName = cell(row, best?.map.deviceName);
    const organization = cell(row, best?.map.organization);
    const hasAnyValue = row.some((value) => String(value ?? "").trim());
    if (!hasAnyValue) return;
    if (!deviceName || !organization) { rejectedRows += 1; return; }
    rows.push({
      rowNumber: best!.headerIndex + offset + 2,
      organization,
      location: cell(row, best?.map.location),
      deviceName,
      stableId: cell(row, best?.map.stableId),
      lastUptime: cell(row, best?.map.lastUptime),
      videoCard: cell(row, best?.map.videoCard),
      warrantyStart: cell(row, best?.map.warrantyStart),
      warrantyEnd: cell(row, best?.map.warrantyEnd),
      lastLogin: cell(row, best?.map.lastLogin),
      memoryGiB: cell(row, best?.map.memoryGiB),
      osName: cell(row, best?.map.osName),
      deviceStatus: cell(row, best?.map.deviceStatus),
      diskVolumeUsage: cell(row, best?.map.diskVolumeUsage),
      deviceModel: cell(row, best?.map.deviceModel),
    });
  });
  if (!rows.length) throw new Error("The spreadsheet contains no complete device rows with both Device and Organization values.");
  const detectedHeaders = Object.entries(best.map).filter(([, index]) => index !== undefined).map(([field]) => field);
  return { sourceName: file.name, rows, totalRows: rows.length + rejectedRows, rejectedRows, detectedHeaders };
}
