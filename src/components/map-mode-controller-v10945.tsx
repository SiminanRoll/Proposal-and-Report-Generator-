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
  if (mode === "need") return 1;
  if (mode === "value") return 2;
  return 0;
}

function buttonMode(index: number, hasSegments: boolean): MapLensDisplayMode {
  if (index === 0) return "clients";
  if (index === 1) return hasSegments ? "segments" : "need";
  return "value";
}

function displayLabel(mode: MapLensDisplayMode, hasSegments: boolean, descriptor: string): string {
  if (mode === "segments" && hasSegments) return `Showing · ${descriptor}`;
  if (mode === "value" && hasSegments) return `Showing · ${descriptor} value`;
  if (mode === "value") return "Showing · Value";
  if (mode === "need") return "Showing · Need";
  return "Showing · All clients";
}

function setValueButtonLabel(button: HTMLButtonElement, descriptor: string, hasSegments: boolean) {
  button.replaceChildren(document.createTextNode("Value"));
  button.classList.toggle("has-segment-descriptor", hasSegments);
  button.style.removeProperty("display");
  button.style.removeProperty("grid-template-rows");
  button.style.removeProperty("place-items");
  button.style.removeProperty("align-content");
  button.style.removeProperty("row-gap");
  if (!hasSegments) return;

  button.style.setProperty("display", "grid", "important");
  button.style.setProperty("grid-template-rows", "auto auto", "important");
  button.style.setProperty("place-items", "center", "important");
  button.style.setProperty("align-content", "center", "important");
  button.style.setProperty("row-gap", "1px", "important");

  const small = document.createElement("small");
  small.className = "territory-map-toggle-descriptor";
  small.textContent = `(${descriptor})`;
  small.style.setProperty("display", "block", "important");
  small.style.setProperty("max-width", "100%", "important");
  small.style.setProperty("overflow", "hidden", "important");
  small.style.setProperty("text-overflow", "ellipsis", "important");
  small.style.setProperty("white-space", "nowrap", "important");
  small.style.setProperty("font-size", "7px", "important");
  small.style.setProperty("font-weight", "800", "important");
  small.style.setProperty("line-height", "1", "important");
  small.style.setProperty("opacity", ".72", "important");
  button.appendChild(small);
}

export function MapModeControllerV10945() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/map")) return;

    let activeTarget: HTMLElement | null = null;
    let disposeTarget = () => {};
    let syncingNativeButton = false;
    let renderedFrame = 0;

    const dispatchRendered = () => {
      window.cancelAnimationFrame(renderedFrame);
      renderedFrame = window.requestAnimationFrame(() => window.dispatchEvent(new Event(MAP_MODE_RENDERED_EVENT)));
    };

    const bindTarget = () => {
      const nextTarget = document.querySelector<HTMLElement>(".territory-map-toggle");
      if (!nextTarget || nextTarget === activeTarget) return;

      disposeTarget();
      activeTarget = nextTarget;

      const buttons = Array.from(nextTarget.querySelectorAll<HTMLButtonElement>(":scope > button")).slice(0, 3);
      if (buttons.length < 3) {
        activeTarget = null;
        return;
      }

      nextTarget.dataset.modeController = "v10945";
      buttons[0].textContent = "All";
      buttons[0].setAttribute("aria-label", "Show all clients");
      buttons[2].setAttribute("aria-label", "Show estimated value");

      const syncFromStoredMode = () => {
        const lens = loadMapLensState();
        const hasSegments = lens.segmentIds.length > 0;
        const descriptor = hasSegments ? primaryMapSegmentDescriptor(lens) : "";
        const storedMode = loadMapLensDisplayMode();

        buttons[1].textContent = hasSegments ? descriptor : "Need";
        buttons[1].setAttribute("aria-label", hasSegments ? `Show ${descriptor} clients` : "Show clients in need");
        buttons[1].title = hasSegments ? `Show clients matched by the top segment descriptor: ${descriptor}` : "Show clients in need";
        setValueButtonLabel(buttons[2], descriptor, hasSegments);
        buttons[2].setAttribute("aria-label", hasSegments ? `Show estimated value for ${descriptor} clients` : "Show estimated value");

        if (hasSegments && storedMode === "need") {
          saveMapLensDisplayMode("segments");
          return;
        }
        if (!hasSegments && storedMode === "segments") {
          saveMapLensDisplayMode("clients");
          return;
        }

        const segmentMode = hasSegments && storedMode === "segments";
        const metricMode: MapLensDisplayMode = segmentMode ? "clients" : storedMode;
        const button = buttons[nativeMetricIndex(metricMode)];

        if (button && !button.classList.contains("is-active")) {
          syncingNativeButton = true;
          button.click();
          syncingNativeButton = false;
        }

        const donutWrap = document.querySelector<HTMLElement>(".territory-donut-wrap");
        if (donutWrap) donutWrap.dataset.mapDisplayLabel = displayLabel(storedMode, hasSegments, descriptor || "Segments");

        const settings = nextTarget.closest(".territory-map-controls")?.querySelector<HTMLButtonElement>(".territory-map-settings-trigger") ?? null;
        if (settings) {
          if (segmentMode && document.querySelector(".territory-map-settings") && !settings.disabled) settings.click();
          settings.disabled = segmentMode;
          settings.classList.toggle("is-segment-locked", segmentMode);
          settings.title = segmentMode ? "Map criteria are controlled by Segment Criteria" : "Map criteria settings";
          settings.setAttribute("aria-label", segmentMode ? "Map criteria are controlled by Segment Criteria" : "Map criteria settings");
        }

        nextTarget.classList.toggle("has-slotted-segments-v10944", hasSegments);
        nextTarget.classList.toggle("is-segment-mode-v10942", segmentMode);
        nextTarget.classList.toggle("is-segment-mode-v10944", segmentMode);
        dispatchRendered();
      };

      const buttonCleanups = buttons.map((button, index) => {
        const onClick = (event: MouseEvent) => {
          if (syncingNativeButton) return;
          const lens = loadMapLensState();
          const hasSegments = lens.segmentIds.length > 0;
          const nextMode = buttonMode(index, hasSegments);

          if (index === 1 && hasSegments) {
            event.preventDefault();
            event.stopPropagation();
          }

          if (nextMode === "clients" && lens.states.length) {
            saveMapLensState({ ...lens, states: [] });
          }
          saveMapLensDisplayMode(nextMode);
          dispatchRendered();
        };
        button.addEventListener("click", onClick);
        return () => button.removeEventListener("click", onClick);
      });

      window.addEventListener(MAP_LENS_CHANGE_EVENT, syncFromStoredMode);
      window.addEventListener("client-compass-segments-changed", syncFromStoredMode);
      syncFromStoredMode();

      disposeTarget = () => {
        buttonCleanups.forEach((cleanup) => cleanup());
        window.removeEventListener(MAP_LENS_CHANGE_EVENT, syncFromStoredMode);
        window.removeEventListener("client-compass-segments-changed", syncFromStoredMode);
      };
    };

    bindTarget();
    const timers = [80, 260, 800].map((delay) => window.setTimeout(bindTarget, delay));
    const observer = new MutationObserver(() => {
      const currentTarget = document.querySelector<HTMLElement>(".territory-map-toggle");
      if (currentTarget !== activeTarget) bindTarget();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
      disposeTarget();
      window.cancelAnimationFrame(renderedFrame);
    };
  }, [pathname]);

  return null;
}
