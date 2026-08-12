"use client";

import { useEffect } from "react";
import {
  loadMapLensState,
  MAP_LENS_CHANGE_EVENT,
  MAP_MODE_RENDERED_EVENT,
  saveMapLensState,
} from "@/lib/segments/map-lens";

function regionNameFromLabel(value: string): string {
  return value.split(":")[0]?.trim() ?? "";
}

function mapRegionForSlice(slice: Element): SVGGElement | null {
  const name = regionNameFromLabel(slice.getAttribute("aria-label") || "");
  if (!name) return null;
  return Array.from(document.querySelectorAll<SVGGElement>(".territory-map-region")).find((region) => (
    regionNameFromLabel(region.getAttribute("aria-label") || "") === name
  )) ?? null;
}

function stateCodeForRegion(region: SVGGElement | null): string {
  if (!region) return "";
  const stateGroup = region.closest<SVGGElement>(".territory-map-state");
  const label = stateGroup?.querySelector<SVGTextElement>(".territory-map-region-label")?.textContent?.trim().toUpperCase() ?? "";
  return label.slice(0, 2);
}

function stateCodeForSlice(slice: Element): string {
  return stateCodeForRegion(mapRegionForSlice(slice));
}

function commitDonutState(state: string, additive: boolean): void {
  if (!state) return;
  const current = loadMapLensState();
  const states = additive
    ? current.states.includes(state)
      ? current.states.filter((item) => item !== state)
      : [...current.states, state]
    : [state];
  saveMapLensState({ ...current, states });
}

function syncDonutHighlights(): void {
  const selected = new Set(loadMapLensState().states);
  document.querySelectorAll<SVGSVGElement>(".territory-donut").forEach((donut) => {
    donut.classList.toggle("has-lens-scope", selected.size > 0);
    donut.querySelectorAll<SVGPathElement>(".territory-donut-slice").forEach((slice) => {
      slice.classList.toggle("is-lens-selected", selected.has(stateCodeForSlice(slice)));
    });
  });
}

function sliceFromTarget(target: EventTarget | null): SVGPathElement | null {
  return target instanceof Element ? target.closest<SVGPathElement>(".territory-donut-slice") : null;
}

export function MapDonutSelectionBridge() {
  useEffect(() => {
    const syncSoon = () => {
      syncDonutHighlights();
      window.requestAnimationFrame(syncDonutHighlights);
    };

    const onClick = (event: MouseEvent) => {
      if (!event.isTrusted) return;
      const slice = sliceFromTarget(event.target);
      if (!slice) return;
      commitDonutState(stateCodeForSlice(slice), event.ctrlKey || event.metaKey);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.isTrusted || (event.key !== "Enter" && event.key !== " ")) return;
      const slice = sliceFromTarget(event.target);
      if (!slice) return;
      commitDonutState(stateCodeForSlice(slice), event.ctrlKey || event.metaKey);
    };

    syncSoon();
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener(MAP_LENS_CHANGE_EVENT, syncSoon);
    window.addEventListener(MAP_MODE_RENDERED_EVENT, syncSoon);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener(MAP_LENS_CHANGE_EVENT, syncSoon);
      window.removeEventListener(MAP_MODE_RENDERED_EVENT, syncSoon);
    };
  }, []);

  return null;
}
