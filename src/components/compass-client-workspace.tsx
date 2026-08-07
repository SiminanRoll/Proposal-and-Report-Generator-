"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { recalculateDataset } from "@/lib/compass/engine";
import { saveCompassDataset } from "@/lib/compass/store";
import type { CompassClient, CompassConfig, CompassDataset, CompassDevice, CompassFinding } from "@/lib/compass/types";
import { ReviewOutcomeEditor } from "./review-outcome-editor";
import { createReviewOutcomeItem, dispositionOption, hasAgreedReviewPlan } from "@/lib/review-outcomes/model";
import { buildCompassLocationSnapshots, buildCompassProjectPackages } from "@/lib/compass/project-packaging";
import {
  checkCaptainsLogLocalBridge,
  coordinationCallTaskTitle,
  mergeCaptainsLogSyncIntoClient,
  nextBusinessDate,
  sendCoordinationCallToCaptainsLogInteractive,
  syncClientFromCaptainsLogInteractive,
  type CaptainsLogActivityItem,
  type CaptainsLogClientSyncResult,
} from "@/lib/compass/captains-log-bridge";
import { CAPTAINS_LOG_QUEUE_EVENT, clearCaptainsLogQueueEntry, getCaptainsLogQueueEntry, markCaptainsLogQueueEntry } from "@/lib/compass/captains-log-queue";

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
  const raw = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

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

function activityDate(item: CaptainsLogActivityItem): string {
  return item.completed_at || item.scheduled_at || item.created_at || "";
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
  const [captainsLogOpen, setCaptainsLogOpen] = useState(false);
  const [captainsLogDue, setCaptainsLogDue] = useState("");
  const [captainsLogStatus, setCaptainsLogStatus] = useState("");
  const [captainsLogReceiverAvailable, setCaptainsLogReceiverAvailable] = useState<boolean | null>(null);
  const [captainsLogSending, setCaptainsLogSending] = useState(false);
  const [captainsLogSyncing, setCaptainsLogSyncing] = useState(false);
  const [captainsLogSync, setCaptainsLogSync] = useState<CaptainsLogClientSyncResult | null>(null);
  const [captainsLogQueued, setCaptainsLogQueued] = useState(() => getCaptainsLogQueueEntry(clientId));

  useEffect(() => {
    setDraft(client ? structuredClone(client) : null);
    setMessage("");
    setError("");
    setActiveLocationId("");
    setCaptainsLogOpen(false);
    setCaptainsLogStatus("");
    setCaptainsLogSync(null);
    setCaptainsLogDue(client?.nextFollowUp?.slice(0, 10) || nextBusinessDate());
  }, [client?.id]);

  useEffect(() => {
    const syncQueue = () => setCaptainsLogQueued(getCaptainsLogQueueEntry(clientId));
    syncQueue();
    window.addEventListener("storage", syncQueue);
    window.addEventListener(CAPTAINS_LOG_QUEUE_EVENT, syncQueue as EventListener);
    return () => {
      window.removeEventListener("storage", syncQueue);
      window.removeEventListener(CAPTAINS_LOG_QUEUE_EVENT, syncQueue as EventListener);
    };
  }, [clientId]);

  useEffect(() => {
    if (activeLocationId && !locationSnapshots.some((location) => location.id === activeLocationId)) setActiveLocationId("");
  }, [activeLocationId, locationSnapshots]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (captainsLogOpen) { setCaptainsLogOpen(false); return; }
      if (!saving) onBack();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [captainsLogOpen, onBack, saving]);

  if (!client || !summary || !draft) return null;

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
      if (successMessage) setMessage(successMessage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client relationship details could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const saveDetails = () => void persist(draft, "Client details saved.");
  const markReview = () => void persist({ ...draft, lastAccountReview: today(), workflowStatus: "Review Completed" }, "Account review marked complete today.");
  const saveReviewOutcome = async (value: { outcome: CompassClient["reviewOutcome"] }) => {
    const reviewedAt = value.outcome.reviewedAt || draft.lastAccountReview;
    await persist({ ...draft, lastAccountReview: draft.lastAccountReview || reviewedAt, reviewOutcome: value.outcome }, value.outcome.status === "confirmed" ? "Confirmed review outcome saved." : "Review outcome saved.");
    setReviewEditorOpen(false);
  };

  const applyCaptainsLogSync = async (sync: CaptainsLogClientSyncResult, successMessage = "Captain's Log sync refreshed.") => {
    if (!sync.ok) return;
    setCaptainsLogSync(sync);
    if (sync.coordination?.open) {
      const entry = {
        clientId: client.id,
        company: client.name,
        dueDate: String(sync.coordination.scheduled_at || "").slice(0, 10),
        addedAt: sync.synced_at || new Date().toISOString(),
        taskId: sync.coordination.task_id || "",
        linkedCompany: sync.linked_company || "",
      };
      markCaptainsLogQueueEntry(entry);
      setCaptainsLogQueued(entry);
    } else if (sync.matched) {
      clearCaptainsLogQueueEntry(client.id);
      setCaptainsLogQueued(null);
    }
    const next = mergeCaptainsLogSyncIntoClient(draft, sync);
    if (JSON.stringify(next) !== JSON.stringify(draft)) await persist(next, successMessage);
    else if (successMessage) setMessage(successMessage);
  };

  const refreshCaptainsLog = async (successMessage = "Captain's Log sync refreshed.") => {
    if (captainsLogSyncing) return null;
    setCaptainsLogSyncing(true);
    setError("");
    try {
      const sync = await syncClientFromCaptainsLogInteractive(client.id, client.name, 7000);
      await applyCaptainsLogSync(sync, successMessage);
      return sync;
    } catch {
      setCaptainsLogReceiverAvailable(false);
      setError("Captain's Log could not be reached. Open Captain's Log V837, then try the sync again.");
      return null;
    } finally {
      setCaptainsLogSyncing(false);
    }
  };

  const openCaptainsLogScheduler = async () => {
    if (captainsLogQueued) {
      clearCaptainsLogQueueEntry(client.id);
      setCaptainsLogQueued(null);
      setMessage("Captain's Log queued indicator cleared in Client Compass.");
      return;
    }
    const sync = await refreshCaptainsLog("");
    if (sync?.coordination?.open) {
      setMessage(`Captain's Log already has an active Coordination Call${sync.linked_company ? ` for ${sync.linked_company}` : ""}.`);
      return;
    }
    setCaptainsLogDue(sync?.coordination?.scheduled_at?.slice(0, 10) || draft.nextFollowUp?.slice(0, 10) || captainsLogDue || nextBusinessDate());
    setCaptainsLogStatus("");
    setCaptainsLogReceiverAvailable(null);
    setCaptainsLogOpen(true);
    void checkCaptainsLogLocalBridge().then((available) => setCaptainsLogReceiverAvailable(available));
  };

  const sendCoordinationCallToCaptainsLog = async () => {
    if (!captainsLogDue) { setCaptainsLogStatus("Choose a due date first."); return; }
    if (captainsLogSending) return;
    const requestId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${client.id}-${captainsLogDue}-${Date.now()}`;
    const request = {
      clientId: client.id,
      company: client.name,
      dueDate: captainsLogDue,
      priorityReason: summary.topDrivers.join("; "),
      requestId,
    };
    setCaptainsLogSending(true);
    setCaptainsLogStatus("Connecting to Captain's Log…");
    try {
      // Use the interactive localhost bridge as the primary transport. It is a
      // top-level browser connection rather than a cross-origin fetch, which makes
      // it much more reliable from the deployed HTTPS Client Compass site.
      const result = await sendCoordinationCallToCaptainsLogInteractive(request, 8000);
      setCaptainsLogReceiverAvailable(true);
      let sync = result.sync;
      if (!sync?.ok) {
        try { sync = await syncClientFromCaptainsLogInteractive(client.id, client.name, 6500); } catch { /* creation still succeeded */ }
      }
      if (sync?.ok) await applyCaptainsLogSync(sync, "Captain's Log task and client details synced.");
      else {
        const linked = result.linked_company || result.company || "";
        const entry = { clientId: client.id, company: client.name, dueDate: captainsLogDue, addedAt: new Date().toISOString(), taskId: result.task_id || "", linkedCompany: linked };
        markCaptainsLogQueueEntry(entry);
        setCaptainsLogQueued(entry);
      }
      const linked = result.linked_company || result.company || sync?.linked_company || "";
      setCaptainsLogStatus(result.status === "exists"
        ? `Captain's Log already has an active Coordination Call${linked ? ` · ${linked}` : ""}`
        : linked ? `Added to Captain's Log · linked to ${linked}` : "Added to Captain's Log · client association needs review");
    } catch {
      setCaptainsLogReceiverAvailable(false);
      setCaptainsLogStatus("Captain's Log did not answer the desktop connection. Open Captain's Log V837, then click Create Coordination Call again.");
    } finally {
      setCaptainsLogSending(false);
    }
  };

  const recentActivity = captainsLogSync?.recent_activity?.slice(0, 5) ?? [];
  const syncedContact = captainsLogSync?.contact;

  return (
    <div className="compass-client-workspace-backdrop" role="presentation" onMouseDown={onBack}>
      <section className="compass-client-workspace compass-client-workspace-crm" role="dialog" aria-modal="true" aria-labelledby="compass-client-workspace-title" aria-busy={saving || captainsLogSyncing} onMouseDown={(event) => event.stopPropagation()}>
        <header className="compass-client-workspace-header compass-crm-header">
          <div className="compass-client-workspace-heading">
            <button className="compass-workspace-back" type="button" onClick={onBack}>← Back to list</button>
            <span className="compass-kicker">Client</span>
            <h2 id="compass-client-workspace-title">{client.name}</h2>
          </div>
          <div className="compass-client-workspace-header-actions">
            <button className={`compass-captains-log-button${captainsLogQueued ? " is-added" : ""}`} type="button" onClick={() => void openCaptainsLogScheduler()} aria-label={captainsLogQueued ? "Captain's Log coordination is already tracked. Click to clear the local indicator." : "Sync or schedule a Coordination Call in Captain's Log"} title={captainsLogQueued ? "Captain's Log coordination is already tracked. Click to clear the local indicator." : "Sync or schedule a Coordination Call in Captain's Log"}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m15.2 8.8-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z"/><circle cx="12" cy="12" r="1.05" fill="currentColor" stroke="none"/></svg><span className="compass-captains-log-check" aria-hidden="true">✓</span>
            </button>
            <button className="compass-drawer-close" type="button" onClick={onCloseAll} aria-label="Close client">×</button>
          </div>
        </header>

        <div className="compass-crm-summary-grid">
          <article><span>Last account review</span><strong>{formatDate(draft.lastAccountReview)}</strong><small>Last quote: {formatDate(draft.lastQuoteDate)}</small><button type="button" onClick={markReview} disabled={saving}>Mark today</button></article>
          <article><span>Next follow-up</span><strong>{formatDate(draft.nextFollowUp)}</strong><small>{captainsLogSync?.coordination?.open ? "Synced from Captain's Log" : "Client Compass"}</small></article>
          <article><span>Primary contact</span><strong>{draft.primaryContact || "Not recorded"}</strong><small>{draft.primaryContactEmail || draft.primaryContactPhone || "No contact details"}</small></article>
          <article className={captainsLogSync?.matched ? "is-connected" : ""}><span>Captain's Log</span><strong>{captainsLogSync?.matched ? "Connected" : captainsLogQueued ? "Coordination queued" : "Not synced"}</strong><small>{captainsLogSync?.linked_company || captainsLogQueued?.linkedCompany || "Click the compass or refresh below"}</small></article>
        </div>

        {(message || error) && <div className={error ? "compass-import-error" : "compass-workspace-success"} role={error ? "alert" : "status"}>{error || message}</div>}

        <div className="compass-crm-main-grid">
          <section className="compass-crm-card">
            <header><div><span className="compass-kicker">Basic CRM</span><h3>Account review tracking</h3></div><span className="compass-crm-muted">Keep this simple.</span></header>
            <div className="compass-crm-fields">
              <label><span>Primary contact</span><input value={draft.primaryContact} onChange={(event) => setDraft({ ...draft, primaryContact: event.target.value })} placeholder="Name" /></label>
              <label><span>Email</span><input type="email" value={draft.primaryContactEmail} onChange={(event) => setDraft({ ...draft, primaryContactEmail: event.target.value })} placeholder="email@company.com" /></label>
              <label><span>Phone</span><input type="tel" value={draft.primaryContactPhone} onChange={(event) => setDraft({ ...draft, primaryContactPhone: event.target.value })} placeholder="Phone" /></label>
              <label><span>Last account review</span><input type="date" value={draft.lastAccountReview?.slice(0, 10) || ""} onChange={(event) => setDraft({ ...draft, lastAccountReview: event.target.value })} /></label>
              <label><span>Next follow-up</span><input type="date" value={draft.nextFollowUp?.slice(0, 10) || ""} onChange={(event) => setDraft({ ...draft, nextFollowUp: event.target.value })} /></label>
              <label className="compass-crm-note"><span>Note</span><textarea rows={4} value={draft.internalNote} onChange={(event) => setDraft({ ...draft, internalNote: event.target.value })} placeholder="Short relationship note or next-step context" /></label>
            </div>
            <footer><button className="button primary" type="button" disabled={saving} onClick={saveDetails}>{saving ? "Saving…" : "Save"}</button></footer>
          </section>

          <section className="compass-crm-card compass-captains-log-sync-card">
            <header><div><span className="compass-kicker">Captain's Log</span><h3>Client connection & activity</h3></div><span className={`compass-sync-dot${captainsLogSync?.matched ? " is-live" : ""}`} aria-hidden="true" /></header>
            <div className="compass-sync-summary">
              <div><span>Match</span><strong>{captainsLogSync?.matched ? captainsLogSync.linked_company || client.name : "Not checked"}</strong><small>{captainsLogSync?.matched ? `${Math.round((captainsLogSync.match_score || 0) * 100)}% match · ${captainsLogSync.match_method || "matched"}` : "Sync checks Captain's Log's saved client records."}</small></div>
              <div><span>Contact source</span><strong>{syncedContact?.name || "—"}</strong><small>{syncedContact?.email || syncedContact?.phone || "No synced contact yet"}</small></div>
            </div>
            <div className="compass-captains-log-activity-list">
              {recentActivity.length ? recentActivity.map((item) => <article key={`${item.id}-${activityDate(item)}`}><span className={`activity-${item.status}`}>{item.status}</span><div><strong>{item.title || item.type}</strong><small>{formatDate(activityDate(item))}{item.tag ? ` · ${item.tag}` : ""}</small></div></article>) : <div className="compass-crm-empty"><strong>No Captain's Log activity synced yet.</strong><span>Refresh to pull current coordination work and recent client activity.</span></div>}
            </div>
            <footer className="compass-crm-button-row">
              <button className="button secondary" type="button" disabled={captainsLogSyncing} onClick={() => void refreshCaptainsLog()}>{captainsLogSyncing ? "Syncing…" : "Refresh from Captain's Log"}</button>
              <button className="button primary" type="button" onClick={() => void openCaptainsLogScheduler()}>{captainsLogQueued ? "Coordination tracked" : "Schedule Coordination Call"}</button>
            </footer>
          </section>
        </div>

        <details className="compass-crm-details">
          <summary><span><strong>Technology & report context</strong><small>{summary.priorityTier} priority · {formatMoney(summary.totalEstimatedValue)} estimated need</small></span><b>›</b></summary>
          <div className="compass-crm-details-body">
            <section className="compass-workspace-section compass-client-need-summary">
              <div className="compass-workspace-section-heading"><div><span className="compass-kicker">Why this client is here</span><h3>Current technology needs</h3></div><span>{summary.priorityTier} technical urgency</span></div>
              <div className="compass-client-need-content"><p>{summary.topDrivers.join(" · ") || "No scored technical driver is currently recorded."}</p><div>{memberships.map((membership) => <span key={membership}>{membership}</span>)}</div></div>
            </section>
            <section className={`compass-workspace-section compass-review-outcome-summary ${hasAgreedReviewPlan(draft.reviewOutcome) ? "has-plan" : "needs-plan"}`}>
              <div className="compass-workspace-section-heading"><div><span className="compass-kicker">Review outcome</span><h3>{draft.reviewOutcome.status === "confirmed" ? "Agreed plan and next step" : "Optional report detail"}</h3></div><button className="button secondary compact" type="button" onClick={() => setReviewEditorOpen(true)}>{hasAgreedReviewPlan(draft.reviewOutcome) ? "Edit outcome" : "Add outcome"}</button></div>
              {hasAgreedReviewPlan(draft.reviewOutcome) ? <div className="compass-review-outcome-content"><p>{draft.reviewOutcome.meetingSummary || "The client conversation has been recorded."}</p>{draft.reviewOutcome.agreedNextStep && <aside><span>Agreed next step</span><strong>{draft.reviewOutcome.agreedNextStep}</strong></aside>}</div> : <p className="compass-no-findings">Use this only when you need the review outcome carried into a Client Compass report.</p>}
              <Link className="button primary compact" href={generatorUrl(client, context)}>Open Client Report</Link>
            </section>
          </div>
        </details>

        <details className="compass-crm-details">
          <summary><span><strong>Environment & technical detail</strong><small>{devices.length} devices · {visibleProjects.length} grouped needs · {visibleFindings.length} findings</small></span><b>›</b></summary>
          <div className="compass-crm-details-body">
            {locationSnapshots.length > 1 && <section className="compass-workspace-section compass-location-section">
              <div className="compass-workspace-section-heading"><div><span className="compass-kicker">Locations</span><h3>View the environment by site</h3></div><span>{selectedLocation ? selectedLocation.name : "All named locations"}</span></div>
              <div className="compass-location-selector" role="tablist" aria-label="Client location view">
                <button type="button" role="tab" aria-selected={!activeLocationId} className={!activeLocationId ? "is-active" : ""} onClick={() => setActiveLocationId("")}>All locations</button>
                {locationSnapshots.map((location) => <button key={location.id} type="button" role="tab" aria-selected={activeLocationId === location.id} className={activeLocationId === location.id ? "is-active" : ""} onClick={() => setActiveLocationId(location.id)}><strong>{location.name}</strong><small>{location.deviceIds.length} devices · {location.physicalServers + location.virtualServers} servers</small></button>)}
              </div>
            </section>}

            <section className="compass-workspace-section">
              <div className="compass-workspace-section-heading"><div><span className="compass-kicker">Environment</span><h3>{selectedLocation ? `${selectedLocation.name} device profile` : "Current device profile"}</h3></div></div>
              <div className="compass-technical-counts"><div><strong>{physicalServers.length}</strong><span>Physical servers</span></div><div><strong>{virtualServers.length}</strong><span>Virtual servers</span></div><div><strong>{physicalWorkstations.length}</strong><span>Physical workstations</span></div><div><strong>{virtualWorkstations.length}</strong><span>Virtual machines</span></div></div>
            </section>

            <section className="compass-workspace-section compass-project-packages-section compass-client-needs-section">
              <div className="compass-workspace-section-heading"><div><span className="compass-kicker">Project context</span><h3>Grouped technology needs</h3></div><span>{visibleProjects.length} item{visibleProjects.length === 1 ? "" : "s"}</span></div>
              {visibleProjects.length ? <div className="compass-project-package-grid">{visibleProjects.map((project) => {
                const option = dispositionOption(project.disposition);
                const projectLocations = locations.filter((location) => project.locationIds.includes(location.id)).map((location) => location.name);
                return <article key={project.id} className={`project-package-${option.tone}`}><div className="compass-project-package-top"><span>{project.source === "review-outcome" ? "Agreed need" : "Technical need"}</span></div><h4>{project.title}</h4><p>{project.technicalDrivers.join(" · ") || "Identified from the current technical findings."}</p><div className="compass-project-package-meta"><span>{project.deviceIds.length} device{project.deviceIds.length === 1 ? "" : "s"}</span>{projectLocations.length > 0 && <span>{projectLocations.join(", ")}</span>}<span>{option.label}</span></div></article>;
              })}</div> : <p className="compass-no-findings">No grouped technology need is tied to this location yet.</p>}
            </section>

            <section className="compass-workspace-section">
              <div className="compass-finding-groups">
                {[["Operating systems", osFindings], ["Lifecycle", lifecycleFindings], ["Storage", storageFindings], ["Warranty", warrantyFindings]].map(([label, group]) => {
                  const typedGroup = group as CompassFinding[];
                  return <div key={label as string}><h4>{label as string}<span>{typedGroup.length}</span></h4>{typedGroup.length ? typedGroup.slice(0, 8).map((finding) => <article key={finding.id} className={`severity-${finding.severity}`}><strong>{finding.title}</strong><p>{finding.explanation}</p></article>) : <p className="compass-no-findings">No current findings in this group.</p>}</div>;
                })}
              </div>
            </section>

            <section className="compass-workspace-section">
              <div className="compass-workspace-section-heading"><div><span className="compass-kicker">Inventory</span><h3>Current device inventory</h3></div><span>{visibleDevices.length} devices</span></div>
              <div className="compass-inventory-table-wrap"><table className="compass-inventory-table"><thead><tr><th>Device</th><th>Type</th><th>Operating system</th><th>Lifecycle</th><th>Storage</th><th>Warranty</th><th>Last check-in</th></tr></thead><tbody>{[...visibleDevices].sort((a, b) => a.deviceType.localeCompare(b.deviceType) || a.name.localeCompare(b.name)).map((device) => <tr key={device.id}><td><strong>{device.name}</strong><span>{device.model || "Model unavailable"}</span></td><td><span className={device.isVirtual ? "is-virtual" : ""}>{deviceTypeLabel(device)}</span>{device.virtualizationPlatform && <small>{device.virtualizationPlatform}</small>}</td><td>{device.osName || "Unknown"}</td><td><span className={`compass-lifecycle-pill lifecycle-${device.lifecycle}`}>{device.lifecycle.replace("-", " ")}</span></td><td>{storageLabel(device)}</td><td>{formatDate(device.warrantyEnd)}</td><td>{formatDate(device.lastUptime || device.lastLogin)}</td></tr>)}</tbody></table></div>
            </section>
          </div>
        </details>
      </section>

      {captainsLogOpen && <div className="compass-captains-log-backdrop" role="presentation" onMouseDown={() => setCaptainsLogOpen(false)}>
        <section className="compass-captains-log-modal" role="dialog" aria-modal="true" aria-labelledby="captains-log-coordination-call-title" onMouseDown={(event) => event.stopPropagation()}>
          <header><span className="compass-captains-log-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="m15.2 8.8-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z"/></svg></span><div><span className="compass-kicker">Captain's Log</span><h3 id="captains-log-coordination-call-title">Schedule coordination call</h3></div><button type="button" aria-label="Close Captain's Log scheduler" onClick={() => setCaptainsLogOpen(false)}>×</button></header>
          <div className="compass-captains-log-task-preview"><span>Task</span><strong>{coordinationCallTaskTitle(client.name)}</strong><small>Client Coordination · Call · Captain's Log client match + sync</small></div>
          <label><span>Due date</span><input type="date" value={captainsLogDue} min={today()} onChange={(event) => { setCaptainsLogDue(event.target.value); setCaptainsLogStatus(""); }} /></label>
          <p>Client Compass checks Captain's Log first. If an active Coordination Call already exists, it syncs that effort instead of creating another one.</p>
          <small className={`compass-captains-log-requirement${captainsLogReceiverAvailable === true ? " is-ready" : captainsLogReceiverAvailable === false ? " is-missing" : ""}`}>{captainsLogReceiverAvailable === true ? "Captain's Log V837 is ready to sync." : captainsLogReceiverAvailable === false ? "Captain's Log V837 is not responding yet. Open the desktop app before creating the call." : "Checking Captain's Log V837…"}</small>
          {captainsLogStatus && <div className="compass-captains-log-status" role="status">{captainsLogStatus}</div>}
          <footer><button className="button secondary" type="button" onClick={() => setCaptainsLogOpen(false)} disabled={captainsLogSending}>Cancel</button><button className="button primary" type="button" onClick={() => void sendCoordinationCallToCaptainsLog()} disabled={captainsLogSending}>{captainsLogSending ? "Sending…" : "Create Coordination Call"}</button></footer>
        </section>
      </div>}

      {reviewEditorOpen && <ReviewOutcomeEditor outcome={draft.reviewOutcome} suggestions={reviewSuggestions} saving={saving} onClose={() => setReviewEditorOpen(false)} onSave={saveReviewOutcome} />}
    </div>
  );
}
