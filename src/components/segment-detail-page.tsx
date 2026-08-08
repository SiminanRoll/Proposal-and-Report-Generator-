"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { COMPASS_SEGMENT_ROUTE_EVENT } from "@/lib/compass/shell-actions";
import { useCompassState } from "@/lib/compass/store";
import { buildSegmentSnapshot, formatSegmentStat, SEGMENT_STAT_OPTIONS, segmentStatValue } from "@/lib/segments/engine";
import { useSegments } from "@/lib/segments/store";
import type { SegmentStatId } from "@/lib/segments/types";
import { CompassClientWorkspace } from "./compass-client-workspace";
import { SegmentIcon } from "./segment-icon";

type SegmentSortKey = "client" | "health" | "assets" | "estimated" | "review" | "activity";
type SortDirection = "asc" | "desc";

function formatDate(value: string): string {
  if (!value) return "Not recorded";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function dateValue(value: string): number {
  if (!value) return 0;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function statLabel(stat: SegmentStatId): string {
  return SEGMENT_STAT_OPTIONS.find((item) => item.id === stat)?.label ?? stat;
}

function reportUrl(clientId: string, clientName: string): string {
  const params = new URLSearchParams({ type: "client-report", compassClientId: clientId, client: clientName });
  return `/create/?${params.toString()}`;
}

function sortIndicator(column: SegmentSortKey, active: SegmentSortKey | null, direction: SortDirection): string {
  if (column !== active) return "↕";
  return direction === "asc" ? "↑" : "↓";
}

export function SegmentDetailPage() {
  const { dataset, config, refresh } = useCompassState();
  const { segments } = useSegments();
  const [segmentId, setSegmentId] = useState("");
  const [routeReady, setRouteReady] = useState(false);
  const [query, setQuery] = useState("");
  const [activeClientId, setActiveClientId] = useState("");
  const [sortKey, setSortKey] = useState<SegmentSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    const syncRoute = () => {
      const route = new URLSearchParams(window.location.search);
      setSegmentId(route.get("id")?.trim() || "");
      setRouteReady(true);
      setQuery("");
      setActiveClientId("");
    };
    syncRoute();
    window.addEventListener("popstate", syncRoute);
    window.addEventListener(COMPASS_SEGMENT_ROUTE_EVENT, syncRoute);
    return () => {
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener(COMPASS_SEGMENT_ROUTE_EVENT, syncRoute);
    };
  }, []);

  const segment = segments.find((item) => item.id === segmentId) || null;
  const snapshot = useMemo(() => segment ? buildSegmentSnapshot(segment, dataset, config) : null, [config, dataset, segment]);

  const filtered = useMemo(() => {
    if (!snapshot) return [];
    const normalized = query.trim().toLowerCase();
    const clients = normalized ? snapshot.clients.filter((client) => client.clientName.toLowerCase().includes(normalized)) : [...snapshot.clients];
    if (!sortKey) return clients;
    const dir = sortDirection === "asc" ? 1 : -1;
    return clients.sort((left, right) => {
      if (sortKey === "client") return dir * left.clientName.localeCompare(right.clientName);
      if (sortKey === "health") return dir * ((left.replaceNow - right.replaceNow) || (left.planSoon - right.planSoon) || (left.healthy - right.healthy) || left.clientName.localeCompare(right.clientName));
      if (sortKey === "assets") return dir * (left.managedAssets - right.managedAssets || left.clientName.localeCompare(right.clientName));
      if (sortKey === "estimated") return dir * (left.estimatedValue - right.estimatedValue || left.clientName.localeCompare(right.clientName));
      if (sortKey === "review") return dir * (dateValue(left.lastAccountReview) - dateValue(right.lastAccountReview) || left.clientName.localeCompare(right.clientName));
      return dir * (Number(left.activityTracked) - Number(right.activityTracked) || left.clientName.localeCompare(right.clientName));
    });
  }, [query, snapshot, sortDirection, sortKey]);

  const updateSort = (column: SegmentSortKey) => {
    if (sortKey === column) { setSortDirection((current) => current === "asc" ? "desc" : "asc"); return; }
    setSortKey(column);
    setSortDirection(column === "client" ? "asc" : "desc");
  };
  const sortButton = (column: SegmentSortKey, label: string) => <button type="button" className={`compass-column-sort${sortKey === column ? " is-active" : ""}`} onClick={() => updateSort(column)}>{label}<span aria-hidden="true">{sortIndicator(column, sortKey, sortDirection)}</span></button>;

  if (!routeReady) return <div className="segment-page"><section className="segment-empty"><p>Loading segment…</p></section></div>;
  if (activeClientId && dataset) return <CompassClientWorkspace clientId={activeClientId} dataset={dataset} config={config} onBack={() => setActiveClientId("")} onCloseAll={() => setActiveClientId("")} onDatasetSaved={refresh} />;
  if (!segment || !snapshot) return <div className="segment-page"><section className="segment-empty"><h2>Segment not found.</h2><p>It may have been removed or renamed.</p><Link className="button primary" href="/segments/">Back to Segment Manager</Link></section></div>;

  return <div className="segment-page segment-detail-page" style={{ "--segment-color": segment.color } as CSSProperties}>
    <header className="segment-detail-header"><div className="segment-detail-title"><Link href="/segments/">← Segment Manager</Link><div><span className="segment-detail-icon"><SegmentIcon name={segment.icon} /></span><div><span className="compass-kicker">Managed segment</span><h1>{segment.title}</h1><p>{segment.description || "Live client enrollment from the current Client Compass snapshot."}</p></div></div></div><div className="segment-detail-count"><strong>{snapshot.aggregate.clientCount}</strong><span>clients</span></div></header>
    <section className="segment-detail-stats"><article><span>Estimated need</span><strong>{formatSegmentStat("estimated-value", snapshot.aggregate.estimatedValue)}</strong></article>{segment.stats.filter((stat) => stat !== "estimated-value").slice(0, 3).map((stat) => <article key={stat}><span>{statLabel(stat)}</span><strong>{formatSegmentStat(stat, segmentStatValue(snapshot.aggregate, stat))}</strong></article>)}</section>
    <section className="segment-client-section"><div className="segment-client-heading"><div><span className="compass-kicker">Enrolled</span><h2>Clients</h2></div><label className="segment-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this segment" /></label></div>
      <div className="segment-client-table"><div className="segment-client-head"><span>{sortButton("client", "Client")}</span><span>{sortButton("health", "Health")}</span><span>{sortButton("assets", "Assets")}</span><span>{sortButton("estimated", "Est. need")}</span><span>{sortButton("review", "Last review")}</span><span>{sortButton("activity", "Captain's Log")}</span><span /></div>{filtered.length ? <div className="segment-client-list">{filtered.map((client) => <div className="segment-client-row" key={client.clientId}><button className="segment-client-name" type="button" onClick={() => setActiveClientId(client.clientId)}><i /><strong>{client.clientName}</strong></button><span className="segment-client-health"><b className="risk"><i />{client.replaceNow}</b><b className="attention"><i />{client.planSoon}</b><b className="healthy"><i />{client.healthy}</b></span><span>{client.managedAssets}</span><span>{formatSegmentStat("estimated-value", client.estimatedValue)}</span><span>{formatDate(client.lastAccountReview)}</span><span className={client.activityTracked ? "segment-activity is-tracked" : "segment-activity"}>{client.activityTracked ? "Tracked ✓" : "—"}</span><span className="segment-client-actions"><button type="button" onClick={() => setActiveClientId(client.clientId)}>Open</button><Link href={reportUrl(client.clientId, client.clientName)}>Report</Link></span></div>)}</div> : <div className="segment-client-empty">No clients match this segment{query ? " and search" : ""}.</div>}</div>
    </section>
  </div>;
}
