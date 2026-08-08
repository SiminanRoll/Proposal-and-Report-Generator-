"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useCompassState } from "@/lib/compass/store";
import { buildSegmentSnapshot } from "@/lib/segments/engine";
import {
  EMPTY_MAP_LENS_STATE,
  loadMapLensDisplayMode,
  loadMapLensState,
  mapLensClientIds,
  normalizeMapLensState,
  saveMapLensDisplayMode,
  saveMapLensState,
  type MapLensDisplayMode,
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

function numberLabel(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
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
  const [displayMode, setDisplayMode] = useState<MapLensDisplayMode>("value");
  const mapRef = useRef<Element | null>(null);
  const lensRef = useRef<MapLensState>(EMPTY_MAP_LENS_STATE);
  const metricProxyRef = useRef(false);
  const previousSegmentCountRef = useRef<number | null>(null);
  const lastExactRegionRef = useRef("");

  useEffect(() => {
    setMounted(true);
    const stored = loadMapLensState();
    lensRef.current = stored;
    setLens(stored);
    setDisplayMode(loadMapLensDisplayMode());
  }, []);

  useEffect(() => {
    lensRef.current = lens;
    if (mapRef.current) syncLensHighlights(mapRef.current, lens.states);
  }, [lens]);

  const commitLens = useCallback((updater: (current: MapLensState) => MapLensState) => {
    setLens((current) => {
      const next = normalizeMapLensState(updater(current));
      lensRef.current = next;
      saveMapLensState(next);
      return next;
    });
  }, []);

  const setMapDisplayMode = useCallback((mode: MapLensDisplayMode) => {
    setDisplayMode(mode);
    saveMapLensDisplayMode(mode);
  }, []);

  const toggleState = useCallback((state: string) => {
    if (!state) return;
    commitLens((current) => ({
      ...current,
      states: current.states.includes(state) ? current.states.filter((item) => item !== state) : [...current.states, state],
    }));
  }, [commitLens]);

  const toggleWholeGroup = useCallback((state: string) => {
    const group = geographicGroupForState(state);
    if (!group.length) return;
    commitLens((current) => {
      const allSelected = group.every((item) => current.states.includes(item));
      if (allSelected) return { ...current, states: current.states.filter((item) => !group.includes(item)) };
      return { ...current, states: [...new Set([...current.states.filter((item) => !group.includes(item)), ...group])] };
    });
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

  const lensRollup = useMemo(() => {
    if (!dataset) return { clients: 0, matches: 0, value: 0 };
    const geographyOnly = { ...lens, segmentIds: [] };
    const clientIds = mapLensClientIds(dataset, geographyOnly, segments);
    const matchIds = activeSegments.length ? mapLensClientIds(dataset, lens, segments) : clientIds;
    const value = dataset.summaries.reduce((sum, summary) => matchIds.has(summary.clientId) ? sum + Math.max(0, summary.totalEstimatedValue || 0) : sum, 0);
    return { clients: clientIds.size, matches: matchIds.size, value };
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

    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".territory-map-toggle button"));
    if (previous === 0 && activeSegments.length > 0) {
      setMapDisplayMode("segments");
      if (buttons[0]) {
        metricProxyRef.current = true;
        buttons[0].click();
      }
    } else if (previous > 0 && activeSegments.length === 0) {
      setDrawerOpen(false);
      if (buttons[1]) buttons[1].click();
    }
  }, [activeSegments.length, setMapDisplayMode]);

  useEffect(() => {
    const onMetricClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>(".territory-map-toggle button") : null;
      if (!target || !activeSegments.length) return;
      if (metricProxyRef.current) {
        metricProxyRef.current = false;
        return;
      }
      const buttons = Array.from(target.parentElement?.querySelectorAll<HTMLButtonElement>("button") ?? []);
      const index = buttons.indexOf(target);
      if (index === 0) {
        setMapDisplayMode("clients");
        return;
      }
      if (index === 2) {
        setMapDisplayMode("value");
        return;
      }
      if (index !== 1) return;
      event.preventDefault();
      event.stopPropagation();
      setMapDisplayMode("segments");
      if (buttons[0]) {
        metricProxyRef.current = true;
        buttons[0].click();
      }
    };
    document.addEventListener("click", onMetricClick, true);
    return () => document.removeEventListener("click", onMetricClick, true);
  }, [activeSegments.length, setMapDisplayMode]);

  useEffect(() => {
    let currentMap: Element | null = null;

    const detach = () => {
      if (!currentMap) return;
      currentMap.removeEventListener("click", onMapClick);
      currentMap.removeEventListener("keydown", onMapKeyDown);
    };

    const promoteOrPin = (target: EventTarget | null, trusted: boolean) => {
      if (!trusted || !(target instanceof Element)) return;
      const region = target.closest<SVGGElement>(".territory-map-region");
      if (!region) return;
      const state = stateCodeFromTarget(region);
      const key = regionKeyFromTarget(region);
      if (!state || !key) return;

      const group = geographicGroupForState(state);
      const currentStates = lensRef.current.states;
      const wholeGroupSelected = group.length > 0 && group.every((item) => currentStates.includes(item));
      if (wholeGroupSelected) {
        commitLens((current) => ({ ...current, states: current.states.filter((item) => item !== state) }));
        lastExactRegionRef.current = key;
        window.setTimeout(() => region.click(), 0);
        return;
      }

      if (lastExactRegionRef.current === key) {
        lastExactRegionRef.current = "";
        window.setTimeout(() => toggleWholeGroup(state), 0);
        return;
      }

      lastExactRegionRef.current = key;
      // TerritoryMapPage intentionally uses a first click for state focus and a second
      // for the exact section. Replay one synthetic click after React commits the first
      // focus so a single user click lands on the exact section without changing hover.
      window.setTimeout(() => {
        if (document.contains(region)) region.click();
      }, 0);
    };

    function onMapClick(event: Event) {
      const mouse = event as MouseEvent;
      promoteOrPin(mouse.target, mouse.isTrusted);
    }

    function onMapKeyDown(event: Event) {
      const keyboard = event as KeyboardEvent;
      if (!keyboard.isTrusted || (keyboard.key !== "Enter" && keyboard.key !== " ")) return;
      promoteOrPin(keyboard.target, true);
    }

    const attach = () => {
      const map = document.querySelector(".territory-regional-map");
      const insight = document.querySelector<HTMLElement>(".territory-map-insight");
      setPortalTarget(insight);
      if (map === currentMap) return;
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
    const timer = window.setInterval(attach, 350);
    return () => {
      window.clearInterval(timer);
      detach();
      mapRef.current = null;
    };
  }, [activeSegments.length, commitLens, segmentMatchStates, toggleWholeGroup]);

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

  useEffect(() => {
    if (!mounted) return;
    const syncChrome = () => {
      const insight = document.querySelector<HTMLElement>(".territory-map-insight");
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".territory-map-toggle button"));
      const middle = buttons[1];
      const settings = document.querySelector<HTMLButtonElement>(".territory-map-settings-trigger");
      const summary = Array.from(document.querySelectorAll<HTMLElement>(".territory-map-summary > span"));
      const hasSegments = activeSegments.length > 0;

      if (middle) {
        const label = hasSegments ? "Segment Criteria" : "Need";
        if (middle.textContent !== label) middle.textContent = label;
        middle.title = hasSegments ? "Show clients matching the active Segment Manager criteria" : "Show clients meeting the map need criteria";
      }

      if (hasSegments && buttons.length >= 3) {
        const desiredIndex = displayMode === "clients" ? 0 : displayMode === "segments" ? 1 : 2;
        buttons.forEach((button, index) => button.classList.toggle("is-active", index === desiredIndex));
      }

      if (settings) {
        if (hasSegments && document.querySelector(".territory-map-settings") && !settings.disabled) settings.click();
        settings.disabled = hasSegments;
        settings.classList.toggle("is-segment-locked", hasSegments);
        settings.title = hasSegments ? "Map criteria are automatic while segments are active" : "Map criteria settings";
        settings.setAttribute("aria-label", hasSegments ? "Map criteria are controlled by active segments" : "Map criteria settings");
      }

      if (insight) insight.dataset.segmentCriteriaActive = hasSegments ? "true" : "false";

      if (hasSegments && summary.length >= 3) {
        const values = [numberLabel(lensRollup.clients), numberLabel(lensRollup.matches), compactMoney(lensRollup.value)];
        const labels = ["clients", "matches", "value"];
        summary.slice(0, 3).forEach((item, index) => {
          const strong = item.querySelector("strong");
          if (strong && strong.textContent !== values[index]) strong.textContent = values[index];
          const textNode = Array.from(item.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
          if (textNode && textNode.textContent?.trim() !== labels[index]) textNode.textContent = ` ${labels[index]}`;
        });
      }
    };

    syncChrome();
    const timer = window.setInterval(syncChrome, 400);
    return () => window.clearInterval(timer);
  }, [activeSegments.length, displayMode, lensRollup, mounted]);

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
    {hasLens && <button type="button" className="map-lens-clear" onClick={() => commitLens(() => EMPTY_MAP_LENS_STATE)}>Clear map filters</button>}
  </section>, portalTarget);
}
