"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { recalculateDataset } from "@/lib/compass/engine";
import { saveCompassDataset } from "@/lib/compass/store";
import type { CompassClient, CompassConfig, CompassDataset, CompassDevice, CompassFinding } from "@/lib/compass/types";
import { buildCompassLocationSnapshots, buildCompassProjectPackages } from "@/lib/compass/project-packaging";
import {
  mergeCaptainsLogSyncIntoClient,
  syncClientFromCaptainsLog,
  syncClientsFromCaptainsLog,
  type CaptainsLogActivityItem,
  type CaptainsLogClientSyncResult,
} from "@/lib/compass/captains-log-bridge";
import { requestQuickPresent } from "@/lib/compass/quick-present-events";
import { ReviewOutcomeEditor } from "./review-outcome-editor";
import { createReviewOutcomeItem, dispositionOption, hasAgreedReviewPlan } from "@/lib/review-outcomes/model";
import { technicalAgeYears } from "@/lib/technical-truth";

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

function activityDate(item: CaptainsLogActivityItem): string {
  return item.completed_at || item.scheduled_at || item.created_at || "";
}

function activityStatus(item: CaptainsLogActivityItem): "completed" | "scheduled" | "open" {
  const status = String(item.status || "").toLowerCase();
  if (item.completed_at || status === "completed" || status === "done") return "completed";
  if (item.scheduled_at || status === "scheduled") return "scheduled";
  return "open";
}

function activityStatusLabel(item: CaptainsLogActivityItem): string {
  const status = activityStatus(item);
  return status === "completed" ? "Completed" : status === "scheduled" ? "Scheduled" : "Open";
}

function normalizedActivityTitle(item: CaptainsLogActivityItem): string {
  return String(item.title || item.type || "activity").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function resolvedActivityHistory(items: CaptainsLogActivityItem[]): CaptainsLogActivityItem[] {
  const byIdentity = new Map<string, CaptainsLogActivityItem>();
  for (const item of items) {
    const createdDay = String(item.created_at || "").slice(0, 10);
    const identity = `${normalizedActivityTitle(item)}|${createdDay}`;
    const existing = byIdentity.get(identity);
    if (!existing) {
      byIdentity.set(identity, item);
      continue;
    }
    const existingRank = activityStatus(existing) === "completed" ? 3 : activityStatus(existing) === "scheduled" ? 2 : 1;
    const incomingRank = activityStatus(item) === "completed" ? 3 : activityStatus(item) === "scheduled" ? 2 : 1;
    const existingDate = activityDate(existing);
    const incomingDate = activityDate(item);
    if (incomingRank > existingRank || (incomingRank === existingRank && incomingDate > existingDate)) byIdentity.set(identity, item);
  }
  return [...byIdentity.values()].sort((a, b) => activityDate(b).localeCompare(activityDate(a)));
}

function storedActivitySync(client: CompassClient): CaptainsLogClientSyncResult | null {
  const state = client.captainsLog;
  if (!state) return null;
  return {
    ok: true,
    client_id: client.id,
    requested_company: client.name,
    matched: state.matched,
    linked_company: state.linkedCompany,
    closest_company: state.closestCompany,
    match_method: state.matchMethod,
    match_score: state.matchScore,
    synced_at: state.syncedAt,
    has_open_tasks: state.openTaskCount > 0,
    open_task_count: state.openTaskCount,
    open_tasks: state.openTasks.map((task) => ({
      id: task.id,
      type: task.type,
      tag: task.tag,
      title: task.title,
      status: task.status,
      scheduled_at: task.scheduledAt,
      created_at: task.createdAt,
      source: task.source,
    })),
    recent_activity: state.recentActivity.map((item) => ({
      id: item.id,
      type: item.type,
      tag: item.tag,
      title: item.title,
      status: item.status,
      scheduled_at: item.scheduledAt,
      completed_at: item.completedAt,
      created_at: item.createdAt,
      source: item.source,
    })),
  };
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

function compactVideoCard(value: string): string {
  const clean = String(value || "")
    .replace(/[®™]/g, "")
    .replace(/\(R\)|\(TM\)/gi, "")
    .replace(/\bIntel Corporation\b/gi, "Intel")
    .replace(/\bNVIDIA Corporation\b/gi, "NVIDIA")
    .replace(/\bGraphics\b/gi, "")
    .replace(/\bDisplay Adapter\b/gi, "Adapter")
    .replace(/\s+/g, " ")
    .trim();
  return clean || "—";
}

function findingGroup(findings: CompassFinding[], categories: string[]): CompassFinding[] {
  return findings.filter((finding) => categories.includes(finding.category));
}

type CompanyHealthStatus = "Healthy" | "Monitor Needs" | "Unhealthy";

function companyHealthStatus(projectValue: number, servers: CompassDevice[], referenceDate = new Date()): CompanyHealthStatus {
  const oldestServerAge = servers
    .map((server) => technicalAgeYears(server.warrantyStart, referenceDate))
    .filter((age): age is number => age !== null)
    .reduce((oldest, age) => Math.max(oldest, age), 0);
  if (projectValue > 8_000 || oldestServerAge > 6) return "Unhealthy";
  if (projectValue > 5_000 || oldestServerAge > 5) return "Monitor Needs";
  return "Healthy";
}

function companyHealthClass(status: CompanyHealthStatus): string {
  return status.toLowerCase().replace(/\s+/g, "-");
}

function generatorUrl(client: CompassClient, context: string): string {
  const params = new URLSearchParams({ type: "client-report", compassClientId: client.id, client: client.name });
  if (client.primaryContact) params.set("contact", client.primaryContact);
  if (context) params.set("context", context);
  return `/create/?${params.toString()}`;
}

export function CompassClientReviewWorkspaceV10941({ clientId, dataset, config, onBack, onCloseAll, onDatasetSaved }: Props) {
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
  const [contactOpen, setContactOpen] = useState(false);
  const [reviewEditorOpen, setReviewEditorOpen] = useState(false);
  const [activeLocationId, setActiveLocationId] = useState("");
  const [activitySyncing, setActivitySyncing] = useState(false);
  const [activitySync, setActivitySync] = useState<CaptainsLogClientSyncResult | null>(() => client ? storedActivitySync(client) : null);

  useEffect(() => {
    document.documentElement.classList.add("is-company-details-open-v1172");
    document.body.classList.add("is-company-details-open-v1172");
    return () => {
      document.documentElement.classList.remove("is-company-details-open-v1172");
      document.body.classList.remove("is-company-details-open-v1172");
    };
  }, []);

  useEffect(() => {
    setDraft(client ? structuredClone(client) : null);
    setMessage("");
    setError("");
    setContactOpen(false);
    setActiveLocationId("");
    setActivitySync(client ? storedActivitySync(client) : null);
  }, [client?.id]);

  useEffect(() => {
    if (!client) return;
    let active = true;
    void syncClientFromCaptainsLog(client.id, client.name, 7000, client.aliases, client.companyId)
      .then((sync) => {
        if (!active || !sync.ok || !sync.matched) return;
        setActivitySync(sync);
        setDraft((current) => current ? mergeCaptainsLogSyncIntoClient(current, sync) : current);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [client?.companyId, client?.id]);

  useEffect(() => {
    if (activeLocationId && !locationSnapshots.some((location) => location.id === activeLocationId)) setActiveLocationId("");
  }, [activeLocationId, locationSnapshots]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (contactOpen) { setContactOpen(false); return; }
      if (!saving) onBack();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [contactOpen, onBack, saving]);

  if (!client || !summary || !draft) return null;

  const selectedLocation = locationSnapshots.find((location) => location.id === activeLocationId);
  const selectedDeviceIds = selectedLocation ? new Set(selectedLocation.deviceIds) : null;
  const visibleDevices = selectedDeviceIds ? devices.filter((device) => selectedDeviceIds.has(device.id)) : devices;
  const visibleFindings = selectedDeviceIds ? findings.filter((finding) => selectedDeviceIds.has(finding.deviceId)) : findings;
  const physicalServers = visibleDevices.filter((device) => device.deviceType === "physical-server");
  const virtualServers = visibleDevices.filter((device) => device.deviceType === "virtual-server");
  const physicalWorkstations = visibleDevices.filter((device) => device.deviceType === "physical-workstation");
  const healthStatus = companyHealthStatus(summary.totalEstimatedValue, physicalServers);
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

  const persistedActivity = storedActivitySync(draft)?.recent_activity ?? [];
  const activityHistory = resolvedActivityHistory([...persistedActivity, ...(activitySync?.recent_activity ?? [])]);
  const latestActivity = activityHistory[0] ?? null;
  const reviewHasPlan = hasAgreedReviewPlan(draft.reviewOutcome);

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
      setError(cause instanceof Error ? cause.message : "Client details could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const saveDetails = async () => {
    await persist(draft, "Client details saved.");
    setContactOpen(false);
  };

  const markReview = () => void persist({ ...draft, lastAccountReview: today(), workflowStatus: "Review Completed" }, "Last review updated.");

  const saveReviewOutcome = async (value: { outcome: CompassClient["reviewOutcome"] }) => {
    const reviewedAt = value.outcome.reviewedAt || draft.lastAccountReview;
    await persist({ ...draft, lastAccountReview: draft.lastAccountReview || reviewedAt, reviewOutcome: value.outcome }, value.outcome.status === "confirmed" ? "Account review outcome saved." : "Review outcome saved.");
    setReviewEditorOpen(false);
  };

  const refreshActivity = async () => {
    if (activitySyncing) return;
    setActivitySyncing(true);
    setError("");
    try {
      const batch = await syncClientsFromCaptainsLog([{ clientId: client.id, company: client.name, aliases: client.aliases, companyId: client.companyId }], 9000);
      const sync = batch.results[0];
      if (!sync?.ok) throw new Error(sync?.error || "Activity history could not be refreshed.");
      setActivitySync(sync);
      if (sync.matched) {
        const next = mergeCaptainsLogSyncIntoClient(draft, sync);
        if (JSON.stringify(next) !== JSON.stringify(draft)) await persist(next, "Activity refreshed.");
        else setMessage("Activity refreshed.");
      } else {
        setMessage(`No activity history matched ${client.name}.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Activity history could not be refreshed from Supabase.");
    } finally {
      setActivitySyncing(false);
    }
  };

  return (
    <div className="compass-client-workspace-backdrop" role="presentation" onMouseDown={onBack}>
      <section className="compass-client-workspace compass-client-review-workspace-v10941" role="dialog" aria-modal="true" aria-labelledby="compass-client-workspace-title" aria-busy={saving || activitySyncing} onMouseDown={(event) => event.stopPropagation()}>
        <header className="client-review-header-v10941">
          <div className="client-review-heading-v10941">
            <button className="compass-workspace-back" type="button" onClick={onBack}>← Back to list</button>
            <h2 id="compass-client-workspace-title">{client.name}</h2>
            {(draft.city || draft.state || draft.market || draft.industry) && <div className="client-review-company-meta-v10941">
              {[draft.city, draft.state, draft.market, draft.industry].filter(Boolean).map((value) => <span key={value}>{value}</span>)}
            </div>}
          </div>
          <div className="client-review-header-actions-v10941">
            <button className="compass-client-present-button" type="button" onClick={() => requestQuickPresent(client.id)} aria-label={`Present report for ${client.name}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="m10 8 5 2.5-5 2.5V8Z"/><path d="M8 21h8M12 17v4"/></svg><span>Present report</span>
            </button>
            <button className="compass-drawer-close" type="button" onClick={onCloseAll} aria-label="Close client">×</button>
          </div>
        </header>

        <div className="client-review-scroll-v10941" role="region" aria-label={`${client.name} company details`} tabIndex={0} onWheel={(event) => {
          const viewport = event.currentTarget;
          if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || viewport.scrollHeight <= viewport.clientHeight) return;
          const previous = viewport.scrollTop;
          viewport.scrollTop += event.deltaY;
          if (viewport.scrollTop !== previous) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}>
          <div className="client-review-scroll-content-v1173">
          <section className="client-review-glance-v10941" aria-label="Client review glance">
            <article>
              <span>Last review</span>
              <strong>{formatDate(draft.lastAccountReview)}</strong>
              <button type="button" onClick={markReview} disabled={saving}>Mark today</button>
            </article>
            <button className={`client-review-contact-card-v10941${contactOpen ? " is-open" : ""}`} type="button" onClick={() => setContactOpen((open) => !open)} aria-expanded={contactOpen}>
              <span>Primary contact</span>
              <strong>{draft.primaryContact || "Not recorded"}</strong>
              <b aria-hidden="true">›</b>
            </button>
            <article className="client-review-latest-activity-v10941">
              <div>
                <span>Latest activity</span>
                {latestActivity ? <>
                  <strong>{latestActivity.title || latestActivity.type}</strong>
                  <small><em className={`activity-${activityStatus(latestActivity)}`}>{activityStatusLabel(latestActivity)}</em>{formatDate(activityDate(latestActivity))}</small>
                </> : <strong>No activity recorded</strong>}
              </div>
              <button className={activitySyncing ? "is-loading" : ""} type="button" onClick={() => void refreshActivity()} disabled={activitySyncing} aria-label="Refresh activity" title="Refresh activity">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0 2 5.3"/><path d="M20 4v7h-7"/></svg>
              </button>
            </article>
          </section>

          {contactOpen && <section className="client-review-contact-editor-v10941" aria-label="Client and contact details">
            <header><div><span>Client details</span><strong>{draft.primaryContact || client.name}</strong></div><button type="button" onClick={() => setContactOpen(false)} aria-label="Close client details">×</button></header>
            <div className="client-review-contact-fields-v10941">
              <label><span>Primary contact</span><input value={draft.primaryContact} onChange={(event) => setDraft({ ...draft, primaryContact: event.target.value })} placeholder="Name" /></label>
              <label><span>Contact role</span><input value={draft.primaryContactRole} onChange={(event) => setDraft({ ...draft, primaryContactRole: event.target.value })} placeholder="Office Manager, Owner…" /></label>
              <label><span>Email</span><input type="email" value={draft.primaryContactEmail} onChange={(event) => setDraft({ ...draft, primaryContactEmail: event.target.value })} placeholder="email@company.com" /></label>
              <label><span>Phone</span><input type="tel" value={draft.primaryContactPhone} onChange={(event) => setDraft({ ...draft, primaryContactPhone: event.target.value })} placeholder="Phone" /></label>
              <label><span>City</span><input value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} placeholder="City" /></label>
              <label><span>State</span><input value={draft.state} onChange={(event) => setDraft({ ...draft, state: event.target.value.toUpperCase() })} placeholder="State" maxLength={20} /></label>
              <label><span>Market</span><input value={draft.market} onChange={(event) => setDraft({ ...draft, market: event.target.value })} placeholder="Market / territory" /></label>
              <label><span>Industry</span><input value={draft.industry} onChange={(event) => setDraft({ ...draft, industry: event.target.value })} placeholder="Dental, Legal, Medical…" /></label>
              <label><span>Client tags</span><input value={draft.tags.join(", ")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(/[,;|]/).map((value) => value.trim()).filter(Boolean) })} placeholder="Premier, Partner…" /></label>
              <label><span>Last quote</span><input type="date" value={draft.lastQuoteDate?.slice(0, 10) || ""} onChange={(event) => setDraft({ ...draft, lastQuoteDate: event.target.value, quoted: Boolean(event.target.value) || draft.quoted })} /></label>
              <label className="is-wide"><span>Internal note</span><textarea rows={3} value={draft.internalNote} onChange={(event) => setDraft({ ...draft, internalNote: event.target.value })} placeholder="Relationship or planning context" /></label>
            </div>
            <footer><button className="button secondary" type="button" onClick={() => setContactOpen(false)}>Cancel</button><button className="button primary" type="button" disabled={saving} onClick={() => void saveDetails()}>{saving ? "Saving…" : "Save details"}</button></footer>
          </section>}

          {(message || error) && <div className={error ? "compass-import-error client-review-message-v10941" : "compass-workspace-success client-review-message-v10941"} role={error ? "alert" : "status"}>{error || message}</div>}

          <section className="client-review-core-v10941">
            <header className="client-review-core-header-v10941">
              <div><span>Client Review</span><h3>Technology picture & review outcome</h3></div>
              <div className="client-review-core-metrics-v10941"><span className={`status-${companyHealthClass(healthStatus)}`}>{healthStatus}</span><strong>{formatMoney(summary.totalEstimatedValue)}</strong></div>
            </header>

            <div className="client-review-core-grid-v10941">
              <section className="client-review-outcome-v10941">
                <div className="client-review-section-heading-v10941"><div><span>Account Review Outcome</span><strong>{reviewHasPlan ? "Discussed plan" : "Not recorded"}</strong></div><button type="button" onClick={() => setReviewEditorOpen(true)}>{reviewHasPlan ? "Edit" : "Add outcome"}</button></div>
                {reviewHasPlan ? <>
                  {draft.reviewOutcome.meetingSummary && <p>{draft.reviewOutcome.meetingSummary}</p>}
                  {draft.reviewOutcome.agreedNextStep && <aside><span>Agreed next step</span><strong>{draft.reviewOutcome.agreedNextStep}</strong></aside>}
                  {draft.reviewOutcome.items.length > 0 && <div className="client-review-decisions-v10941">{draft.reviewOutcome.items.map((item) => {
                    const option = dispositionOption(item.disposition);
                    return <article key={item.id}><span className={`tone-${option.tone}`}>{option.label}</span><strong>{item.title}</strong>{item.targetDate && <small>{item.targetDate}</small>}</article>;
                  })}</div>}
                </> : <p className="client-review-empty-v10941">No account review outcome has been recorded yet.</p>}
              </section>

              <section className="client-review-technical-glance-v10941">
                <div className="client-review-section-heading-v10941"><div><span>Technical overview</span><strong>{devices.length} managed devices</strong></div></div>
                <div className="client-review-device-counts-v10941">
                  <div><strong>{physicalServers.length}</strong><span>Physical servers</span></div>
                  <div><strong>{virtualServers.length}</strong><span>Virtual servers</span></div>
                  <div><strong>{physicalWorkstations.length}</strong><span>Workstations</span></div>
                  <div><strong>{visibleFindings.length}</strong><span>Findings</span></div>
                </div>
                <div className="client-review-drivers-v10941"><span>Current focus</span><p>{summary.topDrivers.join(" · ") || "No scored technical concerns are currently recorded."}</p></div>
              </section>
            </div>

            <section className="client-review-needs-v10941">
              <div className="client-review-section-heading-v10941"><div><span>Upcoming needs</span><strong>{visibleProjects.length ? `${visibleProjects.length} planning item${visibleProjects.length === 1 ? "" : "s"}` : "No grouped needs"}</strong></div></div>
              {visibleProjects.length ? <div className="client-review-needs-list-v10941">{visibleProjects.map((project) => {
                const option = dispositionOption(project.disposition);
                const projectLocations = locations.filter((location) => project.locationIds.includes(location.id)).map((location) => location.name);
                return <article key={project.id}>
                  <span className={`tone-${option.tone}`}>{project.source === "review-outcome" ? "Agreed" : option.label}</span>
                  <div><strong>{project.title}</strong><small>{project.technicalDrivers.join(" · ") || "Identified from current technical findings."}</small></div>
                  <div className="client-review-need-meta-v10941"><span>{project.deviceIds.length} device{project.deviceIds.length === 1 ? "" : "s"}</span>{projectLocations.length > 0 && <span>{projectLocations.join(", ")}</span>}</div>
                </article>;
              })}</div> : <p className="client-review-empty-v10941">No current grouped technology need is recorded for this client.</p>}
            </section>

            <footer className="client-review-core-footer-v10941">
              <button className="button secondary" type="button" onClick={() => setReviewEditorOpen(true)}>{reviewHasPlan ? "Edit review outcome" : "Record review outcome"}</button>
              <Link className="button primary" href={generatorUrl(client, context)}>Open Client Report</Link>
            </footer>
          </section>

          <details className="client-review-technical-details-v10941">
            <summary><span><strong>Technical details</strong><small>{devices.length} devices · {visibleFindings.length} findings · {locationSnapshots.length || 1} location{locationSnapshots.length === 1 ? "" : "s"}</small></span><b>›</b></summary>
            <div className="client-review-technical-body-v10941">
              {locationSnapshots.length > 1 && <section className="compass-workspace-section compass-location-section">
                <div className="compass-workspace-section-heading"><div><span className="compass-kicker">Locations</span><h3>View by site</h3></div><span>{selectedLocation ? selectedLocation.name : "All locations"}</span></div>
                <div className="compass-location-selector" role="tablist" aria-label="Client location view">
                  <button type="button" role="tab" aria-selected={!activeLocationId} className={!activeLocationId ? "is-active" : ""} onClick={() => setActiveLocationId("")}>All locations</button>
                  {locationSnapshots.map((location) => <button key={location.id} type="button" role="tab" aria-selected={activeLocationId === location.id} className={activeLocationId === location.id ? "is-active" : ""} onClick={() => setActiveLocationId(location.id)}><strong>{location.name}</strong><small>{location.deviceIds.length} devices · {location.physicalServers + location.virtualServers} servers</small></button>)}
                </div>
              </section>}

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
                <div className="compass-inventory-table-wrap"><table className="compass-inventory-table"><thead><tr><th>Device</th><th>Type</th><th>OS</th><th>GPU</th><th>Lifecycle</th><th>Storage</th><th>Warranty</th><th>Check-in</th></tr></thead><tbody>{[...visibleDevices].sort((a, b) => a.deviceType.localeCompare(b.deviceType) || a.name.localeCompare(b.name)).map((device) => <tr key={device.id}><td><strong title={device.name}>{device.name}</strong><span title={device.model || "Model unavailable"}>{device.model || "Model unavailable"}</span></td><td><span className={device.isVirtual ? "is-virtual" : ""} title={deviceTypeLabel(device)}>{deviceTypeLabel(device)}</span>{device.virtualizationPlatform && <small title={device.virtualizationPlatform}>{device.virtualizationPlatform}</small>}</td><td className="compass-inventory-os" title={device.osName || "Unknown"}>{device.osName || "Unknown"}</td><td className="compass-inventory-gpu" title={device.videoCard || "Video card not reported"}>{compactVideoCard(device.videoCard)}</td><td><span className={`compass-lifecycle-pill lifecycle-${device.lifecycle}`}>{device.lifecycle.replace("-", " ")}</span></td><td className="compass-inventory-storage" title={storageLabel(device)}>{storageLabel(device)}</td><td>{formatDate(device.warrantyEnd)}</td><td>{formatDate(device.lastUptime || device.lastLogin)}</td></tr>)}</tbody></table></div>
              </section>
            </div>
          </details>
          </div>
        </div>
      </section>

      {reviewEditorOpen && <ReviewOutcomeEditor outcome={draft.reviewOutcome} suggestions={reviewSuggestions} saving={saving} onClose={() => setReviewEditorOpen(false)} onSave={saveReviewOutcome} />}
    </div>
  );
}
