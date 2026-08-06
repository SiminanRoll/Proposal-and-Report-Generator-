import * as XLSX from "xlsx";
import type { ReviewHistoryRow } from "./review-history";

export interface ParsedReviewHistoryImport {
  sourceName: string;
  sheetName: string;
  totalRows: number;
  rows: ReviewHistoryRow[];
  skippedBlankDates: number;
  invalidRows: Array<{ rowNumber: number; companyName: string; value: string }>;
  detectedHeaders: string[];
}

const COMPANY_HEADERS = new Set([
  "company", "company name", "client", "client name", "organization", "organization name", "practice", "practice name", "account", "account name",
]);
const REVIEW_DATE_HEADERS = new Set([
  "last account review", "last account review date", "account review", "account review date", "last review", "last review date", "review date", "technology review", "technology review date",
]);

function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function datePartsToIso(year: number, month: number, day: number): string {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return "";
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseReviewDate(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) return datePartsToIso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? datePartsToIso(parsed.y, parsed.m, parsed.d) : "";
  }
  const text = String(value ?? "").trim();
  if (!text) return "";
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s.*)?$/);
  if (match) return datePartsToIso(Number(match[1]), Number(match[2]), Number(match[3]));
  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:\s.*)?$/);
  if (match) {
    const yearValue = Number(match[3]);
    const year = yearValue < 100 ? (yearValue >= 70 ? 1900 + yearValue : 2000 + yearValue) : yearValue;
    return datePartsToIso(year, Number(match[1]), Number(match[2]));
  }
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return "";
  const date = new Date(parsed);
  return datePartsToIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export async function parseReviewHistorySpreadsheet(file: File): Promise<ParsedReviewHistoryImport> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, dense: false });
  let best: { sheetName: string; rows: unknown[][]; headerIndex: number; companyIndex: number; reviewDateIndex: number; score: number } | null = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true, blankrows: false });
    for (let headerIndex = 0; headerIndex < Math.min(rows.length, 30); headerIndex += 1) {
      const headers = rows[headerIndex].map(normalizeHeader);
      const companyIndex = headers.findIndex((header: string) => COMPANY_HEADERS.has(header));
      const reviewDateIndex = headers.findIndex((header: string) => REVIEW_DATE_HEADERS.has(header));
      const score = (companyIndex >= 0 ? 1 : 0) + (reviewDateIndex >= 0 ? 1 : 0);
      if (!best || score > best.score) best = { sheetName, rows, headerIndex, companyIndex, reviewDateIndex, score };
    }
  }

  if (!best || best.companyIndex < 0 || best.reviewDateIndex < 0) {
    throw new Error("No supported review-history header row was found. Include Company Name and Last Account Review Date columns.");
  }

  const rows: ReviewHistoryRow[] = [];
  const invalidRows: ParsedReviewHistoryImport["invalidRows"] = [];
  let skippedBlankDates = 0;
  let totalRows = 0;
  best.rows.slice(best.headerIndex + 1).forEach((sourceRow, offset) => {
    const rowNumber = best!.headerIndex + offset + 2;
    const companyName = String(sourceRow[best!.companyIndex] ?? "").trim();
    const rawDate = sourceRow[best!.reviewDateIndex];
    const rawDateText = rawDate instanceof Date ? rawDate.toLocaleDateString("en-US") : String(rawDate ?? "").trim();
    const hasAnyValue = sourceRow.some((value) => String(value ?? "").trim());
    if (!hasAnyValue) return;
    totalRows += 1;
    if (!companyName) {
      invalidRows.push({ rowNumber, companyName: "", value: rawDateText });
      return;
    }
    if (!rawDateText) {
      skippedBlankDates += 1;
      return;
    }
    const lastAccountReview = parseReviewDate(rawDate);
    if (!lastAccountReview) {
      invalidRows.push({ rowNumber, companyName, value: rawDateText });
      return;
    }
    rows.push({ rowNumber, companyName, lastAccountReview });
  });

  if (!rows.length && !skippedBlankDates) throw new Error("The file contains no valid company and account-review date rows.");
  return {
    sourceName: file.name,
    sheetName: best.sheetName,
    totalRows,
    rows,
    skippedBlankDates,
    invalidRows,
    detectedHeaders: [String(best.rows[best.headerIndex][best.companyIndex] ?? "Company Name"), String(best.rows[best.headerIndex][best.reviewDateIndex] ?? "Last Account Review Date")],
  };
}
