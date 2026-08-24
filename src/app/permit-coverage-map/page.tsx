"use client";

import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { SERVICE_STATE_GEOMETRIES, SERVICE_STATE_ORDER } from "@/lib/compass/service-area-map";
import styles from "./permit-coverage-map.module.css";

type ClerkSource = {
  key: string;
  label: string;
  jurisdiction: string;
  health: string;
  lastScan: string | null;
  permitsScanned: number;
};

type StateCoverage = {
  code: string;
  name: string;
  connected: boolean;
  clerkCount: number;
  healthyCount: number;
  leadCount: number;
  permitsScanned: number;
  lastScan: string | null;
  clerks: ClerkSource[];
};

type PermitCoveragePayload = {
  rangeLabel: string;
  totalLeads: number;
  totalClerks: number;
  connectedStates: number;
  states: StateCoverage[];
};

type PermitMapMessage = {
  type: "permit-map:data";
  payload: PermitCoveragePayload;
};

const STATE_NAMES: Record<string, string> = {
  WI: "Wisconsin", MI: "Michigan", IL: "Illinois", IN: "Indiana", OH: "Ohio",
  KY: "Kentucky", TN: "Tennessee", AL: "Alabama", GA: "Georgia", FL: "Florida",
};

const STATE_ACCENTS: Record<string, string> = {
  WI: "#55c8f2", MI: "#55ddbd", IL: "#8392ff", IN: "#f0c56a", OH: "#ef8d91",
  KY: "#70c9a8", TN: "#4ed2cf", AL: "#62cfa0", GA: "#e7a06d", FL: "#9a86ff",
};

const LABEL_OVERRIDES: Record<string, { x: number; y: number }> = {
  MI: { x: 450, y: 136 },
  FL: { x: 548, y: 506 },
};

const VIEWBOX = "274 0 354 610";

function relativeTime(value: string | null): string {
  if (!value) return "No successful scan recorded";
  const at = new Date(value).getTime();
  if (!Number.isFinite(at)) return "Scan time unavailable";
  const minutes = Math.max(0, Math.floor((Date.now() - at) / 60000));
  if (minutes < 2) return "Scanned just now";
  if (minutes < 60) return `Scanned ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `Scanned ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Scanned ${days}d ago`;
}

function stateHealth(state: StateCoverage): "healthy" | "warning" | "off" {
  if (!state.connected) return "off";
  return state.healthyCount === state.clerkCount ? "healthy" : "warning";
}

export default function PermitCoverageMapPage() {
  const [payload, setPayload] = useState<PermitCoveragePayload | null>(null);
  const [focusedState, setFocusedState] = useState<string | null>(null);
  const [pinnedState, setPinnedState] = useState<string | null>(null);

  useEffect(() => {
    const origin = window.location.origin;
    const receive = (event: MessageEvent<PermitMapMessage>) => {
      if (event.origin !== origin || event.data?.type !== "permit-map:data") return;
      setPayload(event.data.payload);
      setPinnedState((current) => current && event.data.payload.states.some((state) => state.code === current) ? current : null);
    };
    window.addEventListener("message", receive as EventListener);
    window.parent?.postMessage({ type: "permit-map:ready" }, origin);
    return () => window.removeEventListener("message", receive as EventListener);
  }, []);

  const states = useMemo(() => {
    const byCode = new Map((payload?.states ?? []).map((state) => [state.code, state]));
    return SERVICE_STATE_ORDER.map((code) => byCode.get(code) ?? {
      code,
      name: STATE_NAMES[code] ?? code,
      connected: false,
      clerkCount: 0,
      healthyCount: 0,
      leadCount: 0,
      permitsScanned: 0,
      lastScan: null,
      clerks: [],
    });
  }, [payload]);

  const activeCode = pinnedState ?? focusedState ?? states
    .filter((state) => state.connected)
    .sort((a, b) => b.leadCount - a.leadCount || b.clerkCount - a.clerkCount)[0]?.code ?? states[0]?.code;
  const activeState = states.find((state) => state.code === activeCode) ?? states[0];

  const handleKey = (event: KeyboardEvent<SVGGElement>, code: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setPinnedState((current) => current === code ? null : code);
  };

  return (
    <main className={styles.page}>
      <section className={styles.surface}>
        <div className={styles.mapColumn}>
          <div className={styles.mapGlow} aria-hidden="true" />
          <svg className={styles.map} viewBox={VIEWBOX} preserveAspectRatio="xMidYMid meet" aria-label="Permit clerk coverage by state">
            {states.map((state) => {
              const geometry = SERVICE_STATE_GEOMETRIES[state.code];
              if (!geometry) return null;
              const label = LABEL_OVERRIDES[state.code] ?? geometry.label;
              const health = stateHealth(state);
              const selected = state.code === activeCode;
              const style = { "--state-accent": STATE_ACCENTS[state.code] ?? "#62d7e9" } as CSSProperties;
              return (
                <g
                  key={state.code}
                  className={`${styles.state} ${styles[health]} ${selected ? styles.selected : ""}`}
                  style={style}
                  role="button"
                  tabIndex={0}
                  aria-label={`${state.name}: ${state.clerkCount} connected clerk offices, ${state.leadCount} permit leads`}
                  onMouseEnter={() => setFocusedState(state.code)}
                  onMouseLeave={() => setFocusedState(null)}
                  onFocus={() => setFocusedState(state.code)}
                  onBlur={() => setFocusedState(null)}
                  onClick={() => setPinnedState((current) => current === state.code ? null : state.code)}
                  onKeyDown={(event) => handleKey(event, state.code)}
                >
                  <path className={styles.statePath} d={geometry.path} />
                  <text className={styles.stateLabel} x={label.x} y={label.y - 3} textAnchor="middle">{state.code}</text>
                  <text className={styles.leadLabel} x={label.x} y={label.y + 11} textAnchor="middle">
                    {state.leadCount} {state.leadCount === 1 ? "lead" : "leads"}
                  </text>
                  {state.connected && <circle className={styles.connectionDot} cx={label.x + 22} cy={label.y - 8} r="3.2" />}
                </g>
              );
            })}
          </svg>
          <div className={styles.legend}>
            <span><i className={styles.connectedLegend} />Connected clerk coverage</span>
            <span><i className={styles.warningLegend} />Needs attention</span>
            <span>Lead count = current dashboard window</span>
          </div>
        </div>

        <aside className={styles.intelligencePanel} aria-live="polite">
          <div className={styles.summaryGrid}>
            <div><b>{payload?.connectedStates ?? 0}</b><span>states connected</span></div>
            <div><b>{payload?.totalClerks ?? 0}</b><span>clerk sources</span></div>
            <div><b>{payload?.totalLeads ?? 0}</b><span>permit leads · {payload?.rangeLabel ?? "—"}</span></div>
          </div>

          {activeState ? (
            <div className={styles.stateCard} style={{ "--state-accent": STATE_ACCENTS[activeState.code] ?? "#62d7e9" } as CSSProperties}>
              <div className={styles.stateCardHeader}>
                <div>
                  <span>{activeState.connected ? "CONNECTED COVERAGE" : "NO CONNECTED SOURCE"}</span>
                  <h2>{activeState.name}</h2>
                </div>
                <strong>{activeState.leadCount}<small>{activeState.leadCount === 1 ? "lead" : "leads"}</small></strong>
              </div>
              <div className={styles.stateMetrics}>
                <div><b>{activeState.clerkCount}</b><span>clerk sources</span></div>
                <div><b>{activeState.healthyCount}</b><span>current</span></div>
                <div><b>{activeState.permitsScanned.toLocaleString()}</b><span>permits scanned</span></div>
              </div>
              <div className={styles.lastScan}>{relativeTime(activeState.lastScan)}</div>
              <div className={styles.clerkList}>
                <span className={styles.listHeading}>Connected jurisdictions</span>
                {activeState.clerks.length ? activeState.clerks.map((clerk) => (
                  <div key={clerk.key} className={styles.clerkRow}>
                    <i data-health={clerk.health.toLowerCase()} />
                    <span><b>{clerk.jurisdiction || clerk.label}</b><small>{clerk.label !== clerk.jurisdiction ? clerk.label : relativeTime(clerk.lastScan)}</small></span>
                    <em>{clerk.permitsScanned.toLocaleString()}</em>
                  </div>
                )) : <p className={styles.empty}>No clerk office is connected in this state yet.</p>}
              </div>
              <p className={styles.hint}>{pinnedState === activeState.code ? "Click the state again to unpin." : "Hover a state for detail. Click to pin it."}</p>
            </div>
          ) : <div className={styles.waiting}>Waiting for live permit coverage data…</div>}
        </aside>
      </section>
    </main>
  );
}
