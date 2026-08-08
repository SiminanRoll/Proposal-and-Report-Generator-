import type { CompassDataset } from "@/lib/compass/types";
import { buildSegmentClientMetrics, segmentIncludesClient } from "./engine";
import type { SegmentDefinition } from "./types";

export type MapSegmentMatchMode = "all" | "any";

export interface MapLensState {
  segmentIds: string[];
  matchMode: MapSegmentMatchMode;
  states: string[];
}

export const MAP_LENS_STORAGE_KEY = "client-compass.map-lens.v1";
export const MAP_LENS_CHANGE_EVENT = "client-compass-map-lens-changed";
const SEGMENT_STORAGE_KEY = "client-compass.segments.v1";

export const EMPTY_MAP_LENS_STATE: MapLensState = { segmentIds: [], matchMode: "all", states: [] };

export function normalizeMapLensState(value: unknown): MapLensState {
  const row = value && typeof value === "object" ? value as Partial<MapLensState> : {};
  return {
    segmentIds: Array.isArray(row.segmentIds) ? [...new Set(row.segmentIds.map(String).filter(Boolean))] : [],
    matchMode: row.matchMode === "any" ? "any" : "all",
    states: Array.isArray(row.states) ? [...new Set(row.states.map((state) => String(state).trim().toUpperCase()).filter(Boolean))] : [],
  };
}

export function loadMapLensState(): MapLensState {
  if (typeof window === "undefined") return EMPTY_MAP_LENS_STATE;
  try { return normalizeMapLensState(JSON.parse(window.localStorage.getItem(MAP_LENS_STORAGE_KEY) || "null")); }
  catch { return EMPTY_MAP_LENS_STATE; }
}

export function saveMapLensState(state: MapLensState): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeMapLensState(state);
  window.localStorage.setItem(MAP_LENS_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(MAP_LENS_CHANGE_EVENT));
  window.dispatchEvent(new Event("client-compass-data-changed"));
}

function savedSegments(): SegmentDefinition[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SEGMENT_STORAGE_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SegmentDefinition => Boolean(item && typeof item === "object" && String((item as SegmentDefinition).id || "") && String((item as SegmentDefinition).title || "")));
  } catch { return []; }
}

export function mapLensClientIds(dataset: CompassDataset, state: MapLensState, segments: SegmentDefinition[]): Set<string> {
  const normalized = normalizeMapLensState(state);
  const activeSegments = normalized.segmentIds.map((id) => segments.find((segment) => segment.id === id)).filter((segment): segment is SegmentDefinition => Boolean(segment));
  const stateScope = new Set(normalized.states);
  const ids = new Set<string>();

  for (const client of dataset.clients) {
    const clientState = String(client.state || "").trim().toUpperCase();
    if (stateScope.size && !stateScope.has(clientState)) continue;
    if (!activeSegments.length) { ids.add(client.id); continue; }
    const metrics = buildSegmentClientMetrics(dataset, client.id);
    if (!metrics) continue;
    const matches = activeSegments.map((segment) => segmentIncludesClient(segment, metrics));
    const included = normalized.matchMode === "any" ? matches.some(Boolean) : matches.every(Boolean);
    if (included) ids.add(client.id);
  }
  return ids;
}

export function filterCompassDatasetForMapLens(dataset: CompassDataset): CompassDataset {
  if (typeof window === "undefined" || !String(window.location?.pathname || "").startsWith("/map")) return dataset;
  const state = loadMapLensState();
  if (!state.segmentIds.length && !state.states.length) return dataset;
  const ids = mapLensClientIds(dataset, state, savedSegments());
  return {
    ...dataset,
    clients: dataset.clients.filter((client) => ids.has(client.id)),
    locations: dataset.locations.filter((location) => ids.has(location.clientId)),
    devices: dataset.devices.filter((device) => ids.has(device.clientId)),
    findings: dataset.findings.filter((finding) => ids.has(finding.clientId)),
    summaries: dataset.summaries.filter((summary) => ids.has(summary.clientId)),
  };
}
