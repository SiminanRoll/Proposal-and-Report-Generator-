"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { TerritoryCompassHub } from "./territory-compass-hub";

const CENTER = 104;
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

type SliceArc = { state: string; sweep: number };
type DonutTarget = { bearing: number; label: string; active: boolean };

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

function arcFromPath(path: SVGPathElement): SliceArc | null {
  const state = stateFromLabel(path.getAttribute("aria-label") || "");
  if (!state) return null;
  const values = (path.getAttribute("d") || "").match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (values.length < 9) return null;
  const start = Math.atan2(values[1] - CENTER, values[0] - CENTER) * 180 / Math.PI;
  let end = Math.atan2(values[8] - CENTER, values[7] - CENTER) * 180 / Math.PI;
  while (end <= start) end += 360;
  return { state, sweep: Math.max(0, end - start) };
}

function targetFor(donut: SVGSVGElement): DonutTarget {
  const arcs = Array.from(donut.querySelectorAll<SVGPathElement>(".territory-donut-slice"))
    .map(arcFromPath)
    .filter((arc): arc is SliceArc => Boolean(arc && arc.sweep > 0));

  if (!arcs.length) return { bearing: 0, label: "No active group", active: false };
  const totalSweep = arcs.reduce((sum, arc) => sum + arc.sweep, 0) || 360;
  const groups = new Map<string, { start: number; end: number; sweep: number }>();
  let angle = -90;

  for (const arc of arcs) {
    const sweep = arc.sweep / totalSweep * 360;
    const start = angle;
    const end = angle + sweep;
    const key = groupKey(arc.state);
    const current = groups.get(key);
    if (current) {
      current.end = end;
      current.sweep += sweep;
    } else {
      groups.set(key, { start, end, sweep });
    }
    angle = end;
  }

  const winner = [...groups.entries()].sort((left, right) => right[1].sweep - left[1].sweep)[0];
  if (!winner) return { bearing: 0, label: "No active group", active: false };
  const [key, span] = winner;
  const midpoint = span.start + span.sweep / 2;
  return { bearing: normalizeAngle(midpoint + 90), label: COMPASS_GROUP_LABELS[key] ?? key, active: true };
}

export function MapCompassRuntimeV10934() {
  const pathname = usePathname();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [bearing, setBearing] = useState(0);
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState("No active group");
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
    const timer = window.setInterval(syncTarget, 500);
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
    };
    const queueSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };
    const onMetricClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".territory-map-toggle button")) return;
      queueSync();
    };

    sync();
    document.addEventListener("click", onMetricClick, true);
    window.addEventListener("client-compass-map-lens-changed", queueSync);
    window.addEventListener("client-compass-data-changed", queueSync);
    window.addEventListener("client-compass-segments-changed", queueSync);
    const safety = window.setInterval(queueSync, 1200);
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
    <TerritoryCompassHub bearing={bearing} active={active} title={`Compass points to highest grouped map section: ${label}`} />
  </svg>, target) : null;
}
