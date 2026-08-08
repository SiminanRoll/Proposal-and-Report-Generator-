"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCompassState } from "@/lib/compass/store";
import { buildTerritoryMapSnapshot, type TerritoryMetric } from "@/lib/compass/territory-map";

type MapMetric = "value" | "need";
type TerritorySlice = { territory: TerritoryMetric; startAngle: number; endAngle: number; value: number };
type MapRect = { x: number; y: number; width: number; height: number };
type StateGeometry = { path: string; bounds: MapRect; label: { x: number; y: number } };
type TerritoryRegion = MapRect & { territory: TerritoryMetric };

// A lightweight local service-area map. The shapes intentionally favor legibility at dashboard
// size while preserving the recognizable geographic relationship of the states we currently serve.
const STATE_GEOMETRIES: Record<string, StateGeometry> = {
  WI: {
    path: "M71.5 27 L214.5 27 L260 37.8 L318.5 48.6 L403 72.9 L422.5 135 L299 148.5 L214.5 135 L182 126.9 L175.5 108 L130 91.8 L71.5 64.8 Z",
    bounds: { x: 71.5, y: 27, width: 351, height: 121.5 },
    label: { x: 230, y: 86 },
  },
  MI: {
    path: "M494 59.4 L585 54 L624 59.4 L682.5 86.4 L702 116.1 L747.5 135 L715 162 L604.5 170.1 L533 151.2 L500.5 126.9 L487.5 102.6 L520 81 Z M234 37.8 L357.5 13.5 L585 21.6 L617.5 40.5 L520 48.6 L422.5 56.7 L292.5 51.3 Z",
    bounds: { x: 234, y: 13.5, width: 513.5, height: 156.6 },
    label: { x: 616, y: 111 },
  },
  IL: {
    path: "M162.5 148.5 L422.5 148.5 L422.5 189 L390 243 L318.5 297 L292.5 297 L260 270 L227.5 229.5 L162.5 202.5 Z",
    bounds: { x: 162.5, y: 148.5, width: 260, height: 148.5 },
    label: { x: 296, y: 222 },
  },
  IN: {
    path: "M422.5 167.4 L598 167.4 L598 270 L533 272.7 L422.5 253.8 Z",
    bounds: { x: 422.5, y: 167.4, width: 175.5, height: 105.3 },
    label: { x: 514, y: 222 },
  },
  OH: {
    path: "M598 167.4 L877.5 162 L877.5 216 L780 256.5 L598 256.5 Z",
    bounds: { x: 598, y: 162, width: 279.5, height: 94.5 },
    label: { x: 746, y: 211 },
  },
  KY: {
    path: "M286 272.7 L390 272.7 L487.5 270 L598 256.5 L780 256.5 L702 297 L585 310.5 L325 310.5 Z",
    bounds: { x: 286, y: 256.5, width: 494, height: 54 },
    label: { x: 520, y: 285 },
  },
  TN: {
    path: "M240.5 305.1 L799.5 307.8 L767 351 L240.5 351 Z",
    bounds: { x: 240.5, y: 305.1, width: 559, height: 45.9 },
    label: { x: 516, y: 331 },
  },
  AL: {
    path: "M357.5 351 L585 351 L585 459 L364 477.9 L364 432 Z",
    bounds: { x: 357.5, y: 351, width: 227.5, height: 126.9 },
    label: { x: 457, y: 411 },
  },
  GA: {
    path: "M546 351 L715 351 L858 432 L819 467.1 L591.5 467.1 L585 432 Z",
    bounds: { x: 546, y: 351, width: 312, height: 116.1 },
    label: { x: 689, y: 414 },
  },
  FL: {
    path: "M416 461.7 L591.5 464.4 L715 469.8 L780 491.4 L832 486 L877.5 513 L910 594 L877.5 634.5 L812.5 621 L780 580.5 L747.5 553.5 L734.5 526.5 L650 491.4 L585 475.2 L416 475.2 Z",
    bounds: { x: 416, y: 461.7, width: 494, height: 172.8 },
    label: { x: 800, y: 548 },
  },
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

function contains(territory: TerritoryMetric, fragment: string): boolean {
  return territory.name.toLowerCase().includes(fragment.toLowerCase());
}

function splitVertical(bounds: MapRect, territories: TerritoryMetric[]): TerritoryRegion[] {
  const width = bounds.width / territories.length;
  return territories.map((territory, index) => ({ territory, x: bounds.x + width * index, y: bounds.y, width, height: bounds.height }));
}

function splitHorizontal(bounds: MapRect, territories: TerritoryMetric[]): TerritoryRegion[] {
  const height = bounds.height / territories.length;
  return territories.map((territory, index) => ({ territory, x: bounds.x, y: bounds.y + height * index, width: bounds.width, height }));
}

function territoryRegions(state: string, territories: TerritoryMetric[]): TerritoryRegion[] {
  const geometry = STATE_GEOMETRIES[state];
  if (!geometry || territories.length === 0) return [];
  const { bounds } = geometry;
  if (territories.length === 1) return [{ territory: territories[0], ...bounds }];

  if (state === "FL" && territories.length === 4) {
    const jacksonville = territories.find((item) => contains(item, "jacksonville") || contains(item, "north"));
    const centralWest = territories.find((item) => contains(item, "central west"));
    const centralEast = territories.find((item) => contains(item, "central east"));
    const southeast = territories.find((item) => contains(item, "southeast") || contains(item, "south"));
    if (jacksonville && centralWest && centralEast && southeast) {
      const top = bounds.height * .22;
      const middle = bounds.height * .42;
      return [
        { territory: jacksonville, x: bounds.x, y: bounds.y, width: bounds.width, height: top },
        { territory: centralWest, x: bounds.x, y: bounds.y + top, width: bounds.width * .52, height: middle },
        { territory: centralEast, x: bounds.x + bounds.width * .52, y: bounds.y + top, width: bounds.width * .48, height: middle },
        { territory: southeast, x: bounds.x, y: bounds.y + top + middle, width: bounds.width, height: bounds.height - top - middle },
      ];
    }
  }

  if (territories.length === 2) {
    const north = territories.find((item) => contains(item, "north"));
    const south = territories.find((item) => contains(item, "south"));
    if (north && south) return splitHorizontal(bounds, [north, south]);
    const east = territories.find((item) => contains(item, "east"));
    const west = territories.find((item) => contains(item, "west"));
    if (east && west) return splitVertical(bounds, [west, east]);
    if (state === "IL") return splitHorizontal(bounds, territories);
    if (state === "AL") return splitHorizontal(bounds, [...territories].sort((a, b) => Number(contains(b, "north")) - Number(contains(a, "north"))));
    if (state === "GA") return splitVertical(bounds, territories);
  }

  return splitVertical(bounds, territories);
}

export function TerritoryMapPage() {
  const { dataset, ready } = useCompassState();
  const [metric, setMetric] = useState<MapMetric>("value");
  const [hoveredTerritoryId, setHoveredTerritoryId] = useState("");
  const [pinnedTerritoryId, setPinnedTerritoryId] = useState("");

  const snapshot = useMemo(() => dataset ? buildTerritoryMapSnapshot(dataset) : null, [dataset]);
  const rankedTerritories = useMemo(() => snapshot ? [...snapshot.territories].sort((left, right) => {
    const leftValue = metric === "value" ? left.estimatedValue : left.clientsInNeed;
    const rightValue = metric === "value" ? right.estimatedValue : right.clientsInNeed;
    return rightValue - leftValue || right.estimatedValue - left.estimatedValue || left.name.localeCompare(right.name);
  }) : [], [metric, snapshot]);
  const defaultTerritoryId = rankedTerritories[0]?.id ?? "";
  const activeTerritoryId = hoveredTerritoryId || pinnedTerritoryId || defaultTerritoryId;
  const activeTerritory = snapshot?.territories.find((territory) => territory.id === activeTerritoryId) ?? rankedTerritories[0] ?? null;
  const slices = useMemo(() => snapshot ? slicesFor(snapshot.territories, metric) : [], [metric, snapshot]);
  const territoriesByState = useMemo(() => {
    const map = new Map<string, TerritoryMetric[]>();
    for (const territory of snapshot?.territories ?? []) {
      const list = map.get(territory.primaryState) ?? [];
      list.push(territory);
      map.set(territory.primaryState, list);
    }
    for (const list of map.values()) list.sort((left, right) => right.estimatedValue - left.estimatedValue || left.name.localeCompare(right.name));
    return map;
  }, [snapshot]);

  if (!ready) return <div className="territory-map-page"><div className="territory-map-empty">Loading Client Compass data…</div></div>;
  if (!dataset || !snapshot || snapshot.territories.length === 0) return <div className="territory-map-page"><div className="territory-map-empty"><strong>No territory data yet.</strong><span>Import client record enrichment with State and Territory to populate the map.</span></div></div>;

  const donutTotal = metric === "value" ? snapshot.totals.estimatedValue : snapshot.totals.clientsInNeed;
  const mappedStates = snapshot.states.filter((state) => STATE_GEOMETRIES[state]);
  const unmappedStates = snapshot.states.filter((state) => !STATE_GEOMETRIES[state]);

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
        <svg className={`territory-regional-map${activeTerritoryId ? " has-active" : ""}`} viewBox="40 0 900 650" role="img" aria-label={`Service-area map covering ${mappedStates.join(", ")}`}>
          <defs>
            {mappedStates.map((state) => <clipPath key={state} id={`territory-state-${state}`}><path d={STATE_GEOMETRIES[state].path} /></clipPath>)}
          </defs>
          {mappedStates.map((state) => {
            const geometry = STATE_GEOMETRIES[state];
            const stateTerritories = territoriesByState.get(state) ?? [];
            const regions = territoryRegions(state, stateTerritories);
            const activeInState = Boolean(activeTerritory && activeTerritory.primaryState === state);
            return <g key={state} className={`territory-map-state${activeInState ? " is-active" : ""}`}>
              <path className="territory-map-state-base" d={geometry.path} />
              <g clipPath={`url(#territory-state-${state})`}>
                {regions.map((region) => {
                  const active = region.territory.id === activeTerritoryId;
                  return <rect key={region.territory.id} className={`territory-map-region${active ? " is-active" : ""}`} x={region.x} y={region.y} width={region.width} height={region.height} fill={region.territory.color} role="button" tabIndex={0}
                    aria-label={`${region.territory.name}: ${region.territory.clientCount} clients, ${region.territory.clientsInNeed} need attention, ${compactMoney(region.territory.estimatedValue)} estimated need`}
                    onMouseEnter={() => setHoveredTerritoryId(region.territory.id)} onMouseLeave={() => setHoveredTerritoryId("")} onFocus={() => setHoveredTerritoryId(region.territory.id)} onBlur={() => setHoveredTerritoryId("")} onClick={() => setPinnedTerritoryId((current) => current === region.territory.id ? "" : region.territory.id)} onKeyDown={(event) => handleKeyboard(event, () => setPinnedTerritoryId((current) => current === region.territory.id ? "" : region.territory.id))}>
                    <title>{region.territory.name}</title>
                  </rect>;
                })}
              </g>
              <path className="territory-map-state-outline" d={geometry.path} />
              <text className="territory-map-state-label" x={geometry.label.x} y={geometry.label.y}>{state}</text>
            </g>;
          })}
        </svg>
        {unmappedStates.length > 0 && <div className="territory-unmapped-states"><span>Also tracked</span>{unmappedStates.map((state) => <b key={state}>{state}</b>)}</div>}
        <small className="territory-map-hint">Hover a territory to compare it with the portfolio. Click to hold.</small>
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
        </div>}
      </aside>
    </div>
  </div>;
}
