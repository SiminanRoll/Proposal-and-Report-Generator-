"use client";

import { useEffect, useRef } from "react";
import { loadMapLensState, saveMapLensState } from "@/lib/segments/map-lens";

const SEGMENTS_CHANGE_EVENT = "client-compass-segments-changed";
const DROP_CONFIRM_MS = 560;

function slotForTarget(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(".map-lens-slot") : null;
}

export function MapInteractionPolishV10932() {
  const dragSourceRef = useRef<HTMLElement | null>(null);
  const previewSlotRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
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

    // Segment definitions can be edited elsewhere. Re-save the active lens so
    // the map recomputes against the latest segment rules without changing mode.
    const onSegmentsChanged = () => {
      const lens = loadMapLensState();
      if (lens.segmentIds.length) saveMapLensState(lens);
    };

    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("dragover", onDragOver, true);
    document.addEventListener("drop", onDrop, true);
    document.addEventListener("dragend", onDragEnd, true);
    window.addEventListener(SEGMENTS_CHANGE_EVENT, onSegmentsChanged);

    return () => {
      clearDragPreview();
      document.removeEventListener("dragstart", onDragStart, true);
      document.removeEventListener("dragover", onDragOver, true);
      document.removeEventListener("drop", onDrop, true);
      document.removeEventListener("dragend", onDragEnd, true);
      window.removeEventListener(SEGMENTS_CHANGE_EVENT, onSegmentsChanged);
    };
  }, []);

  return null;
}