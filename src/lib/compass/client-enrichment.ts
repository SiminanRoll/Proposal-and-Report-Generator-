import type { CompassClient, CompassDataset } from "./types";
import { normalizeReviewOrganization, reviewOrganizationSimilarity } from "./review-history";

export interface ClientEnrichmentRow {
  rowNumber: number;
  companyName: string;
  city: string;
  state: string;
  market: string;
  industry: string;
  tags: string[];
  primaryContact: string;
  primaryContactRole: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  assignedOwner: string;
  technicalConsultant: string;
  lastAccountReview: string;
  lastSalesInteraction: string;
  futureTechnicalConsultantActivity?: string;
  lastQuoteDate: string;
  nextFollowUp: string;
  workflowStatus: string;
  internalNote: string;
}

export type ClientEnrichmentMatchKind = "exact" | "alias" | "smart" | "manual" | "create" | "ambiguous" | "unmatched";
export type ClientEnrichmentResolutions = Record<string, string>;

export interface ClientEnrichmentSuggestion {
  clientId: string;
  clientName: string;
  score: number;
}

export interface ClientEnrichmentMatch extends ClientEnrichmentRow {
  key: string;
  rowNumbers: number[];
  companyNames: string[];
  kind: ClientEnrichmentMatchKind;
  clientId: string;
  clientName: string;
  confidence: number;
  suggestions: ClientEnrichmentSuggestion[];
}

export interface ClientEnrichmentUpdate {
  clientId: string;
  clientName: string;
  importedCompanyNames: string[];
  changedFields: string[];
  next: CompassClient;
}

export interface ClientEnrichmentPreview {
  totalRows: number;
  consolidatedRows: number;
  duplicateRowsConsolidated: number;
  matches: ClientEnrichmentMatch[];
  autoMatchedCount: number;
  manualMatchedCount: number;
  ambiguousCount: number;
  unmatchedCount: number;
  clientUpdates: ClientEnrichmentUpdate[];
  newClients: CompassClient[];
  newClientCount: number;
  updateCount: number;
}

function clean(value: string): string { return String(value ?? "").trim(); }
function emptyImportedReviewOutcome(): CompassClient["reviewOutcome"] {
  return { status: "not-reviewed", reviewedAt: "", meetingSummary: "", agreedNextStep: "", reportTitle: "", executiveSummary: "", items: [], lastUpdatedAt: "" };
}
function latestDate(left: string, right: string): string {
  const values = [left, right].filter((value) => Number.isFinite(Date.parse(value))).sort((a, b) => Date.parse(b) - Date.parse(a));
  return values[0] ?? "";
}
function lastText(left: string, right: string): string { return clean(right) || clean(left); }
function uniqueTags(values: string[]): string[] {
  return Array.from(new Map<string, string>(values.map((tag) => [tag.trim().toLowerCase(), tag.trim()] as [string, string]).filter(([key]) => Boolean(key))).values());
}
function mergeConsultants(left: string, right: string): string {
  const values = [...clean(left).split(";"), ...clean(right).split(";")].map((value) => value.trim()).filter(Boolean);
  return uniqueTags(values).join("; ");
}
function localDateKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function isFutureTcSalesDate(value: string, now = new Date()): boolean {
  const cleanValue = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanValue)) return false;
  const parsed = new Date(`${cleanValue}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && cleanValue > localDateKey(now);
}
function rowHasData(row: ClientEnrichmentRow): boolean {
  return Boolean(row.city || row.state || row.market || row.industry || row.tags.length || row.primaryContact || row.primaryContactRole || row.primaryContactEmail || row.primaryContactPhone || row.assignedOwner || row.technicalConsultant || row.lastAccountReview || row.lastSalesInteraction || row.futureTechnicalConsultantActivity || row.lastQuoteDate || row.nextFollowUp || row.workflowStatus || row.internalNote);
}

interface ConsolidatedRow extends ClientEnrichmentRow {
  key: string;
  rowNumbers: number[];
  companyNames: string[];
}

export function consolidateClientEnrichmentRows(rows: ClientEnrichmentRow[]): ConsolidatedRow[] {
  const groups = new Map<string, ConsolidatedRow>();
  for (const row of rows) {
    const key = normalizeReviewOrganization(row.companyName) || row.companyName.trim().toLowerCase() || `row-${row.rowNumber}`;
    const incomingFutureSalesDate = isFutureTcSalesDate(row.lastSalesInteraction) ? row.lastSalesInteraction : "";
    const incomingCompletedSalesDate = incomingFutureSalesDate ? "" : row.lastSalesInteraction;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        ...row,
        lastSalesInteraction: incomingCompletedSalesDate,
        futureTechnicalConsultantActivity: incomingFutureSalesDate || row.futureTechnicalConsultantActivity,
        key,
        rowNumbers: [row.rowNumber],
        companyNames: [row.companyName.trim()],
      });
      continue;
    }
    existing.rowNumbers.push(row.rowNumber);
    if (!existing.companyNames.includes(row.companyName.trim())) existing.companyNames.push(row.companyName.trim());
    existing.city = lastText(existing.city, row.city);
    existing.state = lastText(existing.state, row.state);
    existing.market = lastText(existing.market, row.market);
    existing.industry = lastText(existing.industry, row.industry);
    existing.tags = uniqueTags([...existing.tags, ...row.tags]);
    existing.primaryContact = lastText(existing.primaryContact, row.primaryContact);
    existing.primaryContactRole = lastText(existing.primaryContactRole, row.primaryContactRole);
    existing.primaryContactEmail = lastText(existing.primaryContactEmail, row.primaryContactEmail);
    existing.primaryContactPhone = lastText(existing.primaryContactPhone, row.primaryContactPhone);
    existing.assignedOwner = lastText(existing.assignedOwner, row.assignedOwner);
    existing.lastAccountReview = latestDate(existing.lastAccountReview, row.lastAccountReview);

    if (incomingFutureSalesDate) {
      existing.futureTechnicalConsultantActivity = latestDate(existing.futureTechnicalConsultantActivity || "", incomingFutureSalesDate);
    } else {
      const currentSalesDate = existing.lastSalesInteraction;
      const incomingSalesDate = incomingCompletedSalesDate;
      if (incomingSalesDate && (!currentSalesDate || Date.parse(incomingSalesDate) > Date.parse(currentSalesDate))) {
        existing.lastSalesInteraction = incomingSalesDate;
        existing.technicalConsultant = clean(row.technicalConsultant) || existing.technicalConsultant;
      } else if (incomingSalesDate && currentSalesDate && Date.parse(incomingSalesDate) === Date.parse(currentSalesDate)) {
        existing.technicalConsultant = mergeConsultants(existing.technicalConsultant, row.technicalConsultant);
      } else if (!currentSalesDate && !existing.futureTechnicalConsultantActivity && row.technicalConsultant) {
        existing.technicalConsultant = lastText(existing.technicalConsultant, row.technicalConsultant);
      }
    }

    existing.lastQuoteDate = latestDate(existing.lastQuoteDate, row.lastQuoteDate);
    existing.nextFollowUp = latestDate(existing.nextFollowUp, row.nextFollowUp) || lastText(existing.nextFollowUp, row.nextFollowUp);
    existing.workflowStatus = lastText(existing.workflowStatus, row.workflowStatus);
    existing.internalNote = lastText(existing.internalNote, row.internalNote);
  }
  return [...groups.values()].filter(rowHasData);
}

function namesForClient(client: CompassClient): Array<{ name: string; kind: "exact" | "alias" }> {
  return [{ name: client.name, kind: "exact" }, ...client.aliases.filter(Boolean).map((name) => ({ name, kind: "alias" as const }))];
}

function automaticMatch(row: ConsolidatedRow, clients: CompassClient[]): ClientEnrichmentMatch {
  const normalized = normalizeReviewOrganization(row.companyName);
  const exact: Array<{ client: CompassClient; kind: "exact" | "alias" }> = [];
  for (const client of clients) {
    for (const candidate of namesForClient(client)) {
      if (normalized && normalizeReviewOrganization(candidate.name) === normalized) exact.push({ client, kind: candidate.kind });
    }
  }
  const uniqueExact = Array.from(new Map(exact.map((item) => [item.client.id, item])).values());
  if (uniqueExact.length === 1) {
    const match = uniqueExact[0];
    return { ...row, kind: match.kind, clientId: match.client.id, clientName: match.client.name, confidence: 1, suggestions: [{ clientId: match.client.id, clientName: match.client.name, score: 1 }] };
  }
  const scored = clients.map((client) => {
    let score = 0;
    for (const candidate of namesForClient(client)) score = Math.max(score, reviewOrganizationSimilarity(row.companyName, candidate.name));
    return { clientId: client.id, clientName: client.name, score };
  }).sort((a, b) => b.score - a.score || a.clientName.localeCompare(b.clientName));
  const best = scored[0];
  const second = scored[1];
  const margin = best ? best.score - (second?.score ?? 0) : 0;
  const suggestions = scored.filter((item) => item.score >= 0.55).slice(0, 4);
  if (best && best.score >= 0.84 && (margin >= 0.075 || best.score >= 0.965)) return { ...row, kind: "smart", clientId: best.clientId, clientName: best.clientName, confidence: best.score, suggestions };
  if (best && best.score >= 0.67) return { ...row, kind: "ambiguous", clientId: "", clientName: "", confidence: best.score, suggestions };
  return { ...row, kind: "unmatched", clientId: "", clientName: "", confidence: best?.score ?? 0, suggestions };
}

function newerDate(incoming: string, current: string): string {
  if (!incoming) return current;
  if (!current || !Number.isFinite(Date.parse(current)) || Date.parse(incoming) > Date.parse(current)) return incoming;
  return current;
}
function setIfIncoming(current: string, incoming: string): string { return clean(incoming) || current; }
function addChanged(changes: string[], label: string, before: unknown, after: unknown): void {
  if (JSON.stringify(before) !== JSON.stringify(after)) changes.push(label);
}

function mergedClient(client: CompassClient, match: ClientEnrichmentMatch): { next: CompassClient; changedFields: string[] } {
  const changedFields: string[] = [];
  const tags = uniqueTags([...(client.tags ?? []), ...match.tags]);
  const aliases = uniqueTags([...(client.aliases ?? []), ...match.companyNames.filter((name) => normalizeReviewOrganization(name) !== normalizeReviewOrganization(client.name))]);
  const lastAccountReview = newerDate(match.lastAccountReview, client.lastAccountReview);
  const lastSalesInteraction = newerDate(match.lastSalesInteraction, client.lastSalesInteraction);
  const futureTechnicalConsultantActivity = latestDate(client.futureTechnicalConsultantActivity || "", match.futureTechnicalConsultantActivity || "") || undefined;
  const lastQuoteDate = newerDate(match.lastQuoteDate, client.lastQuoteDate);
  const salesActivityAccepted = Boolean(match.lastSalesInteraction && lastSalesInteraction === match.lastSalesInteraction);
  const technicalConsultant = salesActivityAccepted
    ? (Date.parse(match.lastSalesInteraction) === Date.parse(client.lastSalesInteraction)
      ? mergeConsultants(client.technicalConsultant ?? "", match.technicalConsultant)
      : setIfIncoming(client.technicalConsultant ?? "", match.technicalConsultant))
    : setIfIncoming(client.technicalConsultant ?? "", match.lastSalesInteraction || match.futureTechnicalConsultantActivity ? "" : match.technicalConsultant);
  const next: CompassClient = {
    ...client,
    aliases,
    city: setIfIncoming(client.city, match.city),
    state: setIfIncoming(client.state, match.state).toUpperCase(),
    market: setIfIncoming(client.market, match.market),
    industry: setIfIncoming(client.industry, match.industry),
    tags,
    primaryContact: setIfIncoming(client.primaryContact, match.primaryContact),
    primaryContactRole: setIfIncoming(client.primaryContactRole, match.primaryContactRole),
    primaryContactEmail: setIfIncoming(client.primaryContactEmail, match.primaryContactEmail),
    primaryContactPhone: setIfIncoming(client.primaryContactPhone, match.primaryContactPhone),
    assignedOwner: setIfIncoming(client.assignedOwner, match.assignedOwner),
    technicalConsultant,
    lastAccountReview,
    lastSalesInteraction,
    futureTechnicalConsultantActivity,
    lastQuoteDate,
    quoted: client.quoted || Boolean(lastQuoteDate),
    nextFollowUp: setIfIncoming(client.nextFollowUp, match.nextFollowUp),
    workflowStatus: setIfIncoming(client.workflowStatus, match.workflowStatus),
    internalNote: setIfIncoming(client.internalNote, match.internalNote),
  };
  addChanged(changedFields, "City", client.city, next.city);
  addChanged(changedFields, "State", client.state, next.state);
  addChanged(changedFields, "Territory", client.market, next.market);
  addChanged(changedFields, "Industry", client.industry, next.industry);
  addChanged(changedFields, "Tags", client.tags, next.tags);
  addChanged(changedFields, "Primary contact", client.primaryContact, next.primaryContact);
  addChanged(changedFields, "Contact role", client.primaryContactRole, next.primaryContactRole);
  addChanged(changedFields, "Email", client.primaryContactEmail, next.primaryContactEmail);
  addChanged(changedFields, "Phone", client.primaryContactPhone, next.primaryContactPhone);
  addChanged(changedFields, "Assigned owner", client.assignedOwner, next.assignedOwner);
  addChanged(changedFields, "TC", client.technicalConsultant ?? "", next.technicalConsultant ?? "");
  addChanged(changedFields, "Account review", client.lastAccountReview, next.lastAccountReview);
  addChanged(changedFields, "Last sales activity", client.lastSalesInteraction, next.lastSalesInteraction);
  addChanged(changedFields, "Future TC activity date", client.futureTechnicalConsultantActivity ?? "", next.futureTechnicalConsultantActivity ?? "");
  addChanged(changedFields, "Last quote", client.lastQuoteDate, next.lastQuoteDate);
  addChanged(changedFields, "Next follow-up", client.nextFollowUp, next.nextFollowUp);
  addChanged(changedFields, "Workflow status", client.workflowStatus, next.workflowStatus);
  addChanged(changedFields, "Internal note", client.internalNote, next.internalNote);
  return { next, changedFields };
}

function idSlug(value: string): string {
  return normalizeReviewOrganization(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "imported-client";
}

function nextClientId(name: string, used: Set<string>): string {
  const base = `client-${idSlug(name)}`;
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) { candidate = `${base}-${suffix}`; suffix += 1; }
  used.add(candidate);
  return candidate;
}

function createdClient(match: ClientEnrichmentMatch, usedIds: Set<string>): CompassClient {
  const lastQuoteDate = match.lastQuoteDate;
  const completedSalesActivity = match.lastSalesInteraction;
  return {
    id: nextClientId(match.companyName, usedIds),
    name: match.companyName.trim(),
    aliases: uniqueTags(match.companyNames.filter((name) => normalizeReviewOrganization(name) !== normalizeReviewOrganization(match.companyName))),
    city: match.city,
    state: match.state.toUpperCase(),
    market: match.market,
    industry: match.industry,
    tags: uniqueTags(match.tags),
    primaryContact: match.primaryContact,
    primaryContactRole: match.primaryContactRole,
    primaryContactEmail: match.primaryContactEmail,
    primaryContactPhone: match.primaryContactPhone,
    assignedOwner: match.assignedOwner,
    technicalConsultant: completedSalesActivity ? match.technicalConsultant : "",
    lastAccountReview: match.lastAccountReview,
    lastSalesInteraction: completedSalesActivity,
    futureTechnicalConsultantActivity: match.futureTechnicalConsultantActivity,
    lastQuoteDate,
    quoted: Boolean(lastQuoteDate),
    nextFollowUp: match.nextFollowUp,
    workflowStatus: match.workflowStatus || "Needs Review",
    internalNote: match.internalNote,
    recordReviewNeeded: true,
    recordReviewReason: "Created from an unmatched client-record enrichment row. Verify the company name, territory, contact details, sales coverage, and relationship fields.",
    reviewOutcome: emptyImportedReviewOutcome(),
    lastDataRefresh: new Date().toISOString(),
  };
}

export function buildClientEnrichmentPreview(rows: ClientEnrichmentRow[], dataset: CompassDataset, resolutions: ClientEnrichmentResolutions = {}): ClientEnrichmentPreview {
  const consolidated = consolidateClientEnrichmentRows(rows);
  const matches = consolidated.map((row): ClientEnrichmentMatch => {
    const automatic = automaticMatch(row, dataset.clients);
    const resolution = resolutions[row.key];
    if (!resolution) {
      // A truly unmatched row defaults to creating a review-flagged company record.
      // Ambiguous matches remain unresolved so likely duplicates are reviewed first.
      return automatic.kind === "unmatched" ? { ...automatic, kind: "create", clientName: row.companyName } : automatic;
    }
    if (resolution === "create") return { ...automatic, kind: "create", clientId: "", clientName: row.companyName, confidence: 1 };
    if (resolution === "skip") return { ...automatic, kind: automatic.kind === "ambiguous" ? "ambiguous" : "unmatched", clientId: "", clientName: "" };
    const client = dataset.clients.find((candidate) => candidate.id === resolution);
    return client ? { ...automatic, kind: "manual", clientId: client.id, clientName: client.name, confidence: 1 } : automatic;
  });

  const updates: ClientEnrichmentUpdate[] = [];
  for (const match of matches) {
    if (!match.clientId) continue;
    const client = dataset.clients.find((candidate) => candidate.id === match.clientId);
    if (!client) continue;
    const merged = mergedClient(client, match);
    if (merged.changedFields.length) updates.push({ clientId: client.id, clientName: client.name, importedCompanyNames: match.companyNames, changedFields: merged.changedFields, next: merged.next });
  }

  const usedIds = new Set(dataset.clients.map((client) => client.id));
  const newClients = matches.filter((match) => match.kind === "create").map((match) => createdClient(match, usedIds));

  return {
    totalRows: rows.length,
    consolidatedRows: consolidated.length,
    duplicateRowsConsolidated: Math.max(0, rows.length - consolidated.length),
    matches,
    autoMatchedCount: matches.filter((match) => ["exact", "alias", "smart"].includes(match.kind)).length,
    manualMatchedCount: matches.filter((match) => match.kind === "manual").length,
    ambiguousCount: matches.filter((match) => match.kind === "ambiguous" && !match.clientId).length,
    unmatchedCount: matches.filter((match) => match.kind === "unmatched" && !match.clientId).length,
    clientUpdates: updates.sort((a, b) => a.clientName.localeCompare(b.clientName)),
    newClients,
    newClientCount: newClients.length,
    updateCount: updates.length + newClients.length,
  };
}

export function applyClientEnrichmentPreview(dataset: CompassDataset, preview: ClientEnrichmentPreview): CompassDataset {
  const updates = new Map(preview.clientUpdates.map((update) => [update.clientId, update.next]));
  const clients = dataset.clients.map((client) => updates.get(client.id) ?? client);
  return { ...dataset, clients: [...clients, ...preview.newClients] };
}
