"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { ProjectCoverageCardId, ProjectCoverageCardMetric, ProjectCoverageClient } from "@/lib/compass/project-coverage";
import { useCompassState } from "@/lib/compass/store";
import { buildSegmentClientMetrics } from "@/lib/segments/engine";
import { ProjectCoverageFilters, projectCoverageFilterMatches, type ProjectCoverageReasonFilter } from "./project-coverage-filters";
import { AnimatedNumber } from "./animated-number";
import type { CaptainsLogClientSyncResult } from "@/lib/compass/captains-log-bridge";

const INITIAL_CLIENT_COUNT = 5;

type SortKey = "client" | "health" | "assets" | "estimate" | "review" | "captains-log";
type SortDirection = "asc" | "desc";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string): string {
  if (!value) return "Not recorded";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function dateValue(value: string): number {
  if (!value) return 0;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "CC";
}

function projectNeed(client: ProjectCoverageClient): string {
  return client.projects.map((project) => project.title).join(" + ");
}

function listDescription(position: ProjectCoverageCardId): string {
  if (position === "needs-review") return "Highest-priority qualified needs that have not yet been reviewed or quoted.";
  if (position === "discussed-open") return "Qualified needs already discussed with the client but still missing a completed decision.";
  if (position === "quoted-open") return "Qualified needs with a recorded quote and no completed or otherwise resolved outcome.";
  if (position === "highest-risk") return "The qualified client book ordered by critical server exposure and technical severity.";
  if (position === "oldest-quotes") return "Open quotes ordered from the oldest re-engagement need to the most recent.";
  return "Qualified clients ordered by deduplicated estimated project-package value.";
}

function sortIndicator(sortKey: SortKey, activeKey: SortKey | null, direction: SortDirection): string {
  if (sortKey !== activeKey) return "↕";
  return direction === "asc" ? "↑" : "↓";
}

function reportUrl(clientId: string, clientName: string): string {
  const params = new URLSearchParams({ type: "client-report", compassClientId: clientId, client: clientName });
  return `/create/?${params.toString()}`;
}

interface Props {
  card: ProjectCoverageCardMetric;
  activeSegmentId?: string | null;
  onClearSegment?: () => void;
  onOpenClient: (clientId: string) => void;
  onCaptainsLogSync?: (clientId: string, sync: CaptainsLogClientSyncResult) => Promise<void> | void;
}

export function ProjectCoverageClientList({ card, activeSegmentId = null, onClearSegment, onOpenClient, onCaptainsLogSync }: Props) {
  const { dataset } = useCompassState();
  const [activeFilter, setActiveFilter] = useState<ProjectCoverageReasonFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  void onCaptainsLogSync;

  useEffect(() => {
    setActiveFilter("all");
    setShowAll(false);
    setSortKey(null);
    setSortDirection("desc");
  }, [card.id]);

  useEffect(() => { setShowAll(false); }, [activeFilter]);
  useEffect(() => { setActiveFilter("all"); setShowAll(false); }, [activeSegmentId]);

  const activeSegment = useMemo(() => card.stats.find((stat) => stat.id === activeSegmentId) ?? null, [activeSegmentId, card.stats]);
  const segmentedClients = useMemo(() => {
    if (!activeSegment) return card.clients;
    const clientIds = new Set(activeSegment.clientIds);
    return card.clients.filter((client) => clientIds.has(client.clientId));
  }, [activeSegment, card.clients]);
  const filteredClients = useMemo(
    () => segmentedClients.filter((client) => projectCoverageFilterMatches(client, activeFilter)),
    [activeFilter, segmentedClients],
  );

  const metricsByClient = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildSegmentClientMetrics>>();
    if (!dataset) return map;
    for (const client of filteredClients) map.set(client.clientId, buildSegmentClientMetrics(dataset, client.clientId));
    return map;
  }, [dataset, filteredClients]);

  const sortedClients = useMemo(() => {
    const clients = [...filteredClients];
    if (!sortKey) return clients;
    const dir = sortDirection === "asc" ? 1 : -1;
    clients.sort((left, right) => {
      const a = metricsByClient.get(left.clientId);
      const b = metricsByClient.get(right.clientId);
      if (sortKey === "client") return dir * left.clientName.localeCompare(right.clientName);
      if (sortKey === "health") return dir * (((a?.replaceNow ?? 0) - (b?.replaceNow ?? 0)) || ((a?.planSoon ?? 0) - (b?.planSoon ?? 0)) || ((a?.healthy ?? 0) - (b?.healthy ?? 0)) || left.clientName.localeCompare(right.clientName));
      if (sortKey === "assets") return dir * (((a?.managedAssets ?? 0) - (b?.managedAssets ?? 0)) || left.clientName.localeCompare(right.clientName));
      if (sortKey === "review") return dir * ((dateValue(a?.lastAccountReview ?? left.reviewDate) - dateValue(b?.lastAccountReview ?? right.reviewDate)) || left.clientName.localeCompare(right.clientName));
      if (sortKey === "captains-log") return dir * ((left.captainsLogActivityCount - right.captainsLogActivityCount) || left.clientName.localeCompare(right.clientName));
      return dir * ((left.estimatedValue - right.estimatedValue) || left.clientName.localeCompare(right.clientName));
    });
    return clients;
  }, [filteredClients, metricsByClient, sortDirection, sortKey]);

  const visibleClients = showAll ? sortedClients : sortedClients.slice(0, INITIAL_CLIENT_COUNT);
  const hiddenCount = Math.max(0, sortedClients.length - visibleClients.length);
  const motionKey = `${card.id}-${activeSegmentId ?? "all-segments"}-${activeFilter}-${showAll ? "all" : "priority"}-${sortKey ?? "default"}-${sortDirection}`;

  const updateSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "client" ? "asc" : "desc");
  };
  const sortButton = (column: SortKey, label: string) => <button type="button" className={`compass-column-sort${sortKey === column ? " is-active" : ""}`} onClick={() => updateSort(column)}>{label}<span aria-hidden="true">{sortIndicator(column, sortKey, sortDirection)}</span></button>;

  return (
    <>
      <section className={`project-coverage-client-list list-${card.id}`} aria-labelledby="project-coverage-client-list-title">
        <header className="project-coverage-client-list-header">
          <div>
            <span className="project-coverage-list-kicker">Selected coverage position</span>
            <h2 id="project-coverage-client-list-title">{card.title} <small>(<AnimatedNumber value={card.count} duration={520} delay={80} />)</small></h2>
            <p>{listDescription(card.id)}</p>
          </div>
          <div className="project-coverage-list-summary">
            <strong><AnimatedNumber value={card.estimatedValue} duration={760} delay={120} format={(value) => formatMoney(Math.round(value))} /></strong>
            <span>{card.valueLabel}</span>
          </div>
        </header>

        {activeSegment && <div className="project-coverage-active-segment" role="status">
          <span><strong>{activeSegment.label}</strong><small>{segmentedClients.length} client{segmentedClients.length === 1 ? "" : "s"} from the selected card detail</small></span>
          <button type="button" onClick={onClearSegment}>Clear segment</button>
        </div>}

        <ProjectCoverageFilters clients={segmentedClients} activeFilter={activeFilter} onChange={setActiveFilter} />

        {visibleClients.length ? <div key={motionKey} className="project-coverage-table-wrap project-coverage-list-motion project-coverage-table-standardized">
          <table className="project-coverage-table">
            <thead>
              <tr>
                <th>{sortButton("client", "Client")}</th>
                <th>Project need</th>
                <th>{sortButton("health", "Health")}</th>
                <th>{sortButton("assets", "Assets")}</th>
                <th>{sortButton("estimate", "Est. need")}</th>
                <th>{sortButton("review", "Last review")}</th>
                <th>{sortButton("captains-log", "Captain's Log")}</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {visibleClients.map((client, index) => {
                const metrics = metricsByClient.get(client.clientId);
                const hasCaptainsLogHistory = client.captainsLogActivityCount > 0;
                return <tr key={client.clientId} style={{ "--row-motion-index": index } as CSSProperties}>
                  <td data-label="Client"><div className="project-coverage-client-name"><span aria-hidden="true">{initials(client.clientName)}</span><strong>{client.clientName}</strong></div></td>
                  <td data-label="Project need"><strong className="project-coverage-need" title={client.attentionReason || client.priorityReason}>{projectNeed(client)}</strong></td>
                  <td data-label="Health"><span className="segment-client-health"><b className="risk"><i />{metrics?.replaceNow ?? 0}</b><b className="attention"><i />{metrics?.planSoon ?? 0}</b><b className="healthy"><i />{metrics?.healthy ?? 0}</b></span></td>
                  <td data-label="Assets"><span className="project-coverage-assets">{metrics?.managedAssets ?? 0}</span></td>
                  <td data-label="Est. need"><strong className="project-coverage-estimate">{formatMoney(client.estimatedValue)}</strong></td>
                  <td data-label="Last review"><span className="project-coverage-review-date">{formatDate(metrics?.lastAccountReview ?? client.reviewDate)}</span></td>
                  <td data-label="Captain's Log"><span className={hasCaptainsLogHistory ? "segment-activity is-tracked" : "segment-activity"}>{hasCaptainsLogHistory ? "Tracked ✓" : "—"}</span></td>
                  <td data-label="Actions"><span className="project-coverage-standard-actions"><a className="compass-list-action report" href={reportUrl(client.clientId, client.clientName)}>Report</a><button className="compass-list-action open" type="button" onClick={() => onOpenClient(client.clientId)}>Open</button></span></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div> : <div key={motionKey} className="project-coverage-list-empty project-coverage-list-motion">
          <span className="project-coverage-empty-pulse" aria-hidden="true" />
          <strong>No clients match this reason filter.</strong>
          <span>{activeSegment ? `${activeSegment.label} contains ${segmentedClients.length} client${segmentedClients.length === 1 ? "" : "s"} before the reason filter.` : `The selected coverage position still contains ${card.count} qualifying client${card.count === 1 ? "" : "s"}.`}</span>
          <button type="button" onClick={() => setActiveFilter("all")}>Show all project needs</button>
        </div>}

        {sortedClients.length > INITIAL_CLIENT_COUNT && <div className="project-coverage-view-all">
          <button type="button" onClick={() => setShowAll((current) => !current)}>
            {showAll ? "Show highest-priority clients" : `View all ${sortedClients.length} clients`}
            <span aria-hidden="true">{showAll ? "↑" : "→"}</span>
          </button>
          {!showAll && hiddenCount > 0 && <small>{hiddenCount} more client{hiddenCount === 1 ? "" : "s"} in this filtered list</small>}
        </div>}
      </section>
    </>
  );
}
