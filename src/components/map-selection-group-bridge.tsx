"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useCompassState } from "@/lib/compass/store";
import { buildSegmentSnapshot } from "@/lib/segments/engine";
import {
  EMPTY_MAP_LENS_STATE,
  loadMapLensState,
  MAP_LENS_CHANGE_EVENT,
  mapLensClientIds,
  normalizeMapLensState,
  saveMapLensDisplayMode,
  saveMapLensState,
  type MapLensState,
} from "@/lib/segments/map-lens";
import { useSegments } from "@/lib/segments/store";
import { SegmentIcon } from "./segment-icon";

const STATE_SELECTION_GROUPS = [
  ["TN", "KY", "AL"],
  ["IN", "OH"],
] as const;
const MAX_SEGMENT_SLOTS = 3;

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

function regionKeyFromTarget(target: EventTarget | null): string {
  if (!(target instanceof Element)) return "";
  const region = target.closest<SVGGElement>(".territory-map-region");
  if (!region) return "";
  const label = region.getAttribute("aria-label") || "";
  return label.split(":")[0]?.trim() || `${stateCodeFromTarget(region)}|region`;
}

function geographicGroupForState(state: string): string[] {
  const group = STATE_SELECTION_GROUPS.find((states) => states.includes(state as never));
  return group ? [...group] : state ? [state] : [];
}

function dispatchRegionClick(region: SVGGElement): void {
  region.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
}

function syncLensHighlights(map: Element, states: string[]) {
  const selected = new Set(states);
  map.classList.toggle("has-lens-scope", selected.size > 0);
  map.querySelectorAll<SVGGElement>(".territory-map-state").forEach((node) => {
    node.classList.toggle("is-lens-selected", selected.has(stateCodeForGroup(node)));
  });
}

function syncSegmentAvailability(map: Element, enabled: boolean, matchStates: Set<string>) {
  map.classList.toggle("has-segment-distribution", enabled);
  map.querySelectorAll<SVGGElement>(".territory-map-state").forEach((node) => {
    const state = stateCodeForGroup(node);
    node.classList.toggle("is-segment-empty", enabled && Boolean(state) && !matchStates.has(state));
  });
}

export function MapSelectionGroupBridge() {
  const { dataset, config } = useCompassState();
  const { segments } = useSegments();
  const [mounted, setMounted] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lens, setLens] = useState<MapLensState>(EMPTY_MAP_LENS_STATE);
  const mapRef = useRef<Element | null>(null);
  const lensRef = useRef<MapLensState>(EMPTY_MAP_LENS_STATE);
  const previousSegmentCountRef = useRef<number | null>(null);
  const lastExactRegionRef = useRef("");

  useEffect(() => {
    setMounted(true);
    const syncStoredLens = () => {
      const stored = loadMapLensState();
      lensRef.current = stored;
      setLens(stored);
    };
    syncStoredLens();
    window.addEventListener(MAP_LENS_CHANGE_EVENT, syncStoredLens);
    return () => window.removeEventListener(MAP_LENS_CHANGE_EVENT, syncStoredLens);
  }, []);

  useEffect(() => {
    lensRef.current = lens;
    if (mapRef.current) syncLensHighlights(mapRef.current, lens.states);
  }, [lens]);

  const commitLens = useCallback((updater: (current: MapLensState) => MapLensState) => {
    const current = lensRef.current;
    const next = normalizeMapLensState(updater(current));
    lensRef.current = next;
    setLens(next);
    saveMapLensState(next);
  }, []);

  const toggleState = useCallback((state: string) => {
    if (!state) return;
    commitLens((current) => ({
      ...current,
      states: current.states.includes(state) ? current.states.filter((item) => item !== state) : [...current.states, state],
    }));
  }, [commitLens]);

  const activeSegments = useMemo(
    () => lens.segmentIds.map((id) => segments.find((segment) => segment.id === id)).filter((segment): segment is NonNullable<typeof segment> => Boolean(segment)),
    [lens.segmentIds, segments],
  );
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

  const segmentMatchStates = useMemo(() => {
    const next = new Set<string>();
    if (!dataset || !activeSegments.length) return next;
    const ids = mapLensClientIds(dataset, { ...lens, states: [] }, segments);
    for (const client of dataset.clients) {
      if (!ids.has(client.id)) continue;
      const state = String(client.state || "").trim().toUpperCase();
      if (state) next.add(state);
    }
    return next;
  }, [activeSegments.length, dataset, lens, segments]);

  const placeSegment = useCallback((segmentId: string, slotIndex: number) => {
    if (!segmentId || !segments.some((segment) => segment.id === segmentId)) return;
    commitLens((current) => {
      const ids = current.segmentIds.filter((id) => id !== segmentId);
      if (!current.segmentIds.includes(segmentId) && ids.length >= MAX_SEGMENT_SLOTS) return current;
      const target = Math.max(0, Math.min(slotIndex, ids.length));
      ids.splice(target, 0, segmentId);
      return { ...current, segmentIds: ids.slice(0, MAX_SEGMENT_SLOTS) };
    });
  }, [commitLens, segments]);

  useEffect(() => {
    if (activeSegments.length >= MAX_SEGMENT_SLOTS) setDrawerOpen(false);
  }, [activeSegments.length]);

  useEffect(() => {
    const previous = previousSegmentCountRef.current;
    previousSegmentCountRef.current = activeSegments.length;
    if (previous === null) return;

    if (previous === 0 && activeSegments.length > 0) {
      saveMapLensDisplayMode("segments");
    } else if (previous > 0 && activeSegments.length === 0) {
      setDrawerOpen(false);
      lastExactRegionRef.current = "";
      commitLens((current) => ({ ...current, states: [] }));
      saveMapLensDisplayMode("clients");
    }
  }, [activeSegments.length, commitLens]);

  useEffect(() => {
    let currentMap: Element | null = null;

    const detach = () => {
      if (!currentMap) return;
      currentMap.removeEventListener("click", onMapClick);
      currentMap.removeEventListener("keydown", onMapKeyDown);
    };

    const selectGeography = (target: EventTarget | null, trusted: boolean, additive: boolean) => {
      if (!trusted || !(target instanceof Element)) return;
      const region = target.closest<SVGGElement>(".territory-map-region");
      if (!region) return;
      const state = stateCodeFromTarget(region);
      const key = regionKeyFromTarget(region);
      if (!state || !key) return;

      if (additive) {
        commitLens((current) => ({
          ...current,
          states: current.states.includes(state) ? current.states.filter((item) => item !== state) : [...current.states, state],
        }));
        lastExactRegionRef.current = key;
        window.setTimeout(() => {
          if (document.contains(region)) dispatchRegionClick(region);
        }, 0);
        return;
      }

      if (lastExactRegionRef.current === key) {
        commitLens((current) => ({ ...current, states: geographicGroupForState(state) }));
        lastExactRegionRef.current = "";
        return;
      }

      commitLens((current) => ({ ...current, states: [state] }));
      lastExactRegionRef.current = key;

      // TerritoryMapPage still uses state-first / region-second internal focus.
      // Replay one untrusted click so one user click lands on the exact section.
      window.setTimeout(() => {
        if (document.contains(region)) dispatchRegionClick(region);
      }, 0);
    };

    function onMapClick(event: Event) {
      const mouse = event as MouseEvent;
      selectGeography(mouse.target, mouse.isTrusted, mouse.ctrlKey || mouse.metaKey);
    }

    function onMapKeyDown(event: Event) {
      const keyboard = event as KeyboardEvent;
      if (!keyboard.isTrusted || (keyboard.key !== "Enter" && keyboard.key !== " ")) return;
      selectGeography(keyboard.target, true, keyboard.ctrlKey || keyboard.metaKey);
    }

    const attach = () => {
      const map = document.querySelector(".territory-regional-map");
      const insight = document.querySelector<HTMLElement>(".territory-map-insight");
      setPortalTarget(insight);
      if (map === currentMap) {
        if (map) {
          syncLensHighlights(map, lensRef.current.states);
          syncSegmentAvailability(map, activeSegments.length > 0, segmentMatchStates);
        }
        return;
      }
      detach();
      currentMap = map;
      mapRef.current = map;
      if (!map) return;
      syncLensHighlights(map, lensRef.current.states);
      syncSegmentAvailability(map, activeSegments.length > 0, segmentMatchStates);
      map.addEventListener("click", onMapClick);
      map.addEventListener("keydown", onMapKeyDown);
    };

    attach();
    const timer = window.setInterval(attach, 220);
    return () => {
      window.clearInterval(timer);
      detach();
      mapRef.current = null;
    };
  }, [activeSegments.length, commitLens, segmentMatchStates]);

  useEffect(() => {
    if (!mapRef.current) return;
    syncLensHighlights(mapRef.current, lens.states);
    syncSegmentAvailability(mapRef.current, activeSegments.length > 0, segmentMatchStates);
  }, [activeSegments.length, lens.states, segmentMatchStates]);

  useEffect(() => {
    const validIds = new Set(segments.map((segment) => segment.id));
    if (!lens.segmentIds.some((id) => !validIds.has(id))) return;
    commitLens((current) => ({ ...current, segmentIds: current.segmentIds.filter((id) => validIds.has(id)) }));
  }, [commitLens, lens.segmentIds, segments]);

  if (!mounted || !portalTarget) return null;
  const hasLens = activeSegments.length > 0 || lens.states.length > 0;

  return createPortal(<section className="map-segment-lens-panel" aria-label="Map segments">
    <div className="map-lens-heading"><strong>Segments</strong><button type="button" className={drawerOpen ? "is-active" : ""} onClick={() => setDrawerOpen((open) => !open)} aria-label="Choose a saved segment" disabled={activeSegments.length >= MAX_SEGMENT_SLOTS}>+</button></div>

    {drawerOpen && <div className="map-lens-drawer" aria-label="Saved segments">{availableSegments.length ? <div className="map-lens-drawer-list">{availableSegments.map((segment) => {
      const stat = metrics.get(segment.id);
      return <button key={segment.id} type="button" draggable className="map-lens-drawer-card" style={{ "--segment-color": segment.color } as CSSProperties}
        onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", segment.id); }}
        onClick={() => { placeSegment(segment.id, lens.segmentIds.length); setDrawerOpen(false); }}>
        <span className="map-lens-card-icon"><SegmentIcon name={segment.icon} /></span><span className="map-lens-drawer-copy"><strong>{segment.title}</strong></span><span className="map-lens-drawer-stats"><strong>{stat ? `${stat.clients} client${stat.clients === 1 ? "" : "s"}` : "—"}</strong><small>{stat ? compactMoney(stat.value) : "—"}</small></span>
      </button>;
    })}</div> : <div className="map-lens-drawer-empty">No additional segments</div>}</div>}

    {activeSegments.length > 1 && <div className="map-lens-match"><span>Match</span><div role="group" aria-label="How selected segments combine"><button type="button" className={lens.matchMode === "all" ? "is-active" : ""} onClick={() => commitLens((current) => ({ ...current, matchMode: "all" }))}>ALL</button><button type="button" className={lens.matchMode === "any" ? "is-active" : ""} onClick={() => commitLens((current) => ({ ...current, matchMode: "any" }))}>ANY</button></div></div>}

    <div className="map-lens-slot-stack" aria-label="Active segment slots">{Array.from({ length: MAX_SEGMENT_SLOTS }, (_, slotIndex) => {
      const segment = activeSegments[slotIndex];
      if (!segment) return <div key={`empty-${slotIndex}`} className="map-lens-slot is-empty" role="button" tabIndex={0} aria-label={`Empty segment slot ${slotIndex + 1}`}
        onClick={() => setDrawerOpen(true)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setDrawerOpen(true); } }}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => { event.preventDefault(); placeSegment(event.dataTransfer.getData("text/plain"), slotIndex); setDrawerOpen(false); }}><span>+</span></div>;
      const stat = metrics.get(segment.id);
      return <article key={segment.id} className="map-lens-slot map-lens-card" draggable style={{ "--segment-color": segment.color } as CSSProperties}
        onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", segment.id); }}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => { event.preventDefault(); placeSegment(event.dataTransfer.getData("text/plain"), slotIndex); setDrawerOpen(false); }}>
        <span className="map-lens-card-icon"><SegmentIcon name={segment.icon} /></span><div className="map-lens-card-copy"><strong>{segment.title}</strong><small>{stat ? `${stat.clients} client${stat.clients === 1 ? "" : "s"} · ${compactMoney(stat.value)}` : "Saved segment"}</small></div><button type="button" onClick={() => commitLens((current) => ({ ...current, segmentIds: current.segmentIds.filter((id) => id !== segment.id) }))} aria-label={`Remove ${segment.title} from map`}>×</button>
      </article>;
    })}</div>

    {lens.states.length > 0 && <div className="map-lens-where"><span>Where</span><div>{lens.states.map((state) => <button key={state} type="button" onClick={() => toggleState(state)}>{state}<b>×</b></button>)}</div></div>}
    {hasLens && <button type="button" className="map-lens-clear" onClick={() => { lastExactRegionRef.current = ""; commitLens(() => EMPTY_MAP_LENS_STATE); }}>Clear map filters</button>}
  </section>, portalTarget);
}