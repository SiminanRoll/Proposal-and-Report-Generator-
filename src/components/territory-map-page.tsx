"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { CompassClientWorkspace } from "@/components/compass-client-workspace";
import { useCompassState } from "@/lib/compass/store";
import { SERVICE_STATE_GEOMETRIES, SERVICE_STATE_ORDER } from "@/lib/compass/service-area-map";
import {
  buildTerritoryMapSnapshot,
  DEFAULT_TERRITORY_MAP_CRITERIA,
  territoryColor,
  type TerritoryHealth,
  type TerritoryMapCriteria,
  type TerritoryMetric,
  type TerritoryNeedBasis,
} from "@/lib/compass/territory-map";
import { buildSegmentClientMetrics } from "@/lib/segments/engine";

type MapMetric = "clients" | "need" | "value";
type SortDirection = "asc" | "desc";
type MapListSortKey = "client" | "health" | "review" | "value";
type ListScope = { title: string; state: string; clientIds: string[] } | null;
type MapPan = { x: number; y: number };
type MapDragState = { pointerId: number; startClientX: number; startClientY: number; startPan: MapPan; moved: boolean };

type RegionRule = {
  key: string;
  label: string;
  name: string;
  color: string;
  matches: string[];
};

type RegionLayout = {
  axis: "x" | "y";
  bounds: { x: number; y: number; width: number; height: number };
  labels: Array<{ x: number; y: number }>;
  splitAt?: number;
};

type MapRegionMetric = {
  id: string;
  state: string;
  key: string;
  label: string;
  name: string;
  color: string;
  territoryIds: string[];
  clientIds: string[];
  clientCount: number;
  clientsInNeed: number;
  estimatedValue: number;
  replaceNow: number;
  planSoon: number;
  healthy: number;
};

type RegionSlice = { region: MapRegionMetric; startAngle: number; endAngle: number; value: number };

const MAP_SETTINGS_KEY = "client-compass.territory-map-settings.v1";
const BASE_VIEWBOX = { x: 274, y: 0, width: 354, height: 610 };
const SERVER_PROJECT_CARDS = new Set(["critical-server", "server-planning"]);
const STATE_SELECTION_GROUPS = [
  ["TN", "KY", "AL"],
  ["IN", "OH"],
] as const;

const STATE_SINGLE_COLORS: Record<string, string> = {
  WI: "#4DBEEA",
  IN: "#F1BD62",
  OH: "#F17A78",
  KY: "#68CFA5",
  TN: "#42C3C0",
};

const STATE_REGION_RULES: Record<string, RegionRule[]> = {
  MI: [
    { key: "west", label: "MI W", name: "Michigan West", color: "#3EC9AE", matches: ["west"] },
    { key: "east", label: "MI E", name: "Michigan East", color: "#73DFC9", matches: ["east"] },
  ],
  IL: [
    { key: "north", label: "IL N", name: "Illinois North", color: "#6879EB", matches: ["chi - n", "chi-n", "north"] },
    { key: "south", label: "IL S", name: "Illinois South", color: "#929DFF", matches: ["chi - s", "chi-s", "south"] },
  ],
  AL: [
    { key: "north", label: "AL N", name: "Alabama North", color: "#45C98B", matches: ["north"] },
    { key: "central", label: "AL C", name: "Alabama Central", color: "#73D9A9", matches: ["central"] },
  ],
  GA: [
    { key: "central", label: "GA C", name: "Georgia Central", color: "#F49B58", matches: ["central"] },
    { key: "east", label: "GA E", name: "Georgia East", color: "#F7B27D", matches: ["east"] },
  ],
  FL: [
    { key: "north", label: "FL N", name: "Florida North", color: "#8067F4", matches: ["jacksonville", "north"] },
    { key: "central", label: "FL C", name: "Florida Central", color: "#A082F8", matches: ["central east", "central west", "central"] },
    { key: "south", label: "FL S", name: "Florida South", color: "#C0A0FF", matches: ["southeast", "south"] },
  ],
};

const STATE_REGION_LAYOUTS: Record<string, RegionLayout> = {
  MI: { axis: "x", bounds: { x: 340, y: 20, width: 151, height: 157 }, labels: [{ x: 424, y: 137 }, { x: 472, y: 137 }], splitAt: 451 },
  IL: { axis: "y", bounds: { x: 330, y: 158, width: 80, height: 139 }, labels: [{ x: 373, y: 191 }, { x: 380, y: 247 }] },
  AL: { axis: "y", bounds: { x: 402, y: 336, width: 77, height: 122 }, labels: [{ x: 437, y: 360 }, { x: 438, y: 410 }] },
  GA: { axis: "x", bounds: { x: 452, y: 329, width: 109, height: 112 }, labels: [{ x: 487, y: 385 }, { x: 535, y: 390 }] },
  FL: { axis: "y", bounds: { x: 420, y: 426, width: 181, height: 154 }, labels: [{ x: 510, y: 448 }, { x: 555, y: 494 }, { x: 580, y: 543 }] },
};

function compactMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function numberLabel(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string): string {
  if (!value) return "Not recorded";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function dateValue(value: string): number {
  if (!value) return 0;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function reportUrl(clientId: string, clientName: string): string {
  const params = new URLSearchParams({ type: "client-report", compassClientId: clientId, client: clientName });
  return `/create/?${params.toString()}`;
}

function selectionGroupForState(state: string): readonly string[] | null {
  return STATE_SELECTION_GROUPS.find((group) => group.includes(state as never)) ?? null;
}

function statesShareSelectionGroup(left: string, right: string): boolean {
  if (left === right) return true;
  const group = selectionGroupForState(left);
  return Boolean(group?.includes(right));
}

function polarPoint(cx: number, cy: number, radius: number, angle: number): [number, number] {
  const radians = angle * Math.PI / 180;
  return [cx + Math.cos(radians) * radius, cy + Math.sin(radians) * radius];
}

function donutPath(startAngle: number, endAngle: number, outerRadius: number, innerRadius = 54, cx = 104, cy = 104): string {
  const safeEnd = Math.min(endAngle, startAngle + 359.999);
  const [outerStartX, outerStartY] = polarPoint(cx, cy, outerRadius, startAngle);
  const [outerEndX, outerEndY] = polarPoint(cx, cy, outerRadius, safeEnd);
  const [innerEndX, innerEndY] = polarPoint(cx, cy, innerRadius, safeEnd);
  const [innerStartX, innerStartY] = polarPoint(cx, cy, innerRadius, startAngle);
  const large = safeEnd - startAngle > 180 ? 1 : 0;
  return `M${outerStartX},${outerStartY} A${outerRadius},${outerRadius} 0 ${large} 1 ${outerEndX},${outerEndY} L${innerEndX},${innerEndY} A${innerRadius},${innerRadius} 0 ${large} 0 ${innerStartX},${innerStartY} Z`;
}

function metricValue(region: MapRegionMetric, metric: MapMetric): number {
  if (metric === "clients") return region.clientCount;
  if (metric === "need") return region.clientsInNeed;
  return region.estimatedValue;
}

function slicesFor(regions: MapRegionMetric[], metric: MapMetric): RegionSlice[] {
  const values = regions.map((region) => ({ region, value: metricValue(region, metric) })).filter((item) => item.value > 0);
  const total = values.reduce((sum, item) => sum + item.value, 0);
  let angle = -90;
  return values.map((item) => {
    const sweep = total > 0 ? (item.value / total) * 360 : 0;
    const slice = { region: item.region, value: item.value, startAngle: angle, endAngle: angle + sweep };
    angle += sweep;
    return slice;
  });
}

function handleKeyboard(event: ReactKeyboardEvent<SVGElement>, callback: () => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  callback();
}

function loadCriteria(): TerritoryMapCriteria {
  if (typeof window === "undefined") return DEFAULT_TERRITORY_MAP_CRITERIA;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MAP_SETTINGS_KEY) || "null") as Partial<TerritoryMapCriteria> | null;
    if (!parsed) return DEFAULT_TERRITORY_MAP_CRITERIA;
    const needBasis: TerritoryNeedBasis = parsed.needBasis === "server" || parsed.needBasis === "server-workstations" ? parsed.needBasis : "value";
    return {
      includeReplaceNow: parsed.includeReplaceNow !== false,
      includePlanSoon: parsed.includePlanSoon !== false,
      minimumEstimatedValue: Math.max(0, Number(parsed.minimumEstimatedValue) || 0),
      valueFollowsNeed: parsed.valueFollowsNeed === true,
      needBasis,
    };
  } catch {
    return DEFAULT_TERRITORY_MAP_CRITERIA;
  }
}

function normalizeTerritory(value: string, state: string): string {
  return value.toLowerCase().replace(new RegExp(`^${state.toLowerCase()}\\s*[-–—]?\\s*`), "").replace(/\s+/g, " ").trim();
}

function ruleForTerritory(state: string, territoryName: string): RegionRule | null {
  const rules = STATE_REGION_RULES[state];
  if (!rules?.length) return null;
  const normalized = normalizeTerritory(territoryName, state);
  const matched = rules.find((rule) => rule.matches.some((fragment) => normalized.includes(fragment)));
  if (matched) return matched;
  return rules.find((rule) => rule.key === "central") ?? rules[0];
}

function buildDisplayRegions(territories: TerritoryMetric[], states: string[]): MapRegionMetric[] {
  const territoryByState = new Map<string, TerritoryMetric[]>();
  for (const territory of territories) {
    const list = territoryByState.get(territory.primaryState) ?? [];
    list.push(territory);
    territoryByState.set(territory.primaryState, list);
  }

  const serviceOrder = SERVICE_STATE_ORDER as readonly string[];
  const orderedStates = [
    ...SERVICE_STATE_ORDER.filter((state) => states.includes(state)),
    ...states.filter((state) => !serviceOrder.includes(state)).sort(),
  ];

  const regions: MapRegionMetric[] = [];
  for (const state of orderedStates) {
    const stateTerritories = territoryByState.get(state) ?? [];
    const rules = STATE_REGION_RULES[state] ?? [{ key: "all", label: state, name: state, color: STATE_SINGLE_COLORS[state] ?? territoryColor(`map-${state}`), matches: [] }];
    for (const rule of rules) {
      const included = stateTerritories.filter((territory) => {
        if (!STATE_REGION_RULES[state]) return true;
        return ruleForTerritory(state, territory.name)?.key === rule.key;
      });
      const clients = included.flatMap((territory) => territory.clients);
      regions.push({
        id: `${state}|${rule.key}`,
        state,
        key: rule.key,
        label: rule.label,
        name: rule.name,
        color: rule.color,
        territoryIds: included.map((territory) => territory.id),
        clientIds: clients.map((client) => client.clientId),
        clientCount: included.reduce((sum, territory) => sum + territory.clientCount, 0),
        clientsInNeed: included.reduce((sum, territory) => sum + territory.clientsInNeed, 0),
        estimatedValue: included.reduce((sum, territory) => sum + territory.estimatedValue, 0),
        replaceNow: included.reduce((sum, territory) => sum + territory.replaceNow, 0),
        planSoon: included.reduce((sum, territory) => sum + territory.planSoon, 0),
        healthy: included.reduce((sum, territory) => sum + territory.healthy, 0),
      });
    }
  }
  return regions;
}

function regionRect(state: string, index: number, count: number) {
  const layout = STATE_REGION_LAYOUTS[state];
  if (!layout || count <= 1) return { x: 0, y: 0, width: 0, height: 0 };
  const { bounds, axis } = layout;
  if (axis === "x") {
    if (count === 2 && layout.splitAt) {
      if (index === 0) return { x: bounds.x, y: bounds.y, width: layout.splitAt - bounds.x + .5, height: bounds.height };
      return { x: layout.splitAt, y: bounds.y, width: bounds.x + bounds.width - layout.splitAt + .5, height: bounds.height };
    }
    const width = bounds.width / count;
    return { x: bounds.x + width * index, y: bounds.y, width: width + .5, height: bounds.height };
  }
  const height = bounds.height / count;
  return { x: bounds.x, y: bounds.y + height * index, width: bounds.width, height: height + .5 };
}

function regionLabelPoint(state: string, index: number) {
  return STATE_REGION_LAYOUTS[state]?.labels[index] ?? SERVICE_STATE_GEOMETRIES[state]?.label ?? { x: 450, y: 300 };
}

function splitLines(state: string, count: number): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const layout = STATE_REGION_LAYOUTS[state];
  if (!layout || count <= 1) return [];
  const lines = [];
  for (let index = 1; index < count; index += 1) {
    if (layout.axis === "x") {
      const x = count === 2 && layout.splitAt ? layout.splitAt : layout.bounds.x + layout.bounds.width * index / count;
      lines.push({ x1: x, y1: layout.bounds.y, x2: x, y2: layout.bounds.y + layout.bounds.height });
    } else {
      const y = layout.bounds.y + layout.bounds.height * index / count;
      lines.push({ x1: layout.bounds.x, y1: y, x2: layout.bounds.x + layout.bounds.width, y2: y });
    }
  }
  return lines;
}

function clampMapPan(pan: MapPan, zoom: number): MapPan {
  if (zoom <= 1) return { x: 0, y: 0 };
  const visibleWidth = BASE_VIEWBOX.width / zoom;
  const visibleHeight = BASE_VIEWBOX.height / zoom;
  const maxX = Math.max(0, (BASE_VIEWBOX.width - visibleWidth) / 2);
  const maxY = Math.max(0, (BASE_VIEWBOX.height - visibleHeight) / 2);
  return { x: Math.max(-maxX, Math.min(maxX, pan.x)), y: Math.max(-maxY, Math.min(maxY, pan.y)) };
}

function viewBoxForZoom(zoom: number, pan: MapPan): string {
  const width = BASE_VIEWBOX.width / zoom;
  const height = BASE_VIEWBOX.height / zoom;
  const safePan = clampMapPan(pan, zoom);
  const centerX = BASE_VIEWBOX.x + BASE_VIEWBOX.width / 2 + safePan.x;
  const centerY = BASE_VIEWBOX.y + BASE_VIEWBOX.height / 2 + safePan.y;
  return `${centerX - width / 2} ${centerY - height / 2} ${width} ${height}`;
}

function clientMatchesNeed(health: TerritoryHealth | undefined, estimatedValue: number, hasServerProject: boolean, workstationCount: number, criteria: TerritoryMapCriteria): boolean {
  if (health === "replace-now" && !criteria.includeReplaceNow) return false;
  if (health === "plan-soon" && !criteria.includePlanSoon) return false;
  if (health !== "replace-now" && health !== "plan-soon") return false;
  if (criteria.needBasis === "server") return hasServerProject;
  if (criteria.needBasis === "server-workstations") return hasServerProject || workstationCount >= 5;
  return estimatedValue >= Math.max(0, criteria.minimumEstimatedValue || 0);
}

function sortIndicator(column: MapListSortKey, active: MapListSortKey, direction: SortDirection): string {
  if (column !== active) return "↕";
  return direction === "asc" ? "↑" : "↓";
}

function BarRow({ label, count, total, tone }: { label: string; count: number; total: number; tone: string }) {
  const width = total > 0 ? Math.max(count > 0 ? 4 : 0, (count / total) * 100) : 0;
  return <div className="territory-health-row"><span>{label}</span><i><b className={`tone-${tone}`} style={{ width: `${width}%` }} /></i><strong>{count}</strong></div>;
}

function MapClientList({ scope, dataset, metric, criteria, healthByClient, onClose, onOpenClient }: {
  scope: NonNullable<ListScope>;
  dataset: NonNullable<ReturnType<typeof useCompassState>["dataset"]>;
  metric: MapMetric;
  criteria: TerritoryMapCriteria;
  healthByClient: Map<string, TerritoryHealth>;
  onClose: () => void;
  onOpenClient: (clientId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<MapListSortKey>(metric === "clients" ? "client" : metric === "need" ? "health" : "value");
  const [sortDirection, setSortDirection] = useState<SortDirection>(metric === "clients" ? "asc" : "desc");
  const clientSet = useMemo(() => new Set(scope.clientIds), [scope.clientIds]);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const built = dataset.clients
      .filter((client) => clientSet.has(client.id))
      .map((client) => {
        const metrics = buildSegmentClientMetrics(dataset, client.id);
        const summary = dataset.summaries.find((item) => item.clientId === client.id);
        const hasServerProject = Boolean(summary?.opportunities.some((opportunity) => SERVER_PROJECT_CARDS.has(opportunity.cardCategory) && opportunity.estimatedValue > 0));
        return { client, metrics, health: healthByClient.get(client.id), hasServerProject };
      })
      .filter((row) => Boolean(row.metrics))
      .filter((row) => metric !== "need" || clientMatchesNeed(row.health, row.metrics?.estimatedValue ?? 0, row.hasServerProject, row.metrics?.workstations ?? 0, criteria))
      .filter((row) => !normalized || row.client.name.toLowerCase().includes(normalized) || (row.client.city || "").toLowerCase().includes(normalized));

    const dir = sortDirection === "asc" ? 1 : -1;
    return built.sort((left, right) => {
      const a = left.metrics!;
      const b = right.metrics!;
      if (sortKey === "client") return dir * left.client.name.localeCompare(right.client.name);
      if (sortKey === "health") return dir * ((a.replaceNow - b.replaceNow) || (a.planSoon - b.planSoon) || (a.healthy - b.healthy) || left.client.name.localeCompare(right.client.name));
      if (sortKey === "review") return dir * ((dateValue(a.lastAccountReview) - dateValue(b.lastAccountReview)) || left.client.name.localeCompare(right.client.name));
      return dir * ((a.estimatedValue - b.estimatedValue) || left.client.name.localeCompare(right.client.name));
    });
  }, [clientSet, criteria, dataset, healthByClient, metric, query, sortDirection, sortKey]);

  const updateSort = (column: MapListSortKey) => {
    if (sortKey === column) { setSortDirection((current) => current === "asc" ? "desc" : "asc"); return; }
    setSortKey(column);
    setSortDirection(column === "client" ? "asc" : "desc");
  };
  const sortButton = (column: MapListSortKey, label: string) => <button type="button" className={`compass-column-sort${sortKey === column ? " is-active" : ""}`} onClick={() => updateSort(column)}>{label}<span aria-hidden="true">{sortIndicator(column, sortKey, sortDirection)}</span></button>;

  return <div className="territory-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <aside className="territory-editor territory-client-review" role="dialog" aria-modal="true" aria-labelledby="territory-client-review-title">
      <header><div><span className="compass-kicker">Map clients</span><h2 id="territory-client-review-title">{scope.title}</h2><p>{rows.length} shown · {metric === "clients" ? "all clients" : metric === "need" ? "current need criteria" : "represented value"}</p></div><button type="button" className="territory-editor-close" onClick={onClose} aria-label="Close client list">×</button></header>
      <div className="territory-client-review-tools"><label><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clients" /></label><span>{metric === "clients" ? "Clients" : metric === "need" ? "Need" : "Value"} view</span></div>
      <div className="territory-client-review-table">
        <div className="territory-client-review-head"><span>{sortButton("client", "Client")}</span><span>{sortButton("health", "Need")}</span><span>{sortButton("review", "Last review")}</span><span>{sortButton("value", "Value")}</span><span>Actions</span></div>
        <div className="territory-client-review-rows">{rows.map(({ client, metrics }) => metrics && <div className="territory-client-review-row" key={client.id}>
          <button type="button" className="territory-client-review-name" onClick={() => onOpenClient(client.id)}><strong>{client.name}</strong><small>{client.city || "City not recorded"}{client.market ? ` · ${client.market}` : ""}</small></button>
          <span className="segment-client-health"><b className="risk"><i />{metrics.replaceNow}</b><b className="attention"><i />{metrics.planSoon}</b><b className="healthy"><i />{metrics.healthy}</b></span>
          <span>{formatDate(metrics.lastAccountReview)}</span><strong>{compactMoney(metrics.estimatedValue)}</strong><span className="territory-client-review-actions"><button type="button" onClick={() => onOpenClient(client.id)}>Open</button><Link href={reportUrl(client.id, client.name)}>Report</Link></span>
        </div>)}</div>
      </div>
    </aside>
  </div>;
}

export function TerritoryMapPage() {
  const { dataset, config, ready, refresh } = useCompassState();
  const [metric, setMetric] = useState<MapMetric>("value");
  const [criteria, setCriteria] = useState<TerritoryMapCriteria>(loadCriteria);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<MapPan>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const mapDragRef = useRef<MapDragState | null>(null);
  const suppressMapClickRef = useRef(false);
  const [hoveredRegionId, setHoveredRegionId] = useState("");
  const [pinnedRegionId, setPinnedRegionId] = useState("");
  const [pinnedState, setPinnedState] = useState("");
  const [listScope, setListScope] = useState<ListScope>(null);
  const [activeClientId, setActiveClientId] = useState("");

  useEffect(() => { window.localStorage.setItem(MAP_SETTINGS_KEY, JSON.stringify(criteria)); }, [criteria]);

  const snapshot = useMemo(() => dataset ? buildTerritoryMapSnapshot(dataset, criteria) : null, [criteria, dataset]);
  const displayRegions = useMemo(() => snapshot ? buildDisplayRegions(snapshot.territories, snapshot.states) : [], [snapshot]);
  const regionsByState = useMemo(() => {
    const map = new Map<string, MapRegionMetric[]>();
    for (const region of displayRegions) {
      const list = map.get(region.state) ?? [];
      list.push(region);
      map.set(region.state, list);
    }
    return map;
  }, [displayRegions]);
  const healthByClient = useMemo(() => new Map(snapshot?.territories.flatMap((territory) => territory.clients.map((client) => [client.clientId, client.health] as const)) ?? []), [snapshot]);

  const hoveredRegion = displayRegions.find((region) => region.id === hoveredRegionId) ?? null;
  const pinnedRegion = displayRegions.find((region) => region.id === pinnedRegionId) ?? null;
  const focusRegion = hoveredRegion || pinnedRegion;
  const focusState = focusRegion?.state || pinnedState;
  const focusSelectionGroup = selectionGroupForState(focusState);
  const slices = useMemo(() => slicesFor(displayRegions, metric), [displayRegions, metric]);
  const stateDividerAngles = useMemo(() => slices.filter((slice, index) => {
    if (index === 0) return true;
    const previous = slices[index - 1].region.state;
    return previous !== slice.region.state && !statesShareSelectionGroup(previous, slice.region.state);
  }).map((slice) => slice.startAngle), [slices]);

  if (!ready) return <div className="territory-map-page"><div className="territory-map-empty">Loading Client Compass data…</div></div>;
  if (!dataset || !snapshot || snapshot.territories.length === 0) return <div className="territory-map-page"><div className="territory-map-empty"><strong>No territory data yet.</strong><span>Import client record enrichment with State and Territory to populate the map.</span></div></div>;
  if (activeClientId) return <CompassClientWorkspace clientId={activeClientId} dataset={dataset} config={config} onBack={() => setActiveClientId("")} onCloseAll={() => setActiveClientId("")} onDatasetSaved={refresh} />;

  const mappedStates = SERVICE_STATE_ORDER.filter((state) => SERVICE_STATE_GEOMETRIES[state]);
  const unmappedStates = snapshot.states.filter((state) => !SERVICE_STATE_GEOMETRIES[state]);
  const maxMetric = Math.max(1, ...displayRegions.map((region) => metricValue(region, metric)));
  const stateRegions = focusState ? regionsByState.get(focusState) ?? [] : [];
  const stateClientCount = stateRegions.reduce((sum, region) => sum + region.clientCount, 0);
  const stateNeed = stateRegions.reduce((sum, region) => sum + region.clientsInNeed, 0);
  const stateValue = stateRegions.reduce((sum, region) => sum + region.estimatedValue, 0);
  const stateReplaceNow = stateRegions.reduce((sum, region) => sum + region.replaceNow, 0);
  const statePlanSoon = stateRegions.reduce((sum, region) => sum + region.planSoon, 0);
  const stateHealthy = stateRegions.reduce((sum, region) => sum + region.healthy, 0);
  const detailClientCount = focusRegion?.clientCount ?? (focusState ? stateClientCount : snapshot.totals.clients);
  const detailNeed = focusRegion?.clientsInNeed ?? (focusState ? stateNeed : snapshot.totals.clientsInNeed);
  const detailValue = focusRegion?.estimatedValue ?? (focusState ? stateValue : snapshot.totals.estimatedValue);
  const detailReplaceNow = focusRegion?.replaceNow ?? (focusState ? stateReplaceNow : snapshot.totals.replaceNow);
  const detailPlanSoon = focusRegion?.planSoon ?? (focusState ? statePlanSoon : snapshot.totals.planSoon);
  const detailHealthy = focusRegion?.healthy ?? (focusState ? stateHealthy : snapshot.totals.healthy);
  const detailTitle = focusRegion?.label ?? (focusState || "All territories");
  const detailSubtitle = focusRegion?.name ?? (focusState ? `${stateRegions.length} map section${stateRegions.length === 1 ? "" : "s"}` : "Service area portfolio");
  const detailColor = focusRegion?.color ?? stateRegions[0]?.color ?? "#69C8FF";
  const donutTotal = metric === "clients" ? snapshot.totals.clients : metric === "need" ? snapshot.totals.clientsInNeed : snapshot.totals.estimatedValue;

  const clearSelection = () => {
    setHoveredRegionId("");
    setPinnedRegionId("");
    setPinnedState("");
  };

  const selectRegion = (region: MapRegionMetric) => {
    setHoveredRegionId("");
    if (pinnedState !== region.state) {
      setPinnedState(region.state);
      setPinnedRegionId("");
      return;
    }
    setPinnedRegionId(region.id);
  };

  const openFocusedClients = () => {
    if (focusRegion) {
      setListScope({ title: `${focusRegion.name} clients`, state: focusRegion.state, clientIds: focusRegion.clientIds });
      return;
    }
    if (focusState) setListScope({ title: `${focusState} clients`, state: focusState, clientIds: stateRegions.flatMap((region) => region.clientIds) });
  };

  const changeZoom = (nextZoom: number) => {
    const value = Math.max(1, Math.min(1.6, Number(nextZoom.toFixed(2))));
    setZoom(value);
    setPan((current) => clampMapPan(current, value));
  };

  const beginMapPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (zoom <= 1 || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    mapDragRef.current = { pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startPan: pan, moved: false };
    setDragging(true);
  };

  const moveMapPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = mapDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    if (!drag.moved && Math.hypot(dx, dy) >= 3) {
      drag.moved = true;
      suppressMapClickRef.current = true;
      setHoveredRegionId("");
    }
    if (!drag.moved) return;
    event.preventDefault();
    const visibleWidth = BASE_VIEWBOX.width / zoom;
    const visibleHeight = BASE_VIEWBOX.height / zoom;
    setPan(clampMapPan({
      x: drag.startPan.x - (dx * visibleWidth / rect.width),
      y: drag.startPan.y - (dy * visibleHeight / rect.height),
    }, zoom));
  };

  const endMapPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = mapDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    mapDragRef.current = null;
    setDragging(false);
  };

  return <div className="territory-map-page">
    <header className="territory-map-header"><div><span className="compass-kicker">Territory view</span><h1>Map</h1></div><div className="territory-map-summary" aria-label="Territory totals"><span><strong>{numberLabel(snapshot.totals.clients)}</strong> clients</span><span><strong>{numberLabel(snapshot.totals.clientsInNeed)}</strong> in need</span><span><strong>{compactMoney(snapshot.totals.estimatedValue)}</strong> value</span></div></header>

    <div className="territory-map-layout">
      <section className="territory-map-canvas" aria-label="Client Compass service territory map" onClick={(event) => { if (event.currentTarget === event.target) clearSelection(); }}>
        <svg className={`territory-regional-map${focusState || focusRegion ? " has-active" : ""}${zoom > 1 ? " is-pannable" : ""}${dragging ? " is-dragging" : ""}`} viewBox={viewBoxForZoom(zoom, pan)} role="img" aria-label="Advantage Technologies service-area territory map" onPointerDown={beginMapPan} onPointerMove={moveMapPan} onPointerUp={endMapPan} onPointerCancel={endMapPan} onClickCapture={(event) => { if (suppressMapClickRef.current) { event.preventDefault(); event.stopPropagation(); suppressMapClickRef.current = false; } }} onClick={(event) => { if (event.currentTarget === event.target) clearSelection(); }}>
          <defs>
            {mappedStates.map((state) => <clipPath id={`territory-clip-${state}`} key={state}><path d={SERVICE_STATE_GEOMETRIES[state].path} /></clipPath>)}
            <linearGradient id="territory-glass-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffffff" stopOpacity=".48"/><stop offset="32%" stopColor="#ffffff" stopOpacity=".12"/><stop offset="68%" stopColor="#ffffff" stopOpacity="0"/><stop offset="100%" stopColor="#dff4ff" stopOpacity=".13"/></linearGradient>
          </defs>
          {mappedStates.map((state) => {
            const geometry = SERVICE_STATE_GEOMETRIES[state];
            const regions = regionsByState.get(state) ?? [{ id: `${state}|all`, state, key: "all", label: state, name: state, color: STATE_SINGLE_COLORS[state] ?? territoryColor(`map-${state}`), territoryIds: [], clientIds: [], clientCount: 0, clientsInNeed: 0, estimatedValue: 0, replaceNow: 0, planSoon: 0, healthy: 0 }];
            const activeInState = focusState === state;
            return <g key={state} className={`territory-map-state${activeInState ? " is-active" : ""}`}>
              <path className="territory-map-state-base" d={geometry.path} />
              <g clipPath={`url(#territory-clip-${state})`}>
                {regions.map((region, index) => {
                  const rect = regionRect(state, index, regions.length);
                  const active = focusRegion ? focusRegion.id === region.id : activeInState;
                  const strength = Math.max(.18, metricValue(region, metric) / maxMetric);
                  const singleState = regions.length === 1;
                  return <g key={region.id} className={`territory-map-region${active ? " is-active" : ""}`} role="button" tabIndex={0} style={{ "--territory-color": region.color, "--territory-strength": strength } as CSSProperties}
                    aria-label={`${region.name}: ${region.clientCount} clients. First click focuses ${state}; next click drills into ${region.label}.`}
                    onMouseEnter={() => setHoveredRegionId(region.id)} onMouseLeave={() => setHoveredRegionId("")} onFocus={() => setHoveredRegionId(region.id)} onBlur={() => setHoveredRegionId("")}
                    onClick={(event) => { event.stopPropagation(); selectRegion(region); }} onKeyDown={(event) => handleKeyboard(event, () => selectRegion(region))}>
                    {singleState ? <>
                      <path className="territory-map-region-fill" d={geometry.path} fill={region.color} />
                      <path className="territory-map-region-sheen" d={geometry.path} fill="url(#territory-glass-sheen)" />
                    </> : <>
                      <rect className="territory-map-region-fill" {...rect} fill={region.color} />
                      <rect className="territory-map-region-sheen" {...rect} fill="url(#territory-glass-sheen)" />
                    </>}
                    <title>{region.name} · {region.clientCount} clients · {region.clientsInNeed} in need · {compactMoney(region.estimatedValue)}</title>
                  </g>;
                })}
                {splitLines(state, regions.length).map((line, index) => <line className="territory-map-split-line" key={`${state}-line-${index}`} {...line} />)}
              </g>
              <path className="territory-map-state-outline" d={geometry.path} />
              {regions.map((region, index) => {
                const point = regionLabelPoint(state, index);
                const active = focusRegion ? focusRegion.id === region.id : activeInState;
                return <text key={`${region.id}-label`} className={`territory-map-region-label${regions.length === 1 ? " is-state-stamp" : ""}${active ? " is-active" : ""}`} x={point.x} y={point.y}>{region.label}</text>;
              })}
            </g>;
          })}
        </svg>

        <div className="territory-map-zoom" aria-label="Map zoom controls" title={zoom > 1 ? "Drag the map to pan" : "Zoom in, then drag to pan"}><button type="button" onClick={() => changeZoom(zoom - .15)} disabled={zoom <= 1}>−</button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => changeZoom(zoom + .15)} disabled={zoom >= 1.6}>+</button></div>
        {unmappedStates.length > 0 && <div className="territory-unmapped-states"><span>Also tracked</span>{unmappedStates.map((state) => <b key={state}>{state}</b>)}</div>}
      </section>

      <aside className="territory-map-insight" aria-label="Territory breakdown">
        <div className="territory-map-controls">
          <div className="territory-map-toggle" aria-label="Map metric"><button type="button" className={metric === "clients" ? "is-active" : ""} onClick={() => setMetric("clients")}>Clients</button><button type="button" className={metric === "need" ? "is-active" : ""} onClick={() => setMetric("need")}>Need</button><button type="button" className={metric === "value" ? "is-active" : ""} onClick={() => setMetric("value")}>Value</button></div>
          <button type="button" className={`territory-map-settings-trigger${settingsOpen ? " is-active" : ""}`} onClick={() => setSettingsOpen((open) => !open)} aria-label="Map criteria settings">⚙</button>
          {settingsOpen && <div className="territory-map-settings" role="dialog" aria-label="Map criteria settings">
            <strong>Need criteria</strong>
            <div className="territory-map-settings-basis"><span>Qualify by</span><div role="group" aria-label="Need qualification basis">
              <button type="button" className={criteria.needBasis === "value" ? "is-active" : ""} onClick={() => setCriteria((current) => ({ ...current, needBasis: "value" }))}>Value</button>
              <button type="button" className={criteria.needBasis === "server" ? "is-active" : ""} onClick={() => setCriteria((current) => ({ ...current, needBasis: "server" }))}>Server</button>
              <button type="button" className={criteria.needBasis === "server-workstations" ? "is-active" : ""} onClick={() => setCriteria((current) => ({ ...current, needBasis: "server-workstations" }))}><span className="territory-criteria-long">Server + 5+ workstations</span><span className="territory-criteria-short">Srv + 5 WS</span></button>
            </div></div>
            <label><input type="checkbox" checked={criteria.includeReplaceNow} onChange={(event) => setCriteria((current) => ({ ...current, includeReplaceNow: event.target.checked }))} />Replace now</label>
            <label><input type="checkbox" checked={criteria.includePlanSoon} onChange={(event) => setCriteria((current) => ({ ...current, includePlanSoon: event.target.checked }))} />Plan soon</label>
            {criteria.needBasis === "value" && <label className="territory-map-settings-number"><span>Minimum project value</span><input type="number" min="0" step="1000" value={criteria.minimumEstimatedValue} onChange={(event) => setCriteria((current) => ({ ...current, minimumEstimatedValue: Math.max(0, Number(event.target.value) || 0) }))} /></label>}
            <label><input type="checkbox" checked={criteria.valueFollowsNeed} onChange={(event) => setCriteria((current) => ({ ...current, valueFollowsNeed: event.target.checked }))} />Value follows Need filter</label>
            <button type="button" onClick={() => setCriteria(DEFAULT_TERRITORY_MAP_CRITERIA)}>Reset</button>
          </div>}
        </div>

        <div className="territory-donut-wrap"><svg className={`territory-donut${focusState || focusRegion ? " has-active" : ""}`} viewBox="0 0 208 208" role="img" aria-label={metric === "clients" ? "Clients by map territory" : metric === "need" ? "Clients in need by map territory" : "Estimated project value by map territory"}>
          {slices.length > 0 ? slices.map((slice) => {
            const active = focusSelectionGroup
              ? focusSelectionGroup.includes(slice.region.state)
              : focusRegion ? slice.region.id === focusRegion.id : focusState ? slice.region.state === focusState : false;
            return <path key={slice.region.id} className={`territory-donut-slice${active ? " is-active" : ""}`} d={donutPath(slice.startAngle, slice.endAngle, active ? 87 : 82)} fill={slice.region.color} role="button" tabIndex={0}
              aria-label={`${slice.region.name}: ${metric === "value" ? compactMoney(slice.value) : numberLabel(slice.value)}`}
              onMouseEnter={() => setHoveredRegionId(slice.region.id)} onMouseLeave={() => setHoveredRegionId("")} onFocus={() => setHoveredRegionId(slice.region.id)} onBlur={() => setHoveredRegionId("")}
              onClick={() => selectRegion(slice.region)} onKeyDown={(event) => handleKeyboard(event, () => selectRegion(slice.region))} />;
          }) : <circle cx="104" cy="104" r="68" fill="none" stroke="currentColor" strokeWidth="22" opacity=".08" />}
          {stateDividerAngles.map((angle) => {
            const [outerX, outerY] = polarPoint(104, 104, 89, angle);
            const [innerX, innerY] = polarPoint(104, 104, 52, angle);
            return <line key={`divider-${angle}`} className="territory-donut-state-divider" x1={innerX} y1={innerY} x2={outerX} y2={outerY} />;
          })}
          <text className="territory-donut-total" x="104" y="98" textAnchor="middle">{metric === "value" ? compactMoney(donutTotal) : numberLabel(donutTotal)}</text><text className="territory-donut-label" x="104" y="119" textAnchor="middle">{metric === "clients" ? "total clients" : metric === "need" ? "clients in need" : "represented value"}</text>
        </svg></div>

        <div className="territory-active-detail" style={{ "--territory-color": detailColor } as CSSProperties}>
          <div className="territory-active-title"><i /><div><strong>{detailTitle}</strong><small>{detailSubtitle}</small></div></div>
          <div className="territory-active-metrics"><span><strong>{detailClientCount}</strong><small>clients</small></span><span><strong>{detailNeed}</strong><small>in need</small></span><span><strong>{compactMoney(detailValue)}</strong><small>value</small></span></div>
          <div className="territory-health-bars" aria-label={`Health mix for ${detailTitle}`}><BarRow label="Replace now" count={detailReplaceNow} total={detailClientCount} tone="red" /><BarRow label="Plan soon" count={detailPlanSoon} total={detailClientCount} tone="yellow" /><BarRow label="Healthy" count={detailHealthy} total={detailClientCount} tone="green" /></div>
          {(focusState || focusRegion) && <button type="button" className="territory-review-clients" onClick={openFocusedClients}>View clients</button>}
        </div>
      </aside>
    </div>

    {listScope && <MapClientList key={`${listScope.title}-${metric}`} scope={listScope} dataset={dataset} metric={metric} criteria={criteria} healthByClient={healthByClient} onClose={() => setListScope(null)} onOpenClient={(clientId) => { setListScope(null); setActiveClientId(clientId); }} />}
  </div>;
}
