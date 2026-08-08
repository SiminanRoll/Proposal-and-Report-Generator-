"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { TerritoryMapPage } from "@/components/territory-map-page";
import { TerritoryCompassHub } from "@/components/territory-compass-hub";
import { useCompassState } from "@/lib/compass/store";
import { SERVICE_STATE_GEOMETRIES, SERVICE_STATE_ORDER } from "@/lib/compass/service-area-map";
import { buildTerritoryMapSnapshot } from "@/lib/compass/territory-map";
import { MAP_LENS_CHANGE_EVENT } from "@/lib/segments/map-lens";

type MapMetric = "clients" | "need" | "value";
type Pan = { x: number; y: number };
type DragState = { pointerId: number; startX: number; startY: number; startPan: Pan; moved: boolean };

const BASE_VIEWBOX = { x: 274, y: 0, width: 354, height: 610 };
const SERVICE_COLORS: Record<string, string> = {
  WI: "#4DBEEA",
  MI: "#58D0B6",
  IL: "#7B89F2",
  IN: "#F1BD62",
  OH: "#F17A78",
  KY: "#68CFA5",
  TN: "#42C3C0",
  AL: "#62D19A",
  GA: "#F4A66B",
  FL: "#9A7CF6",
};

function clampPan(pan: Pan, zoom: number): Pan {
  if (zoom <= 1) return { x: 0, y: 0 };
  const width = BASE_VIEWBOX.width / zoom;
  const height = BASE_VIEWBOX.height / zoom;
  const maxX = Math.max(0, (BASE_VIEWBOX.width - width) / 2);
  const maxY = Math.max(0, (BASE_VIEWBOX.height - height) / 2);
  return { x: Math.max(-maxX, Math.min(maxX, pan.x)), y: Math.max(-maxY, Math.min(maxY, pan.y)) };
}

function viewBoxFor(zoom: number, pan: Pan): string {
  const width = BASE_VIEWBOX.width / zoom;
  const height = BASE_VIEWBOX.height / zoom;
  const safe = clampPan(pan, zoom);
  const centerX = BASE_VIEWBOX.x + BASE_VIEWBOX.width / 2 + safe.x;
  const centerY = BASE_VIEWBOX.y + BASE_VIEWBOX.height / 2 + safe.y;
  return `${centerX - width / 2} ${centerY - height / 2} ${width} ${height}`;
}

function EmptyBar({ label }: { label: string }) {
  return <div className="territory-health-row"><span>{label}</span><i><b style={{ width: "0%" }} /></i><strong>0</strong></div>;
}

function ServiceAreaShell({ loading, hasDataset }: { loading: boolean; hasDataset: boolean }) {
  const [metric, setMetric] = useState<MapMetric>("value");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);

  const changeZoom = (next: number) => {
    const value = Math.max(1, Math.min(1.6, Number(next.toFixed(2))));
    setZoom(value);
    setPan((current) => clampPan(current, value));
  };

  const beginPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (zoom <= 1 || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startPan: pan, moved: false };
    setDragging(true);
  };

  const movePan = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) >= 3) drag.moved = true;
    if (!drag.moved) return;
    event.preventDefault();
    const visibleWidth = BASE_VIEWBOX.width / zoom;
    const visibleHeight = BASE_VIEWBOX.height / zoom;
    setPan(clampPan({
      x: drag.startPan.x - (dx * visibleWidth / rect.width),
      y: drag.startPan.y - (dy * visibleHeight / rect.height),
    }, zoom));
  };

  const endPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDragging(false);
  };

  const status = loading ? "Loading client data…" : hasDataset ? "No matches in the current map view" : "No client data loaded yet";
  const donutLabel = metric === "clients" ? "All" : metric === "need" ? "Need" : "Value";

  return <div className="territory-map-page territory-map-service-shell-page">
    <header className="territory-map-header"><div><span className="compass-kicker">Territory view</span><h1>Map</h1></div><div className="territory-map-summary" aria-label="Territory totals"><span><strong>0</strong> clients</span><span><strong>0</strong> in need</span><span><strong>$0</strong> value</span></div></header>

    <div className="territory-map-layout">
      <section className="territory-map-canvas territory-map-service-shell" aria-label="Advantage Technologies service territory map">
        <svg className={`territory-regional-map is-service-shell${zoom > 1 ? " is-pannable" : ""}${dragging ? " is-dragging" : ""}`} viewBox={viewBoxFor(zoom, pan)} role="img" aria-label="Advantage Technologies service-area territory map" onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}>
          {SERVICE_STATE_ORDER.map((state) => {
            const geometry = SERVICE_STATE_GEOMETRIES[state];
            if (!geometry) return null;
            const color = SERVICE_COLORS[state] ?? "#7DAED2";
            return <g key={state} className="territory-map-state" tabIndex={0} role="button" aria-label={`${state} service area`} style={{ "--territory-color": color, "--territory-strength": .22 } as CSSProperties}>
              <path className="territory-map-region-fill territory-map-service-shell-fill" d={geometry.path} fill={color} />
              <path className="territory-map-state-outline" d={geometry.path} />
              <text className="territory-map-region-label is-state-stamp" x={geometry.label.x} y={geometry.label.y}>{state}</text>
            </g>;
          })}
        </svg>
        <div className="territory-map-service-status" aria-live="polite">{status}</div>
        <div className="territory-map-zoom" aria-label="Map zoom controls" title={zoom > 1 ? "Drag the map to pan" : "Zoom in, then drag to pan"}><button type="button" onClick={() => changeZoom(zoom - .15)} disabled={zoom <= 1}>−</button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => changeZoom(zoom + .15)} disabled={zoom >= 1.6}>+</button></div>
      </section>

      <aside className="territory-map-insight" aria-label="Territory breakdown">
        <div className="territory-map-controls">
          <div className="territory-map-toggle" aria-label="Map metric"><button type="button" className={metric === "clients" ? "is-active" : ""} onClick={() => setMetric("clients")}>Clients</button><button type="button" className={metric === "need" ? "is-active" : ""} onClick={() => setMetric("need")}>Need</button><button type="button" className={metric === "value" ? "is-active" : ""} onClick={() => setMetric("value")}>Value</button></div>
          <button type="button" className="territory-map-settings-trigger" aria-label="Map criteria settings unavailable without matching data" title="Map criteria become available when the map has matching client data" disabled>⚙</button>
        </div>

        <div className="territory-donut-wrap"><svg className="territory-donut is-empty" viewBox="0 0 208 208" role="img" aria-label="No matching map data"><circle cx="104" cy="104" r="68" fill="none" stroke="currentColor" strokeWidth="22" opacity=".08" /><TerritoryCompassHub bearing={0} active={false} title="Client Compass waiting for map data" /><text className="territory-donut-total" x="104" y="98" textAnchor="middle">{metric === "value" ? "$0" : "0"}</text><text className="territory-donut-label" x="104" y="119" textAnchor="middle">{donutLabel}</text></svg></div>

        <div className="territory-active-detail" style={{ "--territory-color": "#69C8FF" } as CSSProperties}>
          <div className="territory-active-title"><i /><div><strong>All territories</strong><small>Service area portfolio</small></div></div>
          <div className="territory-active-metrics"><span><strong>0</strong><small>clients</small></span><span><strong>0</strong><small>in need</small></span><span><strong>$0</strong><small>value</small></span></div>
          <div className="territory-health-bars" aria-label="Health mix for all territories"><EmptyBar label="Replace now" /><EmptyBar label="Plan soon" /><EmptyBar label="Healthy" /></div>
        </div>
      </aside>
    </div>
  </div>;
}

export function PersistentTerritoryMapPage() {
  const { dataset, ready } = useCompassState();
  const [mapLensRevision, setMapLensRevision] = useState(0);
  useEffect(() => {
    const refreshLens = () => setMapLensRevision((revision) => revision + 1);
    window.addEventListener(MAP_LENS_CHANGE_EVENT, refreshLens);
    return () => window.removeEventListener(MAP_LENS_CHANGE_EVENT, refreshLens);
  }, []);
  const hasMappedResults = useMemo(() => dataset ? buildTerritoryMapSnapshot(dataset).territories.length > 0 : false, [dataset, mapLensRevision]);

  if (ready && dataset && hasMappedResults) return <TerritoryMapPage />;
  return <ServiceAreaShell loading={!ready} hasDataset={Boolean(dataset)} />;
}
