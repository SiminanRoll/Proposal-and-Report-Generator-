import type { Project, FileAnalysis } from "./types";
import type { SourceRequirement } from "./templates";

export const NEW_OWNERSHIP_AGREEMENT_LABEL = "New IT agreement";

export const NEW_OWNERSHIP_AGREEMENT_REQUIREMENT: SourceRequirement = {
  kind: "legacy-proposal",
  label: NEW_OWNERSHIP_AGREEMENT_LABEL,
  description: "The new owner's Advantage 360 monthly IT agreement. Client Compass reads the monthly service line items, quantities, unit prices, and agreement total from this document.",
  required: true,
  extensions: [".pdf", ".docx"],
  multiple: false,
};

export type NewOwnershipBilling = "monthly" | "one-time";

export interface NewOwnershipAgreementLine {
  id: string;
  label: string;
  amount: number;
  billing: NewOwnershipBilling;
  quantity?: number;
  unitPrice?: number;
}

export interface NewOwnershipAgreementSummary {
  sourceName: string;
  lines: NewOwnershipAgreementLine[];
  monthlyTotal?: number;
  oneTimeTotal?: number;
  warnings: string[];
}

export function newOwnershipEnabled(project: Project): boolean {
  return project.type === "client-report" && Boolean(project.newOwnership?.enabled);
}

export function normalizedAgreementAuthorizationUrl(value: string | undefined): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function numberValue(value: string): number | undefined {
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function moneyValues(line: string): number[] {
  return [...line.matchAll(/\$\s?([0-9][0-9,]*(?:\.\d{1,2})?)/g)]
    .map((match) => numberValue(match[1]))
    .filter((value): value is number => value !== undefined);
}

function explicitQuantity(line: string): number | undefined {
  const labeled = line.match(/\b(?:qty|quantity)\s*[:#-]?\s*(\d+(?:\.\d+)?)/i);
  if (labeled) {
    const value = Number(labeled[1]);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  const multiplied = line.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*[x×]\s*(?=\$|[A-Za-z])/i);
  if (multiplied) {
    const value = Number(multiplied[1]);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  return undefined;
}

function tableQuantity(line: string, amounts: number[]): number | undefined {
  const explicit = explicitQuantity(line);
  if (explicit !== undefined) return explicit;
  if (amounts.length < 2) return undefined;
  const firstMoney = line.search(/\$/);
  if (firstMoney < 0) return undefined;
  const prefix = line.slice(0, firstMoney).trim();
  const leading = prefix.match(/^\s*(\d+(?:\.\d+)?)\s+/);
  if (leading) {
    const value = Number(leading[1]);
    if (Number.isFinite(value) && value > 0 && value <= 250) return value;
  }
  const tokens = prefix.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
  const candidate = Number(tokens.at(-1));
  if (!Number.isFinite(candidate) || candidate <= 0 || candidate > 250) return undefined;
  return candidate;
}

function cleanLineLabel(line: string, quantity: number | undefined, tableStyle: boolean): string {
  const firstMoney = line.search(/\$/);
  let label = firstMoney >= 0 ? line.slice(0, firstMoney) : line;
  label = label
    .replace(/\b(?:qty|quantity)\s*[:#-]?\s*\d+(?:\.\d+)?/gi, " ")
    .replace(/(?:^|\s)\d+(?:\.\d+)?\s*[x×]\s*/i, " ");
  if (tableStyle && quantity !== undefined) {
    const escaped = String(quantity).replace(".", "\\.");
    label = label
      .replace(new RegExp(`^\\s*${escaped}\\s+`), " ")
      .replace(new RegExp(`\\s${escaped}\\s*$`), " ");
  }
  return label
    .replace(/[|•·]+/g, " ")
    .replace(/\b(?:monthly|per month|\/\s*mo(?:nth)?|recurring)\b/gi, " ")
    .replace(/\s[-–—:]\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^[-–—:]+|[-–—:]+$/g, "")
    .trim();
}

function compactAgreementLabel(label: string): string {
  const detailed = label.match(/^(A360\s*-\s*(?:Site|Server with Standard Backup|Workstation|CloudPlus Advanced Backup|Managed Firewall|Managed Switch|WiFi Access Point))\b/i);
  return detailed?.[1]?.trim() || label.trim();
}

function isTotalLine(line: string): boolean {
  return /\b(total|subtotal|amount due|balance due|grand total|monthly investment|monthly total|monthly agreement|recurring total)\b/i.test(line);
}

function valuesFromFact(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function looksLikeNonServiceAmount(line: string): boolean {
  return /\b(tax|freight|shipping|deposit|down payment|finance|financing|term|signature|authorization|expiration|valid through|one[- ]time|setup fee|implementation fee|onboarding fee|installation fee)\b/i.test(line);
}

const PAGE_MARKER = /^\[\[PAGE\s+(\d+)\]\]$/i;
const RECURRING_TABLE_HEADER = /\bqty\b.*\bdescription\b.*\brecurring\b.*\bext\.?\s*recurring\b/i;
const A360_DETAIL_ROW = /^\s*\d+(?:\.\d+)?\s+A360\s*-\s*.+\$\s?[0-9][0-9,]*(?:\.\d{1,2})?\s+\$\s?[0-9][0-9,]*(?:\.\d{1,2})?\s*$/i;
const A360_SUBTOTAL_ROW = /\bAdvantage\s*360\s+Subtotal\b/i;

function pageSections(analysis: FileAnalysis): string[][] {
  const raw = analysis.rawTextPreview.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const pages: string[][] = [];
  let current: string[] = [];
  for (const line of raw) {
    if (PAGE_MARKER.test(line)) {
      if (current.length) pages.push(current);
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length) pages.push(current);
  return pages;
}

/**
 * Advantage order PDFs have a descriptive Advantage 360 page followed by a
 * recurring-services table. Only the detailed recurring table is billable.
 */
function recurringDetailCandidates(analysis: FileAnalysis): string[] {
  const pages = pageSections(analysis);
  const detailPage = pages.find((page) => {
    const hasHeader = page.some((line) => RECURRING_TABLE_HEADER.test(line));
    const detailedRows = page.filter((line) => A360_DETAIL_ROW.test(line)).length;
    return hasHeader && detailedRows >= 1;
  });
  return detailPage
    ? detailPage.filter((line) => A360_DETAIL_ROW.test(line) || A360_SUBTOTAL_ROW.test(line))
    : [];
}

export function newOwnershipAgreementSummary(project: Project): NewOwnershipAgreementSummary {
  const source = project.sources.find((item) => item.label === NEW_OWNERSHIP_AGREEMENT_LABEL)
    ?? project.sources.find((item) => newOwnershipEnabled(project) && item.kind === "legacy-proposal");
  const files = source?.files ?? [];
  const sourceName = files[0]?.name || NEW_OWNERSHIP_AGREEMENT_LABEL;
  const detailedCandidates: string[] = [];
  const fallbackCandidates: string[] = [];

  for (const file of files) {
    const analysis = file.analysis;
    if (!analysis) continue;
    detailedCandidates.push(...recurringDetailCandidates(analysis));
    for (const line of analysis.rawTextPreview.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) fallbackCandidates.push(line);
    for (const fact of analysis.facts) {
      if (fact.key === "pricing.monthlyCandidates") fallbackCandidates.push(...valuesFromFact(fact.value));
    }
  }

  // Once the recurring detail table is found, intentionally ignore the rest
  // of the agreement. In particular, the descriptive "1 Advantage 360 $0"
  // row on the preceding page is not an agreement line item.
  const candidates = detailedCandidates.length ? detailedCandidates : fallbackCandidates;
  let explicitMonthlyTotal: number | undefined;
  const lines: NewOwnershipAgreementLine[] = [];
  const seen = new Set<string>();

  for (const raw of candidates) {
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text || looksLikeNonServiceAmount(text)) continue;
    const amounts = moneyValues(text);
    if (!amounts.length) continue;
    const extendedAmount = amounts.at(-1);
    if (extendedAmount === undefined) continue;

    if (isTotalLine(text)) {
      explicitMonthlyTotal = extendedAmount;
      continue;
    }

    const quantity = tableQuantity(text, amounts);
    const tableStyle = amounts.length >= 2 && quantity !== undefined;
    const label = compactAgreementLabel(cleanLineLabel(text, quantity, tableStyle));
    if (!label || label.length < 3) continue;
    if (!/^A360\s*-\s*/i.test(label)) continue;

    const unitPrice = amounts.length >= 2
      ? amounts[0]
      : quantity && quantity > 1
        ? extendedAmount / quantity
        : extendedAmount;
    const key = `${label.toLowerCase()}|${quantity ?? 1}|${unitPrice.toFixed(2)}|${extendedAmount.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({
      id: `agreement-${lines.length + 1}`,
      label,
      amount: extendedAmount,
      billing: "monthly",
      quantity,
      unitPrice,
    });
  }

  const monthlyTotal = explicitMonthlyTotal ?? (lines.length ? lines.reduce((sum, line) => sum + line.amount, 0) : undefined);
  const warnings: string[] = [];
  if (!files.length) warnings.push("Attach the new IT agreement to populate the monthly agreement details.");
  else if (!lines.length && monthlyTotal === undefined) warnings.push("The agreement is attached, but the recurring service table has not been read yet. Refresh source data to read the detailed A360 line items from the agreement.");
  else if (!lines.length) warnings.push("The monthly agreement total was found, but the detailed A360 service rows should be refreshed from the attached agreement.");

  return { sourceName, lines, monthlyTotal, oneTimeTotal: undefined, warnings };
}

export function newOwnershipMoney(value: number | undefined): string {
  return value === undefined
    ? "See agreement"
    : value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}
