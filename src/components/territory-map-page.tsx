"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCompassState } from "@/lib/compass/store";
import { buildTerritoryMapSnapshot, type TerritoryMetric } from "@/lib/compass/territory-map";

const ATLAS_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-albers-10m.json";

type MapMetric = "value" | "need";
type Point = [number, number];
type Bounds = [number, number, number, number];
type ArcRing = number[];
type PolygonArcs = ArcRing[];
type MultiPolygonArcs = PolygonArcs[];

interface TopologyGeometry {
  type: "Polygon" | "MultiPolygon";
  id?: string | number;
  properties?: { name?: string };
  arcs: PolygonArcs | MultiPolygonArcs;
}

interface StateTopology {
  type: "Topology";
  transform?: { scale: [number, number]; translate: [number, number] };
  arcs: number[][][];
  objects: { states: { geometries: TopologyGeometry[] } };
}

interface StateShape {
  code: string;
  name: string;
  path: string;
  bounds: Bounds;
}

interface TerritorySlice {
  territory: TerritoryMetric;
  startAngle: number;
  endAngle: number;
  value: number;
}

const STATE_CODES: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE",
  Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY",
  Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO",
  Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA",
  "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY", "District of Columbia": "DC",
};

function compactMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function numberLabel(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function decodeArc(topology: StateTopology, arcIndex: number): Point[] {
  const reverse = arcIndex < 0;
  const source = topology.arcs[reverse ? ~arcIndex : arcIndex] ?? [];
  const points: Point[] = [];
  if (topology.transform) {
    const [sx, sy] = topology.transform.scale;
    const [tx, ty] = topology.transform.translate;
    let x = 0;
    let y = 0;
    for (const pair of source) {
      x += pair[0] ?? 0;
      y += pair[1] ?? 0;
      points.push([x * sx + tx, y * sy + ty]);
    }
  } else {
    for (const pair of source) points.push([pair[0] ?? 0, pair[1] ?? 0]);
  }
  return reverse ? points.reverse() : points;
}

function stitchRing(topology: StateTopology, arcIndexes: ArcRing): Point[] {
  const result: Point[] = [];
  arcIndexes.forEach((arcIndex, index) => {
    const arc = decodeArc(topology, arcIndex);
    result.push(...(index === 0 ? arc : arc.slice(1)));
  });
  return result;
}

function geometryPolygons(topology: StateTopology, geometry: TopologyGeometry): Point[][][] {
  const polygons = geometry.type === "Polygon"
    ? [geometry.arcs as PolygonArcs]
    : geometry.arcs as MultiPolygonArcs;
  return polygons.map((polygon) => polygon.map((ring) => stitchRing(topology, ring)));
}

function boundsForPolygons(polygons: Point[][][]): Bounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const polygon of polygons) for (const ring of polygon) for (const [x, y] of ring) {
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : [0, 0, 0, 0];
}

function pathForPolygons(polygons: Point[][][]): string {
  return polygons.map((polygon) => polygon.map((ring) => {
    if (ring.length === 0) return "";
    return `M${ring.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join("L")}Z`;
  }).join("")).join("");
}

function stateShapesFromTopology(topology: StateTopology): StateShape[] {
  return topology.objects.states.geometries.flatMap((geometry) => {
    const name = geometry.properties?.name?.trim() ?? "";
    const code = STATE_CODES[name];
    if (!code) return [];
    const polygons = geometryPolygons(topology, geometry);
    return [{ code, name, path: pathForPolygons(polygons), bounds: boundsForPolygons(polygons) }];
  });
}

function mergedBounds(shapes: StateShape[]): Bounds {
  if (shapes.length === 0) return [0, 0, 975, 610];
  const minX = Math.min(...shapes.map((shape) => shape.bounds[0]));
  const minY = Math.min(...shapes.map((shape) => shape.bounds[1]));
  const maxX = Math.max(...shapes.map((shape) => shape.bounds[2]));
  const maxY = Math.max(...shapes.map((shape) => shape.bounds[3]));
  const width = maxX - minX;
  const height = maxY - minY;
  const pad = Math.max(22, Math.min(56, Math.max(width, height) * 0.06));
  return [Math.max(0, minX - pad), Math.max(0, minY - pad), Math.min(975, maxX + pad), Math.min(610, maxY + pad)];
}

function markerOffset(count: number, index: number, bounds: Bounds): Point {
  const width = bounds[2] - bounds[0];
  const height = bounds[3] - bounds[1];
  const spread = Math.max(14, Math.min(36, Math.min(width, height) * 0.28));
  if (count <= 1) return [0, 0];
  if (count === 2) return index === 0 ? [-spread * .72, 0] : [spread * .72, 0];
  if (count === 3) return [[0, -spread * .65], [-spread * .72, spread * .45], [spread * .72, spread * .45]][index] as Point;
  if (count === 4) return [[-spread * .7, -spread * .48], [spread * .7, -spread * .48], [-spread * .7, spread * .48], [spread * .7, spread * .48]][index] as Point;
  const angle = (-90 + index * (360 / count)) * Math.PI / 180;
  return [Math.cos(angle) * spread, Math.sin(angle) * spread];
}

function polarPoint(cx: number, cy: number, radius: number, angle: number): Point {
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
  const values = territories.map((territory) => ({ territory, value: metric === "value" ? territory.estimatedValue : territory.clientsInNeed })).filter((item) => item.value > 0);
  const total = values.reduce((sum, item) => sum + item.value, 0);
  let angle = -90;
  return values.map((item) => {
    const sweep = total > 0 ? (item.value / total) * 360 : 0;
    const slice = { territory: item.territory, value: item.value, startAngle: angle, endAngle: angle + sweep };
    angle += sweep;
    return slice;
  });
}

function handleKeyboard(event: ReactKeyboardEvent<SVGGElement | SVGPathElement>, callback: () => void) {
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

export function TerritoryMapPage() {
  const { dataset, ready } = useCompassState();
  const [metric, setMetric] = useState<MapMetric>("value");
  const [hoveredTerritoryId, setHoveredTerritoryId] = useState("");
  const [pinnedTerritoryId, setPinnedTerritoryId] = useState("");
  const [stateShapes, setStateShapes] = useState<StateShape[]>([]);
  const [mapError, setMapError] = useState("");

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

  useEffect(() => {
    let cancelled = false;
    fetch(ATLAS_URL, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`Map geometry returned ${response.status}.`);
        return response.json() as Promise<StateTopology>;
      })
      .then((topology) => { if (!cancelled) { setStateShapes(stateShapesFromTopology(topology)); setMapError(""); } })
      .catch(() => { if (!cancelled) setMapError("Map geometry could not be loaded."); });
    return () => { cancelled = true; };
  }, []);

  const servedShapes = useMemo(() => {
    const served = new Set(snapshot?.states ?? []);
    return stateShapes.filter((shape) => served.has(shape.code));
  }, [snapshot, stateShapes]);
  const bounds = useMemo(() => mergedBounds(servedShapes), [servedShapes]);
  const viewBox = `${bounds[0]} ${bounds[1]} ${Math.max(1, bounds[2] - bounds[0])} ${Math.max(1, bounds[3] - bounds[1])}`;
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
  const mapReady = servedShapes.length > 0;

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
      <section className="territory-map-canvas" aria-label="Client Compass territory map">
        {mapReady ? <svg className="territory-service-map" viewBox={viewBox} role="img" aria-label={`Service territory map covering ${snapshot.states.join(", ")}`}>
          <g className="territory-state-layer">
            {servedShapes.map((shape) => {
              const stateTerritories = territoriesByState.get(shape.code) ?? [];
              const activeInState = activeTerritory && activeTerritory.primaryState === shape.code;
              return <g key={shape.code}>
                <path className={`territory-state-shape${activeInState ? " is-active" : ""}`} d={shape.path} fillRule="evenodd" style={activeInState ? { "--active-territory": activeTerritory.color } as CSSProperties : undefined} />
                <text className="territory-state-code" x={shape.bounds[0] + 8} y={shape.bounds[1] + 14}>{shape.code}</text>
                {stateTerritories.map((territory, index) => {
                  const [offsetX, offsetY] = markerOffset(stateTerritories.length, index, shape.bounds);
                  const x = (shape.bounds[0] + shape.bounds[2]) / 2 + offsetX;
                  const y = (shape.bounds[1] + shape.bounds[3]) / 2 + offsetY;
                  const active = territory.id === activeTerritoryId;
                  const markerWidth = Math.max(52, Math.min(88, territory.shortName.length * 5.1 + 24));
                  return <g key={territory.id} className={`territory-map-marker${active ? " is-active" : ""}`} transform={`translate(${x} ${y})`} role="button" tabIndex={0} aria-label={`${territory.name}: ${territory.clientCount} clients, ${territory.clientsInNeed} need attention, ${compactMoney(territory.estimatedValue)} estimated need`} style={{ "--territory-color": territory.color } as CSSProperties}
                    onMouseEnter={() => setHoveredTerritoryId(territory.id)} onMouseLeave={() => setHoveredTerritoryId("")} onFocus={() => setHoveredTerritoryId(territory.id)} onBlur={() => setHoveredTerritoryId("")} onClick={() => setPinnedTerritoryId((current) => current === territory.id ? "" : territory.id)} onKeyDown={(event) => handleKeyboard(event, () => setPinnedTerritoryId((current) => current === territory.id ? "" : territory.id))}>
                    <rect x={-markerWidth / 2} y={-13} width={markerWidth} height={26} rx={13} />
                    <circle cx={-markerWidth / 2 + 12} cy={0} r={4.5} />
                    <text x={4} y={3.3} textAnchor="middle">{territory.shortName}</text>
                  </g>;
                })}
              </g>;
            })}
          </g>
        </svg> : <div className="territory-map-fallback">
          <span>{mapError || "Loading territory map…"}</span>
          <div>{snapshot.territories.map((territory) => <button key={territory.id} type="button" style={{ "--territory-color": territory.color } as CSSProperties} onMouseEnter={() => setHoveredTerritoryId(territory.id)} onMouseLeave={() => setHoveredTerritoryId("")} onClick={() => setPinnedTerritoryId(territory.id)}><i />{territory.name}</button>)}</div>
        </div>}
        <small className="territory-map-hint">Hover a territory or chart slice. Click to hold the selection.</small>
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
