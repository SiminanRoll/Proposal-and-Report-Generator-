import type { CompassClient, CompassDataset } from "./types";

export interface ReviewHistoryRow {
  rowNumber: number;
  companyName: string;
  lastAccountReview: string;
  lastQuoteDate: string;
}

export type ReviewHistoryMatchKind = "exact" | "alias" | "smart" | "manual" | "ambiguous" | "unmatched";
export type ReviewHistoryDateAction = "update" | "unchanged" | "older" | "empty";

export interface ReviewHistorySuggestion {
  clientId: string;
  clientName: string;
  score: number;
}

export interface ReviewHistoryMatch {
  key: string;
  rowNumbers: number[];
  companyName: string;
  companyNames: string[];
  lastAccountReview: string;
  lastQuoteDate: string;
  kind: ReviewHistoryMatchKind;
  clientId: string;
  clientName: string;
  confidence: number;
  suggestions: ReviewHistorySuggestion[];
}

export type ReviewHistoryResolutions = Record<string, string>;

export interface ReviewHistoryClientUpdate {
  clientId: string;
  clientName: string;
  importedCompanyNames: string[];
  incomingReviewDate: string;
  previousReviewDate: string;
  reviewAction: ReviewHistoryDateAction;
  incomingQuoteDate: string;
  previousQuoteDate: string;
  quoteAction: ReviewHistoryDateAction;
  markQuoted: boolean;
  action: "update" | "unchanged" | "older";
  matchKinds: ReviewHistoryMatchKind[];
}

export interface ReviewHistoryPreview {
  totalRows: number;
  consolidatedRows: number;
  duplicateRowsConsolidated: number;
  matches: ReviewHistoryMatch[];
  autoMatchedCount: number;
  manualMatchedCount: number;
  ambiguousCount: number;
  unmatchedCount: number;
  clientUpdates: ReviewHistoryClientUpdate[];
  updateCount: number;
  reviewUpdateCount: number;
  quoteUpdateCount: number;
  unchangedCount: number;
  olderIgnoredCount: number;
}

const LEGAL_SUFFIXES = new Set([
  "llc", "pllc", "plc", "pc", "pa", "inc", "incorporated", "corp", "corporation", "company", "co", "ltd", "limited",
]);
const CREDENTIALS = new Set(["dds", "dmd", "md", "do", "phd", "rdh"]);
const TITLES = new Set(["dr", "doctor"]);
const GENERIC_TOKENS = new Set(["the", "of", "at", "and"]);

const TOKEN_EQUIVALENTS: Record<string, string> = {
  dentistry: "dental",
  dentist: "dental",
  dentists: "dental",
  orthodontics: "orthodontic",
  orthodontist: "orthodontic",
  orthodontists: "orthodontic",
  pediatrics: "pediatric",
  paediatric: "pediatric",
  paediatrics: "pediatric",
  centres: "center",
  centre: "center",
  clinics: "clinic",
  associates: "associate",
  assocs: "associate",
  surgical: "surgery",
  maxillofacial: "maxillofacial",
  surgeons: "surgery",
  surgeon: "surgery",
  assoc: "associate",
};

const TOKEN_EXPANSIONS: Record<string, string[]> = {
  oms: ["oral", "maxillofacial", "surgery"],
  omfs: ["oral", "maxillofacial", "surgery"],
  ortho: ["orthodontic"],
  endo: ["endodontic"],
  peds: ["pediatric"],
  pedo: ["pediatric"],
};

function cleanText(value: string): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function organizationTokens(value: string): string[] {
  let cleaned = cleanText(value);
  let previous = "";
  while (cleaned !== previous) {
    previous = cleaned;
    cleaned = cleaned.replace(/\b(?:p c|p l l c|l l c|p l c|p a|s c|d d s|d m d|m d|d o|p h d|r d h)\b$/g, "").trim();
  }
  const raw = cleaned.split(/\s+/).filter(Boolean);
  const normalized = raw
    .flatMap((token) => TOKEN_EXPANSIONS[token] ?? [TOKEN_EQUIVALENTS[token] ?? token])
    .filter((token) => !LEGAL_SUFFIXES.has(token) && !CREDENTIALS.has(token) && !TITLES.has(token) && !GENERIC_TOKENS.has(token));
  return Array.from(new Set(normalized));
}

export function normalizeReviewOrganization(value: string): string {
  return organizationTokens(value).join(" ");
}

function tokenSignature(value: string): string {
  return [...organizationTokens(value)].sort().join(" ");
}

function bigrams(value: string): Set<string> {
  const compact = normalizeReviewOrganization(value).replace(/\s+/g, "");
  const result = new Set<string>();
  if (compact.length < 2) {
    if (compact) result.add(compact);
    return result;
  }
  for (let index = 0; index < compact.length - 1; index += 1) result.add(compact.slice(index, index + 2));
  return result;
}

function diceCoefficient(left: string, right: string): number {
  const a = bigrams(left);
  const b = bigrams(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return (2 * intersection) / (a.size + b.size);
}

function tokenOverlap(left: string, right: string): { jaccard: number; containment: number; distinctive: number } {
  const a = new Set(organizationTokens(left));
  const b = new Set(organizationTokens(right));
  if (!a.size || !b.size) return { jaccard: 0, containment: 0, distinctive: 0 };
  let intersection = 0;
  let distinctiveIntersection = 0;
  const genericBusiness = new Set(["dental", "family", "care", "clinic", "center", "associate", "practice", "health", "group", "surgery"]);
  for (const token of a) {
    if (!b.has(token)) continue;
    intersection += 1;
    if (!genericBusiness.has(token)) distinctiveIntersection += 1;
  }
  return {
    jaccard: intersection / new Set([...a, ...b]).size,
    containment: intersection / Math.min(a.size, b.size),
    distinctive: distinctiveIntersection,
  };
}

export function reviewOrganizationSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeReviewOrganization(left);
  const normalizedRight = normalizeReviewOrganization(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  if (tokenSignature(left) === tokenSignature(right)) return 0.995;

  const overlap = tokenOverlap(left, right);
  const character = diceCoefficient(left, right);
  let score = character * 0.48 + overlap.jaccard * 0.32 + overlap.containment * 0.20;
  if (overlap.containment === 1 && overlap.distinctive >= 1) score = Math.max(score, 0.88);
  if (overlap.containment === 1 && overlap.distinctive >= 2) score = Math.max(score, 0.93);
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) score = Math.max(score, overlap.distinctive ? 0.88 : 0.74);
  return Math.min(1, score);
}

function latestDate(values: string[]): string {
  return values
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? "";
}

function dateAction(incomingDate: string, previousDate: string): ReviewHistoryDateAction {
  if (!incomingDate) return "empty";
  if (!previousDate || Date.parse(incomingDate) > Date.parse(previousDate)) return "update";
  if (Date.parse(incomingDate) === Date.parse(previousDate)) return "unchanged";
  return "older";
}

function currentReviewDate(client: CompassClient): string {
  return latestDate([client.lastAccountReview, client.reviewOutcome?.reviewedAt ?? ""]);
}

interface ConsolidatedReviewRow {
  key: string;
  companyName: string;
  companyNames: string[];
  lastAccountReview: string;
  lastQuoteDate: string;
  rowNumbers: number[];
}

export function consolidateReviewHistoryRows(rows: ReviewHistoryRow[]): ConsolidatedReviewRow[] {
  const groups = new Map<string, ConsolidatedReviewRow>();
  for (const row of rows) {
    const normalized = normalizeReviewOrganization(row.companyName) || cleanText(row.companyName);
    const key = normalized || `row-${row.rowNumber}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        key,
        companyName: row.companyName.trim(),
        companyNames: [row.companyName.trim()],
        lastAccountReview: row.lastAccountReview,
        lastQuoteDate: row.lastQuoteDate,
        rowNumbers: [row.rowNumber],
      });
      continue;
    }
    existing.rowNumbers.push(row.rowNumber);
    if (!existing.companyNames.includes(row.companyName.trim())) existing.companyNames.push(row.companyName.trim());
    existing.lastAccountReview = latestDate([existing.lastAccountReview, row.lastAccountReview]);
    existing.lastQuoteDate = latestDate([existing.lastQuoteDate, row.lastQuoteDate]);
  }
  return [...groups.values()];
}

function clientNames(client: CompassClient): Array<{ name: string; kind: "exact" | "alias" }> {
  return [
    { name: client.name, kind: "exact" as const },
    ...client.aliases.filter(Boolean).map((name) => ({ name, kind: "alias" as const })),
  ];
}

function automaticMatch(row: ConsolidatedReviewRow, clients: CompassClient[]): ReviewHistoryMatch {
  const normalized = normalizeReviewOrganization(row.companyName);
  const exactCandidates: Array<{ client: CompassClient; kind: "exact" | "alias" }> = [];
  for (const client of clients) {
    for (const candidate of clientNames(client)) {
      if (normalizeReviewOrganization(candidate.name) === normalized && normalized) exactCandidates.push({ client, kind: candidate.kind });
    }
  }
  const uniqueExact = Array.from(new Map(exactCandidates.map((item) => [item.client.id, item])).values());
  if (uniqueExact.length === 1) {
    const match = uniqueExact[0];
    return {
      ...row,
      kind: match.kind,
      clientId: match.client.id,
      clientName: match.client.name,
      confidence: 1,
      suggestions: [{ clientId: match.client.id, clientName: match.client.name, score: 1 }],
    };
  }

  const scored = clients.map((client) => {
    let score = 0;
    for (const candidate of clientNames(client)) score = Math.max(score, reviewOrganizationSimilarity(row.companyName, candidate.name));
    return { clientId: client.id, clientName: client.name, score };
  }).sort((left, right) => right.score - left.score || left.clientName.localeCompare(right.clientName));
  const best = scored[0];
  const second = scored[1];
  const margin = best ? best.score - (second?.score ?? 0) : 0;
  const suggestions = scored.filter((candidate) => candidate.score >= 0.55).slice(0, 4);

  if (best && best.score >= 0.84 && (margin >= 0.075 || best.score >= 0.965)) {
    return { ...row, kind: "smart", clientId: best.clientId, clientName: best.clientName, confidence: best.score, suggestions };
  }
  if (best && best.score >= 0.67) {
    return { ...row, kind: "ambiguous", clientId: "", clientName: "", confidence: best.score, suggestions };
  }
  return { ...row, kind: "unmatched", clientId: "", clientName: "", confidence: best?.score ?? 0, suggestions };
}

function summarizeUpdateAction(reviewAction: ReviewHistoryDateAction, quoteAction: ReviewHistoryDateAction, markQuoted = false): "update" | "unchanged" | "older" {
  if (reviewAction === "update" || quoteAction === "update" || markQuoted) return "update";
  if (reviewAction === "unchanged" || quoteAction === "unchanged") return "unchanged";
  return "older";
}

export function buildReviewHistoryPreview(
  rows: ReviewHistoryRow[],
  dataset: CompassDataset,
  resolutions: ReviewHistoryResolutions = {},
): ReviewHistoryPreview {
  const consolidated = consolidateReviewHistoryRows(rows);
  const matches: ReviewHistoryMatch[] = consolidated.map((row): ReviewHistoryMatch => {
    const automatic = automaticMatch(row, dataset.clients);
    const resolution = resolutions[row.key];
    if (!resolution) return automatic;
    if (resolution === "skip") {
      const kind: ReviewHistoryMatchKind = automatic.kind === "ambiguous" ? "ambiguous" : "unmatched";
      return { ...automatic, kind, clientId: "", clientName: "" };
    }
    const client = dataset.clients.find((candidate) => candidate.id === resolution);
    return client ? { ...automatic, kind: "manual" as const, clientId: client.id, clientName: client.name, confidence: 1 } : automatic;
  });

  const groupedUpdates = new Map<string, ReviewHistoryClientUpdate>();
  for (const match of matches) {
    if (!match.clientId) continue;
    const client = dataset.clients.find((candidate) => candidate.id === match.clientId);
    if (!client) continue;
    const existing = groupedUpdates.get(client.id);
    if (!existing) {
      const previousReviewDate = currentReviewDate(client);
      const previousQuoteDate = latestDate([client.lastQuoteDate]);
      const reviewAction = dateAction(match.lastAccountReview, previousReviewDate);
      const quoteAction = dateAction(match.lastQuoteDate, previousQuoteDate);
      const markQuoted = Boolean(match.lastQuoteDate) && !client.quoted;
      groupedUpdates.set(client.id, {
        clientId: client.id,
        clientName: client.name,
        importedCompanyNames: [...match.companyNames],
        incomingReviewDate: match.lastAccountReview,
        previousReviewDate,
        reviewAction,
        incomingQuoteDate: match.lastQuoteDate,
        previousQuoteDate,
        quoteAction,
        markQuoted,
        action: summarizeUpdateAction(reviewAction, quoteAction, markQuoted),
        matchKinds: [match.kind],
      });
      continue;
    }
    existing.incomingReviewDate = latestDate([existing.incomingReviewDate, match.lastAccountReview]);
    existing.incomingQuoteDate = latestDate([existing.incomingQuoteDate, match.lastQuoteDate]);
    existing.importedCompanyNames = Array.from(new Set([...existing.importedCompanyNames, ...match.companyNames]));
    existing.matchKinds = Array.from(new Set([...existing.matchKinds, match.kind]));
    existing.reviewAction = dateAction(existing.incomingReviewDate, existing.previousReviewDate);
    existing.quoteAction = dateAction(existing.incomingQuoteDate, existing.previousQuoteDate);
    existing.markQuoted = Boolean(existing.incomingQuoteDate) && !client.quoted;
    existing.action = summarizeUpdateAction(existing.reviewAction, existing.quoteAction, existing.markQuoted);
  }
  const clientUpdates = [...groupedUpdates.values()].sort((left, right) => left.clientName.localeCompare(right.clientName));

  const reviewUpdateCount = clientUpdates.filter((update) => update.reviewAction === "update").length;
  const quoteUpdateCount = clientUpdates.filter((update) => update.quoteAction === "update").length;
  return {
    totalRows: rows.length,
    consolidatedRows: consolidated.length,
    duplicateRowsConsolidated: Math.max(0, rows.length - consolidated.length),
    matches,
    autoMatchedCount: matches.filter((match) => ["exact", "alias", "smart"].includes(match.kind)).length,
    manualMatchedCount: matches.filter((match) => match.kind === "manual").length,
    ambiguousCount: matches.filter((match) => match.kind === "ambiguous" && !match.clientId).length,
    unmatchedCount: matches.filter((match) => match.kind === "unmatched" && !match.clientId).length,
    clientUpdates,
    updateCount: clientUpdates.filter((update) => update.action === "update").length,
    reviewUpdateCount,
    quoteUpdateCount,
    unchangedCount: clientUpdates.filter((update) => update.action === "unchanged").length,
    olderIgnoredCount: clientUpdates.filter((update) => update.action === "older").length,
  };
}

export function applyReviewHistoryPreview(dataset: CompassDataset, preview: ReviewHistoryPreview): CompassDataset {
  const updates = new Map(preview.clientUpdates.filter((update) => update.action === "update").map((update) => [update.clientId, update]));
  if (!updates.size) return dataset;
  return {
    ...dataset,
    clients: dataset.clients.map((client) => {
      const update = updates.get(client.id);
      if (!update) return client;
      const reviewUpdated = update.reviewAction === "update";
      const quoteUpdated = update.quoteAction === "update";
      const normalizedStatus = client.workflowStatus.trim().toLowerCase();
      const workflowStatus = reviewUpdated && (!normalizedStatus || ["needs review", "review needed", "review scheduled"].includes(normalizedStatus))
        ? "Review Completed"
        : client.workflowStatus;
      return {
        ...client,
        lastAccountReview: reviewUpdated ? update.incomingReviewDate : client.lastAccountReview,
        lastQuoteDate: quoteUpdated ? update.incomingQuoteDate : client.lastQuoteDate,
        quoted: client.quoted || update.markQuoted || quoteUpdated || Boolean(client.lastQuoteDate),
        workflowStatus,
      };
    }),
  };
}
