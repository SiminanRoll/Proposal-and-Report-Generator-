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
  coordinationCallTaskTitle,
  mergeCaptainsLogSyncIntoClient,
  nextBusinessDate,
  sendCoordinationCallToCaptainsLogReliable,
  syncClientFromCaptainsLog,
  type CaptainsLogActivityItem,
  type CaptainsLogClientSyncResult,
} from "@/lib/compass/captains-log-bridge";
import { requestQuickPresent } from "@/lib/compass/quick-present-events";

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

function storedCaptainsLogSync(client: CompassClient): CaptainsLogClientSyncResult | null {
  const state = client.captainsLog;
  if (!state) return null;
  return {
    ok: true, client_id: client.id, requested_company: client.name, matched: state.matched, linked_company: state.linkedCompany, closest_company: state.closestCompany,
    match_method: state.matchMethod, match_score: state.matchScore, synced_at: state.syncedAt, has_open_tasks: state.openTaskCount > 0, open_task_count: state.openTaskCount,
    open_tasks: state.openTasks.map((task) => ({ id: task.id, type: task.type, tag: task.tag, title: task.title, status: task.status, scheduled_at: task.scheduledAt, created_at: task.createdAt, source: task.source })),
    primary_open_task: state.openTasks[0] ? { id: state.openTasks[0].id, type: state.openTasks[0].type, tag: state.openTasks[0].tag, title: state.openTasks[0].title, status: state.openTasks[0].status, scheduled_at: state.openTasks[0].scheduledAt, created_at: state.openTasks[0].createdAt, source: state.openTasks[0].source } : undefined,
    recent_activity: state.recentActivity.map((item) => ({ id: item.id, type: item.type, tag: item.tag, title: item.title, status: item.status, scheduled_at: item.scheduledAt, completed_at: item.completedAt, created_at: item.createdAt, source: item.source })),
  };
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
  const [captainsLogSending, setCaptainsLogSending] = useState(false);
  const [captainsLogSyncing, setCaptainsLogSyncing] = useState(false);
  const [captainsLogSync, setCaptainsLogSync] = useState<CaptainsLogClientSyncResult | null>(() => client ? storedCaptainsLogSync(client) : null);

  useEffect(() => {
    setDraft(client ? structuredClone(client) : null);
    setMessage("");
    setError("");
    setActiveLocationId("");
    setCaptainsLogOpen(false);
    setCaptainsLogStatus("");
    setCaptainsLogSync(client ? storedCaptainsLogSync(client) : null);
    setCaptainsLogDue(client?.nextFollowUp?.slice(0, 10) || nextBusinessDate());
  }, [client?.id]);

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

  const applyCaptainsLogSync = async (sync: CaptainsLogClientSyncResult, successMessage = "Supabase history refreshed.") => {
    if (!sync.ok) return;
    setCaptainsLogSync(sync);
    if (!sync.matched) {
      const closest = sync.closest_company ? ` Closest Supabase company: ${sync.closest_company}.` : "";
      setMessage(`No Supabase history matched ${client.name}.${closest}`);
      return;
    }
    const next = mergeCaptainsLogSyncIntoClient(draft, sync);
    if (JSON.stringify(next) !== JSON.stringify(draft)) await persist(next, successMessage);
    else if (successMessage) setMessage(successMessage);
  };

  const refreshCaptainsLog = async (successMessage = "Supabase history refreshed.") => {
    if (captainsLogSyncing) return null;
    setCaptainsLogSyncing(true);
    setError("");
    try {
      const sync = await syncClientFromCaptainsLog(client.id, client.name, 7000, client.aliases);
      await applyCaptainsLogSync(sync, successMessage);
      return sync;
    } catch {
      setError("Captain's Log history could not be read from Supabase. Check the History connection in Settings and retry.");
      return null;
    } finally {
      setCaptainsLogSyncing(false);
    }
  };

  const openCaptainsLogScheduler = () => {
    setCaptainsLogDue(draft.nextFollowUp?.slice(0, 10) || captainsLogDue || nextBusinessDate());
    setCaptainsLogStatus("");
    setCaptainsLogOpen(true);
  };

  const sendCoordinationCallToCaptainsLog = async () => {
    if (!captainsLogDue) { setCaptainsLogStatus("Choose a due date first."); return; }
    if (captainsLogSending) return;
    setCaptainsLogSending(true);
    setCaptainsLogStatus("Adding task…");
    try {
      const requestId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${client.id}-${captainsLogDue}-${Date.now()}`;
      const result = await sendCoordinationCallToCaptainsLogReliable({
        clientId: client.id, company: client.name, dueDate: captainsLogDue,
        priorityReason: summary.topDrivers.join("; "), requestId,
      }, 9000);
      if (!result.ok) throw new Error(result.error || "The task could not be added.");
      let sync = result.sync;
      if (!sync?.ok) sync = await syncClientFromCaptainsLog(client.id, client.name, 7000, client.aliases);
      if (sync?.ok) await applyCaptainsLogSync(sync, "Captain's Log history refreshed.");
      setCaptainsLogStatus("Coordination Call added to Captain's Log.");
      window.setTimeout(() => setCaptainsLogOpen(false), 650);
    } catch (cause) {
      setCaptainsLogStatus(cause instanceof Error ? cause.message : "The task could not be added to Captain's Log.");
    } finally {
      setCaptainsLogSending(false);
    }
  };

  const activityHistory = captainsLogSync?.recent_activity ?? [];
  const hasCaptainsLogHistory = activityHistory.length > 0;
  const historyCount = activityHistory.length;

  return (
    <div className="compass-client-workspace-backdrop" role="presentation" onMouseDown={onBack}>
      <section className="compass-client-workspace compass-client-workspace-crm" role="dialog" aria-modal="true" aria-labelledby="compass-client-workspace-title" aria-busy={saving || captainsLogSyncing} onMouseDown={(event) => event.stopPropagation()}>
        <header className="compass-client-workspace-header compass-crm-header">
          <div className="compass-client-workspace-heading">
            <div className="compass-client-workspace-eyebrow">
              <button className="compass-workspace-back" type="button" onClick={onBack}>← Back to list</button>
              <span className="compass-kicker">Client</span>
            </div>
            <h2 id="compass-client-workspace-title">{client.name}</h2>
          </div>
          <div className="compass-client-workspace-header-actions">
            <button className="compass-client-present-button" type="button" onClick={() => requestQuickPresent(client.id)} aria-label={`Present report for ${client.name}`} title="Open or quick-generate this client presentation">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="m10 8 5 2.5-5 2.5V8Z"/><path d="M8 21h8M12 17v4"/></svg><span>Present report</span>
            </button>
            <span className={`compass-captains-log-button compass-captains-log-indicator${hasCaptainsLogHistory ? " is-added" : ""}`} role="img" aria-label={hasCaptainsLogHistory ? `Captain's Log activity is tracked for ${client.name}` : `No Captain's Log history is synced for ${client.name}`} title={hasCaptainsLogHistory ? "Captain's Log activity tracked" : "No Captain's Log history synced"}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m15.2 8.8-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z"/><circle cx="12" cy="12" r="1.05" fill="currentColor" stroke="none"/></svg><span className="compass-captains-log-check" aria-hidden="true">✓</span>
            </span>
            <button className="compass-drawer-close" type="button" onClick={onCloseAll} aria-label="Close client">×</button>
          </div>
        </header>

        <div className="compass-client-workspace-scroll">
        <div className="compass-crm-summary-grid">
          <article><span>Last account review</span><strong>{formatDate(draft.lastAccountReview)}</strong><small>Last quote: {formatDate(draft.lastQuoteDate)}</small><button type="button" onClick={markReview} disabled={saving}>Mark today</button></article>
          <article><span>Next follow-up</span><strong>{formatDate(draft.nextFollowUp)}</strong><small>Client Compass</small></article>
          <article><span>Primary contact</span><strong>{draft.primaryContact || "Not recorded"}</strong><small>{draft.primaryContactEmail || draft.primaryContactPhone || "No contact details"}</small></article>
          <article className={hasCaptainsLogHistory ? "is-connected" : ""}><span>Captain's Log</span><strong>{hasCaptainsLogHistory ? `${historyCount} activit${historyCount === 1 ? "y" : "ies"}` : "No history"}</strong><small>{hasCaptainsLogHistory ? "Activity tracked" : "Sync history to populate"}</small></article>
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
            <header>
              <div><span className="compass-kicker">Captain's Log</span><h3>Client history</h3></div>
              <div className="compass-history-actions">
                <span className="compass-history-count">{historyCount ? `${historyCount} record${historyCount === 1 ? "" : "s"}` : "No history"}</span>
                <button className={`compass-history-icon-button${captainsLogSyncing ? " is-loading" : ""}`} type="button" disabled={captainsLogSyncing} onClick={() => void refreshCaptainsLog()} aria-label="Refresh Captain's Log history" title="Refresh history">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0 2 5.3"/><path d="M20 4v7h-7"/></svg>
                </button>
                <button className="compass-history-icon-button is-add" type="button" onClick={openCaptainsLogScheduler} aria-label="Add a Coordination Call task" title="Add task">+</button>
              </div>
            </header>
            <div className="compass-captains-log-activity-list">
              {activityHistory.length ? activityHistory.map((item) => <article key={`${item.source}-${item.id}-${activityDate(item)}`}><span className={`activity-${item.status}`}>{item.status || "activity"}</span><div><strong>{item.title || item.type}</strong><small>{formatDate(activityDate(item))}{item.tag ? ` · ${item.tag}` : ""}</small></div></article>) : <div className="compass-crm-empty"><strong>No Captain's Log history synced yet.</strong><span>Use the refresh icon here or Sync all history in Data Tools.</span></div>}
            </div>
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
        </div>
      </section>

      {captainsLogOpen && <div className="compass-captains-log-backdrop" role="presentation" onMouseDown={() => setCaptainsLogOpen(false)}>
        <section className="compass-captains-log-modal" role="dialog" aria-modal="true" aria-labelledby="captains-log-coordination-call-title" onMouseDown={(event) => event.stopPropagation()}>
          <header><span className="compass-captains-log-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="m15.2 8.8-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z"/></svg></span><div><span className="compass-kicker">Captain's Log</span><h3 id="captains-log-coordination-call-title">Add task</h3></div><button type="button" aria-label="Close task dialog" onClick={() => setCaptainsLogOpen(false)}>×</button></header>
          <div className="compass-captains-log-task-preview"><span>Task</span><strong>{coordinationCallTaskTitle(client.name)}</strong><small>Coordination Call · Captain's Log</small></div>
          <label><span>Due date</span><input type="date" value={captainsLogDue} min={today()} onChange={(event) => { setCaptainsLogDue(event.target.value); setCaptainsLogStatus(""); }} /></label>
          {captainsLogStatus && <div className="compass-captains-log-status" role="status">{captainsLogStatus}</div>}
          <footer><button className="button secondary" type="button" onClick={() => setCaptainsLogOpen(false)} disabled={captainsLogSending}>Cancel</button><button className="button primary" type="button" onClick={() => void sendCoordinationCallToCaptainsLog()} disabled={captainsLogSending}>{captainsLogSending ? "Adding…" : "Add task"}</button></footer>
        </section>
      </div>}

      {reviewEditorOpen && <ReviewOutcomeEditor outcome={draft.reviewOutcome} suggestions={reviewSuggestions} saving={saving} onClose={() => setReviewEditorOpen(false)} onSave={saveReviewOutcome} />}
    </div>
  );
}
