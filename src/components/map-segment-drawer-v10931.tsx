"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent as ReactDragEvent } from "react";
import { useCompassState } from "@/lib/compass/store";
import { buildSegmentSnapshot } from "@/lib/segments/engine";
import { loadMapLensState, MAP_LENS_CHANGE_EVENT, type MapLensState } from "@/lib/segments/map-lens";
import { useSegments } from "@/lib/segments/store";
import { SegmentIcon } from "./segment-icon";

function compactMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function MapSegmentDrawerV10931() {
  const { dataset, config } = useCompassState();
  const { segments } = useSegments();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [lens, setLens] = useState<MapLensState>(() => ({ segmentIds: [], matchMode: "all", states: [] }));
  const closeTimerRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const suppressHoverUntilRef = useRef(0);

  useEffect(() => {
    const syncTarget = () => setTarget(document.querySelector<HTMLElement>(".map-segment-lens-panel"));
    syncTarget();
    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sync = () => setLens(loadMapLensState());
    sync();
    window.addEventListener(MAP_LENS_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MAP_LENS_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const onSlotClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(".map-lens-slot.is-empty")) setOpen(true);
    };
    document.addEventListener("click", onSlotClick, true);
    return () => document.removeEventListener("click", onSlotClick, true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeAway = (event: PointerEvent) => {
      const node = event.target instanceof Node ? event.target : null;
      if (!node || rootRef.current?.contains(node)) return;
      if (node instanceof Element && node.closest(".map-lens-slot.is-empty")) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", closeAway, true);
    return () => document.removeEventListener("pointerdown", closeAway, true);
  }, [open]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  const activeIds = useMemo(() => new Set(lens.segmentIds), [lens.segmentIds]);
  const available = useMemo(() => segments.filter((segment) => !activeIds.has(segment.id)), [activeIds, segments]);
  const metrics = useMemo(() => {
    const next = new Map<string, { clients: number; value: number }>();
    for (const segment of segments) {
      if (!dataset) {
        next.set(segment.id, { clients: 0, value: 0 });
        continue;
      }
      const snapshot = buildSegmentSnapshot(segment, dataset, config);
      next.set(segment.id, { clients: snapshot.aggregate.clientCount, value: snapshot.aggregate.estimatedValue });
    }
    return next;
  }, [config, dataset, segments]);

  const scheduleClose = () => {
    if (dragging) return;
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 140);
  };

  const cancelClose = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const beginDrag = (event: ReactDragEvent<HTMLElement>, segmentId: string) => {
    setDragging(true);
    setOpen(true);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", segmentId);
  };

  const finishDrag = () => {
    setDragging(false);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    suppressHoverUntilRef.current = performance.now() + 420;
    setOpen(false);
  };

  if (!target) return null;

  return createPortal(<div ref={rootRef} className={`map-segment-drawer-v10931${open ? " is-open" : ""}${dragging ? " is-dragging" : ""}`} onMouseEnter={() => { cancelClose(); if (performance.now() >= suppressHoverUntilRef.current) setOpen(true); }} onMouseLeave={scheduleClose} onFocusCapture={() => { cancelClose(); setOpen(true); }} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) scheduleClose(); }}>
    <button type="button" className="map-segment-drawer-tab" aria-label="Open saved segments" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span aria-hidden="true">‹</span></button>
    <div className="map-segment-drawer-glass" aria-label="Saved Segment Manager cards">
      {available.length ? <div className="map-segment-drawer-list">{available.map((segment) => {
        const stat = metrics.get(segment.id) ?? { clients: 0, value: 0 };
        return <article key={segment.id} draggable className="map-segment-drawer-card-v10931" style={{ "--segment-color": segment.color } as CSSProperties} onDragStart={(event) => beginDrag(event, segment.id)} onDragEnd={finishDrag}>
          <span className="map-segment-drawer-icon"><SegmentIcon name={segment.icon} /></span>
          <div className="map-segment-drawer-copy"><strong>{segment.title}</strong><small>{stat.clients.toLocaleString()} client{stat.clients === 1 ? "" : "s"}</small></div>
          <strong className="map-segment-drawer-value">{compactMoney(stat.value)}</strong>
        </article>;
      })}</div> : <div className="map-segment-drawer-empty-v10931">{segments.length ? "All saved segments are in use" : "Create segments in Segment Manager"}</div>}
    </div>
  </div>, target);
}
