import type { FileAnalysis } from "./types";

const PAGE_MARKER = /^\[\[PAGE\s+(\d+)\]\]$/i;
const DETAIL_HEADER = /\bqty\b.*\bdescription\b.*\brecurring\b.*\bext\.?\s*recurring\b/i;
const DETAIL_ROW = /^\s*\d+(?:\.\d+)?\s+A360\s*-\s*.+\$\s?[0-9][0-9,]*(?:\.\d{1,2})?\s+\$\s?[0-9][0-9,]*(?:\.\d{1,2})?\s*$/i;
const SUBTOTAL_ROW = /\bAdvantage\s*360\s+Subtotal\b/i;

function cleanLines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/**
 * Pull only the recurring-detail table used to build the Advantage 360 monthly
 * agreement. The descriptive Advantage 360 page is intentionally ignored.
 */
export function recurringAgreementTableLines(analysis: FileAnalysis): string[] {
  const sourceLines = cleanLines(analysis.rawTextPreview);
  const pages: string[][] = [];
  let current: string[] = [];

  for (const line of sourceLines) {
    if (PAGE_MARKER.test(line)) {
      if (current.length) pages.push(current);
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length) pages.push(current);

  const detailPage = pages.find((page) => {
    const header = page.some((line) => DETAIL_HEADER.test(line));
    const detailedRows = page.filter((line) => DETAIL_ROW.test(line)).length;
    return header && detailedRows >= 1;
  });

  if (!detailPage) return [];
  const rows = detailPage.filter((line) => DETAIL_ROW.test(line) || SUBTOTAL_ROW.test(line));
  return rows;
}
