"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { recalculateDataset } from "@/lib/compass/engine";
import {
  campaignHealthForClient,
  campaignHealthMetrics,
  clientHasQuote,
  clientReviewDate,
  type CampaignHealth,
} from "@/lib/compass/review-campaigns";
import { saveCompassDataset } from "@/lib/compass/store";
import type { CompassCardCategory, CompassClient, CompassConfig, CompassDataset } from "@/lib/compass/types";

type QueueSort = "campaign" | "priority" | "value" | "review" | "follow-up";

interface Props {
  cardId: CompassCardCategory;
  dataset: CompassDataset;
  config: CompassConfig;
  onClose: () => void;
  onOpenClient: (clientId: string) => void;
  onDatasetSaved: () => Promise<void> | void;
}

interface HistoryDraft {
  lastAccountReview: string;
  lastSalesInteraction: string;
  lastQuoteDate: string;
  quoted: boolean;
  nextFollowUp: string;
}

const HEALTH_ORDER: Record<Exclude<CampaignHealth, "all">, number> = {
  "review-needed": 0,
  "follow-through": 1,
  served: 2,
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatCompactMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return formatMoney(value);
}

function formatDate(value: string): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function generatorUrl(clientId: string, clientName: string, contact: string, context: string): string {
  const params = new URLSearchParams({ type: "client-report", compassClientId: clientId, client: clientName });
  if (contact) params.set("contact", contact);
  if (context) params.set("context", context);
  return `/create/?${params.toString()}`;
}

function dateValue(value: string): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function futureDateValue(value: string): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function draftFor(client: CompassClient): HistoryDraft {
  return {
    lastAccountReview: client.lastAccountReview?.slice(0, 10) || client.reviewOutcome.reviewedAt?.slice(0, 10) || "",
    lastSalesInteraction: client.lastSalesInteraction?.slice(0, 10) || "",
    lastQuoteDate: client.lastQuoteDate?.slice(0, 10) || "",
    quoted: clientHasQuote(client),
    nextFollowUp: client.nextFollowUp?.slice(0, 10) || "",
  };
}

export function CompassClientQueue({ cardId, dataset, config, onClose, onOpenClient, onDatasetSaved }: Props) {
  const [sort, setSort] = useState<QueueSort>("campaign");
  const [healthFilter, setHealthFilter] = useState<CampaignHealth>("all");
  const [owner, setOwner] = useState("all");
  const [location, setLocation] = useState("all");
  const [query, setQuery] = useState("");
  const [historyClientId, setHistoryClientId] = useState("");
  const [historyDraft, setHistoryDraft] = useState<HistoryDraft | null>(null);
  const [savingClientId, setSavingClientId] = useState("");
  const [error, setError] = useState("");

  const card = config.cards.find((item) => item.id === cardId);
  const rows = useMemo(() => {
    const clientById = new Map(dataset.clients.map((client) => [client.id, client]));
    const locationById = new Map(dataset.locations.map((item) => [item.id, item]));
    return dataset.summaries.flatMap((summary) => {
      const opportunity = summary.opportunities.find((item) => item.cardCategory === cardId);
      const client = clientById.get(summary.clientId);
      if (!opportunity || !client) return [];
      const clientLocations = [...new Set(dataset.devices
        .filter((device) => device.clientId === client.id)
        .map((device) => locationById.get(device.locationId)?.name)
        .filter((value): value is string => Boolean(value)))];
      return {
        client,
        summary,
        opportunity,
        health: campaignHealthForClient(client),
        locations: clientLocations,
        affectedDeviceCount: new Set(opportunity.affectedDeviceIds).size,
      };
    });
  }, [cardId, dataset]);

  const metrics = useMemo(() => campaignHealthMetrics(rows), [rows]);
  const metricByHealth = useMemo(() => new Map(metrics.map((metric) => [metric.health, metric])), [metrics]);
  const owners = useMemo(() => [...new Set(rows.map((row) => row.client.assignedOwner).filter(Boolean))].sort(), [rows]);
  const locations = useMemo(() => [...new Set(rows.flatMap((row) => row.locations))].sort(), [rows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows
      .filter((row) => healthFilter === "all" || row.health.health === healthFilter)
      .filter((row) => owner === "all" || row.client.assignedOwner === owner)
      .filter((row) => location === "all" || row.locations.includes(location))
      .filter((row) => !normalizedQuery || `${row.client.name} ${row.client.primaryContact} ${row.client.primaryContactEmail} ${row.client.assignedOwner} ${row.opportunity.drivers.join(" ")} ${row.health.label} ${row.health.nextAction}`.toLowerCase().includes(normalizedQuery));
  }, [healthFilter, location, owner, query, rows]);

  const visibleRows = useMemo(() => [...filteredRows].sort((a, b) => {
    if (sort === "value") return b.opportunity.estimatedValue - a.opportunity.estimatedValue || b.summary.priorityScore - a.summary.priorityScore;
    if (sort === "review") return dateValue(clientReviewDate(a.client)) - dateValue(clientReviewDate(b.client)) || b.summary.priorityScore - a.summary.priorityScore;
    if (sort === "follow-up") return futureDateValue(a.client.nextFollowUp) - futureDateValue(b.client.nextFollowUp) || b.summary.priorityScore - a.summary.priorityScore;
    if (sort === "priority") return b.summary.priorityScore - a.summary.priorityScore || b.opportunity.estimatedValue - a.opportunity.estimatedValue;
    return HEALTH_ORDER[a.health.health] - HEALTH_ORDER[b.health.health]
      || dateValue(clientReviewDate(a.client)) - dateValue(clientReviewDate(b.client))
      || b.summary.priorityScore - a.summary.priorityScore;
  }), [filteredRows, sort]);

  const selectedValue = filteredRows.reduce((sum, row) => sum + row.opportunity.estimatedValue, 0);
  const selectedDevices = filteredRows.reduce((sum, row) => sum + row.affectedDeviceCount, 0);
  const allMetric = metricByHealth.get("all")!;
  const activeLabel = healthFilter === "all" ? "All campaign clients" : metricByHealth.get(healthFilter)?.health === "served" ? "Reviewed and served" : healthFilter === "follow-through" ? "Follow-through needed" : "Review needed";

  const openHistory = (client: CompassClient) => {
    if (historyClientId === client.id) {
      setHistoryClientId("");
      setHistoryDraft(null);
      return;
    }
    setHistoryClientId(client.id);
    setHistoryDraft(draftFor(client));
    setError("");
  };

  const saveHistory = async (client: CompassClient) => {
    if (!historyDraft) return;
    setSavingClientId(client.id);
    setError("");
    try {
      const nextClient: CompassClient = {
        ...client,
        lastAccountReview: historyDraft.lastAccountReview,
        lastSalesInteraction: historyDraft.lastSalesInteraction,
        lastQuoteDate: historyDraft.lastQuoteDate,
        quoted: historyDraft.quoted || Boolean(historyDraft.lastQuoteDate),
        nextFollowUp: historyDraft.nextFollowUp,
        workflowStatus: client.workflowStatus || (historyDraft.lastAccountReview ? "Review Completed" : "Needs Review"),
      };
      const nextDataset = { ...dataset, clients: dataset.clients.map((item) => item.id === client.id ? nextClient : item) };
      await saveCompassDataset(recalculateDataset(nextDataset, config));
      await onDatasetSaved();
      setHistoryClientId("");
      setHistoryDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The client history could not be saved.");
    } finally {
      setSavingClientId("");
    }
  };

  return (
    <div className="compass-workspace-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="compass-queue-panel" role="dialog" aria-modal="true" aria-labelledby="compass-queue-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="compass-queue-header">
          <div>
            <span className="compass-kicker">Client review campaign</span>
            <h2 id="compass-queue-title">{card?.title ?? "Client Campaign"}</h2>
            <p>{card?.description}</p>
          </div>
          <button className="compass-drawer-close" type="button" onClick={onClose} aria-label="Close client campaign">×</button>
        </header>

        <div className="compass-campaign-summary">
          <div className="compass-campaign-active-metric">
            <span>{activeLabel}</span>
            <strong>{filteredRows.length} client{filteredRows.length === 1 ? "" : "s"}</strong>
            <b>{formatMoney(selectedValue)}</b>
            <small>{selectedDevices} affected device{selectedDevices === 1 ? "" : "s"} in the current list</small>
          </div>
          <div className="compass-campaign-health-wrap">
            <div className="compass-campaign-health-heading">
              <span>Campaign health</span>
              <button type="button" className={healthFilter === "all" ? "is-active" : ""} onClick={() => setHealthFilter("all")}>All {allMetric.count} · {formatCompactMoney(allMetric.value)}</button>
            </div>
            <div className="compass-campaign-health-bar" role="group" aria-label="Filter campaign clients by review health">
              {(["served", "follow-through", "review-needed"] as const).map((health) => {
                const metric = metricByHealth.get(health)!;
                const label = health === "served" ? "Reviewed and served" : health === "follow-through" ? "Follow-through needed" : "Review needed";
                const basis = allMetric.count ? Math.max(18, (metric.count / allMetric.count) * 100) : 33.33;
                return <button key={health} type="button" className={`campaign-${health}${healthFilter === health ? " is-active" : ""}`} style={{ flexBasis: `${basis}%` }} onClick={() => setHealthFilter(health)} aria-pressed={healthFilter === health}>
                  <strong>{metric.count}</strong><span>{label}</span><small>{formatCompactMoney(metric.value)}</small>
                </button>;
              })}
            </div>
          </div>
        </div>

        <div className="compass-queue-controls">
          <label className="compass-queue-search"><span>Search campaign</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Client, contact, need, or next action" /></label>
          <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as QueueSort)}><option value="campaign">Review need first</option><option value="review">Oldest account review</option><option value="follow-up">Next follow-up</option><option value="priority">Technical urgency</option><option value="value">Estimated value</option></select></label>
          <label><span>Owner</span><select value={owner} onChange={(event) => setOwner(event.target.value)}><option value="all">All owners</option>{owners.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>Location</span><select value={location} onChange={(event) => setLocation(event.target.value)}><option value="all">All locations</option>{locations.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </div>

        {error && <div className="compass-import-error" role="alert">{error}</div>}
        <div className="compass-queue-results-note">Showing {visibleRows.length} of {rows.length} campaign clients. The color filter, count, estimated value, and list update together.</div>

        <div className="compass-queue-table-wrap">
          <table className="compass-queue-table compass-campaign-table">
            <thead><tr><th>Client</th><th>Why included</th><th>Review coverage</th><th>Next relationship action</th><th>Estimated need</th><th>Actions</th></tr></thead>
            <tbody>
              {visibleRows.map(({ client, summary, opportunity, health, locations: clientLocations, affectedDeviceCount }) => {
                const context = `${card?.title ?? "Client Compass campaign"}: ${opportunity.drivers.join("; ")}. Compass Priority ${summary.priorityScore} — ${summary.priorityTier}.`;
                const editingHistory = historyClientId === client.id && historyDraft;
                return (
                  <tr key={client.id}>
                    <td><strong>{client.name}</strong><span>{client.primaryContact || "No primary contact"}</span><small>{client.assignedOwner || "No owner assigned"}{clientLocations.length ? ` · ${clientLocations.join(", ")}` : ""}</small></td>
                    <td><span className={`compass-priority-pill tier-${summary.priorityTier.toLowerCase()}`}>{summary.priorityTier} · {summary.priorityScore}</span><strong>{affectedDeviceCount} affected device{affectedDeviceCount === 1 ? "" : "s"}</strong><small>{opportunity.drivers.join(" · ") || "Manually confirmed need"}</small></td>
                    <td><span className={`compass-campaign-status status-${health.health}`}>{health.label}</span><span>Review: {formatDate(clientReviewDate(client))}</span><span>Sales interaction: {formatDate(client.lastSalesInteraction)}</span><small>{clientHasQuote(client) ? `Quoted${client.lastQuoteDate ? ` ${formatDate(client.lastQuoteDate)}` : ""}` : "No quote recorded"}</small></td>
                    <td><strong>{health.nextAction}</strong><span>Follow-up: {formatDate(client.nextFollowUp)}</span><small>{client.workflowStatus || "No relationship status recorded"}</small></td>
                    <td><strong>{formatMoney(opportunity.estimatedValue)}</strong><small>General planning estimate</small></td>
                    <td>
                      <div className="compass-queue-row-actions">
                        <button className="button primary compact" type="button" onClick={() => onOpenClient(client.id)}>Open Client</button>
                        <Link className="button secondary compact" href={generatorUrl(client.id, client.name, client.primaryContact, context)}>Report</Link>
                        <button className="button secondary compact" type="button" onClick={() => openHistory(client)}>{editingHistory ? "Close History" : "Update History"}</button>
                      </div>
                      {editingHistory && <div className="compass-inline-history">
                        <label><span>Account review</span><input type="date" value={historyDraft.lastAccountReview} onChange={(event) => setHistoryDraft({ ...historyDraft, lastAccountReview: event.target.value })} /></label>
                        <label><span>Sales interaction</span><input type="date" value={historyDraft.lastSalesInteraction} onChange={(event) => setHistoryDraft({ ...historyDraft, lastSalesInteraction: event.target.value })} /></label>
                        <label><span>Quote date</span><input type="date" value={historyDraft.lastQuoteDate} onChange={(event) => setHistoryDraft({ ...historyDraft, lastQuoteDate: event.target.value, quoted: Boolean(event.target.value) || historyDraft.quoted })} /></label>
                        <label><span>Next follow-up</span><input type="date" value={historyDraft.nextFollowUp} onChange={(event) => setHistoryDraft({ ...historyDraft, nextFollowUp: event.target.value })} /></label>
                        <label className="compass-inline-quoted"><input type="checkbox" checked={historyDraft.quoted} onChange={(event) => setHistoryDraft({ ...historyDraft, quoted: event.target.checked })} /><span>Quoted</span></label>
                        <button type="button" disabled={savingClientId === client.id} onClick={() => void saveHistory(client)}>{savingClientId === client.id ? "Saving…" : "Save history"}</button>
                      </div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibleRows.length && <div className="compass-queue-empty">No clients match the current campaign filters.</div>}
        </div>
      </section>
    </div>
  );
}
