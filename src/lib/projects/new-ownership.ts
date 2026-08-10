import type { Project } from "./types";
import type { SourceRequirement } from "./templates";

export const NEW_OWNERSHIP_AGREEMENT_LABEL = "New IT agreement";

export const NEW_OWNERSHIP_AGREEMENT_REQUIREMENT: SourceRequirement = {
  kind: "legacy-proposal",
  label: NEW_OWNERSHIP_AGREEMENT_LABEL,
  description: "The new owner's Advantage 360 IT agreement. Client Compass reads the service line items and agreement totals from this document.",
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

function quantityValue(line: string): number | undefined {
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

function cleanLineLabel(line: string): string {
  return line
    .replace(/\$\s?[0-9][0-9,]*(?:\.\d{1,2})?/g, " ")
    .replace(/\b(?:qty|quantity)\s*[:#-]?\s*\d+(?:\.\d+)?/gi, " ")
    .replace(/(?:^|\s)\d+(?:\.\d+)?\s*[x×]\s*/i, " ")
    .replace(/\b(?:monthly|per month|\/\s*mo(?:nth)?|recurring|one[- ]time|one time|setup|implementation)\b/gi, " ")
    .replace(/[|•·]+/g, " ")
    .replace(/\s[-–—:]\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^[-–—:]+|[-–—:]+$/g, "")
    .trim();
}

function billingFromLine(line: string, fallback?: NewOwnershipBilling): NewOwnershipBilling | undefined {
  const lower = line.toLowerCase();
  if (/\b(monthly|per month|recurring|\/\s*mo(?:nth)?)\b/.test(lower)) return "monthly";
  if (/\b(one[- ]time|one time|setup|implementation|onboarding fee|installation fee)\b/.test(lower)) return "one-time";
  return fallback;
}

function isTotalLine(line: string): boolean {
  return /\b(total|subtotal|amount due|balance due|grand total|monthly investment|monthly total|one[- ]time investment|one[- ]time total)\b/i.test(line);
}

function totalBilling(line: string, fallback?: NewOwnershipBilling): NewOwnershipBilling | undefined {
  const lower = line.toLowerCase();
  if (/monthly|recurring|per month|\/\s*mo/.test(lower)) return "monthly";
  if (/one[- ]time|setup|implementation|onboarding/.test(lower)) return "one-time";
  return fallback;
}

function valuesFromFact(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export function newOwnershipAgreementSummary(project: Project): NewOwnershipAgreementSummary {
  const source = project.sources.find((item) => item.label === NEW_OWNERSHIP_AGREEMENT_LABEL)
    ?? project.sources.find((item) => newOwnershipEnabled(project) && item.kind === "legacy-proposal");
  const files = source?.files ?? [];
  const sourceName = files[0]?.name || NEW_OWNERSHIP_AGREEMENT_LABEL;
  const candidates: Array<{ text: string; forcedBilling?: NewOwnershipBilling }> = [];

  for (const file of files) {
    const analysis = file.analysis;
    if (!analysis) continue;
    for (const line of analysis.rawTextPreview.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) candidates.push({ text: line });
    for (const fact of analysis.facts) {
      if (fact.key === "pricing.monthlyCandidates") valuesFromFact(fact.value).forEach((text) => candidates.push({ text, forcedBilling: "monthly" }));
      if (fact.key === "pricing.oneTimeCandidates") valuesFromFact(fact.value).forEach((text) => candidates.push({ text, forcedBilling: "one-time" }));
    }
  }

  let context: NewOwnershipBilling | undefined;
  let explicitMonthlyTotal: number | undefined;
  let explicitOneTimeTotal: number | undefined;
  const lines: NewOwnershipAgreementLine[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const text = candidate.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const lower = text.toLowerCase();
    if (!moneyValues(text).length) {
      if (/monthly|recurring|managed services/.test(lower)) context = "monthly";
      else if (/one[- ]time|implementation|setup|onboarding|project charges/.test(lower)) context = "one-time";
      continue;
    }

    const amounts = moneyValues(text);
    const amount = amounts[amounts.length - 1];
    const billing = billingFromLine(text, candidate.forcedBilling ?? context);
    if (isTotalLine(text)) {
      const totalType = totalBilling(text, candidate.forcedBilling ?? context);
      if (totalType === "monthly") explicitMonthlyTotal = amount;
      if (totalType === "one-time") explicitOneTimeTotal = amount;
      continue;
    }
    if (!billing || amount === undefined) continue;
    if (/\b(tax|freight|shipping)\b/i.test(text) && !/[A-Za-z]{4,}/.test(cleanLineLabel(text))) continue;
    const label = cleanLineLabel(text);
    if (!label || label.length < 3) continue;
    const key = `${billing}|${label.toLowerCase()}|${amount.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({
      id: `agreement-${lines.length + 1}`,
      label,
      amount,
      billing,
      quantity: quantityValue(text),
    });
  }

  const monthlyLines = lines.filter((line) => line.billing === "monthly");
  const oneTimeLines = lines.filter((line) => line.billing === "one-time");
  const monthlyTotal = explicitMonthlyTotal ?? (monthlyLines.length ? monthlyLines.reduce((sum, line) => sum + line.amount, 0) : undefined);
  const oneTimeTotal = explicitOneTimeTotal ?? (oneTimeLines.length ? oneTimeLines.reduce((sum, line) => sum + line.amount, 0) : undefined);
  const warnings: string[] = [];
  if (!files.length) warnings.push("Attach the new IT agreement to populate agreement details.");
  else if (!lines.length && monthlyTotal === undefined && oneTimeTotal === undefined) warnings.push("The agreement is attached, but line items and totals could not be read confidently. Review the source document before sharing.");
  else if (!lines.length) warnings.push("Agreement totals were found, but individual line items should be confirmed against the source document.");

  return { sourceName, lines, monthlyTotal, oneTimeTotal, warnings };
}

export function newOwnershipMoney(value: number | undefined): string {
  return value === undefined
    ? "See agreement"
    : value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}