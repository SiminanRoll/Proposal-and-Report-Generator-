"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { TerritoryCompassHub } from "./territory-compass-hub";

const CENTER = 104;
const GEOGRAPHIC_STATE_ORDER = ["MI", "OH", "IN", "GA", "FL", "AL", "TN", "KY", "IL", "WI"] as const;
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

type SliceArc = { node: SVGPathElement; state: string; sweep: number; radius: number; index: number };
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

function polarPoint(cx: number, cy: number, radius: number, angle: number): [number, number] {
  const radians = angle * Math.PI / 180;
  return [cx + Math.cos(radians) * radius, cy + Math.sin(radians) * radius];
}

function donutPath(startAngle: number, endAngle: number, outerRadius: number, innerRadius = 54): string {
  const safeEnd = Math.min(endAngle, startAngle + 359.999);
  const [outerStartX, outerStartY] = polarPoint(CENTER, CENTER, outerRadius, startAngle);
  const [outerEndX, outerEndY] = polarPoint(CENTER, CENTER, outerRadius, safeEnd);
  const [innerEndX, innerEndY] = polarPoint(CENTER, CENTER, innerRadius, safeEnd);
  const [innerStartX, innerStartY] = polarPoint(CENTER, CENTER, innerRadius, startAngle);
  const large = safeEnd - startAngle > 180 ? 1 : 0;
  return `M${outerStartX},${outerStartY} A${outerRadius},${outerRadius} 0 ${large} 1 ${outerEndX},${outerEndY} L${innerEndX},${innerEndY} A${innerRadius},${innerRadius} 0 ${large} 0 ${innerStartX},${innerStartY} Z`;
}

function arcFromPath(path: SVGPathElement, index: number): SliceArc | null {
  const state = stateFromLabel(path.getAttribute("aria-label") || "");
  if (!state) return null;
  const values = (path.getAttribute("d") || "").match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (values.length < 9) return null;
  const start = Math.atan2(values[1] - CENTER, values[0] - CENTER) * 180 / Math.PI;
  let end = Math.atan2(values[8] - CENTER, values[7] - CENTER) * 180 / Math.PI;
  while (end <= start) end += 360;
  const radius = Math.max(1, Math.hypot(values[0] - CENTER, values[1] - CENTER));
  return { node: path, state, sweep: Math.max(0, end - start), radius, index };
}

function geographicRank(state: string): number {
  const index = GEOGRAPHIC_STATE_ORDER.indexOf(state as (typeof GEOGRAPHIC_STATE_ORDER)[number]);
  return index < 0 ? GEOGRAPHIC_STATE_ORDER.length : index;
}

function targetFor(donut: SVGSVGElement): DonutTarget {
  donut.querySelector(".territory-compass-portal-v10934")?.remove();
  const arcs = Array.from(donut.querySelectorAll<SVGPathElement>(".territory-donut-slice"))
    .map((path, index) => arcFromPath(path, index))
    .filter((arc): arc is SliceArc => Boolean(arc && arc.sweep > 0))
    .sort((left, right) => geographicRank(left.state) - geographicRank(right.state) || left.index - right.index);

  if (!arcs.length) return { bearing: 0, label: "No active group", active: false };
  const totalSweep = arcs.reduce((sum, arc) => sum + arc.sweep, 0) || 360;
  const groups = new Map<string, { start: number; end: number; sweep: number }>();
  const dividerAngles: number[] = [];
  let angle = -90;
  let previousGroup = "";

  for (const arc of arcs) {
    const sweep = arc.sweep / totalSweep * 360;
    const start = angle;
    const end = angle + sweep;
    const key = groupKey(arc.state);
    if (key !== previousGroup) dividerAngles.push(start);
    previousGroup = key;
    const current = groups.get(key);
    if (current) {
      current.end = end;
      current.sweep += sweep;
    } else {
      groups.set(key, { start, end, sweep });
    }
    const nextPath = donutPath(start, end, arc.radius);
    if (arc.node.getAttribute("d") !== nextPath) arc.node.setAttribute("d", nextPath);
    angle = end;
  }

  const dividers = Array.from(donut.querySelectorAll<SVGLineElement>(".territory-donut-state-divider"));
  dividers.forEach((line, index) => {
    const dividerAngle = dividerAngles[index];
    if (dividerAngle === undefined) {
      line.style.display = "none";
      return;
    }
    line.style.display = "";
    const [outerX, outerY] = polarPoint(CENTER, CENTER, 89, dividerAngle);
    const [innerX, innerY] = polarPoint(CENTER, CENTER, 52, dividerAngle);
    line.setAttribute("x1", String(innerX));
    line.setAttribute("y1", String(innerY));
    line.setAttribute("x2", String(outerX));
    line.setAttribute("y2", String(outerY));
  });

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
    const onPointerActivity = () => queueSync();
    sync();
    target.addEventListener("pointerover", onPointerActivity, true);
    target.addEventListener("pointerout", onPointerActivity, true);
    target.addEventListener("focusin", onPointerActivity, true);
    target.addEventListener("focusout", onPointerActivity, true);
    target.addEventListener("click", onPointerActivity, true);
    window.addEventListener("client-compass-map-lens-changed", queueSync);
    window.addEventListener("client-compass-data-changed", queueSync);
    window.addEventListener("client-compass-segments-changed", queueSync);
    const safety = window.setInterval(queueSync, 900);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearInterval(safety);
      target.removeEventListener("pointerover", onPointerActivity, true);
      target.removeEventListener("pointerout", onPointerActivity, true);
      target.removeEventListener("focusin", onPointerActivity, true);
      target.removeEventListener("focusout", onPointerActivity, true);
      target.removeEventListener("click", onPointerActivity, true);
      window.removeEventListener("client-compass-map-lens-changed", queueSync);
      window.removeEventListener("client-compass-data-changed", queueSync);
      window.removeEventListener("client-compass-segments-changed", queueSync);
    };
  }, [target]);

  return target ? createPortal(<svg className="territory-compass-overlay-v10936" viewBox="0 0 208 208" aria-hidden="true">
    <TerritoryCompassHub bearing={bearing} active={active} title={`Compass points to highest grouped map section: ${label}`} />
  </svg>, target) : null;
}
