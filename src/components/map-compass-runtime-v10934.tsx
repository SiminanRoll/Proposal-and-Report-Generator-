"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { TerritoryCompassHub } from "./territory-compass-hub";

const SVG_NS = "http://www.w3.org/2000/svg";
const CENTER = 104;
const STATE_GROUPS = [new Set(["TN", "KY", "AL"]), new Set(["IN", "OH"])] as const;
const STATE_NAMES: Array<[RegExp, string]> = [
  [/^Wisconsin\b/i, "WI"], [/^Michigan\b/i, "MI"], [/^Illinois\b/i, "IL"], [/^Indiana\b/i, "IN"], [/^Ohio\b/i, "OH"],
  [/^Kentucky\b/i, "KY"], [/^Tennessee\b/i, "TN"], [/^Alabama\b/i, "AL"], [/^Georgia\b/i, "GA"], [/^Florida\b/i, "FL"],
];

type SliceArc = { state: string; start: number; end: number; sweep: number };

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
  const label = path.getAttribute("aria-label") || "";
  const state = stateFromLabel(label);
  if (!state) return null;
  const values = (path.getAttribute("d") || "").match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (values.length < 9) return null;
  const start = Math.atan2(values[1] - CENTER, values[0] - CENTER) * 180 / Math.PI;
  let end = Math.atan2(values[8] - CENTER, values[7] - CENTER) * 180 / Math.PI;
  while (end <= start) end += 360;
  return { state, start, end, sweep: Math.max(0, end - start) };
}

function targetFor(donut: SVGSVGElement): { bearing: number; label: string; active: boolean } {
  const arcs = Array.from(donut.querySelectorAll<SVGPathElement>(".territory-donut-slice")).map(arcFromPath).filter((arc): arc is SliceArc => Boolean(arc));
  if (!arcs.length) return { bearing: 0, label: "No active group", active: false };
  const groups = new Map<string, { states: string[]; start: number; end: number; sweep: number }>();
  for (const arc of arcs) {
    const key = groupKey(arc.state);
    const current = groups.get(key);
    if (!current) {
      groups.set(key, { states: [arc.state], start: arc.start, end: arc.end, sweep: arc.sweep });
      continue;
    }
    current.end = Math.max(current.end, arc.end);
    current.sweep += arc.sweep;
    if (!current.states.includes(arc.state)) current.states.push(arc.state);
  }
  const winner = [...groups.values()].sort((left, right) => right.sweep - left.sweep)[0];
  if (!winner) return { bearing: 0, label: "No active group", active: false };
  const midpoint = winner.start + (winner.end - winner.start) / 2;
  return { bearing: normalizeAngle(midpoint + 90), label: winner.states.join(" / "), active: true };
}

export function MapCompassRuntimeV10934() {
  const pathname = usePathname();
  const [target, setTarget] = useState<SVGGElement | null>(null);
  const [bearing, setBearing] = useState(0);
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState("No active group");
  const bearingRef = useRef(0);

  useEffect(() => {
    if (!pathname.startsWith("/map")) {
      setTarget(null);
      return;
    }

    let frame = 0;
    let retryFrame = 0;
    let retryCount = 0;

    const sync = () => {
      frame = 0;
      const donut = document.querySelector<SVGSVGElement>(".territory-donut");
      if (!donut) {
        setTarget(null);
        if (retryCount < 8) {
          retryCount += 1;
          retryFrame = window.requestAnimationFrame(sync);
        }
        return;
      }
      retryCount = 0;
      if (donut.querySelector(".territory-compass-hub")) {
        setTarget(null);
        return;
      }
      let host = donut.querySelector<SVGGElement>(".territory-compass-portal-v10934");
      if (!host) {
        host = document.createElementNS(SVG_NS, "g");
        host.classList.add("territory-compass-portal-v10934");
        const text = donut.querySelector(".territory-donut-total");
        donut.insertBefore(host, text ?? null);
      }
      const next = targetFor(donut);
      let smooth = next.bearing;
      const current = bearingRef.current;
      while (smooth - current > 180) smooth -= 360;
      while (smooth - current < -180) smooth += 360;
      bearingRef.current = smooth;
      setBearing(smooth);
      setActive(next.active);
      setLabel(next.label);
      setTarget(host);
    };

    const queueSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    const queueAfterMapAction = (event: Event) => {
      const node = event.target instanceof Element ? event.target : null;
      if (!node?.closest(".territory-map-page")) return;
      window.requestAnimationFrame(queueSync);
    };

    sync();
    document.addEventListener("click", queueAfterMapAction, true);
    window.addEventListener("client-compass-map-lens-changed", queueSync);
    window.addEventListener("client-compass-data-changed", queueSync);
    window.addEventListener("storage", queueSync);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (retryFrame) window.cancelAnimationFrame(retryFrame);
      document.removeEventListener("click", queueAfterMapAction, true);
      window.removeEventListener("client-compass-map-lens-changed", queueSync);
      window.removeEventListener("client-compass-data-changed", queueSync);
      window.removeEventListener("storage", queueSync);
    };
  }, [pathname]);

  return target ? createPortal(<TerritoryCompassHub bearing={bearing} active={active} title={`Compass points to highest grouped map section: ${label}`} />, target) : null;
}
