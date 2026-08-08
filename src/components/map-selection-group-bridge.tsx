"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useCompassState } from "@/lib/compass/store";
import { buildSegmentSnapshot } from "@/lib/segments/engine";
import { EMPTY_MAP_LENS_STATE, loadMapLensState, normalizeMapLensState, saveMapLensState, type MapLensState } from "@/lib/segments/map-lens";
import { useSegments } from "@/lib/segments/store";
import { SegmentIcon } from "./segment-icon";

const STATE_SELECTION_GROUPS = [
  ["TN", "KY", "AL"],
  ["IN", "OH"],
] as const;

type PointerPress = { pointerId: number; state: string; x: number; y: number; moved: boolean };

function compactMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function stateCodeForGroup(group: Element): string {
  const label = group.querySelector<SVGTextElement>(".territory-map-region-label")?.textContent?.trim().toUpperCase() ?? "";
  return label.slice(0, 2);
}

function stateCodeFromTarget(target: EventTarget | null): string {
  if (!(target instanceof Element)) return "";
  const group = target.closest(".territory-map-state");
  return group ? stateCodeForGroup(group) : "";
}

function syncPeerHighlights(map: Element) {
  const activeState = map.querySelector(".territory-map-state.is-active");
  const activeCode = activeState ? stateCodeForGroup(activeState) : "";
  const selectionGroup = STATE_SELECTION_GROUPS.find((states) => states.includes(activeCode as never));
  map.querySelectorAll<SVGGElement>(".territory-map-state").forEach((node) => {
    const code = stateCodeForGroup(node);
    const shouldHighlight = Boolean(selectionGroup && code !== activeCode && selectionGroup.includes(code as never));
    node.classList.toggle("is-selection-peer-active", shouldHighlight);
  });
}

function syncLensHighlights(map: Element, states: string[]) {
  const selected = new Set(states);
  map.classList.toggle("has-lens-scope", selected.size > 0);
  map.querySelectorAll<SVGGElement>(".territory-map-state").forEach((node) => node.classList.toggle("is-lens-selected", selected.has(stateCodeForGroup(node))));
}

function syncCriteriaLock(active: boolean) {
  const controls = document.querySelector<HTMLElement>(".territory-map-controls");
  const trigger = controls?.querySelector<HTMLButtonElement>(".territory-map-settings-trigger") ?? null;
  if (!controls || !trigger) return;
  if (active && trigger.classList.contains("is-active")) trigger.click();
  controls.classList.toggle("is-segment-controlled", active);
  trigger.disabled = active;
  trigger.setAttribute("aria-disabled", String(active));
  trigger.setAttribute("aria-label", active ? "Map criteria settings disabled while Segment Manager criteria are active" : "Map criteria settings");
  trigger.title = active ? "Using Segment Manager criteria" : "Map criteria settings";
}

export function MapSelectionGroupBridge() {
  const { dataset, config } = useCompassState();
  const { segments } = useSegments();
  const [mounted, setMounted] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lens, setLens] = useState<MapLensState>(EMPTY_MAP_LENS_STATE);
  const mapRef = useRef<Element | null>(null);
  const lensRef = useRef<MapLensState>(EMPTY_MAP_LENS_STATE);
  const pressRef = useRef<PointerPress | null>(null);

  useEffect(() => { setMounted(true); const stored = loadMapLensState(); lensRef.current = stored; setLens(stored); }, []);
  useEffect(() => {
    lensRef.current = lens;
    if (mapRef.current) syncLensHighlights(mapRef.current, lens.states);
    syncCriteriaLock(lens.segmentIds.length > 0);
  }, [lens]);

  const commitLens = useCallback((updater: (current: MapLensState) => MapLensState) => {
    setLens((current) => {
      const next = normalizeMapLensState(updater(current));
      lensRef.current = next;
      saveMapLensState(next);
      return next;
    });
  }, []);

  const toggleState = useCallback((state: string) => {
    if (!state) return;
    commitLens((current) => ({
      ...current,
      states: current.states.includes(state) ? current.states.filter((item) => item !== state) : [...current.states, state],
    }));
  }, [commitLens]);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    let currentMap: Element | null = null;
    let pageObserver: MutationObserver | null = null;

    const detachMapEvents = () => {
      if (!currentMap) return;
      currentMap.removeEventListener("pointerdown", onPointerDown, true);
      currentMap.removeEventListener("pointermove", onPointerMove, true);
      currentMap.removeEventListener("pointerup", onPointerUp, true);
      currentMap.removeEventListener("pointercancel", onPointerCancel, true);
      currentMap.removeEventListener("keydown", onKeyDown, true);
    };

    const onPointerDown = (event: Event) => {
      const pointer = event as PointerEvent;
      const state = stateCodeFromTarget(pointer.target);
      pressRef.current = state ? { pointerId: pointer.pointerId, state, x: pointer.clientX, y: pointer.clientY, moved: false } : null;
    };
    const onPointerMove = (event: Event) => {
      const pointer = event as PointerEvent;
      const press = pressRef.current;
      if (!press || press.pointerId !== pointer.pointerId || press.moved) return;
      if (Math.hypot(pointer.clientX - press.x, pointer.clientY - press.y) >= 4) press.moved = true;
    };
    const onPointerUp = (event: Event) => {
      const pointer = event as PointerEvent;
      const press = pressRef.current;
      pressRef.current = null;
      if (!press || press.pointerId !== pointer.pointerId || press.moved) return;
      toggleState(press.state);
    };
    const onPointerCancel = () => { pressRef.current = null; };
    const onKeyDown = (event: Event) => {
      const keyboard = event as KeyboardEvent;
      if (keyboard.key !== "Enter" && keyboard.key !== " ") return;
      const state = stateCodeFromTarget(keyboard.target);
      if (!state) return;
      keyboard.preventDefault();
      keyboard.stopPropagation();
      toggleState(state);
    };

    const attach = () => {
      const map = document.querySelector(".territory-regional-map");
      const insight = document.querySelector<HTMLElement>(".territory-map-insight");
      setPortalTarget(insight);
      syncCriteriaLock(lensRef.current.segmentIds.length > 0);
      if (map === currentMap) return;
      observer?.disconnect();
      detachMapEvents();
      currentMap = map;
      mapRef.current = map;
      if (!map) return;
      syncPeerHighlights(map);
      syncLensHighlights(map, lensRef.current.states);
      map.addEventListener("pointerdown", onPointerDown, true);
      map.addEventListener("pointermove", onPointerMove, true);
      map.addEventListener("pointerup", onPointerUp, true);
      map.addEventListener("pointercancel", onPointerCancel, true);
      map.addEventListener("keydown", onKeyDown, true);
      observer = new MutationObserver(() => { syncPeerHighlights(map); syncLensHighlights(map, lensRef.current.states); });
      observer.observe(map, { subtree: true, attributes: true, attributeFilter: ["class"] });
    };

    attach();
    pageObserver = new MutationObserver(attach);
    pageObserver.observe(document.body, { childList: true, subtree: true });
    return () => { observer?.disconnect(); pageObserver?.disconnect(); detachMapEvents(); mapRef.current = null; };
  }, [toggleState]);

  useEffect(() => {
    const validIds = new Set(segments.map((segment) => segment.id));
    if (!lens.segmentIds.some((id) => !validIds.has(id))) return;
    commitLens((current) => ({ ...current, segmentIds: current.segmentIds.filter((id) => validIds.has(id)) }));
  }, [commitLens, lens.segmentIds, segments]);

  const activeSegments = useMemo(() => lens.segmentIds.map((id) => segments.find((segment) => segment.id === id)).filter((segment): segment is NonNullable<typeof segment> => Boolean(segment)), [lens.segmentIds, segments]);
  const availableSegments = useMemo(() => segments.filter((segment) => !lens.segmentIds.includes(segment.id)), [lens.segmentIds, segments]);
  const metrics = useMemo(() => {
    const next = new Map<string, { clients: number; value: number }>();
    if (!dataset) return next;
    for (const segment of segments) {
      const snapshot = buildSegmentSnapshot(segment, dataset, config);
      next.set(segment.id, { clients: snapshot.aggregate.clientCount, value: snapshot.aggregate.estimatedValue });
    }
    return next;
  }, [config, dataset, segments]);

  if (!mounted || !portalTarget) return null;
  const hasLens = activeSegments.length > 0 || lens.states.length > 0;

  return createPortal(<section className="map-segment-lens-panel" aria-label="Map segment lenses">
    <div className="map-lens-heading"><div><span className="compass-kicker">Map lens</span><strong>Segments</strong></div><button type="button" className={pickerOpen ? "is-active" : ""} onClick={() => setPickerOpen((open) => !open)} aria-label="Add a saved segment">+</button></div>
    {pickerOpen && <div className="map-lens-picker"><div><strong>Saved segments</strong><small>From Segment Manager</small></div>{availableSegments.length ? <div className="map-lens-picker-list">{availableSegments.map((segment) => {
      const stat = metrics.get(segment.id);
      return <button key={segment.id} type="button" className="map-lens-picker-card" style={{ "--segment-color": segment.color } as CSSProperties} onClick={() => { commitLens((current) => ({ ...current, segmentIds: [...current.segmentIds, segment.id] })); setPickerOpen(false); }}><span><SegmentIcon name={segment.icon} /></span><div><strong>{segment.title}</strong><small>{stat ? `${stat.clients} clients · ${compactMoney(stat.value)}` : "Saved segment"}</small></div></button>;
    })}</div> : <div className="map-lens-picker-empty">All saved segments are already on the map.</div>}<Link href="/segments/">Open Segment Manager</Link></div>}
    {activeSegments.length > 1 && <div className="map-lens-match"><span>Match</span><div role="group" aria-label="How selected segments combine"><button type="button" className={lens.matchMode === "all" ? "is-active" : ""} onClick={() => commitLens((current) => ({ ...current, matchMode: "all" }))}>ALL</button><button type="button" className={lens.matchMode === "any" ? "is-active" : ""} onClick={() => commitLens((current) => ({ ...current, matchMode: "any" }))}>ANY</button></div></div>}
    {activeSegments.length > 0 && <div className="map-lens-card-stack">{activeSegments.map((segment) => {
      const stat = metrics.get(segment.id);
      return <article key={segment.id} className="map-lens-card" style={{ "--segment-color": segment.color } as CSSProperties}><span className="map-lens-card-icon"><SegmentIcon name={segment.icon} /></span><div className="map-lens-card-copy"><strong>{segment.title}</strong><small>{stat ? `${stat.clients} client${stat.clients === 1 ? "" : "s"} · ${compactMoney(stat.value)}` : "Saved segment"}</small></div><button type="button" onClick={() => commitLens((current) => ({ ...current, segmentIds: current.segmentIds.filter((id) => id !== segment.id) }))} aria-label={`Remove ${segment.title} from map`}>×</button></article>;
    })}</div>}
    {lens.states.length > 0 && <div className="map-lens-where"><span>Where</span><div>{lens.states.map((state) => <button key={state} type="button" onClick={() => toggleState(state)}>{state}<b>×</b></button>)}</div></div>}
    {!activeSegments.length && !lens.states.length && <p className="map-lens-empty">Add a saved segment, or click states on the map to narrow where you want to look.</p>}
    {hasLens && <button type="button" className="map-lens-clear" onClick={() => commitLens(() => EMPTY_MAP_LENS_STATE)}>Clear map lens</button>}
  </section>, portalTarget);
}
