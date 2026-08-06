"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { recalculateDataset } from "@/lib/compass/engine";
import { campaignHealthForClient, clientHasQuote, clientReviewDate } from "@/lib/compass/review-campaigns";
import { saveCompassDataset } from "@/lib/compass/store";
import type { CompassClient, CompassConfig, CompassDataset, CompassDevice, CompassFinding } from "@/lib/compass/types";
import { ReviewOutcomeEditor } from "./review-outcome-editor";
import { createReviewOutcomeItem, dispositionOption, hasAgreedReviewPlan } from "@/lib/review-outcomes/model";
import { buildCompassLocationSnapshots, buildCompassProjectPackages } from "@/lib/compass/project-packaging";

interface Props {
  clientId: string;
  dataset: CompassDataset;
  config: CompassConfig;
  onBack: () => void;
  onCloseAll: () => void;
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

function today(): string { return new Date().toISOString().slice(0, 10); }

function generatorUrl(client: CompassClient, context: string): string {
  const params = new URLSearchParams({ type: "client-report", compassClientId: client.id, client: client.name });
  if (client.primaryContact) params.set("contact", client.primaryContact);
  if (context) params.set("context", context);
  return `/create/?${params.toString()}`;
}

function deviceTypeLabel(device: CompassDevice): string {
  const labels: Record<CompassDevice["deviceType"], string> = {
    "physical-server": "Physical Server",
    "virtual-server": "Virtual Server",
    "physical-workstation": "Physical Workstation",
    "virtual-workstation": "Virtual Workstation / VM",
    unknown: "Unknown Device",
  };
  return labels[device.deviceType];
}

function storageLabel(device: CompassDevice): string {
  const attention = device.diskVolumes.filter((volume) => volume.state === "critical" || volume.state === "watch");
  if (!attention.length) return "Healthy / unknown";
  return attention.map((volume) => `${volume.label} ${volume.state}${volume.freeGb !== null ? ` · ${Math.round(volume.freeGb)} GB free` : ""}`).join("; ");
}

function findingGroup(findings: CompassFinding[], categories: string[]): CompassFinding[] {
  return findings.filter((finding) => categories.includes(finding.category));
}

export function CompassClientWorkspace({ clientId, dataset, config, onBack, onCloseAll, onDatasetSaved }: Props) {
  const client = dataset.clients.find((item) => item.id === clientId);
  const summary = dataset.summaries.find((item) => item.clientId === clientId);
  const devices = useMemo(() => dataset.devices.filter((device) => device.clientId === clientId), [clientId, dataset.devices]);
  const findings = useMemo(() => dataset.findings.filter((finding) => finding.clientId === clientId), [clientId, dataset.findings]);
  const locations = useMemo(() => dataset.locations.filter((location) => location.clientId === clientId), [clientId, dataset.locations]);
  const locationSnapshots = useMemo(() => buildCompassLocationSnapshots(dataset, clientId), [clientId, dataset]);
  const projectPackages = useMemo(() => buildCompassProjectPackages(dataset, config, clientId), [clientId, config, dataset]);
  const cardById = useMemo(() => new Map(config.cards.map((card) => [card.id, card])), [config.cards]);
  const [draft, setDraft] = useState<CompassClient | null>(client ? structuredClone(client) : null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reviewEditorOpen, setReviewEditorOpen] = useState(false);
  const [activeLocationId, setActiveLocationId] = useState("");

  useEffect(() => { setDraft(client ? structuredClone(client) : null); setMessage(""); setError(""); setActiveLocationId(""); }, [client]);
  useEffect(() => { if (activeLocationId && !locationSnapshots.some((location) => location.id === activeLocationId)) setActiveLocationId(""); }, [activeLocationId, locationSnapshots]);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onBack(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack, saving]);

  if (!client || !summary || !draft) return null;

  const health = campaignHealthForClient(draft);
  const selectedLocation = locationSnapshots.find((location) => location.id === activeLocationId);
  const selectedDeviceIds = selectedLocation ? new Set(selectedLocation.deviceIds) : null;
  const visibleDevices = selectedDeviceIds ? devices.filter((device) => selectedDeviceIds.has(device.id)) : devices;
  const visibleFindings = selectedDeviceIds ? findings.filter((finding) => selectedDeviceIds.has(finding.deviceId)) : findings;
  const physicalServers = visibleDevices.filter((device) => device.deviceType === "physical-server");
  const virtualServers = visibleDevices.filter((device) => device.deviceType === "virtual-server");
  const physicalWorkstations = visibleDevices.filter((device) => device.deviceType === "physical-workstation");
  const virtualWorkstations = visibleDevices.filter((device) => device.deviceType === "virtual-workstation");
  const osFindings = findingGroup(visibleFindings, ["server-2012", "unsupported-server-os", "server-2016", "windows-10-active", "windows-11-home"]);
  const lifecycleFindings = findingGroup(visibleFindings, ["server-age-critical", "server-age-warranty-critical", "server-age-planning", "server-warranty-upcoming", "server-consolidation", "replace-now", "plan-soon"]);
  const storageFindings = findingGroup(visibleFindings, ["critical-storage", "watch-storage", "critical-server-storage"]);
  const warrantyFindings = findingGroup(visibleFindings, ["expired-server-warranty", "expired-workstation-warranty"]);
  const visibleProjects = activeLocationId ? projectPackages.filter((project) => project.locationIds.includes(activeLocationId)) : projectPackages;
  const memberships = summary.opportunities
    .filter((opportunity) => opportunity.cardCategory !== "all" && opportunity.cardCategory !== "reviews-due" && opportunity.cardCategory !== "quote-needed")
    .map((opportunity) => cardById.get(opportunity.cardCategory)?.title ?? opportunity.cardCategory);
  const context = `Client Compass Priority ${summary.priorityScore} — ${summary.priorityTier}. ${summary.topDrivers.join("; ")}. Current needs: ${memberships.join(", ")}.`;
  const reviewSuggestions = summary.opportunities
    .filter((opportunity) => opportunity.cardCategory !== "reviews-due" && opportunity.cardCategory !== "quote-needed" && opportunity.cardCategory !== "all")
    .map((opportunity) => createReviewOutcomeItem({
      title: cardById.get(opportunity.cardCategory)?.title ?? "Technology planning decision",
      technicalFinding: opportunity.drivers.join(". "),
      disposition: "investigate",
      responsibleParty: "Advantage + Client",
      targetDate: "Follow-up",
      includeInReport: true,
      deviceIds: opportunity.affectedDeviceIds,
    }));

  const persist = async (next: CompassClient, successMessage: string) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const normalized = { ...next, quoted: next.quoted || Boolean(next.lastQuoteDate) };
      const nextDataset = { ...dataset, clients: dataset.clients.map((item) => item.id === normalized.id ? normalized : item) };
      await saveCompassDataset(recalculateDataset(nextDataset, config));
      await onDatasetSaved();
      setDraft(structuredClone(normalized));
      setMessage(successMessage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client relationship details could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const saveDetails = () => void persist(draft, "Client relationship details saved.");
  const markReview = () => void persist({ ...draft, lastAccountReview: today(), workflowStatus: "Review Completed" }, "Account review marked complete.");
  const saveReviewOutcome = async (value: { outcome: CompassClient["reviewOutcome"] }) => {
    const reviewedAt = value.outcome.reviewedAt || draft.lastAccountReview;
    await persist({ ...draft, lastAccountReview: draft.lastAccountReview || reviewedAt, reviewOutcome: value.outcome }, value.outcome.status === "confirmed" ? "Confirmed review outcome saved." : "Review outcome saved.");
    setReviewEditorOpen(false);
  };

  return (
    <div className="compass-client-workspace-backdrop" role="presentation" onMouseDown={onBack}>
      <section className="compass-client-workspace" role="dialog" aria-modal="true" aria-labelledby="compass-client-workspace-title" aria-busy={saving} onMouseDown={(event) => event.stopPropagation()}>
        <header className="compass-client-workspace-header">
          <div className="compass-client-workspace-heading">
            <button className="compass-workspace-back" type="button" onClick={onBack}>← Back to campaign</button>
            <span className="compass-kicker">Client relationship workspace</span>
            <h2 id="compass-client-workspace-title">{client.name}</h2>
            <div className="compass-workspace-memberships">{memberships.map((membership) => <span key={membership}>{membership}</span>)}</div>
          </div>
          <button className="compass-drawer-close" type="button" onClick={onCloseAll} aria-label="Close client workspace and campaign">×</button>
        </header>

        <div className="compass-client-summary-grid compass-relationship-summary-grid">
          <div className={`compass-client-health-card status-${health.health}`}><span>Review coverage</span><strong>{health.label}</strong><p>{health.reason}</p></div>
          <div><span>Next relationship action</span><strong>{health.nextAction}</strong><p>Follow-up: {formatDate(draft.nextFollowUp)}</p></div>
          <div><span>Current environment</span><strong>{devices.length} devices</strong><p>{locationSnapshots.length ? `${locationSnapshots.length} named location${locationSnapshots.length === 1 ? "" : "s"}` : "Location not segmented"} · refreshed {formatDate(client.lastDataRefresh || dataset.importedAt)}</p></div>
          <div className="compass-secondary-value-card"><span>General estimated need</span><strong>{formatMoney(summary.totalEstimatedValue)}</strong><p>Planning context only—not a quote or sales forecast.</p></div>
        </div>

        {(message || error) && <div className={error ? "compass-import-error" : "compass-workspace-success"} role={error ? "alert" : "status"}>{error || message}</div>}

        <div className="compass-client-workspace-layout">
          <main className="compass-client-workspace-main">
            <section className="compass-workspace-section compass-client-need-summary">
              <div className="compass-workspace-section-heading"><div><span className="compass-kicker">Why this client is here</span><h3>Current technology needs</h3></div><span>{summary.priorityTier} technical urgency</span></div>
              <div className="compass-client-need-content">
                <p>{summary.topDrivers.join(" · ") || "No scored technical driver is currently recorded."}</p>
                <div>{memberships.map((membership) => <span key={membership}>{membership}</span>)}</div>
              </div>
            </section>

            <section className={`compass-workspace-section compass-review-outcome-summary ${hasAgreedReviewPlan(draft.reviewOutcome) ? "has-plan" : "needs-plan"}`}>
              <div className="compass-workspace-section-heading"><div><span className="compass-kicker">Account review</span><h3>{draft.reviewOutcome.status === "confirmed" ? "Agreed plan and next step" : draft.reviewOutcome.status === "draft" ? "Draft review outcome" : "Record what was discussed"}</h3></div><button className="button secondary compact" type="button" onClick={() => setReviewEditorOpen(true)}>{hasAgreedReviewPlan(draft.reviewOutcome) ? "Edit review outcome" : "Update review outcome"}</button></div>
              {hasAgreedReviewPlan(draft.reviewOutcome) ? <div className="compass-review-outcome-content"><p>{draft.reviewOutcome.meetingSummary || "The client conversation has been recorded."}</p>{draft.reviewOutcome.agreedNextStep && <aside><span>Agreed next step</span><strong>{draft.reviewOutcome.agreedNextStep}</strong></aside>}<div>{draft.reviewOutcome.items.filter((item) => item.includeInReport).map((item) => <span key={item.id}>{item.title}</span>)}</div></div> : <p className="compass-no-findings">The technical need is known, but the client conversation and agreed next step have not been recorded.</p>}
            </section>

            {locationSnapshots.length > 1 && <section className="compass-workspace-section compass-location-section">
              <div className="compass-workspace-section-heading"><div><span className="compass-kicker">Locations</span><h3>View the environment by site</h3></div><span>{selectedLocation ? selectedLocation.name : "All named locations"}</span></div>
              <div className="compass-location-selector" role="tablist" aria-label="Client location view">
                <button type="button" role="tab" aria-selected={!activeLocationId} className={!activeLocationId ? "is-active" : ""} onClick={() => setActiveLocationId("")}>All locations</button>
                {locationSnapshots.map((location) => <button key={location.id} type="button" role="tab" aria-selected={activeLocationId === location.id} className={activeLocationId === location.id ? "is-active" : ""} onClick={() => setActiveLocationId(location.id)}><strong>{location.name}</strong><small>{location.deviceIds.length} devices · {location.physicalServers + location.virtualServers} servers</small></button>)}
              </div>
              {selectedLocation && <div className="compass-location-summary"><span><strong>{selectedLocation.replaceNow}</strong> Replace now</span><span><strong>{selectedLocation.planSoon}</strong> Plan soon</span><span><strong>{selectedLocation.windows10}</strong> Windows 10</span><span><strong>{selectedLocation.storageAttention}</strong> Storage concerns</span><span><strong>{selectedLocation.decisionIds.length}</strong> Agreed decisions</span></div>}
            </section>}

            <section className="compass-workspace-section">
              <div className="compass-workspace-section-heading"><div><span className="compass-kicker">Environment</span><h3>{selectedLocation ? `${selectedLocation.name} device profile` : "Current device profile"}</h3></div></div>
              <div className="compass-technical-counts">
                <div><strong>{physicalServers.length}</strong><span>Physical servers</span></div>
                <div><strong>{virtualServers.length}</strong><span>Virtual servers</span></div>
                <div><strong>{physicalWorkstations.length}</strong><span>Physical workstations</span></div>
                <div><strong>{virtualWorkstations.length}</strong><span>Virtual machines</span></div>
              </div>
            </section>

            <section className="compass-workspace-section compass-project-packages-section compass-client-needs-section">
              <div className="compass-workspace-section-heading"><div><span className="compass-kicker">What needs attention</span><h3>{selectedLocation ? `${selectedLocation.name} technology needs` : "Grouped technology needs"}</h3></div><span>{visibleProjects.length} item{visibleProjects.length === 1 ? "" : "s"}</span></div>
              {visibleProjects.length ? <div className="compass-project-package-grid">{visibleProjects.map((project) => {
                const option = dispositionOption(project.disposition);
                const projectLocations = locations.filter((location) => project.locationIds.includes(location.id)).map((location) => location.name);
                return <article key={project.id} className={`project-package-${option.tone}`}>
                  <div className="compass-project-package-top"><span>{project.source === "review-outcome" ? "Agreed need" : "Technical need"}</span></div>
                  <h4>{project.title}</h4>
                  <p>{project.technicalDrivers.join(" · ") || "Identified from the current technical findings."}</p>
                  <div className="compass-project-package-meta"><span>{project.deviceIds.length} device{project.deviceIds.length === 1 ? "" : "s"}</span>{projectLocations.length > 0 && <span>{projectLocations.join(", ")}</span>}<span>{option.label}</span><span>{project.timing}</span></div>
                  <div className="compass-project-responsibilities"><div><small>Client</small><strong>{project.clientResponsibility}</strong></div><div><small>Advantage</small><strong>{project.advantageResponsibility}</strong></div></div>
                </article>;
              })}</div> : <p className="compass-no-findings">No grouped technology need is tied to this location yet.</p>}
            </section>

            <details className="compass-workspace-section compass-workspace-details">
              <summary><span><small>Technical detail</small><strong>Findings and technical drivers</strong></span><b>{visibleFindings.length} findings</b></summary>
              <div className="compass-finding-groups">
                {[["Operating systems", osFindings], ["Lifecycle", lifecycleFindings], ["Storage", storageFindings], ["Warranty", warrantyFindings]].map(([label, group]) => {
                  const typedGroup = group as CompassFinding[];
                  return <div key={label as string}><h4>{label as string}<span>{typedGroup.length}</span></h4>{typedGroup.length ? typedGroup.slice(0, 12).map((finding) => <article key={finding.id} className={`severity-${finding.severity}`}><strong>{finding.title}</strong><p>{finding.explanation}</p></article>) : <p className="compass-no-findings">No current findings in this group.</p>}</div>;
                })}
              </div>
            </details>

            <details className="compass-workspace-section compass-workspace-details">
              <summary><span><small>Technical detail</small><strong>{selectedLocation ? `${selectedLocation.name} inventory` : "Current device inventory"}</strong></span><b>{visibleDevices.length} devices</b></summary>
              <div className="compass-inventory-table-wrap">
                <table className="compass-inventory-table">
                  <thead><tr><th>Device</th><th>Type</th><th>Operating system</th><th>Lifecycle</th><th>Storage</th><th>Warranty</th><th>Last check-in</th></tr></thead>
                  <tbody>{[...visibleDevices].sort((a, b) => a.deviceType.localeCompare(b.deviceType) || a.name.localeCompare(b.name)).map((device) => <tr key={device.id}><td><strong>{device.name}</strong><span>{device.model || "Model unavailable"}</span></td><td><span className={device.isVirtual ? "is-virtual" : ""}>{deviceTypeLabel(device)}</span>{device.virtualizationPlatform && <small>{device.virtualizationPlatform}</small>}</td><td>{device.osName || "Unknown"}</td><td><span className={`compass-lifecycle-pill lifecycle-${device.lifecycle}`}>{device.lifecycle.replace("-", " ")}</span></td><td>{storageLabel(device)}</td><td>{formatDate(device.warrantyEnd)}</td><td>{formatDate(device.lastUptime || device.lastLogin)}</td></tr>)}</tbody>
                </table>
              </div>
            </details>
          </main>

          <aside className="compass-client-actions-panel">
            <section className="compass-review-action-panel">
              <span className="compass-kicker">Account review</span>
              <h3>Document the client conversation</h3>
              <p>{hasAgreedReviewPlan(draft.reviewOutcome) ? `${draft.reviewOutcome.items.filter((item) => item.includeInReport).length} agreed decision${draft.reviewOutcome.items.filter((item) => item.includeInReport).length === 1 ? "" : "s"} are recorded.` : "Record the discussion, client decision, responsibilities, timing, and agreed next step."}</p>
              <button className="button primary full" type="button" onClick={() => setReviewEditorOpen(true)}>{hasAgreedReviewPlan(draft.reviewOutcome) ? "Edit Review Outcome" : "Update Review Outcome"}</button>
              <button className="button secondary full" type="button" disabled={saving} onClick={markReview}>Mark Review Complete Today</button>
            </section>

            <section>
              <span className="compass-kicker">Client report</span>
              <h3>Prepare the account-review deliverable</h3>
              <Link className="button primary full" href={generatorUrl(client, context)}>Open Client Report</Link>
            </section>

            <section>
              <span className="compass-kicker">Relationship details</span>
              <h3>History and next action</h3>
              <label><span>Primary contact</span><input value={draft.primaryContact} onChange={(event) => setDraft({ ...draft, primaryContact: event.target.value })} /></label>
              <label><span>Contact role</span><input value={draft.primaryContactRole} onChange={(event) => setDraft({ ...draft, primaryContactRole: event.target.value })} /></label>
              <label><span>Contact email</span><input type="email" value={draft.primaryContactEmail} onChange={(event) => setDraft({ ...draft, primaryContactEmail: event.target.value })} /></label>
              <label><span>Contact phone</span><input type="tel" value={draft.primaryContactPhone} onChange={(event) => setDraft({ ...draft, primaryContactPhone: event.target.value })} /></label>
              <label><span>Technology Consultant / owner</span><input value={draft.assignedOwner} onChange={(event) => setDraft({ ...draft, assignedOwner: event.target.value })} /></label>
              <label><span>Relationship status</span><select value={draft.workflowStatus} onChange={(event) => setDraft({ ...draft, workflowStatus: event.target.value })}><option value="">No status</option><option>Needs Review</option><option>Ready to Contact</option><option>Contacted</option><option>Review Scheduled</option><option>Review Completed</option><option>Consultation Recommended</option><option>Consultation Accepted</option><option>Remote Consultation Scheduled</option><option>Onsite Review Scheduled</option><option>Waiting</option><option>Monitoring</option><option>Deferred</option><option>Completed</option></select></label>
              <label><span>Last account review</span><input type="date" value={draft.lastAccountReview?.slice(0, 10) || ""} onChange={(event) => setDraft({ ...draft, lastAccountReview: event.target.value })} /></label>
              <label><span>Last sales interaction</span><input type="date" value={draft.lastSalesInteraction?.slice(0, 10) || ""} onChange={(event) => setDraft({ ...draft, lastSalesInteraction: event.target.value })} /></label>
              <label><span>Last quote date</span><input type="date" value={draft.lastQuoteDate?.slice(0, 10) || ""} onChange={(event) => setDraft({ ...draft, lastQuoteDate: event.target.value, quoted: Boolean(event.target.value) || draft.quoted })} /></label>
              <label className="compass-quoted-toggle"><input type="checkbox" checked={Boolean(draft.quoted)} onChange={(event) => setDraft({ ...draft, quoted: event.target.checked })} /><span>Quoted</span></label>
              <small>{clientHasQuote(draft) ? `Completed handoff recorded${draft.lastQuoteDate ? ` on ${formatDate(draft.lastQuoteDate)}` : ""}.` : "Leave blank when no quote was warranted or completed."}</small>
              <label><span>Next follow-up</span><input type="date" value={draft.nextFollowUp?.slice(0, 10) || ""} onChange={(event) => setDraft({ ...draft, nextFollowUp: event.target.value })} /></label>
              <label><span>Relationship note</span><textarea rows={5} value={draft.internalNote} onChange={(event) => setDraft({ ...draft, internalNote: event.target.value })} placeholder="Short context for the next client conversation" /></label>
              <button className="button primary full" type="button" disabled={saving} onClick={saveDetails}>{saving ? "Saving…" : "Save relationship details"}</button>
              <small>Review on file: {formatDate(clientReviewDate(draft))}</small>
            </section>
          </aside>
        </div>
      </section>
      {reviewEditorOpen && <ReviewOutcomeEditor outcome={draft.reviewOutcome} suggestions={reviewSuggestions} saving={saving} onClose={() => setReviewEditorOpen(false)} onSave={saveReviewOutcome} />}
    </div>
  );
}
