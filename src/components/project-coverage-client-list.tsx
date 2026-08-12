"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { ProjectCoverageCardId, ProjectCoverageCardMetric } from "@/lib/compass/project-coverage";
import { ProjectCoverageFilters, projectCoverageFilterMatches, type ProjectCoverageReasonFilter } from "./project-coverage-filters";
import { AnimatedNumber } from "./animated-number";
import type { CaptainsLogClientSyncResult } from "@/lib/compass/captains-log-bridge";
import { useCompassState } from "@/lib/compass/store";
import { ClientTrackedAction } from "./client-tracked-action";
import { WorkbenchBulkAction } from "./workbench-bulk-action";
import { ListColumnResizeHandle, ListViewSettings, useListViewPreferences, type ListViewColumn } from "./list-view-settings";

const INITIAL_CLIENT_COUNT = 5;

type ColumnKey = "client" | "projectNeed" | "inventory" | "assets" | "estimate" | "review" | "salesActivity" | "tc" | "quote" | "tracked" | "actions";
type SortKey = Exclude<ColumnKey, "actions">;
type SortDirection = "asc" | "desc";
type InventoryCounts = { replaceNow: number; planSoon: number; healthy: number };
const EMPTY_INVENTORY: InventoryCounts = { replaceNow: 0, planSoon: 0, healthy: 0 };

const PROJECT_COVERAGE_COLUMNS: readonly ListViewColumn<ColumnKey>[] = [
  { key: "client", label: "Client", description: "Client name and selection", defaultWidth: 210, minWidth: 165, maxWidth: 380, required: true },
  { key: "projectNeed", label: "Project need", description: "Primary project driver", defaultWidth: 285, minWidth: 180, maxWidth: 520 },
  { key: "inventory", label: "Health", description: "Replace Now · Plan Soon · Current", defaultWidth: 125, minWidth: 105, maxWidth: 190 },
  { key: "assets", label: "Assets", description: "Managed device count", defaultWidth: 82, minWidth: 70, maxWidth: 140, defaultVisible: false },
  { key: "estimate", label: "Est. need", description: "Estimated project need", defaultWidth: 118, minWidth: 100, maxWidth: 190 },
  { key: "review", label: "Last review", description: "Most recent account review", defaultWidth: 130, minWidth: 110, maxWidth: 210 },
  { key: "salesActivity", label: "Last sales activity", description: "Latest TC sales activity", defaultWidth: 142, minWidth: 120, maxWidth: 220 },
  { key: "tc", label: "TC", description: "TC tied to latest sales activity", defaultWidth: 135, minWidth: 100, maxWidth: 240 },
  { key: "quote", label: "Last quote", description: "Most recent quote", defaultWidth: 125, minWidth: 105, maxWidth: 200 },
  { key: "tracked", label: "Captain's Log", description: "Captain's Log activity lane", defaultWidth: 135, minWidth: 115, maxWidth: 210, defaultVisible: false },
  { key: "actions", label: "Actions", description: "Open and report", defaultWidth: 180, minWidth: 150, maxWidth: 250, required: true },
];

function formatMoney(value: number): string { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function formatDate(value: string): string { if (!value) return "Not recorded"; const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value); return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date); }
function dateTimestamp(value: string): number { if (!value) return 0; const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value); return Number.isNaN(date.getTime()) ? 0 : date.getTime(); }
function initials(name: string): string { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "CC"; }
function reportUrl(clientId: string, clientName: string): string { const params = new URLSearchParams({ type: "client-report", compassClientId: clientId, client: clientName }); return `/create/?${params.toString()}`; }
function listDescription(position: ProjectCoverageCardId): string { if (position === "needs-review") return "Highest-priority qualified needs that have not yet been reviewed or quoted."; if (position === "discussed-open") return "Qualified needs already discussed with the client but still missing a completed decision."; if (position === "quoted-open") return "Qualified needs with a recorded quote and no completed or otherwise resolved outcome."; if (position === "highest-risk") return "The qualified client book ordered by critical server exposure and technical severity."; if (position === "oldest-quotes") return "Open quotes ordered from the oldest re-engagement need to the most recent."; return "Qualified clients ordered by deduplicated estimated project-package value."; }
function sortIndicator(sortKey: SortKey, activeKey: SortKey | null, direction: SortDirection): string { if (sortKey !== activeKey) return "↕"; return direction === "asc" ? "↑" : "↓"; }
function textCompare(left: string, right: string, direction: SortDirection): number { const a = left.trim(); const b = right.trim(); if (!a && b) return 1; if (a && !b) return -1; return (direction === "asc" ? 1 : -1) * a.localeCompare(b, undefined, { sensitivity: "base" }); }

interface Props { card: ProjectCoverageCardMetric; activeSegmentId?: string | null; onClearSegment?: () => void; onOpenClient: (clientId: string) => void; onCaptainsLogSync?: (clientId: string, sync: CaptainsLogClientSyncResult) => Promise<void> | void; }

export function ProjectCoverageClientList({ card, activeSegmentId = null, onClearSegment, onOpenClient }: Props) {
  const { dataset } = useCompassState();
  const view = useListViewPreferences("project-coverage", PROJECT_COVERAGE_COLUMNS);
  const [activeFilter, setActiveFilter] = useState<ProjectCoverageReasonFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => { setActiveFilter("all"); setShowAll(false); setSortKey(null); setSortDirection("desc"); setSelectedIds([]); }, [card.id]);
  useEffect(() => { setShowAll(false); setSelectedIds([]); }, [activeFilter]);
  useEffect(() => { setActiveFilter("all"); setShowAll(false); setSelectedIds([]); }, [activeSegmentId]);

  const activeSegment = useMemo(() => card.stats.find((stat) => stat.id === activeSegmentId) ?? null, [activeSegmentId, card.stats]);
  const segmentedClients = useMemo(() => { if (!activeSegment) return card.clients; const clientIds = new Set(activeSegment.clientIds); return card.clients.filter((client) => clientIds.has(client.clientId)); }, [activeSegment, card.clients]);
  const filteredClients = useMemo(() => segmentedClients.filter((client) => projectCoverageFilterMatches(client, activeFilter)), [activeFilter, segmentedClients]);

  const inventoryByClient = useMemo(() => { const next = new Map<string, InventoryCounts>(); const clientIds = new Set(card.clients.map((client) => client.clientId)); for (const device of dataset?.devices ?? []) { if (!clientIds.has(device.clientId) || device.deviceType !== "physical-workstation") continue; const current = next.get(device.clientId) ?? { ...EMPTY_INVENTORY }; if (device.lifecycle === "replace-now") current.replaceNow += 1; else if (device.lifecycle === "plan-soon") current.planSoon += 1; else if (device.lifecycle === "current") current.healthy += 1; next.set(device.clientId, current); } return next; }, [card.clients, dataset?.devices]);
  const clientMetaById = useMemo(() => { const next = new Map<string, { assets: number; lastReview: string; lastSalesActivity: string; technicalConsultant: string; tracked: boolean }>(); const assets = new Map<string, number>(); for (const device of dataset?.devices ?? []) assets.set(device.clientId, (assets.get(device.clientId) ?? 0) + 1); for (const client of dataset?.clients ?? []) next.set(client.id, { assets: assets.get(client.id) ?? 0, lastReview: client.lastAccountReview || "", lastSalesActivity: client.lastSalesInteraction || "", technicalConsultant: client.technicalConsultant || "", tracked: Boolean(client.captainsLog?.recentActivity?.length || client.captainsLog?.openTasks?.length) }); return next; }, [dataset?.clients, dataset?.devices]);

  const sortedClients = useMemo(() => { const clients = [...filteredClients]; if (!sortKey) return clients; const dir = sortDirection === "asc" ? 1 : -1; clients.sort((left, right) => {
    if (sortKey === "client") return dir * left.clientName.localeCompare(right.clientName);
    if (sortKey === "projectNeed") return textCompare(left.attentionReason || left.priorityReason || "", right.attentionReason || right.priorityReason || "", sortDirection) || left.clientName.localeCompare(right.clientName);
    if (sortKey === "inventory") { const a = inventoryByClient.get(left.clientId) ?? EMPTY_INVENTORY; const b = inventoryByClient.get(right.clientId) ?? EMPTY_INVENTORY; return dir * ((a.replaceNow - b.replaceNow) || (a.planSoon - b.planSoon) || (a.healthy - b.healthy) || left.clientName.localeCompare(right.clientName)); }
    if (sortKey === "assets") return dir * (((clientMetaById.get(left.clientId)?.assets ?? 0) - (clientMetaById.get(right.clientId)?.assets ?? 0)) || left.clientName.localeCompare(right.clientName));
    if (sortKey === "estimate") return dir * (left.estimatedValue - right.estimatedValue || left.clientName.localeCompare(right.clientName));
    if (sortKey === "review") return dir * (dateTimestamp(clientMetaById.get(left.clientId)?.lastReview || left.reviewDate || "") - dateTimestamp(clientMetaById.get(right.clientId)?.lastReview || right.reviewDate || "") || left.clientName.localeCompare(right.clientName));
    if (sortKey === "salesActivity") { const leftDate = dateTimestamp(clientMetaById.get(left.clientId)?.lastSalesActivity || ""); const rightDate = dateTimestamp(clientMetaById.get(right.clientId)?.lastSalesActivity || ""); if (!leftDate && rightDate) return sortDirection === "asc" ? -1 : 1; if (leftDate && !rightDate) return sortDirection === "asc" ? 1 : -1; return dir * (leftDate - rightDate || left.clientName.localeCompare(right.clientName)); }
    if (sortKey === "tc") return textCompare(clientMetaById.get(left.clientId)?.technicalConsultant || "", clientMetaById.get(right.clientId)?.technicalConsultant || "", sortDirection) || left.clientName.localeCompare(right.clientName);
    if (sortKey === "quote") { const leftDate = dateTimestamp(left.quoteDate); const rightDate = dateTimestamp(right.quoteDate); if (!leftDate && rightDate) return 1; if (leftDate && !rightDate) return -1; return dir * (leftDate - rightDate || left.clientName.localeCompare(right.clientName)); }
    return dir * (Number(clientMetaById.get(left.clientId)?.tracked) - Number(clientMetaById.get(right.clientId)?.tracked) || left.clientName.localeCompare(right.clientName));
  }); return clients; }, [clientMetaById, filteredClients, inventoryByClient, sortDirection, sortKey]);

  const visibleClients = showAll ? sortedClients : sortedClients.slice(0, INITIAL_CLIENT_COUNT);
  const hiddenCount = Math.max(0, sortedClients.length - visibleClients.length);
  const motionKey = `${card.id}-${activeSegmentId ?? "all-segments"}-${activeFilter}-${showAll ? "all" : "priority"}-${sortKey ?? "priority"}-${sortDirection}`;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected = visibleClients.length > 0 && visibleClients.every((client) => selectedSet.has(client.clientId));

  const updateSort = (nextKey: SortKey) => { if (sortKey === nextKey) { setSortDirection((current) => current === "asc" ? "desc" : "asc"); return; } setSortKey(nextKey); setSortDirection(nextKey === "client" || nextKey === "projectNeed" || nextKey === "salesActivity" || nextKey === "tc" ? "asc" : "desc"); };
  const sortButton = (key: SortKey, label: string) => <button type="button" className={`project-coverage-sort-button${sortKey === key ? " is-active" : ""}`} onClick={() => updateSort(key)}>{label} <span aria-hidden="true">{sortIndicator(key, sortKey, sortDirection)}</span></button>;
  const toggleSelected = (clientId: string) => setSelectedIds((current) => current.includes(clientId) ? current.filter((id) => id !== clientId) : [...current, clientId]);

  const headerFor = (column: ColumnKey) => {
    const meta = view.byKey.get(column)!;
    const content = column === "actions" ? <span>{meta.label}</span> : sortButton(column, meta.label);
    return <th key={column} className="list-view-column-head">{content}<ListColumnResizeHandle column={column} view={view} /></th>;
  };

  const cellFor = (column: ColumnKey, client: ProjectCoverageCardMetric["clients"][number], index: number) => {
    const inventory = inventoryByClient.get(client.clientId) ?? EMPTY_INVENTORY;
    const meta = clientMetaById.get(client.clientId);
    const lastReview = meta?.lastReview || client.reviewDate || "";
    if (column === "client") return <td key={column} data-label="Client"><div className="project-coverage-client-name"><label className="workbench-select" aria-label={`Select ${client.clientName}`}><input type="checkbox" checked={selectedSet.has(client.clientId)} onChange={() => toggleSelected(client.clientId)} /></label><span aria-hidden="true">{initials(client.clientName)}</span><strong>{client.clientName}</strong></div></td>;
    if (column === "projectNeed") return <td key={column} data-label="Project need"><span className="project-coverage-attention">{client.attentionReason || client.priorityReason}</span></td>;
    if (column === "inventory") return <td key={column} data-label="Health"><span className="segment-client-health project-coverage-inventory" title="Replace Now · Plan Soon · Current"><b className="risk"><i />{inventory.replaceNow}</b><b className="attention"><i />{inventory.planSoon}</b><b className="healthy"><i />{inventory.healthy}</b></span></td>;
    if (column === "assets") return <td key={column} data-label="Assets"><span className="project-coverage-assets">{meta?.assets ?? 0}</span></td>;
    if (column === "estimate") return <td key={column} data-label="Est. need"><strong className="project-coverage-estimate">{formatMoney(client.estimatedValue)}</strong></td>;
    if (column === "review") return <td key={column} data-label="Last review"><span className="project-coverage-review-date">{formatDate(lastReview)}</span></td>;
    if (column === "salesActivity") return <td key={column} data-label="Last sales activity"><span className="project-coverage-sales-activity">{formatDate(meta?.lastSalesActivity || "")}</span></td>;
    if (column === "tc") return <td key={column} data-label="TC"><span className="project-coverage-tc">{meta?.technicalConsultant || "Not assigned"}</span></td>;
    if (column === "quote") return <td key={column} data-label="Last quote"><span className="project-coverage-quote-date">{client.quoteDate ? formatDate(client.quoteDate) : "Not recorded"}</span></td>;
    if (column === "tracked") return <td key={column} data-label="Captain's Log"><ClientTrackedAction clientId={client.clientId} clientName={client.clientName} tracked={Boolean(meta?.tracked)} /></td>;
    return <td key={column} data-label="Actions"><span className="project-coverage-row-actions"><button className="project-coverage-open-client" type="button" onClick={() => onOpenClient(client.clientId)}>Open</button><Link className="project-coverage-report-client" href={reportUrl(client.clientId, client.clientName)}>Report</Link></span></td>;
  };

  return <section className={`project-coverage-client-list list-${card.id}`} aria-labelledby="project-coverage-client-list-title">
    <header className="project-coverage-client-list-header"><div><span className="project-coverage-list-kicker">Selected coverage position</span><h2 id="project-coverage-client-list-title">{card.title} <small>(<AnimatedNumber value={card.count} duration={520} delay={80} />)</small></h2><p>{listDescription(card.id)}</p></div><div className="project-coverage-list-summary"><strong><AnimatedNumber value={card.estimatedValue} duration={760} delay={120} format={(value) => formatMoney(Math.round(value))} /></strong><span>{card.valueLabel}</span></div></header>
    {activeSegment && <div className="project-coverage-active-segment" role="status"><span><strong>{activeSegment.label}</strong><small>{segmentedClients.length} client{segmentedClients.length === 1 ? "" : "s"} from the selected card detail</small></span><button type="button" onClick={onClearSegment}>Clear segment</button></div>}
    <ProjectCoverageFilters clients={segmentedClients} activeFilter={activeFilter} onChange={setActiveFilter} />
    <div className="workbench-selection-toolbar list-view-toolbar">{visibleClients.length > 0 && <><button type="button" className="workbench-bulk-action" onClick={() => setSelectedIds(allVisibleSelected ? selectedIds.filter((id) => !visibleClients.some((client) => client.clientId === id)) : [...new Set([...selectedIds, ...visibleClients.map((client) => client.clientId)])])}>{allVisibleSelected ? "Clear visible" : "Select visible"}</button>{selectedIds.length > 0 && <><small>{selectedIds.length} selected</small><WorkbenchBulkAction clientIds={selectedIds} onAdded={() => setSelectedIds([])} /></>}</>}<ListViewSettings view={view} /></div>

    {visibleClients.length ? <div key={motionKey} className="project-coverage-table-wrap project-coverage-list-motion list-view-table-scroll"><table className="project-coverage-table project-coverage-table-v10953 list-view-configurable" style={{ width: `${Math.max(view.totalWidth, 900)}px` }}><colgroup>{view.rendered.map((column) => <col key={column} style={{ width: `${view.widths[column]}px` }} />)}</colgroup><thead><tr>{view.rendered.map(headerFor)}</tr></thead><tbody>{visibleClients.map((client, index) => <tr key={client.clientId} style={{ "--row-motion-index": index } as CSSProperties}>{view.rendered.map((column) => cellFor(column, client, index))}</tr>)}</tbody></table></div> : <div key={motionKey} className="project-coverage-list-empty project-coverage-list-motion"><span className="project-coverage-empty-pulse" aria-hidden="true" /><strong>No clients match this reason filter.</strong><span>{activeSegment ? `${activeSegment.label} contains ${segmentedClients.length} client${segmentedClients.length === 1 ? "" : "s"} before the reason filter.` : `The selected coverage position still contains ${card.count} qualifying client${card.count === 1 ? "" : "s"}.`}</span><button type="button" onClick={() => setActiveFilter("all")}>Show all project needs</button></div>}
    {sortedClients.length > INITIAL_CLIENT_COUNT && <div className="project-coverage-view-all"><button type="button" onClick={() => setShowAll((current) => !current)}>{showAll ? "Show highest-priority clients" : `View all ${sortedClients.length} clients`}<span aria-hidden="true">{showAll ? "↑" : "→"}</span></button>{!showAll && hiddenCount > 0 && <small>{hiddenCount} more client{hiddenCount === 1 ? "" : "s"} in this filtered list</small>}</div>}
  </section>;
}
