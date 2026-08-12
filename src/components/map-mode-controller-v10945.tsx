"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  loadMapLensDisplayMode,
  loadMapLensState,
  MAP_LENS_CHANGE_EVENT,
  MAP_MODE_RENDERED_EVENT,
  primaryMapSegmentDescriptor,
  saveMapLensDisplayMode,
  saveMapLensState,
  type MapLensDisplayMode,
} from "@/lib/segments/map-lens";

function nativeMetricIndex(mode: MapLensDisplayMode): number {
  return mode === "clients" ? 0 : 1;
}

function displayLabel(mode: MapLensDisplayMode, hasSegments: boolean, descriptor: string): string {
  if (mode === "segments" && hasSegments) return `Showing · ${descriptor} clients in need`;
  if (mode === "need") return "Showing · Replacement need";
  return "Showing · All clients";
}

function setBodyMode(mode: MapLensDisplayMode, hasSegments: boolean): void {
  document.body.dataset.compassMapMode = mode;
  document.body.classList.toggle("is-map-qualifying-view", mode !== "clients");
  document.body.classList.toggle("is-map-segment-view", hasSegments && mode === "segments");
}

export function MapModeControllerV10945() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/map")) return;

    let target: HTMLElement | null = null;
    let cleanupButtons = () => {};
    let syncingNative = false;
    let renderedFrame = 0;

    const dispatchRendered = () => {
      window.cancelAnimationFrame(renderedFrame);
      renderedFrame = window.requestAnimationFrame(() => window.dispatchEvent(new Event(MAP_MODE_RENDERED_EVENT)));
    };

    const sync = () => {
      const nextTarget = document.querySelector<HTMLElement>(".territory-map-toggle");
      if (!nextTarget) return;
      if (nextTarget !== target) bind(nextTarget);
      if (!target) return;

      const buttons = Array.from(target.querySelectorAll<HTMLButtonElement>(":scope > button"));
      if (buttons.length < 2) return;

      const lens = loadMapLensState();
      const hasSegments = lens.segmentIds.length > 0;
      const descriptor = hasSegments ? primaryMapSegmentDescriptor(lens) || "Segment" : "";
      const storedMode = loadMapLensDisplayMode();
      const mode: MapLensDisplayMode = storedMode === "value"
        ? (hasSegments ? "segments" : "need")
        : hasSegments && storedMode === "need"
          ? "segments"
          : !hasSegments && storedMode === "segments"
            ? "need"
            : storedMode;

      if (mode !== storedMode) {
        saveMapLensDisplayMode(mode);
        return;
      }

      buttons[0].textContent = "All";
      buttons[0].setAttribute("aria-label", "Show all clients");
      buttons[0].title = "Show all clients";

      buttons[1].textContent = hasSegments ? descriptor : "Need";
      buttons[1].setAttribute("aria-label", hasSegments ? `Show ${descriptor} clients that qualify as replacement need` : "Show clients in replacement need");
      buttons[1].title = hasSegments ? `Show ${descriptor} clients that also meet the active Need criteria` : "Show clients in replacement need";

      // Value is context, not a population. Keep the old native third button out
      // of the interaction model while React still owns the underlying markup.
      const legacyValueButton = buttons[2];
      if (legacyValueButton) {
        legacyValueButton.hidden = true;
        legacyValueButton.disabled = true;
        legacyValueButton.tabIndex = -1;
        legacyValueButton.setAttribute("aria-hidden", "true");
      }

      setBodyMode(mode, hasSegments);

      const nativeButton = buttons[nativeMetricIndex(mode)];
      if (nativeButton) {
        syncingNative = true;
        nativeButton.click();
        syncingNative = false;
      }

      const wrap = document.querySelector<HTMLElement>(".territory-donut-wrap");
      if (wrap) wrap.dataset.mapDisplayLabel = displayLabel(mode, hasSegments, descriptor || "Segment");

      const settings = target.closest(".territory-map-controls")?.querySelector<HTMLButtonElement>(".territory-map-settings-trigger") ?? null;
      if (settings) {
        const locked = hasSegments && mode === "segments";
        settings.disabled = locked;
        settings.classList.toggle("is-segment-locked", locked);
        settings.title = locked ? "Need criteria are being applied to the active segment view" : "Map criteria settings";
      }

      target.classList.toggle("has-slotted-segments-v10944", hasSegments);
      target.classList.toggle("is-segment-mode-v10944", hasSegments && mode === "segments");
      dispatchRendered();
    };

    const bind = (next: HTMLElement) => {
      cleanupButtons();
      target = next;
      const buttons = Array.from(next.querySelectorAll<HTMLButtonElement>(":scope > button")).slice(0, 2);
      const cleanups = buttons.map((button, index) => {
        const onClick = () => {
          if (syncingNative) return;
          const lens = loadMapLensState();
          const hasSegments = lens.segmentIds.length > 0;
          if (index === 0 && lens.states.length) saveMapLensState({ ...lens, states: [] });
          saveMapLensDisplayMode(index === 0 ? "clients" : hasSegments ? "segments" : "need");
        };
        button.addEventListener("click", onClick);
        return () => button.removeEventListener("click", onClick);
      });
      cleanupButtons = () => cleanups.forEach((cleanup) => cleanup());
    };

    const queueSync = () => window.requestAnimationFrame(sync);
    sync();
    const attachTimer = window.setInterval(() => {
      const next = document.querySelector<HTMLElement>(".territory-map-toggle");
      if (next && next !== target) { bind(next); sync(); }
    }, 500);
    window.addEventListener(MAP_LENS_CHANGE_EVENT, queueSync);
    window.addEventListener("client-compass-segments-changed", queueSync);

    return () => {
      window.clearInterval(attachTimer);
      window.cancelAnimationFrame(renderedFrame);
      cleanupButtons();
      window.removeEventListener(MAP_LENS_CHANGE_EVENT, queueSync);
      window.removeEventListener("client-compass-segments-changed", queueSync);
      delete document.body.dataset.compassMapMode;
      document.body.classList.remove("is-map-qualifying-view", "is-map-segment-view");
    };
  }, [pathname]);

  return null;
}
