"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  loadMapLensDisplayMode,
  loadMapLensState,
  MAP_LENS_CHANGE_EVENT,
  MAP_MODE_RENDERED_EVENT,
  primaryMapSegmentDescriptor,
  type MapLensDisplayMode,
} from "@/lib/segments/map-lens";
import { TerritoryCompassHub } from "./territory-compass-hub";

type SliceSpan = { label: string; color: string; start: number; sweep: number };
type CompassTarget = { bearing: number; label: string; active: boolean; color: string };

function normalizeBearing(angle: number): number {
  let next = angle;
  while (next < -180) next += 360;
  while (next >= 180) next -= 360;
  return next;
}

function brightenHex(color: string, amount = .28): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return color;
  const value = Number.parseInt(match[1], 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255]
    .map((channel) => Math.round(channel + (255 - channel) * amount));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function pointAngle(x: number, y: number): number {
  return Math.atan2(y - 104, x - 104) * 180 / Math.PI;
}

function renderedSweep(path: SVGPathElement): number {
  const d = path.getAttribute("d") || "";
  const match = /^M\s*([-\d.]+),([-\d.]+)\s+A\s*[-\d.]+,[-\d.]+\s+0\s+[01]\s+1\s+([-\d.]+),([-\d.]+)/i.exec(d);
  if (!match) return 0;
  const start = pointAngle(Number(match[1]), Number(match[2]));
  const end = pointAngle(Number(match[3]), Number(match[4]));
  let sweep = end - start;
  while (sweep < 0) sweep += 360;
  while (sweep >= 360) sweep -= 360;
  if (sweep < .001 && d.includes("359.999")) return 359.999;
  return sweep;
}

function renderedSpans(donut: SVGSVGElement): SliceSpan[] {
  const paths = Array.from(donut.querySelectorAll<SVGPathElement>(".territory-donut-slice"));
  let cursor = -90;
  const spans: SliceSpan[] = [];
  for (const path of paths) {
    const aria = path.getAttribute("aria-label") || "";
    const label = aria.split(":")[0]?.trim() || "";
    const sweep = renderedSweep(path);
    if (!label || !(sweep > 0)) continue;
    spans.push({ label, color: path.getAttribute("fill") || "#67d8ff", start: cursor, sweep });
    cursor += sweep;
  }
  return spans;
}

function targetFor(donut: SVGSVGElement): CompassTarget {
  const spans = renderedSpans(donut);
  if (!spans.length) return { bearing: 0, label: "No active section", active: false, color: "#67d8ff" };

  // The compass is a visual answer to the pie. Never recombine pie sections
  // into hidden state groups: the largest rendered section is the target.
  const winner = spans.slice().sort((left, right) => right.sweep - left.sweep || left.label.localeCompare(right.label))[0];
  const midpoint = winner.start + winner.sweep / 2;
  return {
    bearing: normalizeBearing(midpoint + 90),
    label: winner.label,
    active: true,
    color: brightenHex(winner.color),
  };
}

function explanatoryLabel(mode: MapLensDisplayMode, target: CompassTarget, descriptor: string): string {
  if (!target.active) return "Compass: No active section";
  if (mode === "segments") return `Most ${descriptor.toLowerCase()} clients in need: ${target.label}`;
  if (mode === "value" && descriptor) return `Highest ${descriptor.toLowerCase()} need value: ${target.label}`;
  if (mode === "value") return `Highest replacement-need value: ${target.label}`;
  if (mode === "need") return `Most clients in replacement need: ${target.label}`;
  return `Most clients: ${target.label}`;
}

export function MapCompassRuntimeV10934() {
  const pathname = usePathname();
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [bearing, setBearing] = useState(0);
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState("No active section");
  const [accentColor, setAccentColor] = useState("#67d8ff");
  const bearingRef = useRef(0);

  useEffect(() => {
    if (!pathname.startsWith("/map")) {
      setTargetElement(null);
      return;
    }
    const syncTarget = () => setTargetElement(document.querySelector<HTMLElement>(".territory-map-page .territory-donut-wrap"));
    syncTarget();
    const timer = window.setInterval(syncTarget, 500);
    return () => window.clearInterval(timer);
  }, [pathname]);

  useEffect(() => {
    if (!targetElement) return;
    let frame = 0;
    const sync = () => {
      frame = 0;
      const donut = targetElement.querySelector<SVGSVGElement>(".territory-donut");
      if (!donut) return;
      const mode = loadMapLensDisplayMode();
      const descriptor = loadMapLensState().segmentIds.length ? primaryMapSegmentDescriptor() || "segment" : "";
      const next = targetFor(donut);
      let smooth = next.bearing;
      const current = bearingRef.current;
      while (smooth - current > 180) smooth -= 360;
      while (smooth - current < -180) smooth += 360;
      bearingRef.current = smooth;
      setBearing(smooth);
      setActive(next.active);
      setLabel(next.label);
      setAccentColor(next.color);
      targetElement.dataset.mapDisplayLabel = explanatoryLabel(mode, next, descriptor);
    };
    const queue = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    const observer = new MutationObserver(queue);
    const donut = targetElement.querySelector(".territory-donut");
    if (donut) observer.observe(donut, { childList: true, subtree: true, attributes: true, attributeFilter: ["d", "aria-label", "class"] });
    window.addEventListener(MAP_LENS_CHANGE_EVENT, queue);
    window.addEventListener(MAP_MODE_RENDERED_EVENT, queue);
    window.addEventListener("client-compass-data-changed", queue);
    const safety = window.setInterval(queue, 1200);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.clearInterval(safety);
      window.removeEventListener(MAP_LENS_CHANGE_EVENT, queue);
      window.removeEventListener(MAP_MODE_RENDERED_EVENT, queue);
      window.removeEventListener("client-compass-data-changed", queue);
    };
  }, [targetElement]);

  return targetElement ? createPortal(
    <svg className="territory-compass-overlay-v10936" viewBox="0 0 208 208" aria-hidden="true">
      <TerritoryCompassHub bearing={bearing} active={active} accentColor={accentColor} title={`Compass target: ${label}`} />
    </svg>,
    targetElement,
  ) : null;
}
