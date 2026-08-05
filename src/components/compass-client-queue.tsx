"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { recalculateDataset } from "@/lib/compass/engine";
import { saveCompassDataset } from "@/lib/compass/store";
import type { CompassCardCategory, CompassConfig, CompassDataset } from "@/lib/compass/types";

type QueueSort = "priority" | "value" | "review";

interface Props {
  cardId: CompassCardCategory;
  dataset: CompassDataset;
  config: CompassConfig;
  onClose: () => void;
  onOpenClient: (clientId: string) => void;
  onDatasetSaved: () => Promise<void> | void;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function generatorUrl(type: "client-report", clientId: string, clientName: string, contact: string, context: string): string {
  const params = new URLSearchParams({ type, compassClientId: clientId, client: clientName });
  if (contact) params.set("contact", contact);
  if (context) params.set("context", context);
  return `/create/?${params.toString()}`;
}

function dateValue(value: string): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

export function CompassClientQueue({ cardId, dataset, config, onClose, onOpenClient, onDatasetSaved }: Props) {
  const [sort, setSort] = useState<QueueSort>("priority");
  const [owner, setOwner] = useState("all");
  const [location, setLocation] = useState("all");
  const [query, setQuery] = useState("");
  const [followUpClientId, setFollowUpClientId] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
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
      return [{
        client,
        summary,
        opportunity,
        locations: clientLocations,
        affectedDeviceCount: new Set(opportunity.affectedDeviceIds).size,
      }];
    });
  }, [cardId, dataset]);

  const owners = useMemo(() => [...new Set(rows.map((row) => row.client.assignedOwner).filter(Boolean))].sort(), [rows]);
  const locations = useMemo(() => [...new Set(rows.flatMap((row) => row.locations))].sort(), [rows]);
  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows
      .filter((row) => owner === "all" || row.client.assignedOwner === owner)
      .filter((row) => location === "all" || row.locations.includes(location))
      .filter((row) => !normalizedQuery || `${row.client.name} ${row.client.primaryContact} ${row.client.primaryContactEmail} ${row.client.assignedOwner} ${row.opportunity.drivers.join(" ")}`.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        if (sort === "value") return b.opportunity.estimatedValue - a.opportunity.estimatedValue || b.summary.priorityScore - a.summary.priorityScore;
        if (sort === "review") return dateValue(a.client.lastAccountReview) - dateValue(b.client.lastAccountReview) || b.summary.priorityScore - a.summary.priorityScore;
        return b.summary.priorityScore - a.summary.priorityScore || b.opportunity.estimatedValue - a.opportunity.estimatedValue;
      });
  }, [location, owner, query, rows, sort]);

  const totalValue = rows.reduce((sum, row) => sum + row.opportunity.estimatedValue, 0);

  const saveFollowUp = async (clientId: string) => {
    if (!followUpDate) {
      setError("Choose a follow-up date before saving.");
      return;
    }
    setSavingClientId(clientId);
    setError("");
    try {
      const nextDataset = {
        ...dataset,
        clients: dataset.clients.map((client) => client.id === clientId
          ? { ...client, nextFollowUp: followUpDate, workflowStatus: client.workflowStatus || "Ready to Contact" }
          : client),
      };
      await saveCompassDataset(recalculateDataset(nextDataset, config));
      await onDatasetSaved();
      setFollowUpClientId("");
      setFollowUpDate("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The follow-up could not be saved.");
    } finally {
      setSavingClientId("");
    }
  };

  return (
    <div className="compass-workspace-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="compass-queue-panel" role="dialog" aria-modal="true" aria-labelledby="compass-queue-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="compass-queue-header">
          <div>
            <span className="compass-kicker">Phase 4 client queue</span>
            <h2 id="compass-queue-title">{card?.title ?? "Opportunity Clients"}</h2>
            <p>{card?.description}</p>
          </div>
          <button className="compass-drawer-close" type="button" onClick={onClose} aria-label="Close client queue">×</button>
        </header>

        <div className="compass-queue-summary">
          <div><strong>{rows.length}</strong><span>qualifying clients</span></div>
          <div><strong>{formatMoney(totalValue)}</strong><span>estimated value</span></div>
          <div><strong>{rows.reduce((sum, row) => sum + row.affectedDeviceCount, 0)}</strong><span>affected devices</span></div>
        </div>

        <div className="compass-queue-controls">
          <label className="compass-queue-search"><span>Search</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Client, contact, owner, or driver" /></label>
          <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as QueueSort)}><option value="priority">Priority score</option><option value="value">Estimated value</option><option value="review">Oldest account review</option></select></label>
          <label><span>Owner</span><select value={owner} onChange={(event) => setOwner(event.target.value)}><option value="all">All owners</option>{owners.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>Location</span><select value={location} onChange={(event) => setLocation(event.target.value)}><option value="all">All locations</option>{locations.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </div>

        {error && <div className="compass-import-error" role="alert">{error}</div>}
        <div className="compass-queue-results-note">Showing {visibleRows.length} of {rows.length} qualifying clients. Technical score and workflow dates remain separate.</div>

        <div className="compass-queue-table-wrap">
          <table className="compass-queue-table">
            <thead><tr><th>Client</th><th>Priority</th><th>Qualification</th><th>Workflow</th><th>Estimated value</th><th>Actions</th></tr></thead>
            <tbody>
              {visibleRows.map(({ client, summary, opportunity, locations: clientLocations, affectedDeviceCount }) => {
                const context = `${card?.title ?? "Client Compass opportunity"}: ${opportunity.drivers.join("; ")}. Compass Priority ${summary.priorityScore} — ${summary.priorityTier}.`;
                const editingFollowUp = followUpClientId === client.id;
                return (
                  <tr key={client.id}>
                    <td><strong>{client.name}</strong><span>{client.primaryContact || "No primary contact"}</span><small>{client.assignedOwner || "No owner assigned"}{clientLocations.length ? ` · ${clientLocations.join(", ")}` : ""}</small></td>
                    <td><span className={`compass-priority-pill tier-${summary.priorityTier.toLowerCase()}`}>{summary.priorityScore} · {summary.priorityTier}</span><small>{summary.topDrivers.slice(0, 3).join(" · ") || "No scored driver"}</small></td>
                    <td><strong>{affectedDeviceCount} affected device{affectedDeviceCount === 1 ? "" : "s"}</strong><span>{opportunity.drivers.join(" · ") || "Manually confirmed opportunity"}</span></td>
                    <td><span>Review: {formatDate(client.lastAccountReview)}</span><span>Quoted: <span className="compass-quoted-status" aria-label={client.quoted ? "Quoted" : "Not quoted"}>{client.quoted ? "✓" : ""}</span></span><span>Follow-up: {formatDate(client.nextFollowUp)}</span><small>{client.workflowStatus || "No workflow status"} · refreshed {formatDate(client.lastDataRefresh || dataset.importedAt)}</small></td>
                    <td><strong>{formatMoney(opportunity.estimatedValue)}</strong><small>Internal estimate</small></td>
                    <td>
                      <div className="compass-queue-row-actions">
                        <button className="button primary compact" type="button" onClick={() => onOpenClient(client.id)}>Open Client</button>
                        <Link className="button secondary compact" href={generatorUrl("client-report", client.id, client.name, client.primaryContact, context)}>Generate Report</Link>
                        <button className="button secondary compact" type="button" onClick={() => { setFollowUpClientId(editingFollowUp ? "" : client.id); setFollowUpDate(client.nextFollowUp?.slice(0, 10) || ""); setError(""); }}>Mark for Follow-Up</button>
                      </div>
                      {editingFollowUp && <div className="compass-inline-followup"><input type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} /><button type="button" disabled={savingClientId === client.id} onClick={() => void saveFollowUp(client.id)}>{savingClientId === client.id ? "Saving…" : "Save"}</button></div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibleRows.length && <div className="compass-queue-empty">No qualifying clients match the current filters.</div>}
        </div>
      </section>
    </div>
  );
}
