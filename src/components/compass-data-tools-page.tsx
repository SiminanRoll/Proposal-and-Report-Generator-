"use client";

import { useMemo, useState } from "react";
import { CompassDataDialog } from "./compass-data-dialog";
import { CompassClientEnrichmentDialog } from "./compass-client-enrichment-dialog";
import { CompassClientWorkspace } from "./compass-client-workspace";
import { compassConfigFingerprint, COMPASS_CALCULATION_VERSION, recalculateDataset } from "@/lib/compass/engine";
import { saveCompassDataset, useCompassState } from "@/lib/compass/store";
import { mergeCaptainsLogSyncIntoClient, syncClientsFromCaptainsLog } from "@/lib/compass/captains-log-bridge";

function formatDateTime(value: string): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export function CompassDataToolsPage() {
  const { dataset, config, ready, refresh } = useCompassState();
  const [dataOpen, setDataOpen] = useState(false);
  const [enrichmentOpen, setEnrichmentOpen] = useState(false);
  const [reviewClientId, setReviewClientId] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [captainsLogSyncing, setCaptainsLogSyncing] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const activeClients = useMemo(() => dataset ? dataset.clients.filter((client) => dataset.devices.some((device) => device.clientId === client.id)).length : 0, [dataset]);
  const current = Boolean(dataset && dataset.calculationVersion === COMPASS_CALCULATION_VERSION && dataset.calculationFingerprint === compassConfigFingerprint(config));
  const recordReviewClients = useMemo(() => dataset ? dataset.clients.filter((client) => client.recordReviewNeeded).sort((a, b) => a.name.localeCompare(b.name)) : [], [dataset]);

  const syncAllCaptainsLogActivity = async () => {
    if (!dataset || captainsLogSyncing) return;
    setCaptainsLogSyncing(true); setStatus(""); setError("");
    try {
      const batch = await syncClientsFromCaptainsLog(dataset.clients.map((client) => ({ clientId: client.id, company: client.name, aliases: client.aliases, companyId: client.companyId })), 26000);
      const appliedResults = batch.results.filter((result) => result.ok && result.matched && result.client_id && result.synced_at);
      const byId = new Map(appliedResults.map((result) => [result.client_id!, result]));
      const clients = dataset.clients.map((client) => {
        const sync = byId.get(client.id);
        return sync ? mergeCaptainsLogSyncIntoClient(client, sync) : client;
      });
      const nextDataset = recalculateDataset({ ...dataset, clients }, config);
      await saveCompassDataset(nextDataset);
      await refresh();
      if (!appliedResults.length) throw new Error("Supabase history returned no client matches. No Client Compass records were changed.");
      const activityCount = appliedResults.reduce((sum, result) => sum + (result.recent_activity?.length || 0), 0);
      setStatus(`Synced ${activityCount.toLocaleString()} Captain's Log history record${activityCount === 1 ? "" : "s"} across ${appliedResults.length.toLocaleString()} matched client${appliedResults.length === 1 ? "" : "s"}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not refresh Supabase client history.");
    } finally {
      setCaptainsLogSyncing(false);
    }
  };

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

  const markRecordReviewed = async (clientId: string) => {
    if (!dataset) return;
    setStatus(""); setError("");
    try {
      const client = dataset.clients.find((item) => item.id === clientId);
      const clients = dataset.clients.map((item) => item.id === clientId ? { ...item, recordReviewNeeded: false, recordReviewReason: "" } : item);
      await saveCompassDataset({ ...dataset, clients });
      await refresh();
      if (reviewClientId === clientId) setReviewClientId("");
      setStatus(`${client?.name || "Client"} marked reviewed.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not clear the record-review flag.");
    }
  };

  return <div className="compass-admin-page">
    <header className="compass-admin-hero">
      <span className="compass-kicker">Client Compass workspace</span>
      <h1>Data Tools</h1>
      <p>Keep hardware inventory and client-record enrichment separate so each source updates only the data it owns.</p>
    </header>

    <section className="compass-admin-status-grid" aria-label="Current data status">
      <article><span>Snapshot</span><strong>{dataset ? dataset.importSourceName || "Imported data" : "No data imported"}</strong><small>{dataset ? `Updated ${formatDateTime(dataset.importedAt)}` : "Import Ninja data to begin."}</small></article>
      <article><span>Active clients</span><strong>{dataset ? activeClients.toLocaleString() : "—"}</strong><small>{dataset ? `${dataset.devices.length.toLocaleString()} devices in the current snapshot` : "No current snapshot"}</small></article>
      <article><span>Calculations</span><strong className={current ? "is-current" : "is-attention"}>{dataset ? (current ? "Current" : "Refresh needed") : "Waiting for data"}</strong><small>{dataset ? `Calculation engine ${dataset.calculationVersion || "not recorded"}` : ""}</small></article>
    </section>

    <section className="compass-data-category">
      <div className="compass-data-category-heading"><div><span className="compass-kicker">Hardware & inventory</span><h2>Technical enrichment</h2></div><p>Device, operating system, lifecycle, warranty, storage, and location data only.</p></div>
      <div className="compass-admin-card-grid two-up">
        <article className="compass-admin-action-card">
          <div className="compass-admin-action-icon">↥</div><div><span className="compass-kicker">Hardware snapshot</span><h2>Update Ninja data</h2><p>Replace or merge the current device inventory while preserving client-record, contact, territory, and relationship data.</p></div>
          <button className="button primary" type="button" onClick={() => setDataOpen(true)}>Update inventory</button>
        </article>
        <article className="compass-admin-action-card">
          <div className="compass-admin-action-icon">↻</div><div><span className="compass-kicker">Inventory rules</span><h2>Refresh calculations</h2><p>Rebuild lifecycle findings, project values, health counts, and segment metrics from the current inventory.</p></div>
          <button className="button secondary" type="button" disabled={!dataset || refreshing} onClick={() => void refreshCalculations()}>{refreshing ? "Refreshing…" : "Refresh calculations"}</button>
        </article>
      </div>
    </section>

    <section className="compass-data-category client-record-category">
      <div className="compass-data-category-heading"><div><span className="compass-kicker">Client records & contacts</span><h2>Relationship enrichment</h2></div><p>Geography, territory, industry, tags, contacts, sales activity + TC, review/quote dates, ownership, and relationship context.</p></div>
      <div className="compass-admin-card-grid two-up">
        <article className="compass-admin-action-card">
          <div className="compass-admin-action-icon">◷</div><div><span className="compass-kicker">Client record enrichment</span><h2>Import client details</h2><p>Bulk-enrich client details including Last Sales Activity and TC. Your Company / Latest Sales Activity / TC sheet can be imported directly here.</p></div>
          <button className="button primary" type="button" disabled={!dataset} onClick={() => setEnrichmentOpen(true)}>Import client records</button>
        </article>
        <article className="compass-admin-action-card">
          <div className="compass-admin-action-icon">↔</div><div><span className="compass-kicker">Captain's Log</span><h2>Sync all client history</h2><p>Pull every matched Captain's Log task and activity record from Supabase across the full client book. This stays separate from imported sales activity.</p></div>
          <button className="button secondary" type="button" disabled={!dataset || captainsLogSyncing} onClick={() => void syncAllCaptainsLogActivity()}>{captainsLogSyncing ? "Syncing all history…" : "Sync all history"}</button>
        </article>
      </div>
    </section>

    {recordReviewClients.length > 0 && <section className="compass-record-review-group" aria-label="Client records needing review">
      <div className="compass-record-review-group-heading"><div><span className="compass-kicker">Import follow-up</span><h2>Needs record review <small>{recordReviewClients.length}</small></h2><p>These companies were created from enrichment rows that had no confident Client Compass match. Open the record to correct it, then mark it reviewed.</p></div></div>
      <div className="compass-record-review-list">{recordReviewClients.map((client) => <article key={client.id}>
        <button className="compass-record-review-open" type="button" onClick={() => setReviewClientId(client.id)}><span><strong>{client.name}</strong><small>{[client.market, client.city, client.state].filter(Boolean).join(" · ") || "Imported client record"}</small></span><b>Review →</b></button>
        <button className="compass-record-review-done" type="button" onClick={() => void markRecordReviewed(client.id)}>Mark reviewed</button>
      </article>)}</div>
    </section>}

    {!ready && <div className="compass-admin-message">Loading browser workspace…</div>}
    {status && <div className="compass-workspace-success" role="status">{status}</div>}
    {error && <div className="compass-import-error" role="alert">{error}</div>}

    <CompassDataDialog open={dataOpen} dataset={dataset} config={config} onClose={() => setDataOpen(false)} onCommitted={refresh} />
    <CompassClientEnrichmentDialog open={enrichmentOpen} dataset={dataset} config={config} onClose={() => setEnrichmentOpen(false)} onCommitted={refresh} />
    {dataset && reviewClientId && <CompassClientWorkspace clientId={reviewClientId} dataset={dataset} config={config} onBack={() => setReviewClientId("")} onCloseAll={() => setReviewClientId("")} onDatasetSaved={refresh} />}
  </div>;
}
