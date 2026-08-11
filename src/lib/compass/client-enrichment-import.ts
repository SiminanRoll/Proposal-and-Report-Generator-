import * as XLSX from "xlsx";
import type { ClientEnrichmentRow } from "./client-enrichment";


function datePartsToIso(year: number, month: number, day: number): string {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return "";
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseClientEnrichmentDate(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) return datePartsToIso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? datePartsToIso(parsed.y, parsed.m, parsed.d) : "";
  }
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  let match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s.*)?$/);
  if (match) return datePartsToIso(Number(match[1]), Number(match[2]), Number(match[3]));
  match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:\s.*)?$/);
  if (match) {
    const yearValue = Number(match[3]);
    const year = yearValue < 100 ? (yearValue >= 70 ? 1900 + yearValue : 2000 + yearValue) : yearValue;
    return datePartsToIso(year, Number(match[1]), Number(match[2]));
  }
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return "";
  const date = new Date(parsed);
  return datePartsToIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export interface ParsedClientEnrichmentImport {
  sourceName: string;
  sheetName: string;
  totalRows: number;
  rows: ClientEnrichmentRow[];
  detectedHeaders: string[];
  invalidRows: Array<{ rowNumber: number; companyName: string; field: string; value: string }>;
  skippedEmptyRows: number;
}

type FieldName = Exclude<keyof ClientEnrichmentRow, "rowNumber" | "companyName" | "tags"> | "companyName" | "tags";

const HEADER_ALIASES: Record<FieldName, string[]> = {
  companyName: ["company", "company name", "client", "client name", "organization", "organization name", "practice", "practice name", "account", "account name"],
  city: ["city", "client city", "practice city"],
  state: ["state", "state code", "province", "region", "client state", "practice state"],
  market: ["market", "sales market", "territory", "region market"],
  industry: ["industry", "vertical", "business type", "practice type"],
  tags: ["client tags", "tags", "tag", "client type", "account tags", "status tags"],
  primaryContact: ["primary contact", "contact", "contact name", "primary contact name"],
  primaryContactRole: ["primary contact role", "contact role", "contact title", "title"],
  primaryContactEmail: ["primary contact email", "contact email", "email", "email address"],
  primaryContactPhone: ["primary contact phone", "contact phone", "phone", "phone number"],
  assignedOwner: ["assigned owner", "owner", "csm", "account owner", "client success manager"],
  technicalConsultant: ["tc", "tc name", "technical consultant", "technology consultant", "tech consultant"],
  lastAccountReview: ["last account review", "last account review date", "account review", "account review date", "last review", "last review date", "review date", "technology review date"],
  lastSalesInteraction: ["latest sales activity", "last sales activity", "last sales activity date", "sales activity", "sales activity date", "last sales interaction", "last sales interaction date", "sales interaction"],
  lastQuoteDate: ["last quote date", "quote date", "quoted last", "last quoted", "latest quote date", "most recent quote date", "proposal date", "last proposal date"],
  nextFollowUp: ["next follow up", "next follow-up", "follow up date", "follow-up date", "next action date"],
  workflowStatus: ["workflow status", "client status", "account status"],
  internalNote: ["internal note", "note", "notes", "relationship note"],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}
function indexFor(headers: string[], field: FieldName): number {
  const aliases = new Set(HEADER_ALIASES[field]);
  return headers.findIndex((header) => aliases.has(header));
}
function text(value: unknown): string { return String(value ?? "").trim(); }
function tags(value: unknown): string[] {
  return text(value).split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
}
function emptyRow(row: ClientEnrichmentRow): boolean {
  return !row.city && !row.state && !row.market && !row.industry && !row.tags.length && !row.primaryContact && !row.primaryContactRole && !row.primaryContactEmail && !row.primaryContactPhone && !row.assignedOwner && !row.technicalConsultant && !row.lastAccountReview && !row.lastSalesInteraction && !row.lastQuoteDate && !row.nextFollowUp && !row.workflowStatus && !row.internalNote;
}

export async function parseClientEnrichmentSpreadsheet(file: File): Promise<ParsedClientEnrichmentImport> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, dense: false });
  let best: { sheetName: string; rows: unknown[][]; headerIndex: number; indexes: Record<FieldName, number>; score: number } | null = null;
  const fields = Object.keys(HEADER_ALIASES) as FieldName[];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true, blankrows: false });
    for (let headerIndex = 0; headerIndex < Math.min(rows.length, 30); headerIndex += 1) {
      const headers = rows[headerIndex].map(normalizeHeader);
      const indexes = Object.fromEntries(fields.map((field) => [field, indexFor(headers, field)])) as Record<FieldName, number>;
      const recognized = fields.filter((field) => indexes[field] >= 0).length;
      const score = (indexes.companyName >= 0 ? 5 : 0) + recognized;
      if (!best || score > best.score) best = { sheetName, rows, headerIndex, indexes, score };
    }
  }
  if (!best || best.indexes.companyName < 0 || Object.entries(best.indexes).filter(([field, index]) => field !== "companyName" && index >= 0).length === 0) {
    throw new Error("No supported client-enrichment header row was found. Include Company Name plus at least one client record field such as City, State, Territory/Market, Industry, Primary Contact, Last Account Review Date, Last Sales Activity, TC, or Last Quote Date.");
  }

  const parsedRows: ClientEnrichmentRow[] = [];
  const invalidRows: ParsedClientEnrichmentImport["invalidRows"] = [];
  let totalRows = 0;
  let skippedEmptyRows = 0;
  const value = (source: unknown[], field: FieldName) => best!.indexes[field] >= 0 ? source[best!.indexes[field]] : "";
  const parseDateField = (source: unknown[], field: "lastAccountReview" | "lastSalesInteraction" | "lastQuoteDate" | "nextFollowUp", rowNumber: number, companyName: string): string => {
    const raw = value(source, field);
    const rawText = raw instanceof Date ? raw.toLocaleDateString("en-US") : text(raw);
    if (!rawText) return "";
    const parsed = parseClientEnrichmentDate(raw);
    if (!parsed) invalidRows.push({ rowNumber, companyName, field, value: rawText });
    return parsed;
  };

  best.rows.slice(best.headerIndex + 1).forEach((sourceRow, offset) => {
    if (!sourceRow.some((item) => text(item))) return;
    const rowNumber = best!.headerIndex + offset + 2;
    totalRows += 1;
    const companyName = text(value(sourceRow, "companyName"));
    if (!companyName) { invalidRows.push({ rowNumber, companyName: "", field: "companyName", value: "" }); return; }
    const row: ClientEnrichmentRow = {
      rowNumber,
      companyName,
      city: text(value(sourceRow, "city")),
      state: text(value(sourceRow, "state")).toUpperCase(),
      market: text(value(sourceRow, "market")),
      industry: text(value(sourceRow, "industry")),
      tags: tags(value(sourceRow, "tags")),
      primaryContact: text(value(sourceRow, "primaryContact")),
      primaryContactRole: text(value(sourceRow, "primaryContactRole")),
      primaryContactEmail: text(value(sourceRow, "primaryContactEmail")),
      primaryContactPhone: text(value(sourceRow, "primaryContactPhone")),
      assignedOwner: text(value(sourceRow, "assignedOwner")),
      technicalConsultant: text(value(sourceRow, "technicalConsultant")),
      lastAccountReview: parseDateField(sourceRow, "lastAccountReview", rowNumber, companyName),
      lastSalesInteraction: parseDateField(sourceRow, "lastSalesInteraction", rowNumber, companyName),
      lastQuoteDate: parseDateField(sourceRow, "lastQuoteDate", rowNumber, companyName),
      nextFollowUp: parseDateField(sourceRow, "nextFollowUp", rowNumber, companyName),
      workflowStatus: text(value(sourceRow, "workflowStatus")),
      internalNote: text(value(sourceRow, "internalNote")),
    };
    if (emptyRow(row)) { skippedEmptyRows += 1; return; }
    parsedRows.push(row);
  });
  if (!parsedRows.length) throw new Error("The file contains no populated client-enrichment values.");
  return {
    sourceName: file.name,
    sheetName: best.sheetName,
    totalRows,
    rows: parsedRows,
    detectedHeaders: fields.filter((field) => best!.indexes[field] >= 0).map((field) => String(best!.rows[best!.headerIndex][best!.indexes[field]] ?? field)),
    invalidRows,
    skippedEmptyRows,
  };
}