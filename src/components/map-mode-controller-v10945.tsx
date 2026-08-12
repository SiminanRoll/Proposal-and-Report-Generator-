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
  if (mode === "value") return 2;
  if (mode === "need" || mode === "segments") return 1;
  return 0;
}

function displayLabel(mode: MapLensDisplayMode, hasSegments: boolean, descriptor: string): string {
  if (mode === "segments" && hasSegments) return `Showing · ${descriptor} clients in need`;
  if (mode === "value" && hasSegments) return `Showing · ${descriptor} need value`;
  if (mode === "value") return "Showing · Need value";
  if (mode === "need") return "Showing · Replacement need";
  return "Showing · All clients";
}

function setValueButtonLabel(button: HTMLButtonElement, descriptor: string, hasSegments: boolean): void {
  const desiredText = hasSegments ? `Value (${descriptor})` : "Value";
  if (button.dataset.mapDesiredLabel === desiredText) return;
  button.dataset.mapDesiredLabel = desiredText;
  button.replaceChildren(document.createTextNode("Value"));
  button.classList.toggle("has-segment-descriptor", hasSegments);
  if (!hasSegments) return;
  const small = document.createElement("small");
  small.className = "territory-map-toggle-descriptor";
  small.textContent = `(${descriptor})`;
  button.appendChild(small);
}

function setBodyMode(mode: MapLensDisplayMode, hasSegments: boolean): void {
  document.body.dataset.compassMapMode = mode;
  document.body.classList.toggle("is-map-qualifying-view", mode !== "clients");
  document.body.classList.toggle("is-map-segment-view", hasSegments && mode !== "clients");
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

      const buttons = Array.from(target.querySelectorAll<HTMLButtonElement>(":scope > button")).slice(0, 3);
      if (buttons.length < 3) return;

      const lens = loadMapLensState();
      const hasSegments = lens.segmentIds.length > 0;
      const descriptor = hasSegments ? primaryMapSegmentDescriptor(lens) || "Segment" : "";
      let mode = loadMapLensDisplayMode();

      if (hasSegments && mode === "need") {
        saveMapLensDisplayMode("segments");
        return;
      }
      if (!hasSegments && mode === "segments") {
        saveMapLensDisplayMode("clients");
        return;
      }

      buttons[0].textContent = "All";
      buttons[0].setAttribute("aria-label", "Show all clients");
      buttons[1].textContent = hasSegments ? descriptor : "Need";
      buttons[1].setAttribute("aria-label", hasSegments ? `Show ${descriptor} clients that also qualify as replacement need` : "Show clients in replacement need");
      buttons[1].title = hasSegments ? `Show only ${descriptor} clients that also meet the active Need criteria` : "Show clients in replacement need";
      setValueButtonLabel(buttons[2], descriptor, hasSegments);
      buttons[2].setAttribute("aria-label", hasSegments ? `Show replacement-need value for ${descriptor} clients` : "Show replacement-need value");

      setBodyMode(mode, hasSegments);

      // The rendered button class is presentation only. Always drive the native
      // React metric from the stored display mode so a stale .is-active class
      // can never leave a Segment/Need label plotting All clients.
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
      const buttons = Array.from(next.querySelectorAll<HTMLButtonElement>(":scope > button")).slice(0, 3);
      const cleanups = buttons.map((button, index) => {
        const onClick = () => {
          if (syncingNative) return;
          const lens = loadMapLensState();
          const hasSegments = lens.segmentIds.length > 0;
          if (index === 0 && lens.states.length) saveMapLensState({ ...lens, states: [] });
          const nextMode: MapLensDisplayMode = index === 0 ? "clients" : index === 2 ? "value" : hasSegments ? "segments" : "need";
          saveMapLensDisplayMode(nextMode);
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
