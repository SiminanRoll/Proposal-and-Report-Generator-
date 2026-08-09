"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCompassState } from "@/lib/compass/store";
import { loadWorkbenchState, removeClientFromWorkbench, WORKBENCH_CHANGED_EVENT, workbenchStage } from "@/lib/compass/workbench";
import { CompassClientWorkspace } from "./compass-client-workspace";

const STAGES = ["Queued", "In Progress", "Scheduled", "Completed"] as const;
type Stage = (typeof STAGES)[number];

function formatDate(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function latestActivityDate(client: { captainsLog?: { recentActivity?: Array<{ completedAt?: string; createdAt?: string; scheduledAt?: string }>; openTasks?: Array<{ createdAt?: string; scheduledAt?: string }> } }): string {
  const dates = [
    ...(client.captainsLog?.recentActivity ?? []).flatMap((item) => [item.completedAt, item.createdAt, item.scheduledAt]),
    ...(client.captainsLog?.openTasks ?? []).flatMap((item) => [item.createdAt, item.scheduledAt]),
  ].filter(Boolean) as string[];
  return dates.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? "";
}

function reportUrl(clientId: string, clientName: string): string {
  const params = new URLSearchParams({ type: "client-report", compassClientId: clientId, client: clientName });
  return `/create/?${params.toString()}`;
}

export function WorkbenchPage() {
  const { dataset, config, refresh } = useCompassState();
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [stageFilter, setStageFilter] = useState<Stage | "All">("All");
  const [query, setQuery] = useState("");
  const [activeClientId, setActiveClientId] = useState("");

  useEffect(() => {
    const sync = () => setManualIds(loadWorkbenchState().clientIds);
    sync();
    window.addEventListener(WORKBENCH_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(WORKBENCH_CHANGED_EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);

  const rows = useMemo(() => {
    if (!dataset) return [];
    const manual = new Set(manualIds);
    return dataset.clients
      .filter((client) => manual.has(client.id) || Boolean(client.captainsLog?.openTasks?.length || client.captainsLog?.recentActivity?.length))
      .map((client) => {
        const summary = dataset.summaries.find((item) => item.clientId === client.id);
        return { client, summary, stage: workbenchStage(client), manual: manual.has(client.id), latest: latestActivityDate(client) };
      })
      .sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || Date.parse(b.latest || "0") - Date.parse(a.latest || "0") || (b.summary?.totalEstimatedValue ?? 0) - (a.summary?.totalEstimatedValue ?? 0));
  }, [dataset, manualIds]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => (stageFilter === "All" || row.stage === stageFilter) && (!needle || `${row.client.name} ${row.client.primaryContact} ${row.client.city} ${row.client.state} ${row.client.market}`.toLowerCase().includes(needle)));
  }, [query, rows, stageFilter]);

  const counts = useMemo(() => new Map(STAGES.map((stage) => [stage, rows.filter((row) => row.stage === stage).length])), [rows]);

  const remove = (clientId: string) => {
    removeClientFromWorkbench(clientId);
    setManualIds(loadWorkbenchState().clientIds);
  };

  if (activeClientId && dataset) return <CompassClientWorkspace clientId={activeClientId} dataset={dataset} config={config} onBack={() => setActiveClientId("")} onCloseAll={() => setActiveClientId("")} onDatasetSaved={refresh} />;

  return <div className="workbench-page">
    <header className="workbench-hero">
      <div><span className="compass-kicker">Active client work</span><h1>Account Review Workbench</h1><p>Your live book of clients in motion — selected intentionally or surfaced automatically from Captain&apos;s Log activity.</p></div>
      <div className="workbench-total"><strong>{rows.length}</strong><span>active clients</span></div>
    </header>

    <section className="workbench-stage-strip" aria-label="Workbench stages">
      <button className={stageFilter === "All" ? "is-active" : ""} type="button" onClick={() => setStageFilter("All")}><strong>{rows.length}</strong><span>All</span></button>
      {STAGES.map((stage) => <button key={stage} className={stageFilter === stage ? "is-active" : ""} type="button" onClick={() => setStageFilter(stage)}><strong>{counts.get(stage) ?? 0}</strong><span>{stage}</span></button>)}
    </section>

    <section className="workbench-panel">
      <div className="workbench-toolbar"><div><span className="compass-kicker">Current focus</span><h2>{stageFilter === "All" ? "Workbench clients" : stageFilter}</h2></div><label><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workbench" /></label></div>
      {filtered.length ? <div className="workbench-table-wrap"><table className="workbench-table"><thead><tr><th>Client</th><th>Stage</th><th>Latest activity</th><th>Open tasks</th><th>Last review</th><th>Est. need</th><th>Actions</th></tr></thead><tbody>
        {filtered.map(({ client, summary, stage, manual, latest }) => <tr key={client.id}>
          <td><strong>{client.name}</strong><small>{client.city}{client.state ? `${client.city ? ", " : ""}${client.state}` : ""}</small></td>
          <td><span className={`workbench-stage stage-${stage.toLowerCase().replace(/\s+/g, "-")}`}>{stage}</span></td>
          <td>{formatDate(latest)}</td>
          <td>{client.captainsLog?.openTaskCount ?? client.captainsLog?.openTasks?.length ?? 0}</td>
          <td>{formatDate(client.lastAccountReview || client.reviewOutcome?.reviewedAt || "")}</td>
          <td><strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(summary?.totalEstimatedValue ?? 0)}</strong></td>
          <td><div className="workbench-row-actions"><button type="button" onClick={() => setActiveClientId(client.id)}>Open</button><Link href={reportUrl(client.id, client.name)}>Report</Link>{manual && <button className="is-quiet" type="button" onClick={() => remove(client.id)}>Remove</button>}</div></td>
        </tr>)}
      </tbody></table></div> : <div className="workbench-empty"><strong>No clients in this view.</strong><span>Add clients from Compass lists or let Captain&apos;s Log activity surface them automatically.</span></div>}
    </section>
  </div>;
}
