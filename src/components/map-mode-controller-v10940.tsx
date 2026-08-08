"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  loadMapLensDisplayMode,
  loadMapLensState,
  MAP_LENS_CHANGE_EVENT,
  MAP_MODE_RENDERED_EVENT,
  saveMapLensDisplayMode,
  saveMapLensState,
  type MapLensDisplayMode,
} from "@/lib/segments/map-lens";

function nativeMetricIndex(mode: MapLensDisplayMode): number {
  if (mode === "need") return 1;
  if (mode === "value") return 2;
  return 0;
}

export function MapModeControllerV10940() {
  const pathname = usePathname();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<MapLensDisplayMode>("value");
  const [hasSegments, setHasSegments] = useState(false);

  const syncStoredMode = useCallback(() => {
    const lens = loadMapLensState();
    const segmentsActive = lens.segmentIds.length > 0;
    let next = loadMapLensDisplayMode();
    if (next === "segments" && !segmentsActive) next = "clients";
    setHasSegments(segmentsActive);
    setMode(next);
  }, []);

  useEffect(() => {
    if (!pathname.startsWith("/map")) {
      setTarget(null);
      return;
    }
    const syncTarget = () => setTarget(document.querySelector<HTMLElement>(".territory-map-toggle"));
    syncTarget();
    const timers = [80, 260, 800].map((delay) => window.setTimeout(syncTarget, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [pathname]);

  useEffect(() => {
    syncStoredMode();
    window.addEventListener(MAP_LENS_CHANGE_EVENT, syncStoredMode);
    return () => window.removeEventListener(MAP_LENS_CHANGE_EVENT, syncStoredMode);
  }, [syncStoredMode]);

  useEffect(() => {
    if (!target) return;
    const buttons = Array.from(target.querySelectorAll<HTMLButtonElement>(":scope > button"));
    const button = buttons[nativeMetricIndex(mode)];
    const settings = target.closest(".territory-map-controls")?.querySelector<HTMLButtonElement>(".territory-map-settings-trigger") ?? null;
    const segmentMode = mode === "segments";

    if (settings) {
      if (segmentMode && document.querySelector(".territory-map-settings") && !settings.disabled) settings.click();
      settings.disabled = segmentMode;
      settings.classList.toggle("is-segment-locked", segmentMode);
      settings.title = segmentMode ? "Map criteria are controlled by Segment Criteria" : "Map criteria settings";
      settings.setAttribute("aria-label", segmentMode ? "Map criteria are controlled by Segment Criteria" : "Map criteria settings");
    }

    const frame = window.requestAnimationFrame(() => {
      // The original three React buttons remain the map renderer's internal
      // metric control. Only this authoritative controller is allowed to drive them.
      if (button && !button.classList.contains("is-active")) button.click();
      window.requestAnimationFrame(() => window.dispatchEvent(new Event(MAP_MODE_RENDERED_EVENT)));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode, target]);

  const chooseMode = (next: MapLensDisplayMode) => {
    if (next === "segments" && !hasSegments) return;
    if (next === "clients") {
      const lens = loadMapLensState();
      if (lens.states.length) saveMapLensState({ ...lens, states: [] });
    }
    setMode(next);
    saveMapLensDisplayMode(next);
  };

  if (!target) return null;

  return createPortal(<div className="map-mode-toggle-v10940" role="group" aria-label="Map display mode">
    <button type="button" className={mode === "clients" ? "is-active" : ""} onClick={() => chooseMode("clients")}>All</button>
    <button type="button" className={mode === "need" ? "is-active" : ""} onClick={() => chooseMode("need")}>Need</button>
    <button type="button" className={mode === "value" ? "is-active" : ""} onClick={() => chooseMode("value")}>Value</button>
    {hasSegments && <button type="button" className={`is-segment${mode === "segments" ? " is-active" : ""}`} onClick={() => chooseMode("segments")}>Segment Criteria</button>}
  </div>, target);
}
