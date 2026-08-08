"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { ProjectCoverageCardId, ProjectCoverageCardMetric, ProjectCoverageClient } from "@/lib/compass/project-coverage";
import { ProjectCoverageFilters, projectCoverageFilterMatches, type ProjectCoverageReasonFilter } from "./project-coverage-filters";
import { AnimatedNumber } from "./animated-number";
import type { CaptainsLogClientSyncResult } from "@/lib/compass/captains-log-bridge";
import { requestQuickPresent } from "@/lib/compass/quick-present-events";
import { useCompassState } from "@/lib/compass/store";

const INITIAL_CLIENT_COUNT = 5;

type SortKey = "client" | "inventory" | "activity" | "quote" | "estimate" | "captains-log";
type SortDirection = "asc" | "desc";
type InventoryCounts = { replaceNow: number; planSoon: number; healthy: number };
const EMPTY_INVENTORY: InventoryCounts = { replaceNow: 0, planSoon: 0, healthy: 0 };

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string): string {
  if (!value) return "Not recorded";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function dateTimestamp(value: string): number {
  if (!value) return 0;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "CC";
}

function reportUrl(clientId: string, clientName: string): string {
  const params = new URLSearchParams({ type: "client-report", compassClientId: clientId, client: clientName });
  return `/create/?${params.toString()}`;
}

function lastActivity(client: ProjectCoverageClient): { primary: string; flag: string } {
  if (client.position === "quoted-open") return {
    primary: client.quoteDate ? `Quoted ${formatDate(client.quoteDate)}` : "Quote date missing",
    flag: client.reviewHistoryMissing ? "Review history missing" : "Outcome still open",
  };
  if (client.position === "discussed-open") return {
    primary: client.reviewDate ? `Reviewed ${formatDate(client.reviewDate)}` : "Discussion recorded",
    flag: client.followUpPastDue ? "Follow-up past due" : "Decision still open",
  };
  return {
    primary: "No review or quote",
    flag: client.noRelationshipHistory ? "No relationship history" : "Coverage needed",
  };
}

function listDescription(position: ProjectCoverageCardId): string {
  if (position === "needs-review") return "Highest-priority qualified needs that have not yet been reviewed or quoted.";
  if (position === "discussed-open") return "Qualified needs already discussed with the client but still missing a completed decision.";
  if (position === "quoted-open") return "Qualified needs with a recorded quote and no completed or otherwise resolved outcome.";
  if (position === "highest-risk") return "The qualified client book ordered by critical server exposure and technical severity.";
  if (position === "oldest-quotes") return "Open quotes ordered from the oldest re-engagement need to the most recent.";
  return "Qualified clients ordered by deduplicated estimated project-package value.";
}

function activityTimestamp(client: ProjectCoverageClient): number {
  return dateTimestamp(client.quoteDate || client.reviewDate || client.nextFollowUp || "");
}

function sortIndicator(sortKey: SortKey, activeKey: SortKey | null, direction: SortDirection): string {
  if (sortKey !== activeKey) return "↕";
  return direction === "asc" ? "↑" : "↓";
}

interface Props {
  card: ProjectCoverageCardMetric;
  activeSegmentId?: string | null;
  onClearSegment?: () => void;
  onOpenClient: (clientId: string) => void;
  onCaptainsLogSync?: (clientId: string, sync: CaptainsLogClientSyncResult) => Promise<void> | void;
}

export function ProjectCoverageClientList({ card, activeSegmentId = null, onClearSegment, onOpenClient }: Props) {
  const { dataset } = useCompassState();
  const [activeFilter, setActiveFilter] = useState<ProjectCoverageReasonFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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
  const filteredClients = useMemo(() => segmentedClients.filter((client) => projectCoverageFilterMatches(client, activeFilter)), [activeFilter, segmentedClients]);

  const inventoryByClient = useMemo(() => {
    const next = new Map<string, InventoryCounts>();
    const clientIds = new Set(card.clients.map((client) => client.clientId));
    for (const device of dataset?.devices ?? []) {
      if (!clientIds.has(device.clientId) || device.deviceType !== "physical-workstation") continue;
      const current = next.get(device.clientId) ?? { ...EMPTY_INVENTORY };
      if (device.lifecycle === "replace-now") current.replaceNow += 1;
      else if (device.lifecycle === "plan-soon") current.planSoon += 1;
      else if (device.lifecycle === "current") current.healthy += 1;
      next.set(device.clientId, current);
    }
    return next;
  }, [card.clients, dataset?.devices]);

  const sortedClients = useMemo(() => {
    const clients = [...filteredClients];
    if (!sortKey) return clients;
    const dir = sortDirection === "asc" ? 1 : -1;
    clients.sort((left, right) => {
      if (sortKey === "client") return dir * left.clientName.localeCompare(right.clientName);
      if (sortKey === "inventory") {
        const a = inventoryByClient.get(left.clientId) ?? EMPTY_INVENTORY;
        const b = inventoryByClient.get(right.clientId) ?? EMPTY_INVENTORY;
        return dir * ((a.replaceNow - b.replaceNow) || (a.planSoon - b.planSoon) || (a.healthy - b.healthy) || left.clientName.localeCompare(right.clientName));
      }
      if (sortKey === "activity") return dir * (activityTimestamp(left) - activityTimestamp(right) || left.clientName.localeCompare(right.clientName));
      if (sortKey === "quote") {
        const leftDate = dateTimestamp(left.quoteDate);
        const rightDate = dateTimestamp(right.quoteDate);
        if (!leftDate && rightDate) return 1;
        if (leftDate && !rightDate) return -1;
        return dir * (leftDate - rightDate || left.clientName.localeCompare(right.clientName));
      }
      if (sortKey === "estimate") return dir * (left.estimatedValue - right.estimatedValue || left.clientName.localeCompare(right.clientName));
      return dir * (Number(left.captainsLogActivityCount || 0) - Number(right.captainsLogActivityCount || 0) || left.clientName.localeCompare(right.clientName));
    });
    return clients;
  }, [filteredClients, inventoryByClient, sortDirection, sortKey]);

  const visibleClients = showAll ? sortedClients : sortedClients.slice(0, INITIAL_CLIENT_COUNT);
  const hiddenCount = Math.max(0, sortedClients.length - visibleClients.length);
  const motionKey = `${card.id}-${activeSegmentId ?? "all-segments"}-${activeFilter}-${showAll ? "all" : "priority"}-${sortKey ?? "priority"}-${sortDirection}`;

  const updateSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "client" ? "asc" : "desc");
  };

  const sortButton = (key: SortKey, label: string) => <button type="button" className={`project-coverage-sort-button${sortKey === key ? " is-active" : ""}`} onClick={() => updateSort(key)}>{label} <span aria-hidden="true">{sortIndicator(key, sortKey, sortDirection)}</span></button>;

  return <section className={`project-coverage-client-list list-${card.id}`} aria-labelledby="project-coverage-client-list-title">
    <header className="project-coverage-client-list-header">
      <div><span className="project-coverage-list-kicker">Selected coverage position</span><h2 id="project-coverage-client-list-title">{card.title} <small>(<AnimatedNumber value={card.count} duration={520} delay={80} />)</small></h2><p>{listDescription(card.id)}</p></div>
      <div className="project-coverage-list-summary"><strong><AnimatedNumber value={card.estimatedValue} duration={760} delay={120} format={(value) => formatMoney(Math.round(value))} /></strong><span>{card.valueLabel}</span></div>
    </header>

    {activeSegment && <div className="project-coverage-active-segment" role="status"><span><strong>{activeSegment.label}</strong><small>{segmentedClients.length} client{segmentedClients.length === 1 ? "" : "s"} from the selected card detail</small></span><button type="button" onClick={onClearSegment}>Clear segment</button></div>}
    <ProjectCoverageFilters clients={segmentedClients} activeFilter={activeFilter} onChange={setActiveFilter} />

    {visibleClients.length ? <div key={motionKey} className="project-coverage-table-wrap project-coverage-list-motion">
      <table className="project-coverage-table project-coverage-table-v10953">
        <thead><tr>
          <th>{sortButton("client", "Client")}</th>
          <th>Why they need attention</th>
          <th>{sortButton("inventory", "Inventory")}</th>
          <th>{sortButton("activity", "Last activity")}</th>
          <th>{sortButton("quote", "Last quote")}</th>
          <th>{sortButton("estimate", "Estimated value")}</th>
          <th>{sortButton("captains-log", "Captain's Log")}</th>
          <th>Present</th>
          <th>Actions</th>
        </tr></thead>
        <tbody>{visibleClients.map((client, index) => {
          const activity = lastActivity(client);
          const inventory = inventoryByClient.get(client.clientId) ?? EMPTY_INVENTORY;
          const hasCaptainsLogHistory = client.captainsLogActivityCount > 0;
          const quickLabel = hasCaptainsLogHistory
            ? `${client.captainsLogActivityCount} Captain's Log history record${client.captainsLogActivityCount === 1 ? "" : "s"} synced for ${client.clientName}`
            : `No Captain's Log history synced for ${client.clientName}`;
          return <tr key={client.clientId} style={{ "--row-motion-index": index } as CSSProperties}>
            <td data-label="Client"><div className="project-coverage-client-name"><span aria-hidden="true">{initials(client.clientName)}</span><strong>{client.clientName}</strong></div></td>
            <td data-label="Why they need attention"><span className="project-coverage-attention">{client.attentionReason || client.priorityReason}</span></td>
            <td data-label="Inventory"><span className="segment-client-health project-coverage-inventory" title="Replace Now · Plan Soon · Current"><b className="risk"><i />{inventory.replaceNow}</b><b className="attention"><i />{inventory.planSoon}</b><b className="healthy"><i />{inventory.healthy}</b></span></td>
            <td data-label="Last activity"><div className="project-coverage-activity"><strong>{activity.primary}</strong><small>{activity.flag}</small></div></td>
            <td data-label="Last quote"><span className="project-coverage-quote-date">{client.quoteDate ? formatDate(client.quoteDate) : "Not recorded"}</span></td>
            <td data-label="Estimated value"><strong className="project-coverage-estimate">{formatMoney(client.estimatedValue)}</strong></td>
            <td data-label="Captain's Log"><span className={`project-coverage-compass-quick project-coverage-compass-indicator${hasCaptainsLogHistory ? " is-added" : ""}`} role="img" aria-label={quickLabel} title={quickLabel}><span className="project-coverage-compass-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="m15.2 8.8-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z"/><circle cx="12" cy="12" r="1.05" fill="currentColor" stroke="none"/></svg></span><span className="project-coverage-compass-check" aria-hidden="true">✓</span></span></td>
            <td data-label="Present"><button className="project-coverage-present-quick" type="button" onClick={() => requestQuickPresent(client.clientId)} aria-label={`Present report for ${client.clientName}`} title="Open or quick-generate the client presentation"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="m10 8 5 2.5-5 2.5V8Z"/><path d="M8 21h8M12 17v4"/></svg></button></td>
            <td data-label="Actions"><span className="project-coverage-row-actions"><button className="project-coverage-open-client" type="button" onClick={() => onOpenClient(client.clientId)}>Open</button><Link className="project-coverage-report-client" href={reportUrl(client.clientId, client.clientName)}>Report</Link></span></td>
          </tr>;
        })}</tbody>
      </table>
    </div> : <div key={motionKey} className="project-coverage-list-empty project-coverage-list-motion"><span className="project-coverage-empty-pulse" aria-hidden="true" /><strong>No clients match this reason filter.</strong><span>{activeSegment ? `${activeSegment.label} contains ${segmentedClients.length} client${segmentedClients.length === 1 ? "" : "s"} before the reason filter.` : `The selected coverage position still contains ${card.count} qualifying client${card.count === 1 ? "" : "s"}.`}</span><button type="button" onClick={() => setActiveFilter("all")}>Show all project needs</button></div>}

    {sortedClients.length > INITIAL_CLIENT_COUNT && <div className="project-coverage-view-all"><button type="button" onClick={() => setShowAll((current) => !current)}>{showAll ? "Show highest-priority clients" : `View all ${sortedClients.length} clients`}<span aria-hidden="true">{showAll ? "↑" : "→"}</span></button>{!showAll && hiddenCount > 0 && <small>{hiddenCount} more client{hiddenCount === 1 ? "" : "s"} in this filtered list</small>}</div>}
  </section>;
}
