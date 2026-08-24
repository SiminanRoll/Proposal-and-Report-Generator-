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

function countLabel(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: value >= 1000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function relativeTime(value: string | null): string {
  if (!value) return "No recent located activity recorded";
  const at = new Date(value).getTime();
  if (!Number.isFinite(at)) return "Activity time unavailable";
  const minutes = Math.max(0, Math.floor((Date.now() - at) / 60000));
  if (minutes < 2) return "Activity observed just now";
  if (minutes < 60) return `Activity observed ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `Activity observed ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Activity observed ${days}d ago`;
}

export default function SignalGeographyMapPage() {
  const [payload, setPayload] = useState<SourceGeoPayload | null>(null);
  const [focusedState, setFocusedState] = useState<string | null>(null);
  const [pinnedState, setPinnedState] = useState<string | null>(null);

  useEffect(() => {
    const origin = window.location.origin;
    const receive = (event: MessageEvent<SourceGeoMessage>) => {
      if (event.origin !== origin || event.data?.type !== "signal-geography:data") return;
      setPayload(event.data.payload);
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
  const activeCode = pinnedState ?? focusedState ?? fallbackActive;
  const activeState = activeCode ? states.find((state) => state.code === activeCode) ?? null : null;
  const accent = payload?.accent ?? "#55d6e9";

  const handleKey = (event: KeyboardEvent<SVGGElement>, code: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setPinnedState((current) => current === code ? null : code);
  };

  const surfaceStyle = { "--source-accent": accent } as CSSProperties;

  return (
    <main className={styles.page} style={surfaceStyle}>
      <section className={styles.surface}>
        <div className={styles.mapColumn}>
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
                  onMouseEnter={() => setFocusedState(state.code)}
                  onMouseLeave={() => setFocusedState(null)}
                  onFocus={() => setFocusedState(state.code)}
                  onBlur={() => setFocusedState(null)}
                  onClick={() => setPinnedState((current) => current === state.code ? null : state.code)}
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
        </div>

        <aside className={styles.intelligencePanel} aria-live="polite">
          <div className={styles.sourceKicker}>Geographic Signal View</div>
          <h1>{payload?.sourceLabel ?? "Selected Source"}</h1>
          <p className={styles.mapNote}>{payload?.note ?? "Waiting for live geographic signal data."}</p>

          <div className={styles.summaryGrid}>
            <div><b>{payload?.totals.statesActive ?? 0}</b><span>states active</span></div>
            <div><b>{countLabel(payload?.totals.primary ?? 0)}</b><span>{payload?.primaryLabel ?? "signals"} · {payload?.rangeLabel ?? "—"}</span></div>
            <div><b>{countLabel(payload?.totals.secondary ?? 0)}</b><span>{payload?.secondaryLabel ?? "qualified"}</span></div>
          </div>

          {payload?.unavailable ? (
            <div className={styles.emptyState}>No geographic feed is connected for this source yet. The source remains visible in Route View, but there is no state-level evidence to plot.</div>
          ) : activeState ? (
            <div className={styles.stateCard}>
              <div className={styles.stateCardHeader}>
                <div>
                  <span>{activeState.active ? "STATE ACTIVITY" : "NO LOCATED ACTIVITY"}</span>
                  <h2>{activeState.name}</h2>
                </div>
                <strong>{countLabel(activeState.primary)}<small>{payload?.primaryLabel ?? "signals"}</small></strong>
              </div>
              <div className={styles.stateMetrics}>
                <div><b>{countLabel(activeState.primary)}</b><span>{payload?.primaryLabel ?? "signals"}</span></div>
                <div><b>{countLabel(activeState.secondary)}</b><span>{payload?.secondaryLabel ?? "qualified"}</span></div>
                <div><b>{countLabel(activeState.tertiary)}</b><span>{payload?.tertiaryLabel ?? "working"}</span></div>
              </div>
              <div className={styles.stateStatus}><i />{relativeTime(activeState.lastActivity)}</div>
            </div>
          ) : (
            <div className={styles.emptyState}>No state-level activity was resolved for {payload?.sourceLabel ?? "this source"} in the current window.</div>
          )}

          {(payload?.totals.unlocated ?? 0) > 0 && (
            <div className={styles.unlocated}>{countLabel(payload?.totals.unlocated ?? 0)} source records are not plotted because their state could not be resolved from the retained evidence.</div>
          )}
        </aside>
      </section>
    </main>
  );
}
