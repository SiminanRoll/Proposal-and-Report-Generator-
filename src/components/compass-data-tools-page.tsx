"use client";

import { useMemo, useState } from "react";
import { CompassDataDialog } from "./compass-data-dialog";
import { CompassReviewHistoryDialog } from "./compass-review-history-dialog";
import { compassConfigFingerprint, COMPASS_CALCULATION_VERSION, recalculateDataset } from "@/lib/compass/engine";
import { saveCompassDataset, useCompassState } from "@/lib/compass/store";

function formatDateTime(value: string): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export function CompassDataToolsPage() {
  const { dataset, config, ready, refresh } = useCompassState();
  const [dataOpen, setDataOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const activeClients = useMemo(() => dataset ? dataset.clients.filter((client) => dataset.devices.some((device) => device.clientId === client.id)).length : 0, [dataset]);
  const current = Boolean(dataset && dataset.calculationVersion === COMPASS_CALCULATION_VERSION && dataset.calculationFingerprint === compassConfigFingerprint(config));

  const refreshCalculations = async () => {
    if (!dataset || refreshing) return;
    setRefreshing(true); setStatus(""); setError("");
    try {
      await saveCompassDataset(recalculateDataset(dataset, config));
      await refresh();
      setStatus("Calculations refreshed from the current browser snapshot.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not refresh the current snapshot.");
    } finally { setRefreshing(false); }
  };

  return <div className="compass-admin-page">
    <header className="compass-admin-hero">
      <span className="compass-kicker">Client Compass workspace</span>
      <h1>Data Tools</h1>
      <p>Keep the technical snapshot and client relationship dates current. These tools update the browser-local Client Compass workspace.</p>
    </header>

    <section className="compass-admin-status-grid" aria-label="Current data status">
      <article><span>Snapshot</span><strong>{dataset ? dataset.importSourceName || "Imported data" : "No data imported"}</strong><small>{dataset ? `Updated ${formatDateTime(dataset.importedAt)}` : "Import Ninja data to begin."}</small></article>
      <article><span>Active clients</span><strong>{dataset ? activeClients.toLocaleString() : "—"}</strong><small>{dataset ? `${dataset.devices.length.toLocaleString()} devices in the current snapshot` : "No current snapshot"}</small></article>
      <article><span>Calculations</span><strong className={current ? "is-current" : "is-attention"}>{dataset ? (current ? "Current" : "Refresh needed") : "Waiting for data"}</strong><small>{dataset ? `Calculation engine ${dataset.calculationVersion || "not recorded"}` : ""}</small></article>
    </section>

    <section className="compass-admin-card-grid">
      <article className="compass-admin-action-card">
        <div className="compass-admin-action-icon">↥</div><div><span className="compass-kicker">Technical snapshot</span><h2>Update Ninja data</h2><p>Replace or merge the current Ninja spreadsheet export while preserving matched client relationship history.</p></div>
        <button className="button primary" type="button" onClick={() => setDataOpen(true)}>Update data</button>
      </article>
      <article className="compass-admin-action-card">
        <div className="compass-admin-action-icon">◷</div><div><span className="compass-kicker">Relationship history</span><h2>{"Import review & quote dates"}</h2><p>Add newer account-review and quote dates in bulk without overwriting more recent information already in Client Compass.</p></div>
        <button className="button secondary" type="button" disabled={!dataset} onClick={() => setHistoryOpen(true)}>Import dates</button>
      </article>
      <article className="compass-admin-action-card">
        <div className="compass-admin-action-icon">↻</div><div><span className="compass-kicker">Current rules</span><h2>Refresh calculations</h2><p>Rebuild findings, project packages, card totals, and client priorities using the current Settings configuration.</p></div>
        <button className="button secondary" type="button" disabled={!dataset || refreshing} onClick={() => void refreshCalculations()}>{refreshing ? "Refreshing…" : "Refresh calculations"}</button>
      </article>
    </section>

    {!ready && <div className="compass-admin-message">Loading browser workspace…</div>}
    {status && <div className="compass-workspace-success" role="status">{status}</div>}
    {error && <div className="compass-import-error" role="alert">{error}</div>}

    <CompassDataDialog open={dataOpen} dataset={dataset} config={config} onClose={() => setDataOpen(false)} onCommitted={refresh} />
    <CompassReviewHistoryDialog open={historyOpen} dataset={dataset} config={config} onClose={() => setHistoryOpen(false)} onCommitted={refresh} />
  </div>;
}
