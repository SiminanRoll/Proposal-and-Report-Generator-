import type { Project, SourceFileRecord } from "@/lib/projects/types";
import { lifecycleDevices, type ClientReportDevice } from "./client-report-data";

interface DiagnosticInventoryRecord extends ClientReportDevice {
  sourceDeviceId?: string;
  sourceDeviceName?: string;
  authoritative?: boolean;
  sourceName?: string;
}

export interface InventoryDiagnosticRow {
  origin: "Ninja / Client Compass" | "Primary lifecycle source" | "Lifecycle enrichment" | "Report output";
  sourceFile: string;
  sourceDeviceId: string;
  sourceDeviceName: string;
  normalizedName: string;
  reportDeviceName: string;
  deviceType: string;
  location: string;
  lifecycleStatus: string;
  includedInReport: boolean;
  lifecycleMatch: string;
  identityReview: boolean;
  disposition: string;
}

export interface InventoryDiagnostics {
  generatedAt: string;
  clientName: string;
  authoritativeSource: string;
  authoritativeTotal: number;
  reportTotal: number;
  lifecycleSourceTotal: number;
  authoritativeMissingFromReport: number;
  reportOnly: number;
  lifecycleOnly: number;
  identityReview: number;
  passed: boolean;
  rows: InventoryDiagnosticRow[];
}

function cleanName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F-\u009F\uE000-\uF8FF\uFFFE\uFFFF]+/g, "-")
    .replace(/\s*([._-])\s*/g, "$1")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .trim();
}

function exactIdentity(value: unknown): string {
  return cleanName(value).toLowerCase();
}

function compactIdentity(value: unknown): string {
  return exactIdentity(value).replace(/[^a-z0-9]/g, "");
}

function serialIdentity(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseInventory(file: SourceFileRecord): DiagnosticInventoryRecord[] {
  const value = file.analysis?.facts.find((item) => item.key === "scalepad.inventory")?.value;
  const entries = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return entries.flatMap((entry) => {
    try {
      const parsed = JSON.parse(String(entry)) as DiagnosticInventoryRecord;
      return parsed.name ? [{ ...parsed, name: cleanName(parsed.name) }] : [];
    } catch {
      return [];
    }
  });
}

function isAuthoritativeFile(file: SourceFileRecord): boolean {
  if (file.mimeType === "application/x-client-compass-snapshot") return true;
  return Boolean(file.analysis?.facts.find((item) => item.key === "compass.authoritativeInventory")?.value);
}

function uniqueMatch(base: DiagnosticInventoryRecord, candidates: DiagnosticInventoryRecord[]): { record?: DiagnosticInventoryRecord; method: string } {
  const id = String(base.sourceDeviceId ?? "").trim();
  if (id) {
    const matches = candidates.filter((candidate) => String(candidate.sourceDeviceId ?? "").trim() === id);
    if (matches.length === 1) return { record: matches[0], method: "Stable Client Compass device ID" };
  }
  const serial = serialIdentity(base.serial);
  if (serial) {
    const matches = candidates.filter((candidate) => serialIdentity(candidate.serial) === serial);
    if (matches.length === 1) return { record: matches[0], method: "Exact serial number" };
  }
  const exact = exactIdentity(base.name);
  if (exact) {
    const matches = candidates.filter((candidate) => exactIdentity(candidate.name) === exact);
    if (matches.length === 1) return { record: matches[0], method: "Exact normalized device name" };
  }
  const compact = compactIdentity(base.name);
  if (compact.length >= 5) {
    const matches = candidates.filter((candidate) => compactIdentity(candidate.name) === compact);
    if (matches.length === 1) return { record: matches[0], method: "Unique punctuation-insensitive name" };
  }
  return { method: "No safe match" };
}

function suspiciousName(value: string): boolean {
  const name = cleanName(value);
  return !name || /[\u0000-\u001F\u007F-\u009F\uE000-\uF8FF\uFFFE\uFFFF]/.test(value) || /^(?:(?:Last)?Check-?In|WarrantyExpiry|WarrantyExpires)/i.test(name);
}

export function buildInventoryDiagnostics(project: Project, generatedAt = new Date().toISOString()): InventoryDiagnostics {
  const lifecycleFiles = project.sources.flatMap((source) => source.files).filter((file) => file.analysis?.sourceType === "scalepad");
  const authoritativeFile = lifecycleFiles.find(isAuthoritativeFile);
  const primaryFile = authoritativeFile ?? lifecycleFiles[0];
  const authoritative = primaryFile ? parseInventory(primaryFile) : [];
  const authoritativeOrigin: InventoryDiagnosticRow["origin"] = authoritativeFile ? "Ninja / Client Compass" : "Primary lifecycle source";
  const enrichmentFiles = lifecycleFiles.filter((file) => file !== primaryFile);
  const enrichment = enrichmentFiles.flatMap((file) => parseInventory(file).map((record) => ({ record, file })));
  const report = lifecycleDevices(project) as DiagnosticInventoryRecord[];
  const usedReport = new Set<DiagnosticInventoryRecord>();
  const usedEnrichment = new Set<DiagnosticInventoryRecord>();
  const rows: InventoryDiagnosticRow[] = [];

  for (const source of authoritative) {
    const reportMatch = uniqueMatch(source, report);
    if (reportMatch.record) usedReport.add(reportMatch.record);
    const enrichmentMatch = uniqueMatch(source, enrichment.map((item) => item.record));
    if (enrichmentMatch.record) usedEnrichment.add(enrichmentMatch.record);
    const enrichmentFile = enrichment.find((item) => item.record === enrichmentMatch.record)?.file;
    const review = suspiciousName(String(source.sourceDeviceName || source.name));
    rows.push({
      origin: authoritativeOrigin,
      sourceFile: primaryFile?.name ?? "Lifecycle source",
      sourceDeviceId: String(source.sourceDeviceId ?? ""),
      sourceDeviceName: String(source.sourceDeviceName || source.name),
      normalizedName: cleanName(source.name),
      reportDeviceName: reportMatch.record ? cleanName(reportMatch.record.name) : "",
      deviceType: String(source.type ?? "unknown"),
      location: String(source.location ?? ""),
      lifecycleStatus: String(reportMatch.record?.lifecycleStatus ?? source.lifecycleStatus ?? "unknown"),
      includedInReport: Boolean(reportMatch.record),
      lifecycleMatch: enrichmentMatch.record ? `${enrichmentMatch.method} · ${enrichmentFile?.name ?? "lifecycle source"}` : "No lifecycle enrichment match",
      identityReview: review,
      disposition: reportMatch.record ? "Included from authoritative inventory" : "ERROR: authoritative device did not reach report output",
    });
  }

  for (const { record, file } of enrichment) {
    if (usedEnrichment.has(record)) continue;
    rows.push({
      origin: "Lifecycle enrichment",
      sourceFile: file.name,
      sourceDeviceId: String(record.sourceDeviceId ?? ""),
      sourceDeviceName: String(record.sourceDeviceName || record.name),
      normalizedName: cleanName(record.name),
      reportDeviceName: "",
      deviceType: String(record.type ?? "unknown"),
      location: String(record.location ?? ""),
      lifecycleStatus: String(record.lifecycleStatus ?? "unknown"),
      includedInReport: false,
      lifecycleMatch: "Not present in authoritative inventory",
      identityReview: suspiciousName(String(record.sourceDeviceName || record.name)),
      disposition: "Enrichment only — not added because Ninja / Client Compass is authoritative",
    });
  }

  for (const record of report) {
    if (usedReport.has(record)) continue;
    rows.push({
      origin: "Report output",
      sourceFile: "Generated report payload",
      sourceDeviceId: String(record.sourceDeviceId ?? ""),
      sourceDeviceName: String(record.sourceDeviceName || record.name),
      normalizedName: cleanName(record.name),
      reportDeviceName: cleanName(record.name),
      deviceType: String(record.type ?? "unknown"),
      location: String(record.location ?? ""),
      lifecycleStatus: String(record.lifecycleStatus ?? "unknown"),
      includedInReport: true,
      lifecycleMatch: "No authoritative source match",
      identityReview: true,
      disposition: "ERROR: report-only record not traced to Ninja / Client Compass",
    });
  }

  const authoritativeMissingFromReport = rows.filter((row) => (row.origin === "Ninja / Client Compass" || row.origin === "Primary lifecycle source") && !row.includedInReport).length;
  const reportOnly = rows.filter((row) => row.origin === "Report output").length;
  const lifecycleOnly = rows.filter((row) => row.origin === "Lifecycle enrichment").length;
  const identityReview = rows.filter((row) => row.identityReview).length;
  return {
    generatedAt,
    clientName: project.client.name,
    authoritativeSource: primaryFile?.name ?? "No lifecycle inventory source",
    authoritativeTotal: authoritative.length,
    reportTotal: report.length,
    lifecycleSourceTotal: enrichment.length,
    authoritativeMissingFromReport,
    reportOnly,
    lifecycleOnly,
    identityReview,
    passed: authoritative.length > 0 && authoritativeMissingFromReport === 0 && reportOnly === 0 && authoritative.length === report.length,
    rows,
  };
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function inventoryDiagnosticsCsv(project: Project): string {
  const diagnostics = buildInventoryDiagnostics(project);
  const summary = [
    ["Client", diagnostics.clientName],
    ["Generated", diagnostics.generatedAt],
    ["Authoritative source", diagnostics.authoritativeSource],
    ["Authoritative Ninja / Client Compass devices", diagnostics.authoritativeTotal],
    ["Report output devices", diagnostics.reportTotal],
    ["Lifecycle enrichment rows", diagnostics.lifecycleSourceTotal],
    ["Authoritative devices missing from report", diagnostics.authoritativeMissingFromReport],
    ["Report-only records", diagnostics.reportOnly],
    ["Lifecycle-source-only records", diagnostics.lifecycleOnly],
    ["Identity review flags", diagnostics.identityReview],
    ["Reconciliation passed", diagnostics.passed ? "Yes" : "No"],
  ].map((row) => row.map(csvCell).join(","));
  const headers = ["Origin", "Source file", "Source device ID", "Source device name", "Normalized name", "Report device name", "Device type", "Location", "Lifecycle status", "Included in report", "Lifecycle match", "Identity review", "Disposition"];
  const rows = diagnostics.rows.map((row) => [row.origin, row.sourceFile, row.sourceDeviceId, row.sourceDeviceName, row.normalizedName, row.reportDeviceName, row.deviceType, row.location, row.lifecycleStatus, row.includedInReport ? "Yes" : "No", row.lifecycleMatch, row.identityReview ? "Yes" : "No", row.disposition].map(csvCell).join(","));
  return `\uFEFF${summary.join("\r\n")}\r\n\r\n${headers.map(csvCell).join(",")}\r\n${rows.join("\r\n")}`;
}

export function downloadInventoryDiagnostics(project: Project): void {
  const blob = new Blob([inventoryDiagnosticsCsv(project)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${project.client.name || "client"}-inventory-reconciliation.csv`.replace(/[^a-z0-9._-]+/gi, "-");
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
