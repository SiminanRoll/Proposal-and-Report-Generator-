"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { loadMapLensDisplayMode, MAP_LENS_CHANGE_EVENT } from "@/lib/segments/map-lens";
import { TerritoryCompassHub } from "./territory-compass-hub";

const CENTER = 104;
const SEGMENTS_CHANGE_EVENT = "client-compass-segments-changed";
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

type ArcMetric = { state: string; sweep: number; midpoint: number };
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

function arcFromPath(path: SVGPathElement): ArcMetric | null {
  const state = stateFromLabel(path.getAttribute("aria-label") || "");
  if (!state) return null;
  const values = (path.getAttribute("d") || "").match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (values.length < 9) return null;
  const start = Math.atan2(values[1] - CENTER, values[0] - CENTER) * 180 / Math.PI;
  let end = Math.atan2(values[8] - CENTER, values[7] - CENTER) * 180 / Math.PI;
  while (end <= start) end += 360;
  const sweep = Math.max(0, end - start);
  return { state, sweep, midpoint: start + sweep / 2 };
}

function targetFor(donut: SVGSVGElement): DonutTarget {
  const arcs = Array.from(donut.querySelectorAll<SVGPathElement>(".territory-donut-slice"))
    .map(arcFromPath)
    .filter((arc): arc is ArcMetric => Boolean(arc && arc.sweep > 0));

  if (!arcs.length) return { bearing: 0, label: "No active group", active: false };

  const groups = new Map<string, { sweep: number; x: number; y: number }>();
  for (const arc of arcs) {
    const key = groupKey(arc.state);
    const radians = arc.midpoint * Math.PI / 180;
    const current = groups.get(key) ?? { sweep: 0, x: 0, y: 0 };
    current.sweep += arc.sweep;
    current.x += Math.cos(radians) * arc.sweep;
    current.y += Math.sin(radians) * arc.sweep;
    groups.set(key, current);
  }

  const winner = [...groups.entries()].sort((left, right) => right[1].sweep - left[1].sweep)[0];
  if (!winner) return { bearing: 0, label: "No active group", active: false };
  const [key, span] = winner;
  const midpoint = Math.atan2(span.y, span.x) * 180 / Math.PI;
  return {
    bearing: normalizeAngle(midpoint + 90),
    label: COMPASS_GROUP_LABELS[key] ?? key,
    active: true,
  };
}

function centerModeLabel(): string {
  if (loadMapLensDisplayMode() === "segments") return "Segment";
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".territory-map-toggle button"));
  const activeIndex = buttons.findIndex((button) => button.classList.contains("is-active"));
  if (activeIndex === 2) return "Value";
  if (activeIndex === 1) return "Need";
  return "All";
}

function donutDataSignature(donut: SVGSVGElement): string {
  const total = donut.querySelector<SVGTextElement>(".territory-donut-total")?.textContent?.trim() ?? "";
  const slices = Array.from(donut.querySelectorAll<SVGPathElement>(".territory-donut-slice"))
    .map((slice) => slice.getAttribute("aria-label") || "")
    .join("|");
  return `${total}::${slices}`;
}

export function MapCorrectionsV10937() {
  const pathname = usePathname();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [bearing, setBearing] = useState(0);
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState("No active group");
  const [centerLabel, setCenterLabel] = useState("All");
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
    const donut = target.querySelector<SVGSVGElement>(".territory-donut");
    if (!donut) return;

    const sync = () => {
      frame = 0;
      const next = targetFor(donut);
      let smooth = next.bearing;
      const current = bearingRef.current;
      while (smooth - current > 180) smooth -= 360;
      while (smooth - current < -180) smooth += 360;
      bearingRef.current = smooth;
      setBearing(smooth);
      setActive(next.active);
      setLabel(next.label);
      setCenterLabel(centerModeLabel());
    };
    const queueSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };
    const onToggleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".territory-map-toggle button")) return;
      window.setTimeout(queueSync, 0);
    };

    sync();
    const observer = new MutationObserver(queueSync);
    observer.observe(donut, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["aria-label"] });
    document.addEventListener("click", onToggleClick, true);
    window.addEventListener(MAP_LENS_CHANGE_EVENT, queueSync);
    window.addEventListener(SEGMENTS_CHANGE_EVENT, queueSync);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("click", onToggleClick, true);
      window.removeEventListener(MAP_LENS_CHANGE_EVENT, queueSync);
      window.removeEventListener(SEGMENTS_CHANGE_EVENT, queueSync);
    };
  }, [target]);

  useEffect(() => {
    if (!pathname.startsWith("/map")) return;
    let frame = 0;
    let token = 0;
    let activeLayout: HTMLElement | null = null;

    const finish = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      activeLayout?.classList.remove("is-map-settling-v10937");
      activeLayout = null;
    };

    const begin = () => {
      token += 1;
      const currentToken = token;
      const layout = document.querySelector<HTMLElement>(".territory-map-layout");
      const donut = document.querySelector<SVGSVGElement>(".territory-donut");
      if (!layout || !donut) return;
      if (activeLayout && activeLayout !== layout) activeLayout.classList.remove("is-map-settling-v10937");
      activeLayout = layout;
      layout.classList.add("is-map-settling-v10937");

      const baseline = donutDataSignature(donut);
      let last = baseline;
      let sawRealUpdate = false;
      let stableFrames = 0;
      const started = performance.now();

      const settle = () => {
        if (currentToken !== token) return;
        const liveDonut = document.querySelector<SVGSVGElement>(".territory-donut");
        const current = liveDonut ? donutDataSignature(liveDonut) : "";
        if (current !== last) {
          last = current;
          sawRealUpdate = true;
          stableFrames = 0;
        } else if (sawRealUpdate) {
          stableFrames += 1;
        }

        if ((sawRealUpdate && stableFrames >= 2) || performance.now() - started > 1200) {
          finish();
          return;
        }
        frame = window.requestAnimationFrame(settle);
      };

      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(settle);
    };

    window.addEventListener(MAP_LENS_CHANGE_EVENT, begin);
    window.addEventListener(SEGMENTS_CHANGE_EVENT, begin);
    return () => {
      token += 1;
      finish();
      window.removeEventListener(MAP_LENS_CHANGE_EVENT, begin);
      window.removeEventListener(SEGMENTS_CHANGE_EVENT, begin);
    };
  }, [pathname]);

  return target ? createPortal(<>
    <svg className="territory-compass-overlay-v10937" viewBox="0 0 208 208" aria-hidden="true">
      <TerritoryCompassHub bearing={bearing} active={active} title={`Compass points to highest grouped map section: ${label}`} />
    </svg>
    <div className="territory-donut-center-label-v10937" aria-hidden="true">{centerLabel}</div>
  </>, target) : null;
}
