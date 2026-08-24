"use client";

import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { SERVICE_STATE_GEOMETRIES, SERVICE_STATE_ORDER } from "@/lib/compass/service-area-map";
import styles from "./signal-geography-map.module.css";

type StateSignalStats = {
  code: string;
  name: string;
  active: boolean;
  primary: number;
  secondary: number;
  tertiary: number;
  lastActivity: string | null;
};

type SourceGeoPayload = {
  sourceId: string;
  sourceLabel: string;
  accent: string;
  rangeLabel: string;
  primaryLabel: string;
  secondaryLabel: string;
  tertiaryLabel: string;
  note: string;
  unavailable?: boolean;
  totals: {
    statesActive: number;
    primary: number;
    secondary: number;
    tertiary: number;
    unlocated: number;
  };
  states: StateSignalStats[];
};

type SourceGeoMessage = {
  type: "signal-geography:data";
  payload: SourceGeoPayload;
};

const STATE_NAMES: Record<string, string> = {
  WI: "Wisconsin", MI: "Michigan", IL: "Illinois", IN: "Indiana", OH: "Ohio",
  KY: "Kentucky", TN: "Tennessee", AL: "Alabama", GA: "Georgia", FL: "Florida",
};

const LABEL_OVERRIDES: Record<string, { x: number; y: number }> = {
  MI: { x: 450, y: 136 },
  FL: { x: 548, y: 506 },
};

const VIEWBOX = "274 0 354 610";
const DEFAULT_ZOOM = 1.08;
const MIN_ZOOM = .86;
const MAX_ZOOM = 1.62;
const ZOOM_STEP = .12;

function countLabel(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: value >= 1000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

export default function SignalGeographyMapPage() {
  const [payload, setPayload] = useState<SourceGeoPayload | null>(null);
  const [focusedState, setFocusedState] = useState<string | null>(null);
  const [pinnedState, setPinnedState] = useState<string | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  useEffect(() => {
    const origin = window.location.origin;
    const receive = (event: MessageEvent<SourceGeoMessage>) => {
      if (event.origin !== origin || event.data?.type !== "signal-geography:data") return;
      setPayload(event.data.payload);
      setFocusedState(null);
      setPinnedState((current) => current && event.data.payload.states.some((state) => state.code === current) ? current : null);
    };
    window.addEventListener("message", receive as EventListener);
    window.parent?.postMessage({ type: "signal-geography:ready" }, origin);
    return () => window.removeEventListener("message", receive as EventListener);
  }, []);

  const states = useMemo(() => {
    const byCode = new Map((payload?.states ?? []).map((state) => [state.code, state]));
    return SERVICE_STATE_ORDER.map((code) => byCode.get(code) ?? {
      code,
      name: STATE_NAMES[code] ?? code,
      active: false,
      primary: 0,
      secondary: 0,
      tertiary: 0,
      lastActivity: null,
    });
  }, [payload]);

  const maxPrimary = Math.max(1, ...states.map((state) => state.primary));
  const fallbackActive = states
    .filter((state) => state.active)
    .sort((a, b) => b.primary - a.primary || b.secondary - a.secondary || b.tertiary - a.tertiary)[0]?.code ?? null;
  const activeCode = focusedState ?? pinnedState ?? fallbackActive;
  const accent = payload?.accent ?? "#55d6e9";
  const surfaceStyle = { "--source-accent": accent, "--map-zoom": zoom } as CSSProperties;

  const notifyParent = (state: StateSignalStats | null, pinned: boolean) => {
    if (!payload) return;
    window.parent?.postMessage({
      type: "signal-geography:state",
      payload: {
        sourceId: payload.sourceId,
        sourceLabel: payload.sourceLabel,
        primaryLabel: payload.primaryLabel,
        secondaryLabel: payload.secondaryLabel,
        tertiaryLabel: payload.tertiaryLabel,
        rangeLabel: payload.rangeLabel,
        note: payload.note,
        totals: payload.totals,
        state,
        pinned,
      },
    }, window.location.origin);
  };

  useEffect(() => {
    if (!payload) return;
    notifyParent(null, false);
    // A source/range refresh should reset the inline detail below the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload?.sourceId, payload?.rangeLabel]);

  const stateByCode = (code: string | null) => code ? states.find((state) => state.code === code) ?? null : null;

  const handleEnter = (code: string) => {
    setFocusedState(code);
    notifyParent(stateByCode(code), pinnedState === code);
  };

  const handleLeave = () => {
    setFocusedState(null);
    notifyParent(stateByCode(pinnedState), Boolean(pinnedState));
  };

  const togglePin = (code: string) => {
    const next = pinnedState === code ? null : code;
    setPinnedState(next);
    notifyParent(stateByCode(next), Boolean(next));
  };

  const handleKey = (event: KeyboardEvent<SVGGElement>, code: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    togglePin(code);
  };

  const changeZoom = (delta: number) => setZoom((current) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number((current + delta).toFixed(2)))));

  return (
    <main className={styles.page} style={surfaceStyle}>
      <section className={styles.surface}>
        <div className={styles.zoomControls} aria-label="Map zoom controls">
          <button type="button" aria-label="Zoom out" onClick={() => changeZoom(-ZOOM_STEP)}>−</button>
          <button type="button" className={styles.zoomReset} aria-label="Reset map zoom" onClick={() => setZoom(DEFAULT_ZOOM)}>{Math.round(zoom * 100)}%</button>
          <button type="button" aria-label="Zoom in" onClick={() => changeZoom(ZOOM_STEP)}>+</button>
        </div>

        <div className={styles.mapStage}>
          <div className={styles.mapGlow} aria-hidden="true" />
          <svg className={styles.map} viewBox={VIEWBOX} preserveAspectRatio="xMidYMid meet" aria-label={`${payload?.sourceLabel ?? "Selected source"} activity by state`}>
            {states.map((state) => {
              const geometry = SERVICE_STATE_GEOMETRIES[state.code];
              if (!geometry) return null;
              const label = LABEL_OVERRIDES[state.code] ?? geometry.label;
              const selected = state.code === activeCode;
              const strength = state.active ? Math.max(18, Math.min(78, 18 + (state.primary / maxPrimary) * 60)) : 0;
              const stateStyle = { "--state-strength": `${strength}%` } as CSSProperties;
              return (
                <g
                  key={state.code}
                  className={`${styles.state} ${state.active ? styles.active : ""} ${selected ? styles.selected : ""}`}
                  style={stateStyle}
                  role="button"
                  tabIndex={0}
                  aria-label={`${state.name}: ${state.primary} ${payload?.primaryLabel ?? "signals"}, ${state.secondary} ${payload?.secondaryLabel ?? "secondary"}`}
                  onMouseEnter={() => handleEnter(state.code)}
                  onMouseLeave={handleLeave}
                  onFocus={() => handleEnter(state.code)}
                  onBlur={handleLeave}
                  onClick={() => togglePin(state.code)}
                  onKeyDown={(event) => handleKey(event, state.code)}
                >
                  <path className={styles.statePath} d={geometry.path} />
                  <text className={styles.stateLabel} x={label.x} y={label.y - 3} textAnchor="middle">{state.code}</text>
                  <text className={styles.metricLabel} x={label.x} y={label.y + 10} textAnchor="middle">
                    {state.active ? `${countLabel(state.primary)} ${payload?.primaryLabel?.toLowerCase() ?? "signals"}` : ""}
                  </text>
                  {state.active && <circle className={styles.activityDot} cx={label.x + 23} cy={label.y - 8} r="3" />}
                </g>
              );
            })}
          </svg>

          {payload?.unavailable && (
            <div className={styles.emptyState}>No geographic feed is connected for this source yet.</div>
          )}
          {!payload?.unavailable && payload && payload.totals.statesActive === 0 && (
            <div className={styles.emptyState}>No state-level activity was resolved for this source in the current window.</div>
          )}
        </div>
      </section>
    </main>
  );
}
