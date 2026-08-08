"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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

type SliceMetric = { state: string; value: number; color: string };
type SliceSpan = SliceMetric & { start: number; end: number };
type DonutTarget = { bearing: number; label: string; active: boolean; color: string };

function stateFromLabel(label: string): string {
  return STATE_NAMES.find(([pattern]) => pattern.test(label))?.[1] ?? "";
}

function groupKey(state: string): string {
  const group = STATE_GROUPS.find((candidate) => candidate.has(state));
  return group ? [...group].sort().join("+") : state;
}

function normalizeAngle(angle: number): number {
  let next = angle;
  while (next < -90) next += 360;
  while (next >= 270) next -= 360;
  return next;
}

function parseCompactValue(raw: string): number {
  const clean = raw.trim().replace(/[$,\s]/g, "").toUpperCase();
  if (!clean) return 0;
  const multiplier = clean.endsWith("B") ? 1_000_000_000 : clean.endsWith("M") ? 1_000_000 : clean.endsWith("K") ? 1_000 : 1;
  const numeric = Number(multiplier === 1 ? clean : clean.slice(0, -1));
  return Number.isFinite(numeric) ? Math.max(0, numeric * multiplier) : 0;
}

function sliceMetric(path: SVGPathElement): SliceMetric | null {
  const label = path.getAttribute("aria-label") || "";
  const state = stateFromLabel(label);
  if (!state) return null;
  const valueText = label.slice(label.lastIndexOf(":") + 1);
  const value = parseCompactValue(valueText);
  if (!(value > 0)) return null;
  return { state, value, color: path.getAttribute("fill") || "#67d8ff" };
}

function brightenHex(color: string, amount = .28): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return color;
  const value = Number.parseInt(match[1], 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255]
    .map((channel) => Math.round(channel + (255 - channel) * amount));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function targetFor(donut: SVGSVGElement): DonutTarget {
  const metrics = Array.from(donut.querySelectorAll<SVGPathElement>(".territory-donut-slice"))
    .map(sliceMetric)
    .filter((slice): slice is SliceMetric => Boolean(slice));
  const total = metrics.reduce((sum, slice) => sum + slice.value, 0);
  if (!(total > 0)) return { bearing: 0, label: "No active group", active: false, color: "#67d8ff" };

  let angle = -90;
  const spans: SliceSpan[] = metrics.map((slice) => {
    const sweep = slice.value / total * 360;
    const span = { ...slice, start: angle, end: angle + sweep };
    angle += sweep;
    return span;
  });

  const groups = new Map<string, { start: number; end: number; value: number }>();
  for (const span of spans) {
    const key = groupKey(span.state);
    const current = groups.get(key);
    if (current) {
      current.end = span.end;
      current.value += span.value;
    } else {
      groups.set(key, { start: span.start, end: span.end, value: span.value });
    }
  }

  const winner = [...groups.entries()].sort((left, right) => right[1].value - left[1].value)[0];
  if (!winner) return { bearing: 0, label: "No active group", active: false, color: "#67d8ff" };
  const [key, span] = winner;
  const midpoint = span.start + (span.end - span.start) / 2;
  const centerSlice = spans.find((slice) => midpoint >= slice.start && midpoint <= slice.end) ?? spans.find((slice) => groupKey(slice.state) === key);

  return {
    bearing: normalizeAngle(midpoint + 90),
    label: COMPASS_GROUP_LABELS[key] ?? key,
    active: true,
    color: brightenHex(centerSlice?.color || "#67d8ff"),
  };
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
    const sync = () => {
      frame = 0;
      const donut = target.querySelector<SVGSVGElement>(".territory-donut");
      if (!donut) return;
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
    };
    const queueSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };
    const onMetricClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".territory-map-toggle button")) return;
      window.setTimeout(queueSync, 0);
    };

    sync();
    document.addEventListener("click", onMetricClick, true);
    window.addEventListener("client-compass-map-lens-changed", queueSync);
    window.addEventListener("client-compass-data-changed", queueSync);
    window.addEventListener("client-compass-segments-changed", queueSync);
    const safety = window.setInterval(queueSync, 900);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearInterval(safety);
      document.removeEventListener("click", onMetricClick, true);
      window.removeEventListener("client-compass-map-lens-changed", queueSync);
      window.removeEventListener("client-compass-data-changed", queueSync);
      window.removeEventListener("client-compass-segments-changed", queueSync);
    };
  }, [target]);

  return target ? createPortal(<svg className="territory-compass-overlay-v10936" viewBox="0 0 208 208" aria-hidden="true">
    <TerritoryCompassHub bearing={bearing} active={active} accentColor={accentColor} title={`Compass points to largest geographic group: ${label}`} />
  </svg>, target) : null;
}
