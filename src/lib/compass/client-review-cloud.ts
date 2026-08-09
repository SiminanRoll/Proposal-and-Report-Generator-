"use client";

import { APP_VERSION } from "@/lib/app-version";
import { captainsLogCloudRest } from "./captains-log-cloud";
import type { CompassClient } from "./types";

export const CLIENT_REVIEW_CLOUD_EVENT = "client-compass-review-cloud-changed";
export const CLIENT_REVIEW_EVENT_TYPE = "client_review_event";
export const CLIENT_REVIEW_SCHEMA = "client_review_v1";
const CACHE_KEY = "client_compass.client_review_cloud.v1";
const MAX_EVENTS = 5000;

export type ClientReviewCloudStatus = "needs-review" | "scheduled" | "completed" | "declined" | "activity-reviewed";
export type ClientReviewCloudDisposition =
  | "needs-review"
  | "activity-reviewed"
  | "review-completed"
  | "client-declined"
  | "rescheduled"
  | "record-corrected"
  | "migrated";

export interface ClientReviewCloudState {
  clientId: string;
  company: string;
  normalizedCompany: string;
  status: ClientReviewCloudStatus;
  lastCompletedReviewDate: string;
  reviewCycleResolvedDate: string;
  reviewedActivityThrough: string;
  nextReviewDate: string;
  disposition: ClientReviewCloudDisposition;
  note: string;
  updatedAt: string;
  sourceApp: string;
  sourceVersion: string;
  eventId: string;
}

export interface ClientReviewCloudHistoryItem extends ClientReviewCloudState {
  createdAt: string;
}

interface ClientReviewEventRow {
  event_id?: string;
  event_type?: string;
  payload?: Record<string, unknown>;
  created_at?: string;
  inserted_at?: string;
}

interface ReviewCache {
  events: ClientReviewCloudHistoryItem[];
  refreshedAt: string;
}

function canStore(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function dateOnly(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeReviewCompany(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(llc|pllc|pc|inc|corp|corporation|company|co)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stringRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanStatus(value: unknown): ClientReviewCloudStatus {
  const status = String(value ?? "").trim().toLowerCase();
  return (["needs-review", "scheduled", "completed", "declined", "activity-reviewed"] as const).includes(status as ClientReviewCloudStatus)
    ? status as ClientReviewCloudStatus
    : "needs-review";
}

function cleanDisposition(value: unknown): ClientReviewCloudDisposition {
  const disposition = String(value ?? "").trim().toLowerCase();
  return (["needs-review", "activity-reviewed", "review-completed", "client-declined", "rescheduled", "record-corrected", "migrated"] as const).includes(disposition as ClientReviewCloudDisposition)
    ? disposition as ClientReviewCloudDisposition
    : "needs-review";
}

function parseRow(row: ClientReviewEventRow): ClientReviewCloudHistoryItem | null {
  if (String(row.event_type || "") !== CLIENT_REVIEW_EVENT_TYPE) return null;
  const payload = stringRecord(row.payload);
  if (String(payload.schema || "") !== CLIENT_REVIEW_SCHEMA) return null;
  const client = stringRecord(payload.client);
  const state = stringRecord(payload.state);
  const company = String(client.company ?? "").trim();
  const clientId = String(client.id ?? "").trim();
  const normalizedCompany = String(client.normalized_company ?? "").trim() || normalizeReviewCompany(company);
  if (!company && !clientId && !normalizedCompany) return null;
  const createdAt = String(row.created_at || row.inserted_at || payload.occurred_at || "");
  return {
    clientId,
    company,
    normalizedCompany,
    status: cleanStatus(state.status),
    lastCompletedReviewDate: dateOnly(state.last_completed_review_date),
    reviewCycleResolvedDate: dateOnly(state.review_cycle_resolved_date),
    reviewedActivityThrough: dateOnly(state.reviewed_activity_through),
    nextReviewDate: dateOnly(state.next_review_date),
    disposition: cleanDisposition(state.disposition),
    note: String(state.note ?? "").trim(),
    updatedAt: String(payload.occurred_at || createdAt),
    sourceApp: String(payload.source_app || "unknown"),
    sourceVersion: String(payload.source_version || ""),
    eventId: String(row.event_id || ""),
    createdAt,
  };
}

function cleanCache(value: unknown): ReviewCache {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<ReviewCache> : {};
  const events = Array.isArray(raw.events)
    ? raw.events.map((item) => parseCachedItem(item)).filter((item): item is ClientReviewCloudHistoryItem => Boolean(item))
    : [];
  return { events: events.slice(-MAX_EVENTS), refreshedAt: String(raw.refreshedAt || "") };
}

function parseCachedItem(value: unknown): ClientReviewCloudHistoryItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<ClientReviewCloudHistoryItem>;
  const company = String(raw.company || "").trim();
  const clientId = String(raw.clientId || "").trim();
  const normalizedCompany = String(raw.normalizedCompany || "").trim() || normalizeReviewCompany(company);
  if (!company && !clientId && !normalizedCompany) return null;
  return {
    clientId,
    company,
    normalizedCompany,
    status: cleanStatus(raw.status),
    lastCompletedReviewDate: dateOnly(raw.lastCompletedReviewDate),
    reviewCycleResolvedDate: dateOnly(raw.reviewCycleResolvedDate),
    reviewedActivityThrough: dateOnly(raw.reviewedActivityThrough),
    nextReviewDate: dateOnly(raw.nextReviewDate),
    disposition: cleanDisposition(raw.disposition),
    note: String(raw.note || "").trim(),
    updatedAt: String(raw.updatedAt || ""),
    sourceApp: String(raw.sourceApp || "unknown"),
    sourceVersion: String(raw.sourceVersion || ""),
    eventId: String(raw.eventId || ""),
    createdAt: String(raw.createdAt || raw.updatedAt || ""),
  };
}

export function loadClientReviewCloudCache(): ReviewCache {
  if (!canStore()) return { events: [], refreshedAt: "" };
  try { return cleanCache(JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null")); }
  catch { return { events: [], refreshedAt: "" }; }
}

function saveCache(cache: ReviewCache): ReviewCache {
  const cleaned = cleanCache(cache);
  if (canStore()) {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cleaned));
    window.dispatchEvent(new CustomEvent(CLIENT_REVIEW_CLOUD_EVENT));
  }
  return cleaned;
}

function clientKeys(client: Pick<CompassClient, "id" | "name" | "aliases">): Set<string> {
  return new Set([client.name, ...(client.aliases ?? [])].map(normalizeReviewCompany).filter(Boolean));
}

function eventMatchesClient(event: ClientReviewCloudHistoryItem, client: Pick<CompassClient, "id" | "name" | "aliases">): boolean {
  if (event.clientId && event.clientId === client.id) return true;
  const keys = clientKeys(client);
  return Boolean(event.normalizedCompany && keys.has(event.normalizedCompany));
}

function newest(items: ClientReviewCloudHistoryItem[]): ClientReviewCloudHistoryItem | null {
  return [...items].sort((left, right) => `${right.createdAt}|${right.eventId}`.localeCompare(`${left.createdAt}|${left.eventId}`))[0] ?? null;
}

export function clientReviewHistoryForClient(client: Pick<CompassClient, "id" | "name" | "aliases">): ClientReviewCloudHistoryItem[] {
  return loadClientReviewCloudCache().events
    .filter((event) => eventMatchesClient(event, client))
    .sort((left, right) => `${right.createdAt}|${right.eventId}`.localeCompare(`${left.createdAt}|${left.eventId}`));
}

export function clientReviewStateForClient(client: Pick<CompassClient, "id" | "name" | "aliases">): ClientReviewCloudState | null {
  const current = newest(clientReviewHistoryForClient(client));
  if (!current) return null;
  const { createdAt: _createdAt, ...state } = current;
  return state;
}

export function clientReviewStateByClientId(clientId: string): ClientReviewCloudState | null {
  const id = String(clientId || "").trim();
  if (!id) return null;
  const current = newest(loadClientReviewCloudCache().events.filter((event) => event.clientId === id));
  if (!current) return null;
  const { createdAt: _createdAt, ...state } = current;
  return state;
}

export async function refreshClientReviewCloudState(): Promise<ClientReviewCloudHistoryItem[]> {
  const rows = await captainsLogCloudRest<ClientReviewEventRow[]>("GET", "app_events", undefined, {
    select: "event_id,event_type,payload,created_at,inserted_at",
    event_type: `eq.${CLIENT_REVIEW_EVENT_TYPE}`,
    order: "created_at.asc,event_id.asc",
    limit: String(MAX_EVENTS),
  });
  const events = (Array.isArray(rows) ? rows : []).map(parseRow).filter((item): item is ClientReviewCloudHistoryItem => Boolean(item));
  saveCache({ events, refreshedAt: new Date().toISOString() });
  return events;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export interface WriteClientReviewStateInput {
  status: ClientReviewCloudStatus;
  disposition: ClientReviewCloudDisposition;
  lastCompletedReviewDate?: string;
  reviewCycleResolvedDate?: string;
  reviewedActivityThrough?: string;
  nextReviewDate?: string;
  note?: string;
  sourceApp?: string;
  sourceVersion?: string;
  deterministicKey?: string;
}

export async function writeClientReviewState(
  client: Pick<CompassClient, "id" | "name" | "aliases" | "lastAccountReview">,
  input: WriteClientReviewStateInput,
): Promise<ClientReviewCloudState> {
  const current = clientReviewStateForClient(client);
  const now = new Date().toISOString();
  const company = String(client.name || current?.company || "").trim();
  const state: ClientReviewCloudState = {
    clientId: client.id,
    company,
    normalizedCompany: normalizeReviewCompany(company),
    status: input.status,
    lastCompletedReviewDate: dateOnly(input.lastCompletedReviewDate ?? current?.lastCompletedReviewDate ?? client.lastAccountReview),
    reviewCycleResolvedDate: dateOnly(input.reviewCycleResolvedDate ?? current?.reviewCycleResolvedDate),
    reviewedActivityThrough: dateOnly(input.reviewedActivityThrough ?? current?.reviewedActivityThrough),
    nextReviewDate: dateOnly(input.nextReviewDate ?? current?.nextReviewDate),
    disposition: input.disposition,
    note: String(input.note ?? current?.note ?? "").trim(),
    updatedAt: now,
    sourceApp: String(input.sourceApp || "client_compass"),
    sourceVersion: String(input.sourceVersion || APP_VERSION),
    eventId: `client_review:${String(input.deterministicKey || randomId()).replace(/[^a-zA-Z0-9:_-]+/g, "-")}`,
  };
  const row = {
    event_id: state.eventId,
    event_type: CLIENT_REVIEW_EVENT_TYPE,
    payload: {
      schema: CLIENT_REVIEW_SCHEMA,
      review_event_type: "state_updated",
      occurred_at: now,
      source_app: state.sourceApp,
      source_version: state.sourceVersion,
      client: { id: state.clientId, company: state.company, normalized_company: state.normalizedCompany },
      state: {
        status: state.status,
        last_completed_review_date: state.lastCompletedReviewDate,
        review_cycle_resolved_date: state.reviewCycleResolvedDate,
        reviewed_activity_through: state.reviewedActivityThrough,
        next_review_date: state.nextReviewDate,
        disposition: state.disposition,
        note: state.note,
      },
    },
  };
  await captainsLogCloudRest<null>("POST", "app_events", [row], { on_conflict: "event_id" }, "resolution=ignore-duplicates,return=minimal");
  const localEvent: ClientReviewCloudHistoryItem = { ...state, createdAt: now };
  const cache = loadClientReviewCloudCache();
  const events = [...cache.events.filter((event) => event.eventId !== state.eventId), localEvent].slice(-MAX_EVENTS);
  saveCache({ events, refreshedAt: cache.refreshedAt });
  return state;
}

export async function seedExistingReviewDatesToCloud(clients: CompassClient[]): Promise<number> {
  const cache = loadClientReviewCloudCache();
  const rows: Array<Record<string, unknown>> = [];
  const localEvents: ClientReviewCloudHistoryItem[] = [];
  for (const client of clients) {
    const reviewDate = dateOnly(client.lastAccountReview || client.reviewOutcome?.reviewedAt || "");
    if (!reviewDate || clientReviewStateForClient(client)) continue;
    const company = String(client.name || "").trim();
    const eventId = `client_review:migrate:${client.id}:${reviewDate}`;
    const occurredAt = `${reviewDate}T12:00:00.000Z`;
    const state: ClientReviewCloudHistoryItem = {
      clientId: client.id,
      company,
      normalizedCompany: normalizeReviewCompany(company),
      status: "completed",
      lastCompletedReviewDate: reviewDate,
      reviewCycleResolvedDate: reviewDate,
      reviewedActivityThrough: reviewDate,
      nextReviewDate: "",
      disposition: "migrated",
      note: "",
      updatedAt: occurredAt,
      sourceApp: "client_compass_migration",
      sourceVersion: APP_VERSION,
      eventId,
      createdAt: occurredAt,
    };
    rows.push({
      event_id: eventId,
      event_type: CLIENT_REVIEW_EVENT_TYPE,
      payload: {
        schema: CLIENT_REVIEW_SCHEMA,
        review_event_type: "state_updated",
        occurred_at: occurredAt,
        source_app: state.sourceApp,
        source_version: APP_VERSION,
        client: { id: client.id, company, normalized_company: state.normalizedCompany },
        state: {
          status: state.status,
          last_completed_review_date: reviewDate,
          review_cycle_resolved_date: reviewDate,
          reviewed_activity_through: reviewDate,
          next_review_date: "",
          disposition: "migrated",
          note: "",
        },
      },
    });
    localEvents.push(state);
  }
  if (!rows.length) return 0;
  await captainsLogCloudRest<null>("POST", "app_events", rows, { on_conflict: "event_id" }, "resolution=ignore-duplicates,return=minimal");
  saveCache({ events: [...cache.events, ...localEvents].slice(-MAX_EVENTS), refreshedAt: cache.refreshedAt });
  return rows.length;
}
