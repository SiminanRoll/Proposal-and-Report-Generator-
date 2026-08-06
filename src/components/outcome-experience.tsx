"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import type { Finding, Project } from "@/lib/projects/types";
import { categoryLabel } from "@/lib/outcomes/builder";
import { clientFacingDocumentTitle, downloadOutcomePdf, outstandingHipaaQuestionCount } from "@/lib/outcomes/export-html";
import { downloadInventoryDiagnostics } from "@/lib/outcomes/inventory-diagnostics";
import { downloadPreMeetingOverviewPdf, openPreMeetingEmailDraft, preMeetingHipaaQuestionCount } from "@/lib/outcomes/pre-meeting";
import {
  clientReportAvailable,
  compassLocationSnapshots,
  compassProjectPackages,
  clientDeviceDisplayName,
  deviceTypeLabel,
  deviceTypeLabelForDevice,
  factNumber,
  formatMetric,
  graphicsSummary,
  physicalAssetCounts,
  inventoryReportDevices,
  inventoryReconciliation,
  reportableLifecycleDevices,
  isServerClassDevice,
  lifecycleStatusLabel,
  lifecycleSummary,
  osSupportReason,
  osSupportStatus,
  osSupportStatusLabel,
  osSupportSummary,
  reportReferenceDate,
  sortLifecycleDevices,
  sortLifecycleDevicesByPriority,
  storageAttentionSummary,
  storageStatus,
  storageStatusLabel,
  storageUsageSummary,
  technologyAssessmentAvailable,
  warrantyStatus,
  warrantyStatusLabel,
} from "@/lib/outcomes/client-report-data";
import { scoreHipaaAssessment } from "@/lib/hipaa/engine";
import { clientReportScores, scoreLabel, scoreTone } from "@/lib/outcomes/client-report-score";
import { clientReportPlanActions, technologyPlanningApproach } from "@/lib/outcomes/client-report-plan";
import { formatPlanningAppointment, planningConsultantSentence, scheduledPlanningAppointment } from "@/lib/outcomes/planning-appointment";
import { planningScheduledLabel } from "@/lib/outcomes/planning-mode";
import { agingSystemsStatus, networkPresentationMessage, securityIncidentResponseMessage, securityPresentationMessage, securityProtectionStatement } from "@/lib/outcomes/client-report-messaging";
import { ArrowIcon, CheckIcon, SparkIcon } from "./icons";
import { HipaaReviewAndResultsPresentation } from "./hipaa-presentation";
import { AnimatedNumber } from "./animated-number";
import { organizationTerm } from "@/lib/projects/client-language";
import { OnsitePlanningScheduler } from "./onsite-planning-scheduler";
import { ReviewOutcomeEditor } from "./review-outcome-editor";
import { hasAgreedReviewPlan } from "@/lib/review-outcomes/model";
import { loadCompassDataset, saveCompassDataset } from "@/lib/compass/store";
import {
  AdvantageStoryPresentation,
  ProposalAuthorizationPresentation,
  ProposalFindingsPresentation,
  ProposalInvestmentPresentation,
  ProposalInvestmentPreview,
  ProposalOverviewPresentation,
  ProposalPlanPresentation,
  ProposalPricingEditor,
  ProposalSecurityAssessmentPresentation,
} from "./proposal-experience";

const STANDARD_SECTIONS = ["overview", "findings", "plan", "recap"] as const;
const CLIENT_REPORT_SECTIONS = ["overview", "security", "lifecycle", "details", "locations", "plan", "recap"] as const;
type PresentationSection = (typeof CLIENT_REPORT_SECTIONS)[number] | (typeof STANDARD_SECTIONS)[number] | "advantage" | "investment" | "authorization" | "hipaa";

function sectionsFor(project: Project): PresentationSection[] {
  if (project.type === "client-report" && clientReportAvailable(project)) {
    const beginning: PresentationSection[] = ["overview", "security", "lifecycle", "details"];
    if (compassLocationSnapshots(project).length > 1) beginning.push("locations");
    const hipaa: PresentationSection[] = project.hipaa.enabled ? ["hipaa"] : [];
    return [...beginning, ...hipaa, "plan", "recap"];
  }
  if (project.type !== "client-report") {
    const technical: PresentationSection[] = technologyAssessmentAvailable(project) ? ["security", "lifecycle", "details"] : [];
    const hipaa: PresentationSection[] = project.hipaa.enabled ? ["hipaa"] : [];
    return ["overview", ...technical, "advantage", "findings", ...hipaa, "plan", "investment", "authorization"];
  }
  const base: PresentationSection[] = [...STANDARD_SECTIONS];
  if (!project.hipaa.enabled) return base;
  const planIndex = base.indexOf("plan");
  return [...base.slice(0, planIndex), "hipaa", ...base.slice(planIndex)];
}

function sectionLabel(value: PresentationSection): string {
  if (value === "overview") return "Introduction";
  if (value === "lifecycle") return "Network health";
  if (value === "security") return "Security";
  if (value === "details") return "Hardware inventory";
  if (value === "locations") return "Locations";
  if (value === "advantage") return "Why Advantage";
  if (value === "investment") return "Investment";
  if (value === "authorization") return "Authorize";
  if (value === "hipaa") return "HIPAA review";
  if (value === "recap") return "Recap";
  return value === "findings" ? "What we found" : "Planning";
}

function presentationType(project: Project): string {
  if (project.type === "client-report") return "Client technology review";
  if (project.type === "legacy-modernization") return "Modernized proposal";
  return "Advantage 360 proposal";
}

function severityCount(findings: Finding[], severity: Finding["severity"]): number {
  return findings.filter((item) => item.severity === severity).length;
}

function preparedDate(project: Project): string {
  const source = project.presentation.publishedAt || project.updatedAt || project.createdAt;
  const value = new Date(source);
  if (Number.isNaN(value.getTime())) return "Prepared";
  return `Prepared ${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(value)}`;
}

function LifecycleStatus({ value, label }: { value: "current" | "due-soon" | "overdue" | "unknown"; label?: string }) {
  return <span className={`device-status device-status-${value}`}>{label || lifecycleStatusLabel(value)}</span>;
}

function WarrantyStatusBadge({ device, project }: { device: ReturnType<typeof reportableLifecycleDevices>[number]; project: Project }) {
  const status = warrantyStatus(device, reportReferenceDate(project));
  return <span className={`warranty-status warranty-status-${status}`}><b>{warrantyStatusLabel(status)}</b><small>{device.warrantyExpires || "Date not listed"}</small></span>;
}

function StorageStatusBadge({ device }: { device: ReturnType<typeof reportableLifecycleDevices>[number] }) {
  const status = storageStatus(device);
  const detail = storageUsageSummary(device);
  if (!detail) return <span className="storage-not-reported">—</span>;
  return <span className={`storage-status storage-status-${status}`}><b>{storageStatusLabel(status)}</b><small>{detail}</small></span>;
}

function OsSupportBadge({ device }: { device: ReturnType<typeof inventoryReportDevices>[number] }) {
  const status = osSupportStatus(device);
  return <span className={`os-support-status os-support-status-${status}`}><b>{device.os || "Not reported"}</b><small>{osSupportStatusLabel(status)} · {osSupportReason(device)}</small></span>;
}

function HealthStatusCard({ status, label, detail, className = "", tone = "good" }: { status: string; label: string; detail: string; className?: string; tone?: string }) {
  return <article className={`health-score-card status-only ${tone} ${className}`}><span>{label}</span><strong>{status}</strong><small>{detail}</small></article>;
}


function AgingSystemsCard({ detail, tone }: { detail: string; tone: "healthy" | "attention" | "priority" }) {
  return <article className={`aging-systems-card ${tone}`}><span className="aging-systems-icon" aria-hidden="true">↻</span><strong>Aging Systems</strong><small>{detail}</small></article>;
}

function ClientReportOverview({ project }: { project: Project }) {
  const lifecycle = lifecycleSummary(project);
  const hipaa = scoreHipaaAssessment(project.hipaa);
  const scores = clientReportScores(project);
  const incidents = factNumber(project, "huntress.incidentsReported");
  const agingSystems = agingSystemsStatus(project);
  const reconciliation = inventoryReconciliation(project);
  const healthPriorities = lifecycle.overdue + lifecycle.dueSoon;
  const scope = project.hipaa.enabled
    ? "Security, lifecycle, HIPAA readiness, and next-step priorities."
    : "Security, lifecycle, infrastructure health, and next-step priorities.";
  return (
    <div className="presentation-health-cover">
      <div className="health-cover-main">
        <section className="health-cover-intro">
          <span className="presentation-kicker">Technology overview · Prepared for {project.client.name}</span>
          <h1>Technology<br />Health Review</h1>
          <p>{scope}</p>
          <div className="presentation-periods"><span>{preparedDate(project)}</span></div>
        </section>
        <article className={`overall-health-score ${scoreTone(scores.overall)}`} style={{ "--score-value": scores.overall } as CSSProperties}>
          <span>{scores.provisional ? "Provisional score" : "Overall technology health"}</span>
          <div><strong><AnimatedNumber value={scores.overall} delay={180} duration={1050} /></strong><em>/100</em></div>
          <b>{scoreLabel(scores.overall)}</b>
          <small>{scores.provisional ? `${hipaa.notYetAssessedCount} HIPAA question${hipaa.notYetAssessedCount === 1 ? " remains" : "s remain"} unanswered, so this score will update as the assessment is completed.` : "A combined view of security protection, lifecycle health, and readiness findings."}</small>
        </article>
        <div className={`health-score-card-grid ${project.hipaa.enabled ? "" : "without-hipaa"}`}>
          <HealthStatusCard status={scoreLabel(scores.security)} label="Security protection" detail="Monitoring, response, and reported incidents" className="security" tone={scoreTone(scores.security)} />
          <HealthStatusCard status={scoreLabel(scores.network)} label="Network & lifecycle" detail={`${lifecycle.current} healthy · ${healthPriorities} aging systems · critical systems weighted`} className="network" tone={scoreTone(scores.network)} />
          {project.hipaa.enabled && <HealthStatusCard status={hipaa.label} label="HIPAA readiness" detail={`${hipaa.assessedQuestionCount} questions answered · ${hipaa.notYetAssessedCount} unanswered`} className="compliance" tone={scoreTone(hipaa.overall)} />}
          <AgingSystemsCard detail={agingSystems.detail} tone={agingSystems.tone} />
        </div>
      </div>
      {!reconciliation.passed && <aside className="inventory-reconciliation-warning"><strong>Inventory needs review before sharing</strong><span>{reconciliation.messages.join(" ")}</span></aside>}
      <div className="health-evidence-strip four-up">
        <span><strong><AnimatedNumber value={lifecycle.inventoryTotal} delay={410} /></strong> managed assets</span>
        <span className="healthy"><strong><AnimatedNumber value={lifecycle.current} delay={470} /></strong> healthy</span>
        <span className="attention"><strong><AnimatedNumber value={healthPriorities} delay={530} /></strong> health priorities</span>
        <span className={incidents ? "risk" : "healthy"}><strong><AnimatedNumber value={incidents} delay={590} /></strong> security incidents</span>
      </div>
    </div>
  );
}

function SecurityPresentation({ project }: { project: Project }) {
  const events = factNumber(project, "huntress.eventsAnalyzed");
  const signals = factNumber(project, "huntress.signalsDetected");
  const investigated = factNumber(project, "huntress.signalsInvestigated");
  const incidents = factNumber(project, "huntress.incidentsReported");
  const entities = factNumber(project, "huntress.entitiesProtected");
  const canaries = factNumber(project, "huntress.canaryFiles");
  const endpoints = factNumber(project, "huntress.canaryEndpoints");
  const malware = factNumber(project, "huntress.malwareFilesBlocked");
  const antivirusEvents = factNumber(project, "huntress.antivirusEvents");
  const autorunEvents = factNumber(project, "huntress.autorunEvents");
  const autorunSignals = factNumber(project, "huntress.autorunSignals");
  const processEvents = factNumber(project, "huntress.processEvents");
  const processSignals = factNumber(project, "huntress.processSignals");
  const message = securityPresentationMessage(project);
  const incidentResponse = securityIncidentResponseMessage(project);
  return (
    <div className={`presentation-section-layout message-${message.tone}`}>
      <div className="presentation-section-heading"><span className="presentation-kicker">Security protection</span><h2>{message.title}</h2><p>{message.subtitle}</p></div>
      <div className="security-funnel-visual" aria-label={`${events} events became ${signals} signals and ${incidents} incidents`}>
        <div className="security-funnel-step events"><strong><AnimatedNumber value={events} delay={210} duration={1100} format={(current) => formatMetric(Math.round(current))} /></strong><span>Events analyzed</span><small>Across <AnimatedNumber value={entities} delay={360} /> protected entities</small></div>
        <div className="security-funnel-arrow">→</div>
        <div className="security-funnel-step signals"><strong><AnimatedNumber value={signals} delay={430} /></strong><span>Signals detected</span><small><AnimatedNumber value={investigated} delay={560} /> required investigation</small></div>
        <div className="security-funnel-arrow">→</div>
        <div className={`security-funnel-step incidents ${incidents ? "risk" : "healthy"}`}><strong><AnimatedNumber value={incidents} delay={650} /></strong><span>Incidents reported</span><small>{incidents ? incidentResponse.status : "No targeted attacks reported"}</small></div>
      </div>
      <div className="security-feature-grid">
        <article className="ransomware-feature"><div className="security-feature-icon">R</div><div><span>Ransomware early warning</span><div className="security-feature-metrics"><div><strong><AnimatedNumber value={canaries} delay={520} /></strong><small>Canary files monitored</small></div><i aria-hidden="true" /><div><strong><AnimatedNumber value={endpoints || entities} delay={610} /></strong><small>Protected endpoints</small></div></div><p>Hidden early-warning files are monitored for changes associated with ransomware, helping isolate activity before it spreads.</p></div></article>
        <article className="antivirus-feature"><div className="security-feature-icon">AV</div><div><span>Managed antivirus</span><h3><AnimatedNumber value={malware} delay={590} /> malware file{malware === 1 ? "" : "s"} automatically blocked</h3><p><AnimatedNumber value={antivirusEvents} delay={680} /> antivirus event{antivirusEvents === 1 ? " was" : "s were"} processed, with protection acting before a blocked file could execute.</p></div></article>
      </div>
      <div className={`security-monitoring-row ${incidentResponse.visible ? "with-incident" : "without-incident"}`}>
        <div className="security-activity-strip"><span><strong><AnimatedNumber value={autorunEvents} delay={700} format={(current) => formatMetric(Math.round(current))} /></strong><small>Autorun events</small><em><AnimatedNumber value={autorunSignals} delay={780} /> signals</em></span><span><strong><AnimatedNumber value={processEvents} delay={760} format={(current) => formatMetric(Math.round(current))} /></strong><small>Process events</small><em><AnimatedNumber value={processSignals} delay={840} /> signals</em></span>{!incidentResponse.visible && <p>Additional monitoring looks for persistence and suspicious processes that may appear before a larger incident.</p>}</div>
        {incidentResponse.visible && <article className={`security-incident-response ${incidentResponse.actions.length ? "completed" : "reviewed"}`}><div className="security-response-copy"><span>Security team response</span><h3>{incidentResponse.title}</h3><p>{incidentResponse.summary}</p></div><div className="security-response-details">{incidentResponse.device && <div><small>Affected computer</small><strong>{incidentResponse.device}</strong></div>}{incidentResponse.threat && <div><small>Threat identified</small><strong>{incidentResponse.threat}</strong></div>}<div className="response-status"><small>Outcome</small><strong>{incidentResponse.status}</strong></div></div>{incidentResponse.actions.length > 0 && <div className="security-response-actions"><span>Actions taken</span><div>{incidentResponse.actions.map((action) => <small key={action}><b>✓</b>{action}</small>)}</div></div>}</article>}
      </div>
      <aside className="security-protection-statement"><span>Keeping your protection complete</span><p>{securityProtectionStatement(project)}</p></aside>
    </div>
  );
}

function LifecyclePresentation({ project }: { project: Project }) {
  const lifecycle = lifecycleSummary(project);
  const devices = sortLifecycleDevices(reportableLifecycleDevices(project));
  const replacements = devices.filter((device) => device.lifecycleStatus === "overdue");
  const sourceReportedReplacementCount = Math.max(lifecycle.overdue, replacements.length);
  const unmatchedReplacementCount = Math.max(0, sourceReportedReplacementCount - replacements.length);
  const nextDevices = devices.filter((device) => device.lifecycleStatus === "due-soon").slice(0, 4);
  const inventory = inventoryReportDevices(project);
  const { workstations, servers, backupServers } = physicalAssetCounts(project);
  const vms = inventory.filter((device) => device.type === "vm").length;
  const network = factNumber(project, "scalepad.networkDevices");
  const message = networkPresentationMessage(project);
  const segment = (count: number) => lifecycle.total ? `${Math.max(0, (count / lifecycle.total) * 100)}%` : "0%";
  return (
    <div className={`presentation-section-layout message-${message.tone}`}>
      <div className="presentation-section-heading network-health-heading"><span className="presentation-kicker">Network health & lifecycle</span><h2>{message.title}</h2><p>{message.subtitle}</p></div>
      <div className="network-health-overview">
        <div className="lifecycle-health-score"><strong><AnimatedNumber value={lifecycle.healthyPercentage} delay={180} suffix="%" /></strong><span>currently healthy</span><small><AnimatedNumber value={lifecycle.current} delay={300} /> of <AnimatedNumber value={lifecycle.assessed} delay={360} /> lifecycle-assessed physical assets are healthy{lifecycle.unknown ? <> · <AnimatedNumber value={lifecycle.unknown} delay={390} /> need lifecycle data</> : null}</small></div>
        <div className="lifecycle-story">
          <div className="lifecycle-segmented-bar"><span className="current" style={{ width: segment(lifecycle.current) }} /><span className="due-soon" style={{ width: segment(lifecycle.dueSoon) }} /><span className="overdue" style={{ width: segment(lifecycle.overdue) }} /><span className="unknown" style={{ width: segment(lifecycle.unknown) }} /></div>
          <div className="lifecycle-legend"><span className="current"><b><AnimatedNumber value={lifecycle.current} delay={430} /></b> Healthy now</span><span className="due-soon"><b><AnimatedNumber value={lifecycle.dueSoon} delay={500} /></b> Plan soon</span><span className="overdue"><b><AnimatedNumber value={lifecycle.overdue} delay={570} /></b> Health priorities</span><span className="unknown"><b><AnimatedNumber value={lifecycle.unknown} delay={640} /></b> Lifecycle unknown</span></div>
        </div>
      </div>
      <div className="environment-count-strip server-first"><span className="server-count"><strong><AnimatedNumber value={servers} delay={520} /></strong>Primary server{servers === 1 ? "" : "s"}</span>{backupServers > 0 && <span className="backup-server-count"><strong><AnimatedNumber value={backupServers} delay={560} /></strong>Cloud Plus backup server{backupServers === 1 ? "" : "s"}</span>}<span><strong><AnimatedNumber value={workstations} delay={600} /></strong>Workstations</span>{vms > 0 && <span><strong><AnimatedNumber value={vms} delay={650} /></strong>Virtual machines</span>}{network > 0 && <span><strong><AnimatedNumber value={network} delay={700} /></strong>Network devices</span>}</div>
      {sourceReportedReplacementCount > 0 && <section className="replacement-overview"><div><span className="presentation-kicker">Health priority details</span><h3>{sourceReportedReplacementCount} system{sourceReportedReplacementCount === 1 ? "" : "s"} need lifecycle planning</h3><p>Server-class systems require a next-step decision: replace, migrate, or safely retire. Other aged computers can be included in the same plan.{unmatchedReplacementCount ? ` ${replacements.length} named system${replacements.length === 1 ? " was" : "s were"} matched safely to the current inventory; ${unmatchedReplacementCount} source-reported priorit${unmatchedReplacementCount === 1 ? "y remains" : "ies remain"} unmatched and should be confirmed before sharing.` : ""}</p></div>{replacements.length > 0 && <div className="replacement-device-grid">{replacements.map((device, index) => <article className={device.type === "server" ? "priority-server" : device.type === "backup-server" ? "priority-backup-server" : ""} key={`${device.type}-${device.name}`}><b>{String(index + 1).padStart(2, "0")}</b><div><span>{device.type === "server" ? "Primary server" : device.type === "backup-server" ? "Cloud Plus backup server" : deviceTypeLabel(device.type)}</span><h4>{clientDeviceDisplayName(device)}</h4><p>{device.make} {device.model}</p><small>{[device.location, device.age ? `${device.age} years old` : "Age not listed", device.warrantyExpires ? `Warranty ${device.warrantyExpires}` : "", osSupportStatus(device) === "unsupported" ? "OS end of support" : osSupportStatus(device) === "ending-soon" ? "OS planning concern" : ""].filter(Boolean).join(" · ")}</small></div><LifecycleStatus value={device.lifecycleStatus} label={isServerClassDevice(device) ? "Plan next step" : undefined} /></article>)}</div>}</section>}
      {nextDevices.length > 0 && <div className="next-device-strip"><span>Next in the lifecycle</span><div>{nextDevices.map((device) => <article key={`${device.type}-${device.name}`}><div><h3>{clientDeviceDisplayName(device)}</h3><LifecycleStatus value={device.lifecycleStatus} /></div><small>{device.age ? `${device.age} years old` : device.type}</small></article>)}</div></div>}
    </div>
  );
}

function DeviceDetailPresentation({ project }: { project: Project }) {
  const [filter, setFilter] = useState<"all" | "current" | "due-soon" | "overdue" | "unknown" | "storage" | "os">("all");
  const devices = useMemo(() => sortLifecycleDevicesByPriority(inventoryReportDevices(project)), [project]);
  const lifecycle = lifecycleSummary(project);
  const storage = storageAttentionSummary(project);
  const osSupport = osSupportSummary(project);
  const hasServer = devices.some(isServerClassDevice);
  const filteredDevices = useMemo(() => {
    if (filter === "all") return devices;
    if (filter === "storage") {
      const storageDevices = devices.filter((device) => {
        const status = storageStatus(device);
        return storage.attention ? status === "watch" || status === "critical" : status !== "unknown";
      });
      return storageDevices.sort((a, b) => {
        const aStatus = storageStatus(a) === "critical" ? 0 : storageStatus(a) === "watch" ? 1 : 2;
        const bStatus = storageStatus(b) === "critical" ? 0 : storageStatus(b) === "watch" ? 1 : 2;
        if (aStatus !== bStatus) return aStatus - bStatus;
        return (b.storagePercent || 0) - (a.storagePercent || 0);
      });
    }
    if (filter === "os") {
      const osDevices = devices.filter((device) => {
        const status = osSupportStatus(device);
        return osSupport.attention ? status === "unsupported" || status === "ending-soon" : status !== "unknown";
      });
      return osDevices.sort((a, b) => {
        const priority = (device: (typeof devices)[number]) => osSupportStatus(device) === "unsupported" ? 0 : osSupportStatus(device) === "ending-soon" ? 1 : 2;
        const status = priority(a) - priority(b);
        return status || a.name.localeCompare(b.name);
      });
    }
    return devices.filter((device) => device.lifecycleStatus === filter);
  }, [devices, filter, osSupport.attention, storage.attention]);
  const filterLabel = filter === "all" ? "all assets" : filter === "current" ? "healthy assets" : filter === "due-soon" ? "plan-soon assets" : filter === "overdue" ? "replace-now assets" : filter === "unknown" ? "assets needing lifecycle data" : filter === "os" ? osSupport.attention ? "operating-system concerns" : "assets with reported operating systems" : storage.attention ? "storage-attention assets" : "assets with reported storage";
  const cards = [
    { key: "all" as const, label: "Total assets", value: devices.length, className: "" },
    { key: "current" as const, label: "Healthy now", value: lifecycle.current, className: "healthy" },
    { key: "due-soon" as const, label: "Plan soon", value: lifecycle.dueSoon, className: "attention" },
    { key: "overdue" as const, label: "Replace now", value: lifecycle.overdue, className: "risk" },
    { key: "unknown" as const, label: "Lifecycle unknown", value: lifecycle.unknown, className: "unknown" },
  ];
  return (
    <div className="presentation-section-layout">
      <div className="presentation-section-heading"><span className="presentation-kicker">Hardware inventory</span><h2>The devices behind the health score.</h2><p>{hasServer ? "Priority devices appear first, with primary and Cloud Plus backup servers kept prominent inside each status. " : "Priority devices appear first. "}Virtual machines remain visible and are identified separately because their lifecycle depends on the physical host. Storage and operating-system support are tracked as separate health concerns. Select a summary to review one group together.</p></div>
      <div className="hardware-summary-ribbon five-up" role="group" aria-label="Filter hardware inventory by lifecycle status">{cards.map((card) => <button type="button" key={card.key} className={`${card.className} ${filter === card.key ? "active" : ""}`.trim()} aria-pressed={filter === card.key} onClick={() => setFilter(card.key)}><strong>{card.value}</strong><span>{card.label}</span></button>)}</div>
      <div className="inventory-health-panels">
        {storage.reported > 0 && <button type="button" className={`storage-attention-panel ${storage.attention ? "has-attention" : "healthy"} ${filter === "storage" ? "active" : ""}`} aria-pressed={filter === "storage"} onClick={() => setFilter("storage")}><div><span className="presentation-kicker">Storage capacity</span><strong>{storage.attention ? `${storage.attention} device${storage.attention === 1 ? " needs" : "s need"} storage attention` : "Reported storage capacity is healthy"}</strong><small>Storage pressure is tracked separately from lifecycle replacement and does not change a replacement status by itself.</small></div><div className="storage-attention-metrics"><span className="critical"><b>{storage.critical}</b>Critical</span><span className="watch"><b>{storage.watch}</b>Watch</span><span className="healthy"><b>{storage.healthy}</b>Healthy</span></div></button>}
        {osSupport.reported > 0 && <button type="button" className={`os-support-panel ${osSupport.attention ? "has-attention" : "healthy"} ${filter === "os" ? "active" : ""}`} aria-pressed={filter === "os"} onClick={() => setFilter("os")}><div><span className="presentation-kicker">OS support</span><strong>{osSupport.attention ? `${osSupport.attention} device${osSupport.attention === 1 ? " needs" : "s need"} operating-system attention` : "Reported operating systems are supported"}</strong><small>Windows 10 and Server 2012 are end-of-support concerns. Server 2016 and Windows 11 Home are highlighted for planning.</small></div><div className="os-support-metrics"><span className="unsupported"><b>{osSupport.endOfSupport}</b>End of support</span><span className="planning"><b>{osSupport.planning}</b>Planning</span><span className="supported"><b>{osSupport.supported}</b>Supported</span></div></button>}
      </div>
      <div className="inventory-filter-status"><strong>Showing {filteredDevices.length}</strong><span>{filterLabel}, sorted by priority</span></div>
      {!devices.length ? <div className="hardware-empty-state"><strong>The inventory summary was read, but the detailed device rows could not be structured.</strong><p>Attach a ScalePad PDF or supported device spreadsheet to populate the named inventory. The summary counts remain available for the review.</p></div> : filteredDevices.length ? <div className="presentation-device-table-wrap"><table className="presentation-device-table"><thead><tr><th>Device</th><th>Type</th><th>Device model</th><th>Video card</th><th>Storage</th><th>Operating system & support</th><th>Age</th><th>Warranty status</th><th>Last check-in</th><th>Lifecycle</th></tr></thead><tbody>{filteredDevices.map((device, index) => <tr className={`device-row-${device.lifecycleStatus} device-row-type-${device.type} device-row-os-${osSupportStatus(device)}`} style={{ "--row-delay": `${Math.min(index, 18) * 38}ms` } as CSSProperties} key={`${device.type}-${device.name}-${device.serial}`}><td><strong>{clientDeviceDisplayName(device)}</strong><small>{[device.location, device.user || device.serial].filter(Boolean).join(" · ")}</small></td><td><span className={`device-type-badge ${device.type}`}>{deviceTypeLabelForDevice(device)}</span></td><td><span>{`${device.make} ${device.model}`.trim() || (device.type === "vm" ? "Virtual Machine" : "Not included in source export")}</span></td><td><span>{device.graphics ? graphicsSummary(device.graphics) : "Not included in source export"}</span></td><td><StorageStatusBadge device={device} /></td><td><OsSupportBadge device={device} /></td><td>{device.type === "vm" ? device.age ? `${device.age} years (VM)` : "Host dependent" : device.age || "—"}</td><td>{device.type === "vm" ? <span className="warranty-status warranty-status-unknown"><b>Virtual machine</b><small>Host hardware determines lifecycle</small></span> : <WarrantyStatusBadge device={device} project={project} />}</td><td>{device.lastCheckIn || "—"}</td><td><LifecycleStatus value={device.lifecycleStatus} label={device.type === "vm" ? "Virtual machine" : undefined} /></td></tr>)}</tbody></table></div> : <div className="hardware-empty-state filtered"><strong>No devices match this filter.</strong><p>Select another summary card to continue the review.</p></div>}
    </div>
  );
}

function LocationPresentation({ project }: { project: Project }) {
  const locations = compassLocationSnapshots(project);
  const projects = compassProjectPackages(project);
  const devices = inventoryReportDevices(project);
  return <div className="presentation-section-layout location-presentation">
    <div className="presentation-section-heading"><span className="presentation-kicker">Location-specific review</span><h2>Each site stays distinct.</h2><p>Named locations are shown separately so server, workstation, lifecycle, operating-system, storage, and agreed-plan details do not get mixed into one oversized list.</p></div>
    <div className="presentation-location-grid">{locations.map((location) => {
      const ids = new Set(location.deviceIds);
      const locationDevices = devices.filter((device) => device.sourceDeviceId ? ids.has(device.sourceDeviceId) : device.location === location.name);
      const locationProjects = projects.filter((item) => item.locationIds.includes(location.id));
      return <article key={location.id}>
        <header><div><span>Location</span><h3>{location.name}</h3></div><strong>{location.deviceIds.length} devices</strong></header>
        <div className="presentation-location-metrics"><span><b>{location.physicalServers}</b>Physical servers</span><span><b>{location.virtualServers}</b>Virtual servers</span><span><b>{location.replaceNow}</b>Replace now</span><span><b>{location.planSoon}</b>Plan soon</span><span><b>{location.windows10}</b>Windows 10</span><span><b>{location.storageAttention}</b>Storage</span></div>
        {locationProjects.length > 0 && <div className="presentation-location-projects"><span className="presentation-location-subhead">Location project plan</span>{locationProjects.slice(0, 4).map((item) => <div key={item.id}><strong>{item.title}</strong><small>{item.source === "review-outcome" ? "Agreed plan" : "Technical finding"} · {item.timing} · {item.quoted ? "Quoted" : "Not quoted"}</small></div>)}{locationProjects.length > 4 && <small className="presentation-location-more">+ {locationProjects.length - 4} additional grouped projects in the plan</small>}</div>}
        <div className="presentation-location-device-list">{locationDevices.slice(0, 8).map((device) => <span key={device.sourceDeviceId || `${device.type}-${device.name}`}><strong>{clientDeviceDisplayName(device)}</strong><small>{deviceTypeLabelForDevice(device)} · {device.lifecycleStatus === "overdue" ? "Replace now" : device.lifecycleStatus === "due-soon" ? "Plan soon" : device.type === "vm" ? "Virtual" : "Current"}</small></span>)}</div>
        {locationDevices.length > 8 && <small className="presentation-location-more">+ {locationDevices.length - 8} additional devices in the detailed inventory</small>}
      </article>;
    })}</div>
  </div>;
}

function PlanPresentation({ project, onUpdate }: { project: Project; onUpdate: (project: Project) => void }) {
  if (project.type !== "client-report") return <ProposalPlanPresentation project={project} />;
  if (project.type !== "client-report") {
    return <div className="presentation-section-layout"><div className="presentation-section-heading"><span className="presentation-kicker">Planning</span><h2>Turn the review into a practical roadmap.</h2><p>A focused plan connected directly to the security, network-health, and readiness findings.</p></div><div className="presentation-plan">{project.recommendations.map((item, index) => <article key={item.id}><b>{String(index + 1).padStart(2, "0")}</b><div><h3>{item.title}</h3><p>{item.clientValue}</p></div></article>)}</div>{(project.pricing.monthly > 0 || project.pricing.oneTime > 0) && <div className="presentation-investment"><span><small>Monthly investment</small><strong>${project.pricing.monthly.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></span><span><small>One-time investment</small><strong>${project.pricing.oneTime.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></span></div>}</div>;
  }
  const actions = clientReportPlanActions(project);
  const projectPackages = compassProjectPackages(project);
  const locationNameById = new Map(compassLocationSnapshots(project).map((location) => [location.id, location.name]));
  const lifecycle = lifecycleSummary(project);
  const hipaa = scoreHipaaAssessment(project.hipaa);
  const incidents = factNumber(project, "huntress.incidentsReported");
  const incidentResponse = securityIncidentResponseMessage(project);
  const healthPriorities = lifecycle.overdue + lifecycle.dueSoon;
  const osSupport = osSupportSummary(project);
  const approach = technologyPlanningApproach(project);
  const securityFollowUps = incidents && !incidentResponse.actions.length ? incidents : 0;
  const hipaaFollowUps = project.hipaa.enabled ? hipaa.notYetAssessedCount + hipaa.counts.no + hipaa.counts.partially : 0;
  const agreedPlan = hasAgreedReviewPlan(project.reviewOutcome);
  const hasActionItems = agreedPlan || healthPriorities > 0 || osSupport.attention > 0 || securityFollowUps > 0 || hipaaFollowUps > 0;
  const hasHardwareActions = healthPriorities > 0;
  const headline = agreedPlan ? "Agreed technology roadmap" : hasHardwareActions ? approach.title : hasActionItems ? "What should happen next" : approach.title;
  const intro = agreedPlan
    ? project.reviewOutcome.meetingSummary || "The technical findings were reviewed and converted into the plan agreed with the client."
    : hasHardwareActions
      ? approach.intro
      : hasActionItems
        ? "A guided planning session with Advantage's Technology Consultant team will turn the findings into clear decisions and next steps."
        : approach.intro;
  return <div className={`presentation-section-layout client-action-plan ${hasActionItems ? "action-mode" : "healthy-mode"}`}>
    <div className="planning-hero-grid">
      <div className="presentation-section-heading"><span className="presentation-kicker">Planning</span><h2>{headline}</h2><p>{intro}</p></div>
      {agreedPlan ? <section className="planning-consultation-banner agreed-plan-banner">
        <div><span className="presentation-kicker">{project.reviewOutcome.status === "confirmed" ? "Confirmed with client" : "Draft client plan"}</span><h3>Agreed next step</h3><p>{project.reviewOutcome.agreedNextStep || "Complete the recorded decisions and confirm progress at the next review checkpoint."}</p></div>
        <div className="planning-session-outcomes">{actions.slice(0, 4).map((item) => <span key={item.id}>{item.title}</span>)}</div>
      </section> : hasHardwareActions && approach.mode !== "purchase-planning" ? <OnsitePlanningScheduler
        project={project}
        onUpdate={onUpdate}
        title={approach.consultationTitle}
        copy={approach.consultationCopy}
        outcomes={approach.sessionOutcomes}
      /> : <section className="planning-consultation-banner">
        <div><span className="presentation-kicker">{hasActionItems ? "Recommended next step" : "Current recommendation"}</span><h3>{hasHardwareActions ? approach.consultationTitle : hasActionItems ? "Meet with your Technology Consultant" : approach.consultationTitle}</h3><p>{hasHardwareActions ? approach.consultationCopy : hasActionItems ? "Your consultant will review the open findings, answer questions, and confirm the appropriate next steps." : approach.consultationCopy}</p></div>
        <div className="planning-session-outcomes">{(hasHardwareActions ? approach.sessionOutcomes : hasActionItems ? ["Review findings", "Confirm owners", "Agree on actions", "Set follow-up"] : approach.sessionOutcomes).map((item) => <span key={item}>{item}</span>)}</div>
      </section>}
    </div>
    <div className={`planning-context-strip ${project.hipaa.enabled ? "with-hipaa" : ""}`}>
      <span className="healthy"><strong><AnimatedNumber value={lifecycle.current} delay={440} /></strong><b>Healthy assets</b></span>
      <span className={healthPriorities ? "attention" : "healthy"}><strong><AnimatedNumber value={healthPriorities} delay={510} /></strong><b>Health priorities</b></span>
      {project.hipaa.enabled && <span className={hipaaFollowUps ? "attention" : "healthy"}><div className="planning-context-value"><strong><AnimatedNumber value={hipaa.overall} delay={580} /></strong><em>/100</em></div><b>HIPAA readiness</b></span>}
      <span className={osSupport.attention ? "attention" : "healthy"}><strong><AnimatedNumber value={osSupport.attention} delay={620} /></strong><b>OS support concerns</b></span>
      <span className={securityFollowUps ? "attention" : "healthy"}><strong><AnimatedNumber value={securityFollowUps} delay={650} /></strong><b>Security follow-ups</b></span>
    </div>
    {projectPackages.length ? <div className="presentation-project-package-grid">{projectPackages.map((item, index) => <article key={item.id} className={`project-package-${item.source === "review-outcome" ? "agreed" : "technical"}`}><div className="project-package-number">{String(index + 1).padStart(2, "0")}</div><div><div className="plan-action-meta"><span>{item.timing}</span><span>{item.quoted ? "Quoted" : "Not quoted"}</span><span>{item.deviceIds.length} device{item.deviceIds.length === 1 ? "" : "s"}</span>{item.locationIds.length > 0 && <span>{item.locationIds.map((id) => locationNameById.get(id)).filter(Boolean).join(" · ")}</span>}</div><h3>{item.title}</h3><p>{item.technicalDrivers.join(" · ") || "Packaged from the current technology findings."}</p><div className="presentation-project-owners"><span><small>Client</small>{item.clientResponsibility}</span><span><small>Advantage</small>{item.advantageResponsibility}</span></div></div></article>)}</div> : <div className="presentation-plan action-plan-grid">{actions.map((item, index) => <article className={`plan-action-${item.tone}`} key={item.id}><b>{String(index + 1).padStart(2, "0")}</b><div><div className="plan-action-meta"><span>{item.timing}</span><span>{item.owner}</span></div><h3>{item.title}</h3><p>{item.detail}</p></div></article>)}</div>}
  </div>;
}

function RecapPresentation({ project, onUpdate }: { project: Project; onUpdate: (project: Project) => void }) {
  const lifecycle = lifecycleSummary(project);
  const incidents = factNumber(project, "huntress.incidentsReported");
  const incidentResponse = securityIncidentResponseMessage(project);
  const hipaa = scoreHipaaAssessment(project.hipaa);
  const incomplete = project.hipaa.enabled && hipaa.notYetAssessedCount > 0;
  const healthPriorities = lifecycle.overdue + lifecycle.dueSoon;
  const osSupport = osSupportSummary(project);
  const approach = technologyPlanningApproach(project);
  const securityFollowUps = incidents && !incidentResponse.actions.length ? incidents : 0;
  const hipaaFollowUps = project.hipaa.enabled ? hipaa.notYetAssessedCount + hipaa.counts.no + hipaa.counts.partially : 0;
  const agreedPlan = hasAgreedReviewPlan(project.reviewOutcome);
  const hasActionItems = agreedPlan || healthPriorities > 0 || osSupport.attention > 0 || securityFollowUps > 0 || hipaaFollowUps > 0;
  const appointment = approach.mode === "purchase-planning" ? null : scheduledPlanningAppointment(project);
  const canSchedulePlanning = healthPriorities > 0 && !agreedPlan && approach.mode !== "purchase-planning";
  return <div className={`presentation-recap ${hasActionItems ? "action-mode" : "healthy-mode"}`}>
    <div className="recap-heading-row">
      <div><span className="presentation-kicker">Final recap</span><h2>Today&apos;s takeaways</h2><p>{agreedPlan ? project.reviewOutcome.meetingSummary || "The review findings and client decisions are documented in one agreed roadmap." : healthPriorities ? approach.intro : hasActionItems ? "Most of the environment is healthy. The items that need attention are documented, and the next conversation can focus on practical decisions." : "The environment reviewed is in a healthy position, with no immediate replacement or corrective action recommended from this report."}</p></div>
      {canSchedulePlanning ? <OnsitePlanningScheduler
        project={project}
        onUpdate={onUpdate}
        title={approach.consultationTitle}
        copy={approach.consultationCopy}
        outcomes={approach.sessionOutcomes}
        variant="compact"
      /> : <aside className={`recap-next-step ${appointment ? "scheduled" : agreedPlan ? "agreed" : hasActionItems ? "" : "healthy"}`}><span className="presentation-kicker">{agreedPlan ? "Agreed next step" : appointment ? planningScheduledLabel(project) : hasActionItems ? "Recommended next step" : "Looking ahead"}</span><h3>{agreedPlan ? "Follow the agreed technology roadmap" : appointment ? formatPlanningAppointment(appointment) : healthPriorities ? approach.consultationTitle : hasActionItems ? "Schedule a Technology Consultant session" : "Continue the current review cadence"}</h3><p>{agreedPlan ? project.reviewOutcome.agreedNextStep || "Complete the recorded decisions and confirm progress at the next review checkpoint." : appointment ? planningConsultantSentence(project, appointment) : healthPriorities ? approach.consultationCopy : hasActionItems ? "Review the findings together, confirm the open priorities, and agree on practical next steps." : "Keep current monitoring in place and revisit technology health at the next scheduled review."}</p></aside>}
    </div>
    <div className="recap-score-grid"><article><strong><AnimatedNumber value={lifecycle.inventoryTotal} delay={280} /></strong><span>Managed assets</span><small>Full inventory included in the review</small></article><article className="healthy"><strong><AnimatedNumber value={lifecycle.current} delay={350} /></strong><span>Healthy assets</span><small>Systems that can remain in service</small></article><article className={healthPriorities ? "attention" : "healthy"}><strong><AnimatedNumber value={healthPriorities} delay={420} /></strong><span>Health priorities</span><small>{healthPriorities ? approach.mode === "purchase-planning" ? "Computers to plan for replacement" : "Items to discuss in the planning session" : "No lifecycle action required"}</small></article><article className={osSupport.attention ? "attention" : "healthy"}><strong><AnimatedNumber value={osSupport.attention} delay={455} /></strong><span>OS support concerns</span><small>{osSupport.endOfSupport ? `${osSupport.endOfSupport} end of support · ${osSupport.planning} planning` : osSupport.planning ? `${osSupport.planning} planning concern${osSupport.planning === 1 ? "" : "s"}` : "Reported systems supported"}</small></article><article className={incidents && securityFollowUps ? "risk" : "healthy"}><strong><AnimatedNumber value={incidents} delay={490} /></strong><span>Security incidents</span><small>{incidents ? incidentResponse.status : "No incidents reported"}</small></article></div>
    {project.hipaa.enabled && <div className={`recap-hipaa-status ${incomplete ? "attention" : "healthy"}`}><div><span className="presentation-kicker">HIPAA Security Readiness</span><strong><AnimatedNumber value={hipaa.overall} delay={520} suffix="%" /></strong></div><p>{incomplete ? `${hipaa.notYetAssessedCount} question${hipaa.notYetAssessedCount === 1 ? " remains" : "s remain"} skipped or unanswered and should be revisited during the follow-up process.` : `The assessment is complete with ${hipaa.completionPercentage}% of applicable controls assessed.`}</p></div>}
    <div className="recap-roadmap">{healthPriorities && approach.mode === "purchase-planning" ? <><article><b>01</b><div><span>Plan the purchase</span><p>Keep the identified computer replacements in the technology budget and timeline.</p></div></article><article><b>02</b><div><span>Let us help confirm the fit</span><p>Advantage can help with business-class equipment and software requirements whenever you are ready.</p></div></article><article><b>03</b><div><span>Coordinate when ready</span><p>Choose a comfortable purchase and installation timeline without pressure.</p></div></article></> : healthPriorities && approach.mode === "onsite-project" ? <><article><b>01</b><div><span>Review onsite</span><p>Review the server, backup, applications, computers, and connected equipment.</p></div></article><article><b>02</b><div><span>Confirm the complete scope</span><p>Include every item that needs replacement, while keeping budget and timing flexible.</p></div></article><article><b>03</b><div><span>Build the project plan</span><p>Prepare the estimate, installation plan, responsibilities, and timing.</p></div></article></> : healthPriorities ? <><article><b>01</b><div><span>Review remotely</span><p>Confirm the affected computer or computers with your Technology Consultant.</p></div></article><article><b>02</b><div><span>Prepare the estimate</span><p>Validate equipment requirements and replacement options.</p></div></article><article><b>03</b><div><span>Choose timing</span><p>Agree on the practical replacement date and next review checkpoint.</p></div></article></> : hasActionItems ? <><article><b>01</b><div><span>Review together</span><p>Walk through the report and answer remaining questions.</p></div></article><article><b>02</b><div><span>Confirm owners</span><p>Validate the open findings and responsible parties.</p></div></article><article><b>03</b><div><span>Agree on actions</span><p>Set timing and the next follow-up checkpoint.</p></div></article></> : <><article><b>01</b><div><span>Maintain the baseline</span><p>Keep healthy systems protected and within the normal lifecycle.</p></div></article><article><b>02</b><div><span>Continue monitoring</span><p>Watch for meaningful security, capacity, or support changes.</p></div></article><article><b>03</b><div><span>Schedule the next review</span><p>Revisit the environment at the normal quarterly or annual checkpoint.</p></div></article></>}</div>
    {incomplete && <div className="recap-warning"><strong>HIPAA assessment incomplete</strong><span>{hipaa.notYetAssessedCount} question{hipaa.notYetAssessedCount === 1 ? " was" : "s were"} skipped or remain unanswered. This reduced the displayed readiness result and should be revisited.</span></div>}
    <div className="recap-close"><CheckIcon /><div><strong>Thank you for reviewing your technology health with us.</strong><span>{approach.mode === "purchase-planning" ? "Advantage Technologies is available to help plan and coordinate the computer purchases whenever the practice is ready." : hasActionItems ? "Advantage Technologies will use these findings to guide the next planning conversation." : "Advantage Technologies will continue monitoring the environment and support the next scheduled review."}</span></div></div>
  </div>;
}

function StandardOverview({ project }: { project: Project }) {
  return <div className="presentation-overview"><div className="presentation-overview-copy"><span className="presentation-kicker">{presentationType(project)} · Prepared for {project.client.name}</span><h1>{project.presentation.title}</h1><p>{project.presentation.executiveSummary}</p></div><div className="presentation-score-stack"><div className="presentation-score priority"><strong><AnimatedNumber value={severityCount(project.findings, "priority")} delay={240} /></strong><span>Priority</span></div><div className="presentation-score attention"><strong><AnimatedNumber value={severityCount(project.findings, "attention")} delay={320} /></strong><span>Attention</span></div><div className="presentation-score healthy"><strong><AnimatedNumber value={severityCount(project.findings, "healthy")} delay={400} /></strong><span>Healthy</span></div></div>{project.painPoints.length > 0 && <div className="presentation-pain"><span>What matters most</span><strong>{project.painPoints[0]}</strong></div>}</div>;
}

function ClientPresentation({ project, onUpdate, onClose, onDownloadPdf, pdfBusy }: { project: Project; onUpdate: (project: Project) => void; onClose: () => void; onDownloadPdf: () => Promise<void>; pdfBusy: boolean }) {
  const sections = useMemo(() => sectionsFor(project), [project]);
  const [section, setSection] = useState<PresentationSection>(sections[0]);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const sectionIndex = Math.max(0, sections.indexOf(section));
  const presentationDocumentTitle = clientFacingDocumentTitle(project);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = presentationDocumentTitle;
    return () => {
      document.title = previousTitle;
    };
  }, [presentationDocumentTitle]);

  function navigateTo(next: PresentationSection) {
    const nextIndex = Math.max(0, sections.indexOf(next));
    setDirection(nextIndex < sectionIndex ? "backward" : "forward");
    setSection(next);
  }

  useEffect(() => {
    if (!sections.includes(section)) {
      setDirection("backward");
      setSection(sections[0]);
    }
  }, [section, sections]);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-presentation-interactive="true"]')) return;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "ArrowRight") {
        setDirection("forward");
        setSection(sections[Math.min(sections.length - 1, sectionIndex + 1)]);
      }
      if (event.key === "ArrowLeft") {
        setDirection("backward");
        setSection(sections[Math.max(0, sectionIndex - 1)]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, sectionIndex, sections]);

  return <div className="presentation-overlay" role="dialog" aria-modal="true" aria-label="Client presentation"><div className="presentation-shell"><header className="presentation-topbar"><div className="presentation-brand"><img src="/advantage-mark.png" alt="" /><img className="presentation-wordmark" src="/advantage-wordmark-no-a.png" alt="Advantage Technologies" /></div><nav className="presentation-progress-nav" data-section-count={sections.length} style={{ "--presentation-progress": `${sections.length > 1 ? (sectionIndex / (sections.length - 1)) * 100 : 100}%` } as CSSProperties}>{sections.map((item, index) => <button key={item} type="button" className={section === item ? "active" : index < sectionIndex ? "complete" : "upcoming"} onClick={() => navigateTo(item)}>{sectionLabel(item)}</button>)}</nav><div className="presentation-topbar-actions"><button className="presentation-pdf" type="button" disabled={pdfBusy} onClick={onDownloadPdf} title="Download the same finished client PDF available from the report generator">{pdfBusy ? "Preparing PDF…" : "Download PDF"}</button><button className="presentation-close" type="button" onClick={onClose}>Close</button></div></header><main className={`presentation-stage presentation-stage-${section}`} aria-live="polite"><div key={section} className={`presentation-slide-motion motion-${direction}`}>
    {section === "overview" && (project.type === "client-report" && clientReportAvailable(project) ? <ClientReportOverview project={project} /> : project.type !== "client-report" ? <ProposalOverviewPresentation project={project} /> : <StandardOverview project={project} />)}
    {section === "advantage" && <AdvantageStoryPresentation project={project} />}
    {section === "security" && (project.type === "client-report" ? <SecurityPresentation project={project} /> : <ProposalSecurityAssessmentPresentation project={project} />)}
    {section === "lifecycle" && <LifecyclePresentation project={project} />}
    {section === "details" && <DeviceDetailPresentation project={project} />}
    {section === "locations" && <LocationPresentation project={project} />}
    {section === "hipaa" && <HipaaReviewAndResultsPresentation project={project} onUpdate={onUpdate} />}
    {section === "findings" && (project.type !== "client-report" ? <ProposalFindingsPresentation project={project} /> : <div className="presentation-section-layout"><div className="presentation-section-heading"><span className="presentation-kicker">The review</span><h2>What we found</h2><p>Clear priorities, without the technical noise.</p></div><div className="presentation-findings">{project.findings.map((item) => <article className={`presentation-finding ${item.severity}`} key={item.id}><div><span>{categoryLabel(item.category)}</span><em>{item.severity}</em></div><h3>{item.title}</h3><p>{item.clientSummary}</p></article>)}</div></div>)}
    {section === "plan" && <PlanPresentation project={project} onUpdate={onUpdate} />}
    {section === "investment" && <ProposalInvestmentPresentation project={project} />}
    {section === "authorization" && <ProposalAuthorizationPresentation project={project} onUpdate={onUpdate} />}
    {section === "recap" && <RecapPresentation project={project} onUpdate={onUpdate} />}
  </div></main><footer className="presentation-footer"><span>{sectionIndex + 1} / {sections.length}</span><div><button type="button" disabled={sectionIndex === 0} onClick={() => navigateTo(sections[Math.max(0, sectionIndex - 1)])}>Previous</button><button className="next" type="button" disabled={sectionIndex === sections.length - 1} onClick={() => navigateTo(sections[Math.min(sections.length - 1, sectionIndex + 1)])}>Next <ArrowIcon /></button></div></footer></div></div>;
}

function ClientReportPreview({ project, editing, updatePresentation }: { project: Project; editing: boolean; updatePresentation: (field: "title" | "executiveSummary", value: string) => void }) {
  const lifecycle = lifecycleSummary(project);
  const planActions = clientReportPlanActions(project);
  const agreedPlan = hasAgreedReviewPlan(project.reviewOutcome);
  const events = factNumber(project, "huntress.eventsAnalyzed");
  const incidents = factNumber(project, "huntress.incidentsReported");
  const canaries = factNumber(project, "huntress.canaryFiles");
  const malware = factNumber(project, "huntress.malwareFilesBlocked");
  const hipaa = scoreHipaaAssessment(project.hipaa);
  return <div className="outcome-preview client-report-preview"><div className="outcome-preview-hero"><span>{project.hipaa.enabled ? "Technology, security & compliance review" : "Technology & security review"} · {project.client.name}</span>{editing ? <input value={project.presentation.title} onChange={(event: ChangeEvent<HTMLInputElement>) => updatePresentation("title", event.target.value)} aria-label="Presentation title" /> : <h3>{project.presentation.title}</h3>}{editing ? <textarea rows={5} value={project.presentation.executiveSummary} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updatePresentation("executiveSummary", event.target.value)} aria-label="Executive summary" /> : <p>{project.presentation.executiveSummary}</p>}</div><div className="client-report-preview-stats"><article className="current"><strong><AnimatedNumber value={lifecycle.current} delay={630} /></strong><span>Healthy now</span></article><article className="overdue"><strong>{lifecycle.overdue + lifecycle.dueSoon}</strong><span>Health priorities</span></article><article><strong><AnimatedNumber value={lifecycle.inventoryTotal} delay={280} /></strong><span>Managed assets</span></article>{project.hipaa.enabled && <article className={hipaa.notYetAssessedCount ? "due-soon" : "current"}><strong><AnimatedNumber value={hipaa.overall} delay={520} suffix="%" /></strong><span>HIPAA readiness</span></article>}</div><div className="client-report-preview-security"><span className="section-kicker">Security protection</span><div><strong>{formatMetric(events)}</strong><small>events analyzed</small></div><div><strong>{canaries}</strong><small>ransomware canaries</small></div><div><strong>{malware}</strong><small>malware files blocked</small></div><div><strong>{incidents}</strong><small>incidents reported</small></div></div><div className="outcome-preview-plan"><span className="section-kicker">{agreedPlan ? "Agreed plan" : "Recommended plan"}</span>{planActions.slice(0, 4).map((item) => <div key={item.id}><CheckIcon /><span><strong>{item.title}</strong><small>{item.detail}</small></span></div>)}</div></div>;
}

export function OutcomeExperience({
  project,
  onUpdate,
  onOpenSources,
  onReprocessSources,
  reprocessingSources,
  canReprocessSources,
  onSetPlanningMode,
}: {
  project: Project;
  onUpdate: (project: Project) => void;
  onOpenSources: () => void;
  onReprocessSources: () => void;
  reprocessingSources: boolean;
  canReprocessSources: boolean;
  onSetPlanningMode: (mode: "onsite-review" | "remote-consultation") => void;
}) {
  const [presenting, setPresenting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [preMeetingPdfBusy, setPreMeetingPdfBusy] = useState(false);
  const [emailDrafted, setEmailDrafted] = useState(false);
  const [tailorOpen, setTailorOpen] = useState(false);
  const topFindings = useMemo(() => project.findings.slice(0, 4), [project.findings]);
  const richClientReport = project.type === "client-report" && clientReportAvailable(project);
  const proposalProject = project.type !== "client-report";
  const proposalLifecycle = lifecycleSummary(project);
  const proposalOs = osSupportSummary(project);
  const proposalStorage = storageAttentionSummary(project);
  const proposalAssessment = proposalProject && technologyAssessmentAvailable(project);
  const outstandingHipaa = outstandingHipaaQuestionCount(project);
  const preMeetingHipaa = preMeetingHipaaQuestionCount(project);
  const planningMode = project.planningRecommendationMode ?? "onsite-review";
  const reportReconciliation = richClientReport ? inventoryReconciliation(project) : null;

  function updatePresentation(field: "title" | "executiveSummary", value: string) {
    onUpdate({ ...project, presentation: { ...project.presentation, [field]: value }, updatedAt: new Date().toISOString() });
  }

  async function downloadFinishedPdf() {
    if (reportReconciliation && !reportReconciliation.passed) return;
    setPdfBusy(true);
    try { await downloadOutcomePdf(project); } finally { setPdfBusy(false); }
  }

  async function downloadPreMeeting() {
    setPreMeetingPdfBusy(true);
    try { await downloadPreMeetingOverviewPdf(project); } finally { setPreMeetingPdfBusy(false); }
  }

  function draftPreMeetingEmail() {
    openPreMeetingEmailDraft(project);
    setEmailDrafted(true);
    window.setTimeout(() => setEmailDrafted(false), 3500);
  }

  async function saveTailoredReport(value: { outcome: Project["reviewOutcome"]; presentation?: { title: string; executiveSummary: string } }) {
    onUpdate({
      ...project,
      reviewOutcome: value.outcome,
      presentation: value.presentation ? { ...project.presentation, ...value.presentation } : project.presentation,
      updatedAt: new Date().toISOString(),
    });
    const compassClientId = project.intelligence.facts.find((fact) => fact.key === "compass.clientId")?.value;
    if (typeof compassClientId === "string" && compassClientId) {
      try {
        const dataset = await loadCompassDataset();
        if (dataset?.clients.some((client) => client.id === compassClientId)) {
          await saveCompassDataset({ ...dataset, clients: dataset.clients.map((client) => client.id === compassClientId ? { ...client, reviewOutcome: value.outcome } : client) });
        }
      } catch {
        // The report workspace remains saved even when the current Compass snapshot is unavailable.
      }
    }
    setTailorOpen(false);
  }

  return <>
    {proposalProject && <ProposalPricingEditor project={project} onUpdate={onUpdate} />}
    <section className="generator-command-center outcome-command-center" aria-label="Generator controls">
      <div className="generator-command-group">
        <span>1 · Data</span>
        <div>
          <button className="button secondary compact" type="button" onClick={onOpenSources}>Sources & attachments</button>
          <button className="button secondary compact" type="button" disabled={!canReprocessSources || reprocessingSources} onClick={onReprocessSources}><SparkIcon />{reprocessingSources ? "Refreshing…" : "Refresh source data"}</button>
          {richClientReport && <button className="button secondary compact" type="button" onClick={() => downloadInventoryDiagnostics(project)}>Inventory diagnostics</button>}
        </div>
      </div>
      <div className="generator-command-group planning-mode-group">
        <span>2 · Planned next step</span>
        <div className="planning-mode-toggle" role="group" aria-label="Recommended planning format">
          <button type="button" className={planningMode === "onsite-review" ? "active" : ""} aria-pressed={planningMode === "onsite-review"} onClick={() => onSetPlanningMode("onsite-review")}>Onsite review</button>
          <button type="button" className={planningMode === "remote-consultation" ? "active" : ""} aria-pressed={planningMode === "remote-consultation"} onClick={() => onSetPlanningMode("remote-consultation")}>Remote consultation</button>
        </div>
      </div>
      <div className="generator-command-group generator-output-group">
        <span>3 · Review & deliver</span>
        <div>
          {richClientReport && <button className="button secondary compact" type="button" onClick={() => setTailorOpen(true)}>Tailor report</button>}
          {!richClientReport && <button className="button secondary compact" type="button" onClick={() => setEditing((value) => !value)}>{editing ? "Done editing" : "Edit summary"}</button>}
          <button className="button secondary compact" type="button" disabled={preMeetingPdfBusy} onClick={downloadPreMeeting}>{preMeetingPdfBusy ? "Preparing…" : preMeetingHipaa ? "Download pre-meeting packet" : "Download pre-meeting overview"}</button>
          <button className="button secondary compact" type="button" onClick={draftPreMeetingEmail}>Draft pre-meeting email</button>
          <button className="button secondary compact" type="button" onClick={() => setPresenting(true)}>Present package</button>
          <button className="button primary compact" type="button" disabled={pdfBusy || Boolean(reportReconciliation && !reportReconciliation.passed)} title={reportReconciliation && !reportReconciliation.passed ? "Resolve the authoritative inventory mismatch before downloading." : ""} onClick={downloadFinishedPdf}>{pdfBusy ? "Preparing PDF…" : reportReconciliation && !reportReconciliation.passed ? "Inventory review required" : "Download PDF"} <ArrowIcon /></button>
        </div>
        <small className="generator-command-guidance">{project.hipaa.enabled ? "The pre-meeting packet includes only unanswered client-facing questions. Scores, findings, pricing, and recommendations are not included." : "HIPAA questions are not mentioned when the HIPAA review is turned off."}</small>
        {reportReconciliation?.authoritative && <small className="generator-command-status"><CheckIcon /> Ninja / Client Compass is authoritative for device identity and report scope.</small>}
        {richClientReport && hasAgreedReviewPlan(project.reviewOutcome) && <small className="generator-command-status"><CheckIcon /> The planning and recap sections use the recorded client conversation.</small>}
        {reportReconciliation && !reportReconciliation.passed && <small className="generator-command-status is-warning">Download diagnostics and refresh source data before sharing.</small>}
        {emailDrafted && <small className="generator-command-status"><CheckIcon /> Email draft opened—attach the {preMeetingHipaa ? "pre-meeting packet" : "overview PDF"}.</small>}
      </div>
    </section>

    <section className="workspace-card outcome-card" id="client-experience">
      <div className="outcome-card-header">
        <div><span className="section-kicker"><SparkIcon /> Finished package</span><h2>{richClientReport ? (project.hipaa.enabled ? "The technology, security, and HIPAA readiness story is assembled." : "The technology and security story is assembled.") : "The package is assembled and ready to present."}</h2><p>{richClientReport ? "Use the consolidated controls above to edit, present, prepare the meeting, or download the finished report." : "Use the consolidated controls above to review, present, and deliver the finished proposal."}</p></div>
      </div>
      {project.hipaa.enabled && <div className={`pdf-handoff-status ${outstandingHipaa ? "open" : "complete"}`}><CheckIcon /><span><strong>{outstandingHipaa ? `${outstandingHipaa} HIPAA question${outstandingHipaa === 1 ? "" : "s"} will be included for the client to complete.` : "The HIPAA review is complete."}</strong><small>{outstandingHipaa ? "The finished PDF includes fillable questions, return instructions, and the current score language. Review the returned answers here before generating the revised report." : "No HIPAA follow-up pages will be added to the client PDF."}</small></span></div>}
      {richClientReport ? <ClientReportPreview project={project} editing={editing} updatePresentation={updatePresentation} /> : <div className="outcome-preview"><div className="outcome-preview-hero"><span>{proposalProject ? `Prepared for ${project.client.name}` : `${presentationType(project)} · ${project.client.name}`}</span>{proposalProject ? <h3>Advantage 360</h3> : editing ? <input value={project.presentation.title} onChange={(event: ChangeEvent<HTMLInputElement>) => updatePresentation("title", event.target.value)} aria-label="Presentation title" /> : <h3>{project.presentation.title}</h3>}{proposalProject ? <p>{project.presentation.executiveSummary || `We reviewed the technology supporting your ${organizationTerm(project)} using the RFT as the primary technical assessment.`}</p> : editing ? <textarea rows={5} value={project.presentation.executiveSummary} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updatePresentation("executiveSummary", event.target.value)} aria-label="Executive summary" /> : <p>{project.presentation.executiveSummary}</p>}</div><div className="outcome-preview-metrics">{proposalAssessment ? <><div><strong>{proposalLifecycle.total}</strong><span>Assets reviewed</span></div><div className="priority"><strong>{proposalLifecycle.overdue + proposalLifecycle.dueSoon}</strong><span>Lifecycle priorities</span></div><div className="attention"><strong>{proposalOs.attention + proposalStorage.attention}</strong><span>OS & storage concerns</span></div></> : <><div className="priority"><strong>{severityCount(project.findings, "priority")}</strong><span>{proposalProject ? "Needs attention now" : "priority"}</span></div><div className="attention"><strong>{severityCount(project.findings, "attention")}</strong><span>{proposalProject ? "Plan for" : "attention"}</span></div><div className="healthy"><strong>{severityCount(project.findings, "healthy")}</strong><span>{proposalProject ? "In good shape" : "healthy"}</span></div></>}</div><div className="outcome-preview-findings">{topFindings.map((item) => <article className={item.severity} key={item.id}><span>{categoryLabel(item.category)}</span><h4>{item.title}</h4><p>{item.clientSummary}</p></article>)}</div><div className="outcome-preview-plan"><span className="section-kicker">Recommended plan</span>{project.recommendations.slice(0, 4).map((item) => <div key={item.id}><CheckIcon /><span><strong>{item.title}</strong><small>{item.clientValue}</small></span></div>)}</div>{proposalProject && <ProposalInvestmentPreview project={project} />}</div>}
    </section>
    {tailorOpen && <ReviewOutcomeEditor outcome={project.reviewOutcome} presentation={{ title: project.presentation.title, executiveSummary: project.presentation.executiveSummary }} heading="Tailor the client report" description="The technical findings stay factual. Adjust the client-facing summary and agreed roadmap to match the conversation." onClose={() => setTailorOpen(false)} onSave={saveTailoredReport} />}
    {presenting && <ClientPresentation project={project} onUpdate={onUpdate} onClose={() => setPresenting(false)} onDownloadPdf={downloadFinishedPdf} pdfBusy={pdfBusy} />}
  </>;
}

