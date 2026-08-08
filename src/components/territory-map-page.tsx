"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCompassState } from "@/lib/compass/store";
import { buildTerritoryMapSnapshot, type TerritoryMetric } from "@/lib/compass/territory-map";

type MapMetric = "value" | "need";
type TerritorySlice = { territory: TerritoryMetric; startAngle: number; endAngle: number; value: number };
type TilePosition = { col: number; row: number };

const STATE_TILE_POSITIONS: Record<string, TilePosition> = {
  WA:{col:1,row:1},MT:{col:3,row:1},ND:{col:5,row:1},MN:{col:6,row:1},WI:{col:7,row:1},MI:{col:9,row:1},VT:{col:11,row:1},ME:{col:12,row:1},
  OR:{col:1,row:2},ID:{col:2,row:2},SD:{col:5,row:2},IA:{col:6,row:2},IL:{col:7,row:2},IN:{col:8,row:2},OH:{col:9,row:2},PA:{col:10,row:2},NY:{col:11,row:2},NH:{col:12,row:2},
  CA:{col:1,row:3},NV:{col:2,row:3},WY:{col:3,row:3},NE:{col:5,row:3},MO:{col:6,row:3},KY:{col:8,row:3},WV:{col:9,row:3},VA:{col:10,row:3},NJ:{col:11,row:3},MA:{col:12,row:3},
  AZ:{col:2,row:4},UT:{col:3,row:4},CO:{col:4,row:4},KS:{col:5,row:4},AR:{col:6,row:4},TN:{col:7,row:4},NC:{col:9,row:4},MD:{col:10,row:4},DE:{col:11,row:4},CT:{col:12,row:4},RI:{col:13,row:4},
  NM:{col:3,row:5},OK:{col:5,row:5},LA:{col:6,row:5},MS:{col:7,row:5},AL:{col:8,row:5},GA:{col:9,row:5},SC:{col:10,row:5},DC:{col:11,row:5},
  TX:{col:4,row:6},FL:{col:9,row:6},AK:{col:1,row:7},HI:{col:2,row:7},
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

function handleKeyboard(event: ReactKeyboardEvent<SVGPathElement>, callback: () => void) {
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

function cropPositions(states: string[]) {
  const positions = states.map((state) => STATE_TILE_POSITIONS[state]).filter(Boolean);
  if (positions.length === 0) return { minCol: 1, minRow: 1, cols: 1, rows: 1 };
  const minCol = Math.min(...positions.map((position) => position.col));
  const maxCol = Math.max(...positions.map((position) => position.col));
  const minRow = Math.min(...positions.map((position) => position.row));
  const maxRow = Math.max(...positions.map((position) => position.row));
  return { minCol, minRow, cols: maxCol - minCol + 1, rows: maxRow - minRow + 1 };
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
  const grid = useMemo(() => cropPositions(snapshot?.states ?? []), [snapshot]);

  if (!ready) return <div className="territory-map-page"><div className="territory-map-empty">Loading Client Compass data…</div></div>;
  if (!dataset || !snapshot || snapshot.territories.length === 0) return <div className="territory-map-page"><div className="territory-map-empty"><strong>No territory data yet.</strong><span>Import client record enrichment with State and Territory to populate the map.</span></div></div>;

  const donutTotal = metric === "value" ? snapshot.totals.estimatedValue : snapshot.totals.clientsInNeed;
  const mappedStates = snapshot.states.filter((state) => STATE_TILE_POSITIONS[state]);
  const unmappedStates = snapshot.states.filter((state) => !STATE_TILE_POSITIONS[state]);

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
        <div className="territory-service-grid" role="img" aria-label={`Service-area territory map covering ${snapshot.states.join(", ")}`} style={{ "--territory-map-cols": grid.cols, "--territory-map-rows": grid.rows } as CSSProperties}>
          {mappedStates.map((state) => {
            const position = STATE_TILE_POSITIONS[state];
            const stateTerritories = territoriesByState.get(state) ?? [];
            const activeInState = Boolean(activeTerritory && activeTerritory.primaryState === state);
            return <div key={state} className={`territory-state-tile${activeInState ? " is-active" : ""}`} style={{ gridColumn: position.col - grid.minCol + 1, gridRow: position.row - grid.minRow + 1, "--active-territory": activeTerritory?.color ?? "#8aa0b6" } as CSSProperties}>
              <strong className="territory-state-code">{state}</strong>
              <div className={`territory-state-territories count-${Math.min(5, stateTerritories.length)}`}>
                {stateTerritories.map((territory) => {
                  const active = territory.id === activeTerritoryId;
                  return <button key={territory.id} className={`territory-map-marker${active ? " is-active" : ""}`} type="button" style={{ "--territory-color": territory.color } as CSSProperties}
                    aria-label={`${territory.name}: ${territory.clientCount} clients, ${territory.clientsInNeed} need attention, ${compactMoney(territory.estimatedValue)} estimated need`}
                    onMouseEnter={() => setHoveredTerritoryId(territory.id)} onMouseLeave={() => setHoveredTerritoryId("")} onFocus={() => setHoveredTerritoryId(territory.id)} onBlur={() => setHoveredTerritoryId("")} onClick={() => setPinnedTerritoryId((current) => current === territory.id ? "" : territory.id)}>
                    <i /><span>{territory.shortName}</span>
                  </button>;
                })}
              </div>
            </div>;
          })}
          {unmappedStates.map((state, index) => <div key={state} className="territory-state-tile is-unmapped" style={{ gridColumn: (index % grid.cols) + 1, gridRow: grid.rows + 1 }}><strong className="territory-state-code">{state}</strong></div>)}
        </div>
        <small className="territory-map-hint">Territory colors match the chart. Hover to compare; click to hold.</small>
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
          <div className="territory-active-title"><i /><div><strong>{activeTerritory.name}</strong><small>{activeTerritory.states.join(" · ")}</small></div></div>
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
