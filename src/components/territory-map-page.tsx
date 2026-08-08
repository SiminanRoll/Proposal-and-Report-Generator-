"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { saveCompassDataset, useCompassState } from "@/lib/compass/store";
import type { CompassClient, CompassDataset } from "@/lib/compass/types";
import { SERVICE_STATE_GEOMETRIES, SERVICE_STATE_ORDER } from "@/lib/compass/service-area-map";
import { buildTerritoryMapSnapshot, type TerritoryMetric } from "@/lib/compass/territory-map";

type MapMetric = "value" | "need";
type TerritorySlice = { territory: TerritoryMetric; startAngle: number; endAngle: number; value: number };
type TerritoryDraft = { state: string; market: string };

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

function slicesFor(territories: TerritoryMetric[], metric: MapMetric): TerritorySlice[] {
  const values = territories
    .map((territory) => ({ territory, value: metric === "value" ? territory.estimatedValue : territory.clientsInNeed }))
    .filter((item) => item.value > 0);
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
  if (matched >= 0) return matched;
  return rules.length + (territory.unassigned ? 20 : 10);
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
  return { x: base.x + (extra % 2 === 0 ? -24 : 24), y: base.y + 28 + Math.floor(extra / 2) * 22 };
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

function TerritoryEditor({ territory, dataset, suggestions, onClose, onSaved }: {
  territory: TerritoryMetric;
  dataset: CompassDataset;
  suggestions: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const clients = useMemo(() => territory.clients
    .map((metric) => dataset.clients.find((client) => client.id === metric.clientId))
    .filter((client): client is CompassClient => Boolean(client)), [dataset.clients, territory.clients]);
  const [drafts, setDrafts] = useState<Record<string, TerritoryDraft>>(() => Object.fromEntries(clients.map((client) => [client.id, { state: client.state, market: client.market }])));
  const [bulkTerritory, setBulkTerritory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const listId = `territory-suggestions-${territory.primaryState}`;

  const updateDraft = (clientId: string, patch: Partial<TerritoryDraft>) => {
    setDrafts((current) => ({ ...current, [clientId]: { ...current[clientId], ...patch } }));
  };

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
        <div>
          <span className="compass-kicker">Territory clients</span>
          <h2 id="territory-editor-title">{territory.name}</h2>
          <p>{clients.length} client{clients.length === 1 ? "" : "s"} · edit State or Territory and save once.</p>
        </div>
        <button type="button" className="territory-editor-close" onClick={onClose} aria-label="Close territory client list">×</button>
      </header>

      <div className="territory-editor-bulk">
        <label>
          <span>Apply one territory to this list</span>
          <input value={bulkTerritory} list={listId} placeholder={`Example: ${territory.primaryState} - Central`} onChange={(event) => setBulkTerritory(event.target.value)} />
        </label>
        <button type="button" onClick={applyToAll} disabled={!bulkTerritory.trim()}>Apply</button>
      </div>
      <datalist id={listId}>{suggestions.map((item) => <option key={item} value={item} />)}</datalist>

      <div className="territory-editor-list">
        {clients.map((client) => {
          const draft = drafts[client.id] ?? { state: client.state, market: client.market };
          return <div className="territory-editor-row" key={client.id}>
            <div className="territory-editor-client">
              <strong>{client.name}</strong>
              <small>{client.city || "City not recorded"}{client.market && client.market !== territory.name ? ` · current: ${client.market}` : ""}</small>
            </div>
            <label className="territory-editor-state"><span>State</span><input maxLength={2} value={draft.state} onChange={(event) => updateDraft(client.id, { state: event.target.value.toUpperCase() })} /></label>
            <label className="territory-editor-market"><span>Territory</span><input list={listId} value={draft.market} onChange={(event) => updateDraft(client.id, { market: event.target.value })} /></label>
          </div>;
        })}
      </div>

      {error && <div className="territory-editor-error" role="alert">{error}</div>}
      <footer>
        <button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="button" className="primary" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save territory changes"}</button>
      </footer>
    </aside>
  </div>;
}

export function TerritoryMapPage() {
  const { dataset, ready, refresh } = useCompassState();
  const [metric, setMetric] = useState<MapMetric>("value");
  const [hoveredTerritoryId, setHoveredTerritoryId] = useState("");
  const [pinnedTerritoryId, setPinnedTerritoryId] = useState("");
  const [editingTerritoryId, setEditingTerritoryId] = useState("");

  const snapshot = useMemo(() => dataset ? buildTerritoryMapSnapshot(dataset) : null, [dataset]);
  const rankedTerritories = useMemo(() => snapshot ? [...snapshot.territories].sort((left, right) => {
    const leftValue = metric === "value" ? left.estimatedValue : left.clientsInNeed;
    const rightValue = metric === "value" ? right.estimatedValue : right.clientsInNeed;
    return rightValue - leftValue || right.estimatedValue - left.estimatedValue || left.name.localeCompare(right.name);
  }) : [], [metric, snapshot]);
  const defaultTerritoryId = rankedTerritories[0]?.id ?? "";
  const activeTerritoryId = hoveredTerritoryId || pinnedTerritoryId || defaultTerritoryId;
  const activeTerritory = snapshot?.territories.find((territory) => territory.id === activeTerritoryId) ?? rankedTerritories[0] ?? null;
  const editingTerritory = snapshot?.territories.find((territory) => territory.id === editingTerritoryId) ?? null;
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

  const donutTotal = metric === "value" ? snapshot.totals.estimatedValue : snapshot.totals.clientsInNeed;
  const mappedStates = SERVICE_STATE_ORDER.filter((state) => SERVICE_STATE_GEOMETRIES[state]);
  const unmappedStates = snapshot.states.filter((state) => !SERVICE_STATE_GEOMETRIES[state]);
  const territorySuggestions = editingTerritory ? snapshot.territories
    .filter((territory) => territory.primaryState === editingTerritory.primaryState && !territory.unassigned)
    .map((territory) => territory.name)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort() : [];

  return <div className="territory-map-page">
    <header className="territory-map-header">
      <div><span className="compass-kicker">Territory view</span><h1>Map</h1></div>
      <div className="territory-map-summary" aria-label="Territory totals">
        <span><strong>{numberLabel(snapshot.totals.clients)}</strong> clients</span>
        <span><strong>{numberLabel(snapshot.totals.clientsInNeed)}</strong> need attention</span>
        <span><strong>{compactMoney(snapshot.totals.estimatedValue)}</strong> estimated</span>
      </div>
    </header>

    <div className="territory-map-layout">
      <section className="territory-map-canvas" aria-label="Client Compass service territory map">
        <svg className={`territory-regional-map${activeTerritoryId ? " has-active" : ""}`} viewBox="285 10 325 565" role="img" aria-label="Advantage Technologies service-area territory map">
          {mappedStates.map((state) => {
            const geometry = SERVICE_STATE_GEOMETRIES[state];
            const stateTerritories = territoriesByState.get(state) ?? [];
            const validTerritories = stateTerritories.filter((territory) => !territory.unassigned);
            const singleTerritory = stateTerritories.length === 1 ? stateTerritories[0] : null;
            const activeInState = Boolean(activeTerritory && activeTerritory.primaryState === state);
            const stateFill = singleTerritory ? singleTerritory.color : validTerritories.length === 1 ? validTerritories[0].color : "#e9eff4";
            return <g key={state} className={`territory-map-state${activeInState ? " is-active" : ""}`}>
              <path className={`territory-map-state-base${singleTerritory ? " is-clickable" : ""}`} d={geometry.path} fill={stateFill} style={{ "--state-fill-opacity": singleTerritory ? .18 : .08 } as CSSProperties}
                role={singleTerritory ? "button" : undefined} tabIndex={singleTerritory ? 0 : undefined}
                onMouseEnter={() => singleTerritory && setHoveredTerritoryId(singleTerritory.id)} onMouseLeave={() => singleTerritory && setHoveredTerritoryId("")}
                onClick={() => singleTerritory && setEditingTerritoryId(singleTerritory.id)}
                onKeyDown={(event) => singleTerritory && handleKeyboard(event, () => setEditingTerritoryId(singleTerritory.id))} />
              <path className="territory-map-state-outline" d={geometry.path} />
              <text className="territory-map-state-label" x={geometry.label.x} y={geometry.label.y}>{state}</text>
              {stateTerritories.map((territory, index) => {
                const point = markerPoint(state, index);
                const active = territory.id === activeTerritoryId;
                const width = Math.max(32, Math.min(88, 15 + territory.shortName.length * 5.2));
                return <g key={territory.id} className={`territory-map-marker${active ? " is-active" : ""}${territory.unassigned ? " needs-review" : ""}`} transform={`translate(${point.x} ${point.y})`} role="button" tabIndex={0}
                  aria-label={`${territory.name}: ${territory.clientCount} clients. Click to review clients.`}
                  onMouseEnter={() => setHoveredTerritoryId(territory.id)} onMouseLeave={() => setHoveredTerritoryId("")} onFocus={() => setHoveredTerritoryId(territory.id)} onBlur={() => setHoveredTerritoryId("")}
                  onClick={() => setEditingTerritoryId(territory.id)} onKeyDown={(event) => handleKeyboard(event, () => setEditingTerritoryId(territory.id))}>
                  <rect x={-width / 2} y={-8.5} width={width} height={17} rx={8.5} fill={territory.unassigned ? "#f4f6f8" : "#fff"} />
                  <circle cx={-width / 2 + 8} cy="0" r="3.3" fill={territory.color} />
                  <text x={-width / 2 + 14} y="3.4">{territory.shortName}</text>
                  <title>{territory.name} · click to review clients</title>
                </g>;
              })}
            </g>;
          })}
        </svg>
        {unmappedStates.length > 0 && <div className="territory-unmapped-states"><span>Also tracked</span>{unmappedStates.map((state) => <b key={state}>{state}</b>)}</div>}
        <small className="territory-map-hint">Hover to compare. Click any territory marker to review and correct its client list.</small>
      </section>

      <aside className="territory-map-insight" aria-label="Territory breakdown">
        <div className="territory-map-toggle" aria-label="Map metric">
          <button type="button" className={metric === "value" ? "is-active" : ""} onClick={() => setMetric("value")}>Value</button>
          <button type="button" className={metric === "need" ? "is-active" : ""} onClick={() => setMetric("need")}>Clients in need</button>
        </div>

        <div className="territory-donut-wrap">
          <svg className="territory-donut" viewBox="0 0 208 208" role="img" aria-label={metric === "value" ? "Estimated project value by territory" : "Clients in need by territory"}>
            {slices.length > 0 ? slices.map((slice) => {
              const active = slice.territory.id === activeTerritoryId;
              return <path key={slice.territory.id} className={`territory-donut-slice${active ? " is-active" : ""}`} d={donutPath(slice.startAngle, slice.endAngle, active ? 88 : 82)} fill={slice.territory.color} role="button" tabIndex={0} aria-label={`${slice.territory.name}: ${metric === "value" ? compactMoney(slice.value) : `${slice.value} clients in need`}`}
                onMouseEnter={() => setHoveredTerritoryId(slice.territory.id)} onMouseLeave={() => setHoveredTerritoryId("")} onFocus={() => setHoveredTerritoryId(slice.territory.id)} onBlur={() => setHoveredTerritoryId("")} onClick={() => setPinnedTerritoryId((current) => current === slice.territory.id ? "" : slice.territory.id)} onKeyDown={(event) => handleKeyboard(event, () => setPinnedTerritoryId((current) => current === slice.territory.id ? "" : slice.territory.id))} />;
            }) : <circle cx="104" cy="104" r="68" fill="none" stroke="currentColor" strokeWidth="22" opacity=".08" />}
            <text className="territory-donut-total" x="104" y="98" textAnchor="middle">{metric === "value" ? compactMoney(donutTotal) : numberLabel(donutTotal)}</text>
            <text className="territory-donut-label" x="104" y="119" textAnchor="middle">{metric === "value" ? "total value" : "clients in need"}</text>
          </svg>
        </div>

        {activeTerritory && <div className="territory-active-detail" style={{ "--territory-color": activeTerritory.color } as CSSProperties}>
          <div className="territory-active-title"><i /><div><strong>{activeTerritory.name}</strong><small>{activeTerritory.primaryState}</small></div></div>
          {activeTerritory.unassigned && <span className="territory-review-note">Territory data needs review</span>}
          <div className="territory-active-metrics">
            <span><strong>{activeTerritory.clientCount}</strong><small>clients</small></span>
            <span><strong>{activeTerritory.clientsInNeed}</strong><small>need attention</small></span>
            <span><strong>{compactMoney(activeTerritory.estimatedValue)}</strong><small>estimated</small></span>
          </div>
          <div className="territory-health-bars" aria-label={`Health mix for ${activeTerritory.name}`}>
            <BarRow label="Replace now" count={activeTerritory.replaceNow} total={activeTerritory.clientCount} tone="red" />
            <BarRow label="Plan soon" count={activeTerritory.planSoon} total={activeTerritory.clientCount} tone="yellow" />
            <BarRow label="Healthy" count={activeTerritory.healthy} total={activeTerritory.clientCount} tone="green" />
          </div>
          <button type="button" className={`territory-review-clients${activeTerritory.unassigned ? " needs-review" : ""}`} onClick={() => setEditingTerritoryId(activeTerritory.id)}>{activeTerritory.unassigned ? "Fix territory records" : "Review territory clients"}</button>
        </div>}
      </aside>
    </div>

    {editingTerritory && <TerritoryEditor key={editingTerritory.id} territory={editingTerritory} dataset={dataset} suggestions={territorySuggestions} onClose={() => setEditingTerritoryId("")} onSaved={refresh} />}
  </div>;
}
