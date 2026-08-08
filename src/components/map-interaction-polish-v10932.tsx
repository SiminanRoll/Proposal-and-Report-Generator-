"use client";

import { useEffect, useRef } from "react";
import {
  loadMapLensDisplayMode,
  loadMapLensState,
  MAP_LENS_CHANGE_EVENT,
  saveMapLensDisplayMode,
  saveMapLensState,
} from "@/lib/segments/map-lens";

const SEGMENTS_CHANGE_EVENT = "client-compass-segments-changed";
const DROP_CONFIRM_MS = 560;

function mapToggleButtons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".territory-map-toggle button"));
}

function clearNativeMapFocus(): void {
  const map = document.querySelector<SVGSVGElement>(".territory-regional-map");
  if (!map) return;
  map.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
}

function activateMiddleMode(): void {
  const buttons = mapToggleButtons();
  buttons[1]?.click();
}

function activateAllMode(clearGeography = true): void {
  const lens = loadMapLensState();
  if (clearGeography && lens.states.length) saveMapLensState({ ...lens, states: [] });
  if (loadMapLensDisplayMode() !== "clients") saveMapLensDisplayMode("clients");
  mapToggleButtons()[0]?.click();
  clearNativeMapFocus();
}

function slotForTarget(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(".map-lens-slot") : null;
}

export function MapInteractionPolishV10932() {
  const previousSegmentCountRef = useRef<number | null>(null);
  const dragSourceRef = useRef<HTMLElement | null>(null);
  const previewSlotRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousSegmentCountRef.current = loadMapLensState().segmentIds.length;

    const clearDragPreview = () => {
      previewSlotRef.current?.classList.remove("is-drop-preview");
      previewSlotRef.current?.querySelector(".map-slot-drag-ghost")?.remove();
      previewSlotRef.current = null;
      document.documentElement.classList.remove("map-segment-drag-active");
    };

    const showDragPreview = (slot: HTMLElement) => {
      if (previewSlotRef.current === slot && slot.querySelector(".map-slot-drag-ghost")) return;
      previewSlotRef.current?.classList.remove("is-drop-preview");
      previewSlotRef.current?.querySelector(".map-slot-drag-ghost")?.remove();
      previewSlotRef.current = slot;
      slot.classList.add("is-drop-preview");

      const source = dragSourceRef.current;
      if (!source) return;
      const ghost = source.cloneNode(true) as HTMLElement;
      ghost.classList.add("map-slot-drag-ghost");
      ghost.removeAttribute("draggable");
      ghost.querySelectorAll("button").forEach((button) => button.remove());
      slot.appendChild(ghost);
    };

    const flashConfirmedSlot = (slotIndex: number) => {
      window.setTimeout(() => {
        const slot = document.querySelectorAll<HTMLElement>(".map-lens-slot")[slotIndex];
        if (!slot) return;
        slot.classList.remove("is-drop-confirmed");
        void slot.offsetWidth;
        slot.classList.add("is-drop-confirmed");
        window.setTimeout(() => slot.classList.remove("is-drop-confirmed"), DROP_CONFIRM_MS);
      }, 24);
    };

    const onDragStart = (event: DragEvent) => {
      if (!(event.target instanceof Element)) return;
      const source = event.target.closest<HTMLElement>(".map-segment-drawer-card-v10931,.map-lens-slot.map-lens-card");
      if (!source) return;
      dragSourceRef.current = source;
      document.documentElement.classList.add("map-segment-drag-active");
    };

    const onDragOver = (event: DragEvent) => {
      const slot = slotForTarget(event.target);
      if (!slot || !dragSourceRef.current) return;
      event.preventDefault();
      showDragPreview(slot);
    };

    const onDrop = (event: DragEvent) => {
      const slot = slotForTarget(event.target);
      if (!slot) return;
      const slots = Array.from(document.querySelectorAll<HTMLElement>(".map-lens-slot"));
      const slotIndex = slots.indexOf(slot);
      clearDragPreview();
      dragSourceRef.current = null;
      if (slotIndex >= 0) flashConfirmedSlot(slotIndex);
    };

    const onDragEnd = () => {
      clearDragPreview();
      dragSourceRef.current = null;
    };

    const onMapClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest(".territory-map-region,.territory-map-state,.territory-donut-slice")) return;
      window.setTimeout(activateMiddleMode, 0);
    };

    const onToggleClick = (event: MouseEvent) => {
      if (!event.isTrusted) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>(".territory-map-toggle button") : null;
      if (!target) return;
      const buttons = Array.from(target.parentElement?.querySelectorAll<HTMLButtonElement>("button") ?? []);
      if (buttons.indexOf(target) !== 0) return;
      window.setTimeout(() => activateAllMode(true), 0);
    };

    const onLensChange = () => {
      const count = loadMapLensState().segmentIds.length;
      const previous = previousSegmentCountRef.current;
      previousSegmentCountRef.current = count;
      if (previous !== null && previous > 0 && count === 0) {
        // The existing map bridge also reacts to this transition. Run after it so
        // an empty segment stack always settles on All + whole-map geography.
        window.setTimeout(() => activateAllMode(true), 120);
      }
    };

    const onSegmentsChanged = () => {
      const lens = loadMapLensState();
      if (lens.segmentIds.length) saveMapLensState(lens);
    };

    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("dragover", onDragOver, true);
    document.addEventListener("drop", onDrop, true);
    document.addEventListener("dragend", onDragEnd, true);
    document.addEventListener("click", onMapClick, true);
    document.addEventListener("click", onToggleClick, true);
    window.addEventListener(MAP_LENS_CHANGE_EVENT, onLensChange);
    window.addEventListener(SEGMENTS_CHANGE_EVENT, onSegmentsChanged);

    return () => {
      clearDragPreview();
      document.removeEventListener("dragstart", onDragStart, true);
      document.removeEventListener("dragover", onDragOver, true);
      document.removeEventListener("drop", onDrop, true);
      document.removeEventListener("dragend", onDragEnd, true);
      document.removeEventListener("click", onMapClick, true);
      document.removeEventListener("click", onToggleClick, true);
      window.removeEventListener(MAP_LENS_CHANGE_EVENT, onLensChange);
      window.removeEventListener(SEGMENTS_CHANGE_EVENT, onSegmentsChanged);
    };
  }, []);

  return null;
}
