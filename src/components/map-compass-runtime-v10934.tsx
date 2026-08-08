"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { loadMapLensDisplayMode, loadMapLensState, MAP_LENS_CHANGE_EVENT, MAP_MODE_RENDERED_EVENT, type MapLensDisplayMode } from "@/lib/segments/map-lens";
import { TerritoryCompassHub } from "./territory-compass-hub";

const STATE_GROUPS = [new Set(["TN", "KY", "AL"]), new Set(["IN", "OH"])] as const;
const COMPASS_GROUP_LABELS: Record<string, string> = {
  MI: "Michigan",
  "IN+OH": "Ohio / Indiana",
  GA: "Georgia",
  FL: "Florida",
  "AL+KY+TN": "Alabama / Tennessee / Kentucky",
  IL: "Illinois",
  WI: "Wisconsin",
};
const STATE_NAMES: Array<[RegExp, string]> = [
  [/^Wisconsin\b/i, "WI"], [/^Michigan\b/i, "MI"], [/^Illinois\b/i, "IL"], [/^Indiana\b/i, "IN"], [/^Ohio\b/i, "OH"],
  [/^Kentucky\b/i, "KY"], [/^Tennessee\b/i, "TN"], [/^Alabama\b/i, "AL"], [/^Georgia\b/i, "GA"], [/^Florida\b/i, "FL"],
];

type SliceSpan = { state: string; label: string; color: string; start: number; end: number; sweep: number };
type DonutTarget = { bearing: number; label: string; active: boolean; color: string };

function stateFromLabel(label: string): string {
  return STATE_NAMES.find(([pattern]) => pattern.test(label))?.[1] ?? "";
}

function groupKey(span: SliceSpan, mode: MapLensDisplayMode): string {
  if ((mode === "segments" || mode === "value") && span.state === "FL") return `FL:${span.label}`;
  const group = STATE_GROUPS.find((candidate) => candidate.has(span.state));
  return group ? [...group].sort().join("+") : span.state;
}

function groupLabel(key: string): string {
  if (key.startsWith("FL:")) return key.slice(3);
  return COMPASS_GROUP_LABELS[key] ?? key;
}

function normalizeBearing(angle: number): number {
  let next = angle;
  while (next < -180) next += 360;
  while (next >= 180) next -= 360;
  return next;
}

function parseCompactValue(raw: string): number {
  const clean = raw.trim().replace(/[$,\s]/g, "").toUpperCase();
  if (!clean) return 0;
  const multiplier = clean.endsWith("B") ? 1_000_000_000 : clean.endsWith("M") ? 1_000_000 : clean.endsWith("K") ? 1_000 : 1;
  const numeric = Number(multiplier === 1 ? clean : clean.slice(0, -1));
  return Number.isFinite(numeric) ? Math.max(0, numeric * multiplier) : 0;
}

function parseCount(raw: string): number {
  const match = raw.match(/[\d,]+/);
  return match ? Number(match[0].replace(/,/g, "")) || 0 : 0;
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
    const state = stateFromLabel(label);
    const sweep = renderedSweep(path);
    if (!state || !(sweep > 0)) continue;
    spans.push({ state, label, color: path.getAttribute("fill") || "#67d8ff", start: cursor, end: cursor + sweep, sweep });
    cursor += sweep;
  }
  return spans;
}

function selectedStates(): Set<string> {
  return new Set(loadMapLensState().states);
}

function selectedSectionForMode(spans: SliceSpan[], mode: MapLensDisplayMode): SliceSpan | null {
  const selected = selectedStates();
  if (!selected.size) return null;
  const map = document.querySelector(".territory-regional-map");
  if (!map) return null;

  let winner: { label: string; metric: number } | null = null;
  map.querySelectorAll<SVGGElement>(".territory-map-region").forEach((region) => {
    const group = region.closest(".territory-map-state");
    const stateLabel = group?.querySelector<SVGTextElement>(".territory-map-region-label")?.textContent?.trim() || "";
    const state = stateLabel.slice(0, 2).toUpperCase();
    if (!selected.has(state)) return;

    const title = region.querySelector("title")?.textContent || "";
    const parts = title.split(" · ");
    const label = parts[0]?.trim() || region.getAttribute("aria-label")?.split(":")[0]?.trim() || "";
    if (!label) return;

    const metric = mode === "value"
      ? parseCompactValue(parts.at(-1) || "")
      : mode === "need"
        ? parseCount(parts[2] || "")
        : parseCount(parts[1] || "");
    if (!winner || metric > winner.metric) winner = { label, metric };
  });

  if (!winner) return null;
  return spans.find((span) => span.label === winner?.label) ?? null;
}

function targetFor(donut: SVGSVGElement, mode: MapLensDisplayMode): DonutTarget {
  const spans = renderedSpans(donut);
  if (!spans.length) return { bearing: 0, label: "No active group", active: false, color: "#67d8ff" };

  const selectedSection = selectedSectionForMode(spans, mode);
  if (selectedSection) {
    const midpoint = selectedSection.start + selectedSection.sweep / 2;
    return {
      bearing: normalizeBearing(midpoint + 90),
      label: selectedSection.label,
      active: true,
      color: brightenHex(selectedSection.color),
    };
  }

  const groups = new Map<string, { start: number; end: number; sweep: number }>();
  for (const span of spans) {
    const key = groupKey(span, mode);
    const current = groups.get(key);
    if (current) {
      current.end = span.end;
      current.sweep += span.sweep;
    } else {
      groups.set(key, { start: span.start, end: span.end, sweep: span.sweep });
    }
  }

  const winner = [...groups.entries()].sort((left, right) => right[1].sweep - left[1].sweep)[0];
  if (!winner) return { bearing: 0, label: "No active group", active: false, color: "#67d8ff" };
  const [key, span] = winner;
  const midpoint = span.start + span.sweep / 2;
  const centerSlice = spans.find((slice) => midpoint >= slice.start && midpoint <= slice.end) ?? spans.find((slice) => groupKey(slice, mode) === key);

  return {
    bearing: normalizeBearing(midpoint + 90),
    label: groupLabel(key),
    active: true,
    color: brightenHex(centerSlice?.color || "#67d8ff"),
  };
}

function explanatoryLabel(mode: MapLensDisplayMode, target: DonutTarget): string {
  if (!target.active) return "Compass · No active group";
  if (mode === "segments") return `Most segment clients · ${target.label}`;
  if (mode === "value") return `Highest value · ${target.label}`;
  if (mode === "need") return `Most clients in need · ${target.label}`;
  return `Most clients · ${target.label}`;
}

export function MapCompassRuntimeV10934() {
  const pathname = usePathname();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [bearing, setBearing] = useState(0);
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState("No active group");
  const [accentColor, setAccentColor] = useState("#67d8ff");
  const bearingRef = useRef(0);

  useEffect(() => {
    if (!pathname.startsWith("/map")) {
      setTarget(null);
      return;
    }
    const syncTarget = () => {
      const wrap = document.querySelector<HTMLElement>(".territory-donut-wrap");
      const page = wrap?.closest(".territory-map-page");
      setTarget(page ? wrap : null);
    };
    syncTarget();
    const timer = window.setInterval(syncTarget, 400);
    return () => window.clearInterval(timer);
  }, [pathname]);

  useEffect(() => {
    if (!target) return;
    let frame = 0;
    let settleFrame = 0;
    const sync = () => {
      frame = 0;
      settleFrame = 0;
      const donut = target.querySelector<SVGSVGElement>(".territory-donut");
      if (!donut) return;
      const mode = loadMapLensDisplayMode();
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
      target.dataset.mapDisplayLabel = explanatoryLabel(mode, next);
    };
    const queueSync = () => {
      if (frame || settleFrame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        settleFrame = window.requestAnimationFrame(sync);
      });
    };
    const onMetricClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest(".territory-map-toggle button") && !event.target.closest(".territory-map-region") && !event.target.closest(".map-lens-where")) return;
      queueSync();
    };

    sync();
    document.addEventListener("click", onMetricClick, true);
    window.addEventListener(MAP_LENS_CHANGE_EVENT, queueSync);
    window.addEventListener(MAP_MODE_RENDERED_EVENT, queueSync);
    window.addEventListener("client-compass-data-changed", queueSync);
    window.addEventListener("client-compass-segments-changed", queueSync);
    const safety = window.setInterval(queueSync, 1200);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (settleFrame) window.cancelAnimationFrame(settleFrame);
      window.clearInterval(safety);
      document.removeEventListener("click", onMetricClick, true);
      window.removeEventListener(MAP_LENS_CHANGE_EVENT, queueSync);
      window.removeEventListener(MAP_MODE_RENDERED_EVENT, queueSync);
      window.removeEventListener("client-compass-data-changed", queueSync);
      window.removeEventListener("client-compass-segments-changed", queueSync);
    };
  }, [target]);

  return target ? createPortal(<svg className="territory-compass-overlay-v10936" viewBox="0 0 208 208" aria-hidden="true">
    <TerritoryCompassHub bearing={bearing} active={active} accentColor={accentColor} title={`Compass target: ${label}`} />
  </svg>, target) : null;
}
