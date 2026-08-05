"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { saveCompassDataset } from "@/lib/compass/store";
import type { CompassClient, CompassConfig, CompassDataset, CompassDevice, CompassFinding } from "@/lib/compass/types";

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

function generatorUrl(type: "client-report" | "prospect-proposal" | "legacy-modernization", client: CompassClient, context: string): string {
  const params = new URLSearchParams({ type, client: client.name });
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

function assumptionText(key: string, config: CompassConfig): string {
  const values: Record<string, string> = {
    standardServerReplacement: `${formatMoney(config.value.standardServerReplacement)} physical-server baseline`,
    advancedServerMigration: `${formatMoney(config.value.advancedServerMigration)} virtual-server / migration baseline`,
    multiServerAdditionalMultiplier: `${Math.round(config.value.multiServerAdditionalMultiplier * 100)}% additional-server multiplier`,
    standardWorkstationModernization: `${formatMoney(config.value.standardWorkstationModernization)} workstation modernization`,
    workstationDeploymentAllowance: `${formatMoney(config.value.workstationDeploymentAllowance)} deployment allowance`,
    virtualOsRemediation: `${formatMoney(config.value.virtualOsRemediation)} virtual OS remediation`,
    storageRemediation: `${formatMoney(config.value.storageRemediation)} storage-remediation baseline`,
    multisiteAdjustment: `${formatMoney(config.value.multisiteAdjustment)} multisite adjustment`,
    planningContingencyPercent: `${config.value.planningContingencyPercent}% planning contingency`,
    customFixedEstimate: "Custom fixed estimate",
    deduplicatedOpportunityValue: "Deduplicated across overlapping server, workstation, storage, fixed-value, and multisite assumptions",
  };
  return values[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function CompassClientWorkspace({ clientId, dataset, config, onBack, onCloseAll, onDatasetSaved }: Props) {
  const client = dataset.clients.find((item) => item.id === clientId);
  const summary = dataset.summaries.find((item) => item.clientId === clientId);
  const devices = useMemo(() => dataset.devices.filter((device) => device.clientId === clientId), [clientId, dataset.devices]);
  const findings = useMemo(() => dataset.findings.filter((finding) => finding.clientId === clientId), [clientId, dataset.findings]);
  const locations = useMemo(() => dataset.locations.filter((location) => location.clientId === clientId), [clientId, dataset.locations]);
  const cardById = useMemo(() => new Map(config.cards.map((card) => [card.id, card])), [config.cards]);
  const [draft, setDraft] = useState<CompassClient | null>(client ? structuredClone(client) : null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { setDraft(client ? structuredClone(client) : null); setMessage(""); setError(""); }, [client]);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onBack(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack, saving]);

  if (!client || !summary || !draft) return null;

  const physicalServers = devices.filter((device) => device.deviceType === "physical-server");
  const virtualServers = devices.filter((device) => device.deviceType === "virtual-server");
  const physicalWorkstations = devices.filter((device) => device.deviceType === "physical-workstation");
  const virtualWorkstations = devices.filter((device) => device.deviceType === "virtual-workstation");
  const osFindings = findingGroup(findings, ["server-2012", "unsupported-server-os", "server-2016", "windows-10-active", "windows-11-home"]);
  const lifecycleFindings = findingGroup(findings, ["server-age-critical", "server-age-warranty-critical", "server-age-planning", "server-warranty-upcoming", "server-consolidation", "replace-now", "plan-soon"]);
  const storageFindings = findingGroup(findings, ["critical-storage", "watch-storage", "critical-server-storage"]);
  const warrantyFindings = findingGroup(findings, ["expired-server-warranty", "expired-workstation-warranty"]);
  const memberships = summary.opportunities.map((opportunity) => cardById.get(opportunity.cardCategory)?.title ?? opportunity.cardCategory);
  const context = `Client Compass Priority ${summary.priorityScore} — ${summary.priorityTier}. ${summary.topDrivers.join("; ")}. Current opportunities: ${memberships.join(", ")}.`;

  const persist = async (next: CompassClient, successMessage: string) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveCompassDataset({ ...dataset, clients: dataset.clients.map((item) => item.id === next.id ? next : item) });
      await onDatasetSaved();
      setDraft(structuredClone(next));
      setMessage(successMessage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client workflow details could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const saveDetails = () => void persist(draft, "Client workflow details saved.");
  const markReview = () => void persist({ ...draft, lastAccountReview: today(), workflowStatus: draft.workflowStatus === "Needs Review" || !draft.workflowStatus ? "Ready to Contact" : draft.workflowStatus }, "Account review marked complete.");
  const markMapping = () => void persist({ ...draft, lastProjectMapping: today(), workflowStatus: draft.workflowStatus === "Project Mapping Needed" || !draft.workflowStatus ? "Ready to Contact" : draft.workflowStatus }, "Project mapping marked complete.");

  return (
    <div className="compass-client-workspace-backdrop" role="presentation" onMouseDown={onBack}>
      <section className="compass-client-workspace" role="dialog" aria-modal="true" aria-labelledby="compass-client-workspace-title" aria-busy={saving} onMouseDown={(event) => event.stopPropagation()}>
        <header className="compass-client-workspace-header">
          <div className="compass-client-workspace-heading">
            <button className="compass-workspace-back" type="button" onClick={onBack}>← Back to queue</button>
            <span className="compass-kicker">Current-state client workspace</span>
            <h2 id="compass-client-workspace-title">{client.name}</h2>
            <div className="compass-workspace-memberships">{memberships.map((membership) => <span key={membership}>{membership}</span>)}</div>
          </div>
          <button className="compass-drawer-close" type="button" onClick={onCloseAll} aria-label="Close client workspace and queue">×</button>
        </header>

        <div className="compass-client-summary-grid">
          <div className="compass-client-score-card"><span>Compass Priority</span><strong>{summary.priorityScore}</strong><b className={`tier-${summary.priorityTier.toLowerCase()}`}>{summary.priorityTier}</b><p>{summary.topDrivers.join(" · ") || "No scored technical driver"}</p></div>
          <div><span>Estimated total project value</span><strong>{formatMoney(summary.totalEstimatedValue)}</strong><p>Deduplicated across current opportunities.</p></div>
          <div><span>Current environment</span><strong>{devices.length} devices</strong><p>{locations.length || 1} location{locations.length === 1 ? "" : "s"} · refreshed {formatDate(client.lastDataRefresh || dataset.importedAt)}</p></div>
          <div><span>Workflow</span><strong>{draft.workflowStatus || "No status"}</strong><p>Next follow-up: {formatDate(draft.nextFollowUp)}</p></div>
        </div>

        {(message || error) && <div className={error ? "compass-import-error" : "compass-workspace-success"} role={error ? "alert" : "status"}>{error || message}</div>}

        <div className="compass-client-workspace-layout">
          <main className="compass-client-workspace-main">
            <section className="compass-workspace-section">
              <div className="compass-workspace-section-heading"><div><span className="compass-kicker">Technical</span><h3>Current device profile</h3></div></div>
              <div className="compass-technical-counts">
                <div><strong>{physicalServers.length}</strong><span>Physical servers</span></div>
                <div><strong>{virtualServers.length}</strong><span>Virtual servers</span></div>
                <div><strong>{physicalWorkstations.length}</strong><span>Physical workstations</span></div>
                <div><strong>{virtualWorkstations.length}</strong><span>Virtual machines</span></div>
              </div>
            </section>

            <section className="compass-workspace-section">
              <div className="compass-workspace-section-heading"><div><span className="compass-kicker">Explainable estimates</span><h3>Current opportunity calculations</h3></div><span>{summary.opportunities.length} card membership{summary.opportunities.length === 1 ? "" : "s"}</span></div>
              <div className="compass-opportunity-breakdown">
                {summary.opportunities.map((opportunity) => {
                  const opportunityCard = cardById.get(opportunity.cardCategory);
                  return <article key={opportunity.cardCategory}><div><span>{opportunityCard?.title ?? opportunity.cardCategory}</span><strong>{formatMoney(opportunity.estimatedValue)}</strong></div><p>{opportunity.drivers.join(" · ") || "Manually confirmed opportunity"}</p><small>{opportunity.affectedDeviceIds.length} affected device{opportunity.affectedDeviceIds.length === 1 ? "" : "s"} · {opportunity.confidence} confidence</small><ul>{opportunity.assumptionKeys.map((key) => <li key={key}>{assumptionText(key, config)}</li>)}</ul></article>;
                })}
              </div>
            </section>

            <section className="compass-workspace-section">
              <div className="compass-workspace-section-heading"><div><span className="compass-kicker">Explainable findings</span><h3>What is driving the opportunity</h3></div></div>
              <div className="compass-finding-groups">
                {[
                  ["Operating systems", osFindings],
                  ["Lifecycle", lifecycleFindings],
                  ["Storage", storageFindings],
                  ["Warranty", warrantyFindings],
                ].map(([label, group]) => {
                  const typedGroup = group as CompassFinding[];
                  return <div key={label as string}><h4>{label as string}<span>{typedGroup.length}</span></h4>{typedGroup.length ? typedGroup.slice(0, 12).map((finding) => <article key={finding.id} className={`severity-${finding.severity}`}><strong>{finding.title}</strong><p>{finding.explanation}</p><small>{finding.scoreContribution ? `+${finding.scoreContribution} priority points` : "Supporting finding"}</small></article>) : <p className="compass-no-findings">No current findings in this group.</p>}</div>;
                })}
              </div>
            </section>

            <section className="compass-workspace-section">
              <div className="compass-workspace-section-heading"><div><span className="compass-kicker">Inventory</span><h3>Current devices</h3></div><span>{devices.length} total</span></div>
              <div className="compass-inventory-table-wrap">
                <table className="compass-inventory-table">
                  <thead><tr><th>Device</th><th>Type</th><th>Operating system</th><th>Lifecycle</th><th>Storage</th><th>Warranty</th><th>Last check-in</th></tr></thead>
                  <tbody>{[...devices].sort((a, b) => a.deviceType.localeCompare(b.deviceType) || a.name.localeCompare(b.name)).map((device) => <tr key={device.id}><td><strong>{device.name}</strong><span>{device.model || "Model unavailable"}</span></td><td><span className={device.isVirtual ? "is-virtual" : ""}>{deviceTypeLabel(device)}</span>{device.virtualizationPlatform && <small>{device.virtualizationPlatform}</small>}</td><td>{device.osName || "Unknown"}</td><td><span className={`compass-lifecycle-pill lifecycle-${device.lifecycle}`}>{device.lifecycle.replace("-", " ")}</span></td><td>{storageLabel(device)}</td><td>{formatDate(device.warrantyEnd)}</td><td>{formatDate(device.lastUptime || device.lastLogin)}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          </main>

          <aside className="compass-client-actions-panel">
            <section>
              <span className="compass-kicker">Output actions</span>
              <h3>Start the next deliverable</h3>
              <Link className="button primary full" href={generatorUrl("client-report", client, context)}>Generate Client Report</Link>
              <Link className="button secondary full" href={generatorUrl("prospect-proposal", client, context)}>Generate Potential Client Proposal</Link>
              <Link className="button secondary full" href={generatorUrl("legacy-modernization", client, context)}>Modernize Existing Proposal</Link>
            </section>

            <section>
              <span className="compass-kicker">Client details</span>
              <h3>Workflow and ownership</h3>
              <label><span>Primary contact</span><input value={draft.primaryContact} onChange={(event) => setDraft({ ...draft, primaryContact: event.target.value })} /></label>
              <label><span>Assigned owner</span><input value={draft.assignedOwner} onChange={(event) => setDraft({ ...draft, assignedOwner: event.target.value })} /></label>
              <label><span>Workflow status</span><select value={draft.workflowStatus} onChange={(event) => setDraft({ ...draft, workflowStatus: event.target.value })}><option value="">No status</option><option>Needs Review</option><option>Ready to Contact</option><option>Contacted</option><option>Remote Consultation Scheduled</option><option>Onsite Review Scheduled</option><option>Project Mapping Needed</option><option>Waiting</option><option>Deferred</option><option>Completed</option></select></label>
              <label><span>Next follow-up</span><input type="date" value={draft.nextFollowUp?.slice(0, 10) || ""} onChange={(event) => setDraft({ ...draft, nextFollowUp: event.target.value })} /></label>
              <label><span>Internal note</span><textarea rows={6} value={draft.internalNote} onChange={(event) => setDraft({ ...draft, internalNote: event.target.value })} placeholder="Short internal context for the next conversation" /></label>
              <button className="button primary full" type="button" disabled={saving} onClick={saveDetails}>{saving ? "Saving…" : "Save client details"}</button>
            </section>

            <section>
              <span className="compass-kicker">Completion actions</span>
              <h3>Update workflow dates</h3>
              <button className="button secondary full" type="button" disabled={saving} onClick={markReview}>Mark Account Review Complete</button>
              <small>Last review: {formatDate(draft.lastAccountReview)}</small>
              <button className="button secondary full" type="button" disabled={saving} onClick={markMapping}>Mark Project Mapping Complete</button>
              <small>Last mapping: {formatDate(draft.lastProjectMapping)}</small>
            </section>
          </aside>
        </div>
      </section>
    </div>
  );
}
