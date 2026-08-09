"use client";

import { useEffect } from "react";

const COMPASS_POSITION_KEY = "client-compass.map-compass-position.v1";
const COMPASS_DRAG_MIN_WIDTH = 760;
const BASE_VIEWBOX = { x: 274, y: 0, width: 354, height: 610 };
const MIN_ZOOM = .5;
const ZOOM_STEP = .15;

type Offset = { x: number; y: number };
type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startOffset: Offset;
  startRect: DOMRect;
  canvasRect: DOMRect;
};

function clamp(value: number, minimum: number, maximum: number): number {
  if (minimum > maximum) return (minimum + maximum) / 2;
  return Math.max(minimum, Math.min(maximum, value));
}

function readOffset(): Offset {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(COMPASS_POSITION_KEY) || "null") as Partial<Offset> | null;
    return { x: Number(parsed?.x) || 0, y: Number(parsed?.y) || 0 };
  } catch {
    return { x: 0, y: 0 };
  }
}

function saveOffset(offset: Offset): void {
  try { window.localStorage.setItem(COMPASS_POSITION_KEY, JSON.stringify(offset)); } catch { /* local preference only */ }
}

function applyOffset(wrap: HTMLElement, offset: Offset): void {
  wrap.style.setProperty("translate", `${Math.round(offset.x)}px ${Math.round(offset.y)}px`);
}

function zoomedOutViewBox(zoom: number): string {
  const width = BASE_VIEWBOX.width / zoom;
  const height = BASE_VIEWBOX.height / zoom;
  const centerX = BASE_VIEWBOX.x + BASE_VIEWBOX.width / 2;
  const centerY = BASE_VIEWBOX.y + BASE_VIEWBOX.height / 2;
  return `${centerX - width / 2} ${centerY - height / 2} ${width} ${height}`;
}

export function MapDisplayRuntime() {
  useEffect(() => {
    let compassWrap: HTMLElement | null = null;
    let compassCanvas: HTMLElement | null = null;
    let compassGrip: HTMLButtonElement | null = null;
    let compassOffset = readOffset();
    let drag: DragState | null = null;
    let externalZoom = 1;

    const detachCompass = () => {
      compassGrip?.remove();
      compassWrap?.classList.remove("is-compass-draggable", "is-compass-dragging");
      compassWrap?.style.removeProperty("translate");
      compassWrap = null;
      compassCanvas = null;
      compassGrip = null;
      drag = null;
    };

    const keepCompassInside = () => {
      if (window.innerWidth < COMPASS_DRAG_MIN_WIDTH || !compassWrap || !compassCanvas) return;
      const rect = compassWrap.getBoundingClientRect();
      const canvas = compassCanvas.getBoundingClientRect();
      const inset = 8;
      let dx = 0;
      let dy = 0;
      if (rect.left < canvas.left + inset) dx = canvas.left + inset - rect.left;
      if (rect.right > canvas.right - inset) dx = canvas.right - inset - rect.right;
      if (rect.top < canvas.top + inset) dy = canvas.top + inset - rect.top;
      if (rect.bottom > canvas.bottom - inset) dy = canvas.bottom - inset - rect.bottom;
      if (dx || dy) {
        compassOffset = { x: compassOffset.x + dx, y: compassOffset.y + dy };
        applyOffset(compassWrap, compassOffset);
        saveOffset(compassOffset);
      }
    };

    const finishDrag = () => {
      if (!drag) return;
      drag = null;
      compassWrap?.classList.remove("is-compass-dragging");
      saveOffset(compassOffset);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drag || !compassWrap) return;
      const rawX = event.clientX - drag.startX;
      const rawY = event.clientY - drag.startY;
      const inset = 8;
      const deltaX = clamp(rawX, drag.canvasRect.left + inset - drag.startRect.left, drag.canvasRect.right - inset - drag.startRect.right);
      const deltaY = clamp(rawY, drag.canvasRect.top + inset - drag.startRect.top, drag.canvasRect.bottom - inset - drag.startRect.bottom);
      compassOffset = { x: drag.startOffset.x + deltaX, y: drag.startOffset.y + deltaY };
      applyOffset(compassWrap, compassOffset);
      event.preventDefault();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      finishDrag();
    };

    const attachCompass = () => {
      if (window.innerWidth < COMPASS_DRAG_MIN_WIDTH) {
        if (compassWrap || compassGrip) detachCompass();
        return;
      }
      const nextWrap = document.querySelector<HTMLElement>(".territory-map-page .territory-donut-wrap");
      const nextCanvas = nextWrap?.closest(".territory-map-layout")?.querySelector<HTMLElement>(".territory-map-canvas") || null;
      if (!nextWrap || !nextCanvas) {
        if (compassWrap || compassGrip) detachCompass();
        return;
      }
      if (nextWrap === compassWrap && compassGrip?.isConnected) return;

      if (compassGrip) compassGrip.remove();
      compassWrap = nextWrap;
      compassCanvas = nextCanvas;
      compassOffset = readOffset();
      compassWrap.classList.add("is-compass-draggable");
      applyOffset(compassWrap, compassOffset);

      const grip = document.createElement("button");
      grip.type = "button";
      grip.className = "territory-compass-drag-grip";
      grip.setAttribute("aria-label", "Move compass");
      grip.title = "Drag to move compass · double-click to reset";
      for (let index = 0; index < 6; index += 1) grip.appendChild(document.createElement("i"));
      grip.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || !compassWrap || !compassCanvas) return;
        event.preventDefault();
        event.stopPropagation();
        grip.setPointerCapture?.(event.pointerId);
        drag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startOffset: { ...compassOffset },
          startRect: compassWrap.getBoundingClientRect(),
          canvasRect: compassCanvas.getBoundingClientRect(),
        };
        compassWrap.classList.add("is-compass-dragging");
      });
      grip.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        compassOffset = { x: 0, y: 0 };
        applyOffset(compassWrap!, compassOffset);
        saveOffset(compassOffset);
        window.setTimeout(keepCompassInside, 30);
      });
      compassWrap.appendChild(grip);
      compassGrip = grip;
      window.setTimeout(keepCompassInside, 40);
    };

    const maintainZoom = () => {
      const control = document.querySelector<HTMLElement>(".territory-map-page .territory-map-zoom");
      const map = document.querySelector<SVGSVGElement>(".territory-map-page .territory-regional-map");
      if (!control || !map) {
        externalZoom = 1;
        return;
      }
      const buttons = control.querySelectorAll<HTMLButtonElement>("button");
      const label = control.querySelector<HTMLElement>("span");
      if (buttons.length < 2 || !label) return;

      if (externalZoom < 1) {
        const percent = Math.round(externalZoom * 100);
        const viewBox = zoomedOutViewBox(externalZoom);
        if (map.getAttribute("viewBox") !== viewBox) map.setAttribute("viewBox", viewBox);
        if (label.textContent !== `${percent}%`) label.textContent = `${percent}%`;
        buttons[0].disabled = externalZoom <= MIN_ZOOM + .001;
        buttons[1].disabled = false;
        control.classList.add("is-zoomed-out");
        map.classList.add("is-zoomed-out");
      } else {
        control.classList.remove("is-zoomed-out");
        map.classList.remove("is-zoomed-out");
        const nativePercent = Number.parseInt(label.textContent || "100", 10) || 100;
        if (nativePercent <= 100) buttons[0].disabled = false;
      }
    };

    const onZoomClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>(".territory-map-zoom button") : null;
      if (!button) return;
      const control = button.closest<HTMLElement>(".territory-map-zoom");
      if (!control) return;
      const buttons = Array.from(control.querySelectorAll<HTMLButtonElement>("button"));
      const label = control.querySelector<HTMLElement>("span");
      const index = buttons.indexOf(button);
      const nativePercent = Number.parseInt(label?.textContent || "100", 10) || 100;

      if (index === 0 && (externalZoom < 1 || nativePercent <= 100)) {
        event.preventDefault();
        event.stopPropagation();
        externalZoom = Math.max(MIN_ZOOM, Number(((externalZoom < 1 ? externalZoom : 1) - ZOOM_STEP).toFixed(2)));
        maintainZoom();
      } else if (index === 1 && externalZoom < 1) {
        event.preventDefault();
        event.stopPropagation();
        const next = Number((externalZoom + ZOOM_STEP).toFixed(2));
        externalZoom = next >= .99 ? 1 : Math.min(1, next);
        if (externalZoom === 1) {
          const map = document.querySelector<SVGSVGElement>(".territory-map-page .territory-regional-map");
          if (map) map.setAttribute("viewBox", `${BASE_VIEWBOX.x} ${BASE_VIEWBOX.y} ${BASE_VIEWBOX.width} ${BASE_VIEWBOX.height}`);
          if (label) label.textContent = "100%";
        }
        maintainZoom();
      }
    };

    const onResize = () => {
      attachCompass();
      keepCompassInside();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("resize", onResize);
    document.addEventListener("click", onZoomClick, true);

    const interval = window.setInterval(() => {
      attachCompass();
      maintainZoom();
    }, 250);
    attachCompass();
    maintainZoom();

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("click", onZoomClick, true);
      detachCompass();
    };
  }, []);

  return null;
}
