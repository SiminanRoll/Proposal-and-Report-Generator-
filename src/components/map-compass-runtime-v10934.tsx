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

function renderedNeedCounts(donut: SVGSVGElement): Map<string, number> {
  const page = donut.closest(".territory-map-page") ?? document;
  const counts = new Map<string, number>();
  page.querySelectorAll<SVGGElement>(".territory-map-region").forEach((region) => {
    const title = region.querySelector("title")?.textContent?.trim() || "";
    const match = /^(.*?)\s+·\s+[\d,]+\s+clients\s+·\s+([\d,]+)\s+in need\b/i.exec(title);
    if (!match) return;
    const label = match[1]?.trim() || "";
    const count = Number((match[2] || "0").replace(/,/g, ""));
    if (label && Number.isFinite(count)) counts.set(label, count);
  });
  return counts;
}

function targetFor(donut: SVGSVGElement, mode: MapLensDisplayMode): CompassTarget {
  const spans = renderedSpans(donut);
  if (!spans.length) return { bearing: 0, label: "No active section", active: false, color: "#67d8ff" };

  let winner: SliceSpan;
  if (mode === "clients") {
    // All means all clients, but the compass always answers the operational
    // question: which territory has the most qualified replacement Need?
    // The map-lens dataset already ignores saved segment rules in All mode.
    const needs = renderedNeedCounts(donut);
    const ranked = spans
      .map((span) => ({ span, need: needs.get(span.label) ?? 0 }))
      .sort((left, right) => right.need - left.need || right.span.sweep - left.span.sweep || left.span.label.localeCompare(right.span.label));
    if (!ranked.length || ranked[0].need <= 0) return { bearing: 0, label: "No active section", active: false, color: "#67d8ff" };
    winner = ranked[0].span;
  } else {
    // Need/Segment views render Need directly, so the largest rendered slice is
    // already the correct target. Never recombine visible pie sections.
    winner = spans.slice().sort((left, right) => right.sweep - left.sweep || left.label.localeCompare(right.label))[0];
  }

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
  return `Most clients in replacement need: ${target.label}`;
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
      const descriptor = mode === "segments" && loadMapLensState().segmentIds.length ? primaryMapSegmentDescriptor() || "segment" : "";
      const next = targetFor(donut, mode);
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
    const page = targetElement.closest(".territory-map-page");
    if (page) observer.observe(page, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["d", "aria-label", "class"] });
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
