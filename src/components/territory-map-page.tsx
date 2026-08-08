"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { saveCompassDataset, useCompassState } from "@/lib/compass/store";
import type { CompassClient, CompassDataset } from "@/lib/compass/types";
import { SERVICE_STATE_GEOMETRIES, SERVICE_STATE_ORDER } from "@/lib/compass/service-area-map";
import {
  buildTerritoryMapSnapshot,
  DEFAULT_TERRITORY_MAP_CRITERIA,
  type TerritoryMapCriteria,
  type TerritoryMetric,
} from "@/lib/compass/territory-map";

type MapMetric = "clients" | "need" | "value";
type TerritorySlice = { territory: TerritoryMetric; startAngle: number; endAngle: number; value: number };
type TerritoryDraft = { state: string; market: string };
type ActionTarget = { kind: "state" | "territory"; id: string } | null;
type EditorScope = { title: string; state: string; clientIds: string[] } | null;

const MAP_SETTINGS_KEY = "client-compass.territory-map-settings.v1";
const BASE_VIEWBOX = { x: 274, y: 0, width: 354, height: 610 };

const TERRITORY_ANCHOR_ORDER: Record<string, string[]> = {
  MI: ["west", "east"],
  IL: ["chi - n", "chi - s"],
  AL: ["central", "north"],
  GA: ["central", "east"],
  FL: ["jacksonville", "central west", "central east", "southeast"],
};

function compactMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function numberLabel(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
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

function metricValue(territory: TerritoryMetric, metric: MapMetric): number {
  if (metric === "clients") return territory.clientCount;
  if (metric === "need") return territory.clientsInNeed;
  return territory.estimatedValue;
}

function slicesFor(territories: TerritoryMetric[], metric: MapMetric): TerritorySlice[] {
  const values = territories.map((territory) => ({ territory, value: metricValue(territory, metric) })).filter((item) => item.value > 0);
  const total = values.reduce((sum, item) => sum + item.value, 0);
  let angle = -90;
  return values.map((item) => {
    const sweep = total > 0 ? (item.value / total) * 360 : 0;
    const slice = { territory: item.territory, value: item.value, startAngle: angle, endAngle: angle + sweep };
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
    return {
      includeReplaceNow: parsed.includeReplaceNow !== false,
      includePlanSoon: parsed.includePlanSoon !== false,
      minimumEstimatedValue: Math.max(0, Number(parsed.minimumEstimatedValue) || 0),
      valueFollowsNeed: parsed.valueFollowsNeed === true,
    };
  } catch {
    return DEFAULT_TERRITORY_MAP_CRITERIA;
  }
}

function BarRow({ label, count, total, tone }: { label: string; count: number; total: number; tone: string }) {
  const width = total > 0 ? Math.max(count > 0 ? 4 : 0, (count / total) * 100) : 0;
  return <div className="territory-health-row">
    <span>{label}</span>
    <i><b className={`tone-${tone}`} style={{ width: `${width}%` }} /></i>
    <strong>{count}</strong>
  </div>;
}

function territorySortIndex(state: string, territory: TerritoryMetric): number {
  const rules = TERRITORY_ANCHOR_ORDER[state] ?? [];
  const name = territory.name.toLowerCase();
  const matched = rules.findIndex((fragment) => name.includes(fragment));
  return matched >= 0 ? matched : rules.length + 10;
}

function orderedTerritories(state: string, territories: TerritoryMetric[]): TerritoryMetric[] {
  return [...territories].sort((left, right) => {
    const byAnchor = territorySortIndex(state, left) - territorySortIndex(state, right);
    return byAnchor || right.estimatedValue - left.estimatedValue || left.name.localeCompare(right.name);
  });
}

function markerPoint(state: string, index: number) {
  const geometry = SERVICE_STATE_GEOMETRIES[state];
  const direct = geometry?.anchors[index];
  if (direct) return direct;
  const base = geometry?.label ?? { x: 450, y: 300 };
  const extra = index - (geometry?.anchors.length ?? 0);
  return { x: base.x + (extra % 2 === 0 ? -25 : 25), y: base.y + 26 + Math.floor(extra / 2) * 22 };
}

function normalizedTerritory(state: string, value: string): string {
  const cleanState = state.trim().toUpperCase();
  const cleanValue = value.trim().replace(/\s+/g, " ");
  if (!cleanValue) return "";
  if (!cleanState) return cleanValue;
  if (cleanValue.toUpperCase() === cleanState) return cleanState;
  if (new RegExp(`^${cleanState}\\s*[-–—]\\s*`, "i").test(cleanValue)) return cleanValue;
  return `${cleanState} - ${cleanValue}`;
}

function viewBoxForZoom(zoom: number): string {
  const width = BASE_VIEWBOX.width / zoom;
  const height = BASE_VIEWBOX.height / zoom;
  const centerX = BASE_VIEWBOX.x + BASE_VIEWBOX.width / 2;
  const centerY = BASE_VIEWBOX.y + BASE_VIEWBOX.height / 2;
  return `${centerX - width / 2} ${centerY - height / 2} ${width} ${height}`;
}

function clientListForState(dataset: CompassDataset, state: string): string[] {
  return dataset.clients.filter((client) => client.state.trim().toUpperCase() === state).map((client) => client.id);
}

function MapClientEditor({ scope, dataset, suggestions, onClose, onSaved }: {
  scope: NonNullable<EditorScope>;
  dataset: CompassDataset;
  suggestions: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const clientSet = useMemo(() => new Set(scope.clientIds), [scope.clientIds]);
  const clients = useMemo(() => dataset.clients.filter((client) => clientSet.has(client.id)), [clientSet, dataset.clients]);
  const [drafts, setDrafts] = useState<Record<string, TerritoryDraft>>(() => Object.fromEntries(clients.map((client) => [client.id, { state: client.state, market: client.market }])));
  const [bulkTerritory, setBulkTerritory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const listId = `territory-suggestions-${scope.state}`;

  const updateDraft = (clientId: string, patch: Partial<TerritoryDraft>) => setDrafts((current) => ({ ...current, [clientId]: { ...current[clientId], ...patch } }));
  const applyToAll = () => {
    if (!bulkTerritory.trim()) return;
    setDrafts((current) => Object.fromEntries(Object.entries(current).map(([clientId, draft]) => [clientId, { ...draft, market: normalizedTerritory(draft.state, bulkTerritory) }])));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const next = structuredClone(dataset);
      for (const client of next.clients) {
        const draft = drafts[client.id];
        if (!draft) continue;
        client.state = draft.state.trim().toUpperCase();
        client.market = normalizedTerritory(client.state, draft.market);
      }
      await saveCompassDataset(next);
      await onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not save these territory changes.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="territory-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <aside className="territory-editor" role="dialog" aria-modal="true" aria-labelledby="territory-editor-title">
      <header>
        <div><span className="compass-kicker">Map records</span><h2 id="territory-editor-title">{scope.title}</h2><p>{clients.length} client{clients.length === 1 ? "" : "s"} · make the corrections here and save once.</p></div>
        <button type="button" className="territory-editor-close" onClick={onClose} aria-label="Close client list">×</button>
      </header>
      <div className="territory-editor-bulk">
        <label><span>Apply one territory to this list</span><input value={bulkTerritory} list={listId} placeholder={`Example: ${scope.state} - Central`} onChange={(event) => setBulkTerritory(event.target.value)} /></label>
        <button type="button" onClick={applyToAll} disabled={!bulkTerritory.trim()}>Apply</button>
      </div>
      <datalist id={listId}>{suggestions.map((item) => <option key={item} value={item} />)}</datalist>
      <div className="territory-editor-list">
        {clients.map((client: CompassClient) => {
          const draft = drafts[client.id] ?? { state: client.state, market: client.market };
          return <div className="territory-editor-row" key={client.id}>
            <div className="territory-editor-client"><strong>{client.name}</strong><small>{client.city || "City not recorded"}{client.market ? ` · current: ${client.market}` : " · territory blank"}</small></div>
            <label className="territory-editor-state"><span>State</span><input maxLength={2} value={draft.state} onChange={(event) => updateDraft(client.id, { state: event.target.value.toUpperCase() })} /></label>
            <label className="territory-editor-market"><span>Territory</span><input list={listId} value={draft.market} onChange={(event) => updateDraft(client.id, { market: event.target.value })} /></label>
          </div>;
        })}
      </div>
      {error && <div className="territory-editor-error" role="alert">{error}</div>}
      <footer><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="button" className="primary" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></footer>
    </aside>
  </div>;
}

export function TerritoryMapPage() {
  const { dataset, ready, refresh } = useCompassState();
  const [metric, setMetric] = useState<MapMetric>("value");
  const [criteria, setCriteria] = useState<TerritoryMapCriteria>(loadCriteria);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [hoveredTerritoryId, setHoveredTerritoryId] = useState("");
  const [hoveredState, setHoveredState] = useState("");
  const [pinnedTerritoryId, setPinnedTerritoryId] = useState("");
  const [pinnedState, setPinnedState] = useState("");
  const [actionTarget, setActionTarget] = useState<ActionTarget>(null);
  const [editorScope, setEditorScope] = useState<EditorScope>(null);

  useEffect(() => {
    window.localStorage.setItem(MAP_SETTINGS_KEY, JSON.stringify(criteria));
  }, [criteria]);

  const snapshot = useMemo(() => dataset ? buildTerritoryMapSnapshot(dataset, criteria) : null, [criteria, dataset]);
  const rankedTerritories = useMemo(() => snapshot ? [...snapshot.territories].sort((left, right) => metricValue(right, metric) - metricValue(left, metric) || right.estimatedValue - left.estimatedValue || left.name.localeCompare(right.name)) : [], [metric, snapshot]);
  const defaultTerritory = rankedTerritories[0] ?? null;
  const hoveredTerritory = snapshot?.territories.find((territory) => territory.id === hoveredTerritoryId) ?? null;
  const pinnedTerritory = snapshot?.territories.find((territory) => territory.id === pinnedTerritoryId) ?? null;
  const focusTerritory = hoveredTerritory || pinnedTerritory || (!hoveredState && !pinnedState ? defaultTerritory : null);
  const focusState = hoveredState || focusTerritory?.primaryState || pinnedState || "";
  const slices = useMemo(() => snapshot ? slicesFor(snapshot.territories, metric) : [], [metric, snapshot]);
  const territoriesByState = useMemo(() => {
    const map = new Map<string, TerritoryMetric[]>();
    for (const territory of snapshot?.territories ?? []) {
      const list = map.get(territory.primaryState) ?? [];
      list.push(territory);
      map.set(territory.primaryState, list);
    }
    for (const [state, list] of map) map.set(state, orderedTerritories(state, list));
    return map;
  }, [snapshot]);

  if (!ready) return <div className="territory-map-page"><div className="territory-map-empty">Loading Client Compass data…</div></div>;
  if (!dataset || !snapshot || snapshot.territories.length === 0) return <div className="territory-map-page"><div className="territory-map-empty"><strong>No territory data yet.</strong><span>Import client record enrichment with State and Territory to populate the map.</span></div></div>;

  const donutTotal = metric === "clients" ? snapshot.totals.clients : metric === "need" ? snapshot.totals.clientsInNeed : snapshot.totals.estimatedValue;
  const mappedStates = SERVICE_STATE_ORDER.filter((state) => SERVICE_STATE_GEOMETRIES[state]);
  const unmappedStates = snapshot.states.filter((state) => !SERVICE_STATE_GEOMETRIES[state]);
  const maxMetric = Math.max(1, ...snapshot.territories.map((territory) => metricValue(territory, metric)));
  const stateTerritories = focusState ? territoriesByState.get(focusState) ?? [] : [];
  const stateClientCount = stateTerritories.reduce((sum, territory) => sum + territory.clientCount, 0);
  const stateNeed = stateTerritories.reduce((sum, territory) => sum + territory.clientsInNeed, 0);
  const stateValue = stateTerritories.reduce((sum, territory) => sum + territory.estimatedValue, 0);
  const stateReplaceNow = stateTerritories.reduce((sum, territory) => sum + territory.replaceNow, 0);
  const statePlanSoon = stateTerritories.reduce((sum, territory) => sum + territory.planSoon, 0);
  const stateHealthy = stateTerritories.reduce((sum, territory) => sum + territory.healthy, 0);
  const stateInferred = stateTerritories.reduce((sum, territory) => sum + territory.inferredClientCount, 0);
  const detailClientCount = focusTerritory?.clientCount ?? stateClientCount;
  const detailNeed = focusTerritory?.clientsInNeed ?? stateNeed;
  const detailValue = focusTerritory?.estimatedValue ?? stateValue;
  const detailReplaceNow = focusTerritory?.replaceNow ?? stateReplaceNow;
  const detailPlanSoon = focusTerritory?.planSoon ?? statePlanSoon;
  const detailHealthy = focusTerritory?.healthy ?? stateHealthy;
  const detailInferred = focusTerritory?.inferredClientCount ?? stateInferred;
  const detailTitle = focusTerritory?.shortName ?? focusState || defaultTerritory?.shortName || "Map";
  const detailSubtitle = focusTerritory?.name ?? (focusState ? `${stateTerritories.length} territor${stateTerritories.length === 1 ? "y" : "ies"}` : defaultTerritory?.name ?? "");
  const detailColor = focusTerritory?.color ?? stateTerritories[0]?.color ?? "#46c7ff";

  const suggestionsForState = (state: string) => snapshot.territories.filter((territory) => territory.primaryState === state).map((territory) => territory.name).filter((value, index, values) => values.indexOf(value) === index).sort();
  const openStateEditor = (state: string) => setEditorScope({ title: `${state} clients`, state, clientIds: clientListForState(dataset, state) });
  const openTerritoryEditor = (territory: TerritoryMetric) => setEditorScope({ title: territory.name, state: territory.primaryState, clientIds: territory.clients.map((client) => client.clientId) });

  const selectState = (state: string) => {
    if (pinnedState === state && !pinnedTerritoryId) {
      setActionTarget({ kind: "state", id: state });
      return;
    }
    setPinnedState(state);
    setPinnedTerritoryId("");
    setActionTarget(null);
  };

  const selectTerritory = (territory: TerritoryMetric) => {
    if (pinnedTerritoryId === territory.id) {
      setActionTarget({ kind: "territory", id: territory.id });
      return;
    }
    setPinnedState(territory.primaryState);
    setPinnedTerritoryId(territory.id);
    setActionTarget(null);
  };

  const actionTerritory = actionTarget?.kind === "territory" ? snapshot.territories.find((territory) => territory.id === actionTarget.id) ?? null : null;
  const actionState = actionTarget?.kind === "state" ? actionTarget.id : "";
  const actionStateTerritories = actionState ? territoriesByState.get(actionState) ?? [] : [];
  const actionInferred = actionTerritory?.inferredClientCount ?? actionStateTerritories.reduce((sum, territory) => sum + territory.inferredClientCount, 0);

  return <div className="territory-map-page">
    <header className="territory-map-header">
      <div><span className="compass-kicker">Territory view</span><h1>Map</h1></div>
      <div className="territory-map-summary" aria-label="Territory totals"><span><strong>{numberLabel(snapshot.totals.clients)}</strong> clients</span><span><strong>{numberLabel(snapshot.totals.clientsInNeed)}</strong> in need</span><span><strong>{compactMoney(snapshot.totals.estimatedValue)}</strong> value</span></div>
    </header>

    <div className="territory-map-layout">
      <section className="territory-map-canvas" aria-label="Client Compass service territory map">
        <svg className={`territory-regional-map${focusState || focusTerritory ? " has-active" : ""}`} viewBox={viewBoxForZoom(zoom)} role="img" aria-label="Advantage Technologies service-area territory map">
          {mappedStates.map((state) => {
            const geometry = SERVICE_STATE_GEOMETRIES[state];
            const territories = territoriesByState.get(state) ?? [];
            const activeInState = focusState === state || Boolean(focusTerritory && focusTerritory.primaryState === state);
            const stateColor = territories[0]?.color ?? "#29445d";
            return <g key={state} className={`territory-map-state${activeInState ? " is-active" : ""}`}>
              <path className="territory-map-state-base is-clickable" d={geometry.path} fill={stateColor} role="button" tabIndex={0}
                onMouseEnter={() => setHoveredState(state)} onMouseLeave={() => setHoveredState("")} onFocus={() => setHoveredState(state)} onBlur={() => setHoveredState("")}
                onClick={() => selectState(state)} onKeyDown={(event) => handleKeyboard(event, () => selectState(state))}>
                <title>{state} · click to select, click again for actions</title>
              </path>
              <path className="territory-map-state-outline" d={geometry.path} />
              <text className="territory-map-state-label" x={geometry.label.x} y={geometry.label.y}>{state}</text>
              {territories.map((territory, index) => {
                const point = markerPoint(state, index);
                const active = focusTerritory ? territory.id === focusTerritory.id : focusState === state;
                const strength = Math.max(.28, metricValue(territory, metric) / maxMetric);
                const radius = 3.3 + strength * 2.2;
                return <g key={territory.id} className={`territory-map-marker${active ? " is-active" : ""}${territory.inferredClientCount ? " has-inferred" : ""}`} transform={`translate(${point.x} ${point.y})`} role="button" tabIndex={0}
                  style={{ "--territory-color": territory.color, "--territory-strength": strength } as CSSProperties}
                  aria-label={`${territory.name}: ${territory.clientCount} clients. Click to select, click again for actions.`}
                  onMouseEnter={() => setHoveredTerritoryId(territory.id)} onMouseLeave={() => setHoveredTerritoryId("")} onFocus={() => setHoveredTerritoryId(territory.id)} onBlur={() => setHoveredTerritoryId("")}
                  onClick={() => selectTerritory(territory)} onKeyDown={(event) => handleKeyboard(event, () => selectTerritory(territory))}>
                  <circle className="territory-map-marker-halo" cx="0" cy="0" r={radius + 5} fill={territory.color} />
                  <circle className="territory-map-marker-dot" cx="0" cy="0" r={radius} fill={territory.color} />
                  <text x="8" y="3.2">{territory.shortName}</text>
                  {territory.inferredClientCount > 0 && <circle className="territory-map-marker-review" cx="-5" cy="-6" r="1.5" />}
                  <title>{territory.name}{territory.inferredClientCount ? ` · ${territory.inferredClientCount} inferred label${territory.inferredClientCount === 1 ? "" : "s"}` : ""}</title>
                </g>;
              })}
            </g>;
          })}
        </svg>

        <div className="territory-map-zoom" aria-label="Map zoom controls"><button type="button" onClick={() => setZoom((value) => Math.max(1, Number((value - .15).toFixed(2))))} disabled={zoom <= 1}>−</button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(1.6, Number((value + .15).toFixed(2))))} disabled={zoom >= 1.6}>+</button></div>
        {unmappedStates.length > 0 && <div className="territory-unmapped-states"><span>Also tracked</span>{unmappedStates.map((state) => <b key={state}>{state}</b>)}</div>}
        <small className="territory-map-hint">Click once to focus. Click the same state or territory again for actions.</small>

        {actionTarget && <div className="territory-map-actions">
          <button type="button" className="territory-map-actions-close" onClick={() => setActionTarget(null)} aria-label="Close map actions">×</button>
          <strong>{actionTerritory?.shortName ?? actionState}</strong>
          <span>{actionTerritory?.name ?? `${actionStateTerritories.length} territor${actionStateTerritories.length === 1 ? "y" : "ies"}`}</span>
          {actionInferred > 0 && <small>{actionInferred} label{actionInferred === 1 ? "" : "s"} inferred from existing territory data</small>}
          <button type="button" onClick={() => { if (actionTerritory) openTerritoryEditor(actionTerritory); else if (actionState) openStateEditor(actionState); setActionTarget(null); }}>Review client records</button>
          <button type="button" className="secondary" onClick={() => { setPinnedState(""); setPinnedTerritoryId(""); setActionTarget(null); }}>Clear focus</button>
        </div>}
      </section>

      <aside className="territory-map-insight" aria-label="Territory breakdown">
        <div className="territory-map-controls">
          <div className="territory-map-toggle" aria-label="Map metric">
            <button type="button" className={metric === "clients" ? "is-active" : ""} onClick={() => setMetric("clients")}>Clients</button>
            <button type="button" className={metric === "need" ? "is-active" : ""} onClick={() => setMetric("need")}>Need</button>
            <button type="button" className={metric === "value" ? "is-active" : ""} onClick={() => setMetric("value")}>Value</button>
          </div>
          <button type="button" className={`territory-map-settings-trigger${settingsOpen ? " is-active" : ""}`} onClick={() => setSettingsOpen((open) => !open)} aria-label="Map criteria settings">⚙</button>
          {settingsOpen && <div className="territory-map-settings" role="dialog" aria-label="Map criteria settings">
            <strong>Need criteria</strong>
            <label><input type="checkbox" checked={criteria.includeReplaceNow} onChange={(event) => setCriteria((current) => ({ ...current, includeReplaceNow: event.target.checked }))} />Replace now</label>
            <label><input type="checkbox" checked={criteria.includePlanSoon} onChange={(event) => setCriteria((current) => ({ ...current, includePlanSoon: event.target.checked }))} />Plan soon</label>
            <label className="territory-map-settings-number"><span>Minimum project value</span><input type="number" min="0" step="1000" value={criteria.minimumEstimatedValue} onChange={(event) => setCriteria((current) => ({ ...current, minimumEstimatedValue: Math.max(0, Number(event.target.value) || 0) }))} /></label>
            <label><input type="checkbox" checked={criteria.valueFollowsNeed} onChange={(event) => setCriteria((current) => ({ ...current, valueFollowsNeed: event.target.checked }))} />Value follows Need filter</label>
            <button type="button" onClick={() => setCriteria(DEFAULT_TERRITORY_MAP_CRITERIA)}>Reset</button>
          </div>}
        </div>

        <div className="territory-donut-wrap">
          <svg className="territory-donut" viewBox="0 0 208 208" role="img" aria-label={metric === "clients" ? "Clients by territory" : metric === "need" ? "Clients in need by territory" : "Estimated project value by territory"}>
            {slices.length > 0 ? slices.map((slice) => {
              const active = focusTerritory ? slice.territory.id === focusTerritory.id : focusState ? slice.territory.primaryState === focusState : slice.territory.id === defaultTerritory?.id;
              return <path key={slice.territory.id} className={`territory-donut-slice${active ? " is-active" : ""}`} d={donutPath(slice.startAngle, slice.endAngle, active ? 88 : 82)} fill={slice.territory.color} role="button" tabIndex={0}
                aria-label={`${slice.territory.name}: ${metric === "value" ? compactMoney(slice.value) : numberLabel(slice.value)}`}
                onMouseEnter={() => setHoveredTerritoryId(slice.territory.id)} onMouseLeave={() => setHoveredTerritoryId("")} onFocus={() => setHoveredTerritoryId(slice.territory.id)} onBlur={() => setHoveredTerritoryId("")}
                onClick={() => selectTerritory(slice.territory)} onKeyDown={(event) => handleKeyboard(event, () => selectTerritory(slice.territory))} />;
            }) : <circle cx="104" cy="104" r="68" fill="none" stroke="currentColor" strokeWidth="22" opacity=".08" />}
            <text className="territory-donut-total" x="104" y="98" textAnchor="middle">{metric === "value" ? compactMoney(donutTotal) : numberLabel(donutTotal)}</text>
            <text className="territory-donut-label" x="104" y="119" textAnchor="middle">{metric === "clients" ? "total clients" : metric === "need" ? "clients in need" : "represented value"}</text>
          </svg>
        </div>

        {(focusTerritory || focusState || defaultTerritory) && <div className="territory-active-detail" style={{ "--territory-color": detailColor } as CSSProperties}>
          <div className="territory-active-title"><i /><div><strong>{detailTitle}</strong><small>{detailSubtitle}</small></div></div>
          {detailInferred > 0 && <span className="territory-review-note">{detailInferred} label{detailInferred === 1 ? "" : "s"} inferred</span>}
          <div className="territory-active-metrics"><span><strong>{detailClientCount}</strong><small>clients</small></span><span><strong>{detailNeed}</strong><small>in need</small></span><span><strong>{compactMoney(detailValue)}</strong><small>value</small></span></div>
          <div className="territory-health-bars" aria-label={`Health mix for ${detailTitle}`}><BarRow label="Replace now" count={detailReplaceNow} total={detailClientCount} tone="red" /><BarRow label="Plan soon" count={detailPlanSoon} total={detailClientCount} tone="yellow" /><BarRow label="Healthy" count={detailHealthy} total={detailClientCount} tone="green" /></div>
        </div>}
      </aside>
    </div>

    {editorScope && <MapClientEditor key={`${editorScope.state}-${editorScope.title}`} scope={editorScope} dataset={dataset} suggestions={suggestionsForState(editorScope.state)} onClose={() => setEditorScope(null)} onSaved={refresh} />}
  </div>;
}
