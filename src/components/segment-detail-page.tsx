"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { COMPASS_SEGMENT_ROUTE_EVENT } from "@/lib/compass/shell-actions";
import { useCompassState } from "@/lib/compass/store";
import { buildSegmentSnapshot, formatSegmentStat, SEGMENT_STAT_OPTIONS, segmentStatValue } from "@/lib/segments/engine";
import { useSegments } from "@/lib/segments/store";
import type { SegmentStatId } from "@/lib/segments/types";
import { ClientTrackedAction } from "./client-tracked-action";
import { CompassClientWorkspace } from "./compass-client-workspace";
import { ListColumnResizeHandle, ListViewSettings, useListViewPreferences, type ListViewColumn } from "./list-view-settings";
import { SegmentIcon } from "./segment-icon";
import { WorkbenchBulkAction } from "./workbench-bulk-action";

type SegmentColumnKey = "client" | "health" | "assets" | "estimated" | "review" | "salesActivity" | "tc" | "quote" | "activity" | "actions";
type SegmentSortKey = Exclude<SegmentColumnKey, "actions">;
type SortDirection = "asc" | "desc";

const SEGMENT_COLUMNS: readonly ListViewColumn<SegmentColumnKey>[] = [
  { key: "client", label: "Client", description: "Client name and selection", defaultWidth: 220, minWidth: 170, maxWidth: 380, required: true },
  { key: "health", label: "Health", description: "Replace Now · Plan Soon · Current", defaultWidth: 135, minWidth: 110, maxWidth: 195 },
  { key: "assets", label: "Assets", description: "Managed device count", defaultWidth: 85, minWidth: 72, maxWidth: 140, defaultVisible: false },
  { key: "estimated", label: "Est. need", description: "Estimated project need", defaultWidth: 120, minWidth: 100, maxWidth: 190 },
  { key: "review", label: "Last review", description: "Most recent account review", defaultWidth: 130, minWidth: 110, maxWidth: 210 },
  { key: "salesActivity", label: "Last sales activity", description: "Latest TC sales activity", defaultWidth: 145, minWidth: 120, maxWidth: 220 },
  { key: "tc", label: "TC", description: "TC tied to latest sales activity", defaultWidth: 140, minWidth: 100, maxWidth: 240 },
  { key: "quote", label: "Last quote", description: "Most recent quote", defaultWidth: 125, minWidth: 105, maxWidth: 200 },
  { key: "activity", label: "Captain's Log", description: "Captain's Log activity lane", defaultWidth: 135, minWidth: 115, maxWidth: 210, defaultVisible: false },
  { key: "actions", label: "Actions", description: "Open and report", defaultWidth: 180, minWidth: 150, maxWidth: 250, required: true },
];

function formatDate(value: string): string { if (!value) return "Not recorded"; const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value); return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date); }
function dateValue(value: string): number { if (!value) return 0; const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value); return Number.isNaN(date.getTime()) ? 0 : date.getTime(); }
function statLabel(stat: SegmentStatId): string { return SEGMENT_STAT_OPTIONS.find((item) => item.id === stat)?.label ?? stat; }
function reportUrl(clientId: string, clientName: string): string { const params = new URLSearchParams({ type: "client-report", compassClientId: clientId, client: clientName }); return `/create/?${params.toString()}`; }
function sortIndicator(column: SegmentSortKey, active: SegmentSortKey | null, direction: SortDirection): string { if (column !== active) return "↕"; return direction === "asc" ? "↑" : "↓"; }
function textCompare(left: string, right: string, direction: SortDirection): number { const a = left.trim(); const b = right.trim(); if (!a && b) return 1; if (a && !b) return -1; const dir = direction === "asc" ? 1 : -1; return dir * a.localeCompare(b, undefined, { sensitivity: "base" }); }

export function SegmentDetailPage() {
  const { dataset, config, refresh } = useCompassState();
  const { segments } = useSegments();
  const [segmentId, setSegmentId] = useState("");
  const [routeReady, setRouteReady] = useState(false);
  const [query, setQuery] = useState("");
  const [activeClientId, setActiveClientId] = useState("");
  const [sortKey, setSortKey] = useState<SegmentSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const view = useListViewPreferences(`segment-${segmentId || "clients"}`, SEGMENT_COLUMNS);

  useEffect(() => {
    const syncRoute = () => {
      const route = new URLSearchParams(window.location.search);
      setSegmentId(route.get("id")?.trim() || "");
      setRouteReady(true);
      setQuery("");
      setActiveClientId("");
      setSelectedIds([]);
    };
    syncRoute();
    window.addEventListener("popstate", syncRoute);
    window.addEventListener(COMPASS_SEGMENT_ROUTE_EVENT, syncRoute);
    return () => { window.removeEventListener("popstate", syncRoute); window.removeEventListener(COMPASS_SEGMENT_ROUTE_EVENT, syncRoute); };
  }, []);

  const segment = segments.find((item) => item.id === segmentId) || null;
  const snapshot = useMemo(() => segment ? buildSegmentSnapshot(segment, dataset, config) : null, [config, dataset, segment]);
  const filtered = useMemo(() => {
    if (!snapshot) return [];
    const normalized = query.trim().toLowerCase();
    const clients = normalized ? snapshot.clients.filter((client) => `${client.clientName} ${client.technicalConsultant}`.toLowerCase().includes(normalized)) : [...snapshot.clients];
    if (!sortKey) return clients;
    const dir = sortDirection === "asc" ? 1 : -1;
    return clients.sort((left, right) => {
      if (sortKey === "client") return dir * left.clientName.localeCompare(right.clientName);
      if (sortKey === "health") return dir * ((left.replaceNow - right.replaceNow) || (left.planSoon - right.planSoon) || (left.healthy - right.healthy) || left.clientName.localeCompare(right.clientName));
      if (sortKey === "assets") return dir * (left.managedAssets - right.managedAssets || left.clientName.localeCompare(right.clientName));
      if (sortKey === "estimated") return dir * (left.estimatedValue - right.estimatedValue || left.clientName.localeCompare(right.clientName));
      if (sortKey === "review") return dir * (dateValue(left.lastAccountReview) - dateValue(right.lastAccountReview) || left.clientName.localeCompare(right.clientName));
      if (sortKey === "salesActivity") return dir * (dateValue(left.lastSalesInteraction) - dateValue(right.lastSalesInteraction) || left.clientName.localeCompare(right.clientName));
      if (sortKey === "tc") return textCompare(left.technicalConsultant, right.technicalConsultant, sortDirection) || left.clientName.localeCompare(right.clientName);
      if (sortKey === "quote") { const leftDate = dateValue(left.lastQuoteDate); const rightDate = dateValue(right.lastQuoteDate); if (!leftDate && rightDate) return 1; if (leftDate && !rightDate) return -1; return dir * (leftDate - rightDate || left.clientName.localeCompare(right.clientName)); }
      return dir * (Number(left.activityTracked) - Number(right.activityTracked) || left.clientName.localeCompare(right.clientName));
    });
  }, [query, snapshot, sortDirection, sortKey]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((client) => selectedSet.has(client.clientId));
  const toggleSelected = (clientId: string) => setSelectedIds((current) => current.includes(clientId) ? current.filter((id) => id !== clientId) : [...current, clientId]);
  const updateSort = (column: SegmentSortKey) => { if (sortKey === column) { setSortDirection((current) => current === "asc" ? "desc" : "asc"); return; } setSortKey(column); setSortDirection(column === "client" || column === "salesActivity" || column === "tc" ? "asc" : "desc"); };
  const sortButton = (column: SegmentSortKey, label: string) => <button type="button" className={`compass-column-sort${sortKey === column ? " is-active" : ""}`} onClick={() => updateSort(column)}>{label}<span aria-hidden="true">{sortIndicator(column, sortKey, sortDirection)}</span></button>;
  const gridStyle = { "--list-view-columns": view.gridTemplate, "--list-view-width": `${Math.max(view.totalWidth, 760)}px` } as CSSProperties;

  if (!routeReady) return <div className="segment-page"><section className="segment-empty"><p>Loading segment…</p></section></div>;
  if (activeClientId && dataset) return <CompassClientWorkspace clientId={activeClientId} dataset={dataset} config={config} onBack={() => setActiveClientId("")} onCloseAll={() => setActiveClientId("")} onDatasetSaved={refresh} />;
  if (!segment || !snapshot) return <div className="segment-page"><section className="segment-empty"><h2>Segment not found.</h2><p>It may have been removed or renamed.</p><Link className="button primary" href="/segments/">Back to Segment Manager</Link></section></div>;

  const headerFor = (column: SegmentColumnKey) => {
    const meta = view.byKey.get(column)!;
    return <span key={column} className="list-view-column-head">{column === "actions" ? meta.label : sortButton(column, meta.label)}<ListColumnResizeHandle column={column} view={view} /></span>;
  };

  const cellFor = (column: SegmentColumnKey, client: NonNullable<typeof snapshot>["clients"][number]) => {
    if (column === "client") return <div key={column} className="segment-client-name"><label className="workbench-select" aria-label={`Select ${client.clientName}`}><input type="checkbox" checked={selectedSet.has(client.clientId)} onChange={() => toggleSelected(client.clientId)} /></label><button type="button" onClick={() => setActiveClientId(client.clientId)}><i /><strong>{client.clientName}</strong></button></div>;
    if (column === "health") return <span key={column} className="segment-client-health"><b className="risk"><i />{client.replaceNow}</b><b className="attention"><i />{client.planSoon}</b><b className="healthy"><i />{client.healthy}</b></span>;
    if (column === "assets") return <span key={column}>{client.managedAssets}</span>;
    if (column === "estimated") return <span key={column}>{formatSegmentStat("estimated-value", client.estimatedValue)}</span>;
    if (column === "review") return <span key={column}>{formatDate(client.lastAccountReview)}</span>;
    if (column === "salesActivity") return <span key={column}>{formatDate(client.lastSalesInteraction)}</span>;
    if (column === "tc") return <span key={column}>{client.technicalConsultant || "Not assigned"}</span>;
    if (column === "quote") return <span key={column}>{formatDate(client.lastQuoteDate)}</span>;
    if (column === "activity") return <span key={column} className="segment-activity"><ClientTrackedAction clientId={client.clientId} clientName={client.clientName} tracked={client.activityTracked} /></span>;
    return <span key={column} className="segment-client-actions"><button type="button" onClick={() => setActiveClientId(client.clientId)}>Open</button><Link href={reportUrl(client.clientId, client.clientName)}>Report</Link></span>;
  };

  return <div className="segment-page segment-detail-page" style={{ "--segment-color": segment.color } as CSSProperties}>
    <header className="segment-detail-header"><div className="segment-detail-title"><Link href="/segments/">← Segment Manager</Link><div><span className="segment-detail-icon"><SegmentIcon name={segment.icon} /></span><div><span className="compass-kicker">Managed segment</span><h1>{segment.title}</h1><p>{segment.description || "Live client enrollment from the current Client Compass snapshot."}</p></div></div></div><div className="segment-detail-count"><strong>{snapshot.aggregate.clientCount}</strong><span>clients</span></div></header>
    <section className="segment-detail-stats"><article><span>Estimated need</span><strong>{formatSegmentStat("estimated-value", snapshot.aggregate.estimatedValue)}</strong></article>{segment.stats.filter((stat) => stat !== "estimated-value").slice(0, 3).map((stat) => <article key={stat}><span>{statLabel(stat)}</span><strong>{formatSegmentStat(stat, segmentStatValue(snapshot.aggregate, stat))}</strong></article>)}</section>
    <section className="segment-client-section"><div className="segment-client-heading"><div><span className="compass-kicker">Enrolled</span><h2>Clients</h2></div><label className="segment-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedIds([]); }} placeholder="Search client or TC" /></label><ListViewSettings view={view} /></div>
      {filtered.length > 0 && <div className="workbench-selection-toolbar"><button type="button" className="workbench-bulk-action" onClick={() => setSelectedIds(allFilteredSelected ? [] : filtered.map((client) => client.clientId))}>{allFilteredSelected ? "Clear selection" : `Select all ${filtered.length}`}</button>{selectedIds.length > 0 && <><small>{selectedIds.length} selected</small><WorkbenchBulkAction clientIds={selectedIds} onAdded={() => setSelectedIds([])} /></>}</div>}
      <div className="segment-client-table list-view-grid-scroll"><div className="segment-client-head list-view-grid" style={gridStyle}>{view.rendered.map(headerFor)}</div>{filtered.length ? <div className="segment-client-list">{filtered.map((client) => <div className="segment-client-row list-view-grid" style={gridStyle} key={client.clientId}>{view.rendered.map((column) => cellFor(column, client))}</div>)}</div> : <div className="segment-client-empty">No clients match this segment{query ? " and search" : ""}.</div>}</div>
    </section>
  </div>;
}
