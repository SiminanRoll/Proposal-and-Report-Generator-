"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import type { Finding, Project } from "@/lib/projects/types";
import { categoryLabel } from "@/lib/outcomes/builder";
import { clientFacingDocumentTitle, downloadOutcomeHtml, downloadOutcomePdf } from "@/lib/outcomes/export-html";
import {
  clientReportAvailable,
  clientDeviceDisplayName,
  deviceTypeLabel,
  factNumber,
  formatMetric,
  physicalAssetCounts,
  reportableLifecycleDevices,
  isServerClassDevice,
  lifecycleStatusLabel,
  lifecycleSummary,
  reportReferenceDate,
  sortLifecycleDevices,
  warrantyStatus,
  warrantyStatusLabel,
} from "@/lib/outcomes/client-report-data";
import { scoreHipaaAssessment } from "@/lib/hipaa/engine";
import { clientReportScores, scoreLabel, scoreTone } from "@/lib/outcomes/client-report-score";
import { clientReportPlanActions, technologyPlanningApproach } from "@/lib/outcomes/client-report-plan";
import { networkPresentationMessage, planningStatus, securityPresentationMessage, securityProtectionStatement } from "@/lib/outcomes/client-report-messaging";
import { ArrowIcon, CheckIcon, SparkIcon } from "./icons";
import { HipaaReviewPresentation, HipaaResultsPresentation } from "./hipaa-presentation";
import { AnimatedNumber } from "./animated-number";
import {
  AdvantageStoryPresentation,
  ProposalAuthorizationPresentation,
  ProposalFindingsPresentation,
  ProposalInvestmentPresentation,
  ProposalInvestmentPreview,
  ProposalOverviewPresentation,
  ProposalPlanPresentation,
  ProposalPricingEditor,
} from "./proposal-experience";

const STANDARD_SECTIONS = ["overview", "findings", "plan", "recap"] as const;
const CLIENT_REPORT_SECTIONS = ["overview", "security", "lifecycle", "details", "plan", "recap"] as const;
type PresentationSection = (typeof CLIENT_REPORT_SECTIONS)[number] | (typeof STANDARD_SECTIONS)[number] | "advantage" | "investment" | "authorization" | "hipaa-review" | "hipaa-results";

function sectionsFor(project: Project): PresentationSection[] {
  if (project.type === "client-report" && clientReportAvailable(project)) {
    const beginning: PresentationSection[] = ["overview", "security", "lifecycle", "details"];
    const hipaa: PresentationSection[] = project.hipaa.enabled ? ["hipaa-review", "hipaa-results"] : [];
    return [...beginning, ...hipaa, "plan", "recap"];
  }
  if (project.type === "prospect-proposal") {
    const beginning: PresentationSection[] = ["overview", "advantage", "findings"];
    const hipaa: PresentationSection[] = project.hipaa.enabled ? ["hipaa-review", "hipaa-results"] : [];
    return [...beginning, ...hipaa, "plan", "investment", "authorization"];
  }
  const base: PresentationSection[] = [...STANDARD_SECTIONS];
  if (!project.hipaa.enabled) return base;
  const planIndex = base.indexOf("plan");
  return [...base.slice(0, planIndex), "hipaa-review", "hipaa-results", ...base.slice(planIndex)];
}

function sectionLabel(value: PresentationSection): string {
  if (value === "overview") return "Introduction";
  if (value === "lifecycle") return "Network health";
  if (value === "security") return "Security";
  if (value === "details") return "Hardware inventory";
  if (value === "advantage") return "Why Advantage";
  if (value === "investment") return "Investment";
  if (value === "authorization") return "Authorize";
  if (value === "hipaa-review") return "HIPAA review";
  if (value === "hipaa-results") return "HIPAA readiness";
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

function LifecycleStatus({ value }: { value: "current" | "due-soon" | "overdue" | "unknown" }) {
  return <span className={`device-status device-status-${value}`}>{lifecycleStatusLabel(value)}</span>;
}

function WarrantyStatusBadge({ device, project }: { device: ReturnType<typeof reportableLifecycleDevices>[number]; project: Project }) {
  const status = warrantyStatus(device, reportReferenceDate(project));
  return <span className={`warranty-status warranty-status-${status}`}><b>{warrantyStatusLabel(status)}</b><small>{device.warrantyExpires || "Date not listed"}</small></span>;
}

function HealthScoreCard({ score, label, detail, className = "", delay = 260 }: { score: number | null; label: string; detail: string; className?: string; delay?: number }) {
  const value = score ?? 0;
  return <article className={`health-score-card ${score === null ? "unavailable" : scoreTone(value)} ${className}`}><div><strong>{score === null ? "—" : <AnimatedNumber value={value} delay={delay} />}</strong>{score !== null && <em>/100</em>}</div><span>{label}</span><small>{detail}</small></article>;
}


function PlanningStatusCard({ label, detail, tone }: { label: string; detail: string; tone: "healthy" | "attention" | "priority" }) {
  return <article className={`planning-status-card ${tone}`}><span>Planning status</span><strong>{label}</strong><small>{detail}</small></article>;
}

function ClientReportOverview({ project }: { project: Project }) {
  const lifecycle = lifecycleSummary(project);
  const hipaa = scoreHipaaAssessment(project.hipaa);
  const scores = clientReportScores(project);
  const incidents = factNumber(project, "huntress.incidentsReported");
  const status = planningStatus(project);
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
          <HealthScoreCard score={scores.security} label="Security protection" detail="Monitoring, response, and reported incidents" className="security" delay={280} />
          <HealthScoreCard score={scores.network} label="Network & lifecycle" detail={`${lifecycle.current} healthy · ${healthPriorities} health priorities · critical systems weighted`} className="network" delay={360} />
          {project.hipaa.enabled && <HealthScoreCard score={scores.hipaa} label="HIPAA readiness" detail={`${hipaa.completionPercentage}% assessed · ${hipaa.notYetAssessedCount} unanswered`} className="compliance" delay={440} />}
          <PlanningStatusCard label={status.label} detail={status.detail} tone={status.tone} />
        </div>
      </div>
      <div className="health-evidence-strip four-up">
        <span><strong><AnimatedNumber value={lifecycle.total} delay={410} /></strong> assets reviewed</span>
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
  return (
    <div className={`presentation-section-layout message-${message.tone}`}>
      <div className="presentation-section-heading"><span className="presentation-kicker">Security protection</span><h2>{message.title}</h2><p>{message.subtitle}</p></div>
      <div className="security-funnel-visual" aria-label={`${events} events became ${signals} signals and ${incidents} incidents`}>
        <div className="security-funnel-step events"><strong><AnimatedNumber value={events} delay={210} duration={1100} format={(current) => formatMetric(Math.round(current))} /></strong><span>Events analyzed</span><small>Across <AnimatedNumber value={entities} delay={360} /> protected entities</small></div>
        <div className="security-funnel-arrow">→</div>
        <div className="security-funnel-step signals"><strong><AnimatedNumber value={signals} delay={430} /></strong><span>Signals detected</span><small><AnimatedNumber value={investigated} delay={560} /> required investigation</small></div>
        <div className="security-funnel-arrow">→</div>
        <div className={`security-funnel-step incidents ${incidents ? "risk" : "healthy"}`}><strong><AnimatedNumber value={incidents} delay={650} /></strong><span>Incidents reported</span><small>{incidents ? "Follow-up required" : "No targeted attacks reported"}</small></div>
      </div>
      <div className="security-feature-grid">
        <article><div className="security-feature-icon">R</div><div><span>Ransomware early warning</span><h3><AnimatedNumber value={canaries} delay={520} /> canary files across <AnimatedNumber value={endpoints || entities} delay={610} /> endpoints</h3><p>Hidden early-warning files are monitored for changes associated with ransomware, helping isolate activity before it spreads.</p></div></article>
        <article><div className="security-feature-icon">AV</div><div><span>Managed antivirus</span><h3><AnimatedNumber value={malware} delay={590} /> malware file{malware === 1 ? "" : "s"} automatically blocked</h3><p><AnimatedNumber value={antivirusEvents} delay={680} /> antivirus event{antivirusEvents === 1 ? " was" : "s were"} processed, with protection acting before a blocked file could execute.</p></div></article>
      </div>
      <div className="security-activity-strip"><span><strong><AnimatedNumber value={autorunEvents} delay={700} format={(current) => formatMetric(Math.round(current))} /></strong><small>Autorun events</small><em><AnimatedNumber value={autorunSignals} delay={780} /> signals</em></span><span><strong><AnimatedNumber value={processEvents} delay={760} format={(current) => formatMetric(Math.round(current))} /></strong><small>Process events</small><em><AnimatedNumber value={processSignals} delay={840} /> signals</em></span><p>Additional monitoring looks for persistence and suspicious processes that may appear before a larger incident.</p></div>
      <aside className="security-protection-statement"><span>Keeping your protection complete</span><p>{securityProtectionStatement(project)}</p></aside>
    </div>
  );
}

function LifecyclePresentation({ project }: { project: Project }) {
  const lifecycle = lifecycleSummary(project);
  const devices = sortLifecycleDevices(reportableLifecycleDevices(project));
  const replacements = devices.filter((device) => device.lifecycleStatus === "overdue");
  const nextDevices = devices.filter((device) => device.lifecycleStatus === "due-soon").slice(0, 4);
  const { workstations, servers, backupServers } = physicalAssetCounts(project);
  const vms = factNumber(project, "scalepad.vms");
  const network = factNumber(project, "scalepad.networkDevices");
  const message = networkPresentationMessage(project);
  const segment = (count: number) => lifecycle.total ? `${Math.max(0, (count / lifecycle.total) * 100)}%` : "0%";
  return (
    <div className={`presentation-section-layout message-${message.tone}`}>
      <div className="presentation-section-heading network-health-heading"><span className="presentation-kicker">Network health & lifecycle</span><h2>{message.title}</h2><p>{message.subtitle}</p></div>
      <div className="network-health-overview">
        <div className="lifecycle-health-score"><strong><AnimatedNumber value={lifecycle.healthyPercentage} delay={180} suffix="%" /></strong><span>currently healthy</span><small><AnimatedNumber value={lifecycle.current} delay={300} /> of <AnimatedNumber value={lifecycle.total} delay={360} /> reportable assets are within the planned lifecycle</small></div>
        <div className="lifecycle-story">
          <div className="lifecycle-segmented-bar"><span className="current" style={{ width: segment(lifecycle.current) }} /><span className="due-soon" style={{ width: segment(lifecycle.dueSoon) }} /><span className="overdue" style={{ width: segment(lifecycle.overdue) }} /></div>
          <div className="lifecycle-legend three-up"><span className="current"><b><AnimatedNumber value={lifecycle.current} delay={430} /></b> Healthy now</span><span className="due-soon"><b><AnimatedNumber value={lifecycle.dueSoon} delay={500} /></b> Plan soon</span><span className="overdue"><b><AnimatedNumber value={lifecycle.overdue} delay={570} /></b> Health priorities</span></div>
        </div>
      </div>
      <div className="environment-count-strip server-first"><span className="server-count"><strong><AnimatedNumber value={servers} delay={520} /></strong>Primary server{servers === 1 ? "" : "s"}</span>{backupServers > 0 && <span className="backup-server-count"><strong><AnimatedNumber value={backupServers} delay={560} /></strong>Cloud Plus backup server{backupServers === 1 ? "" : "s"}</span>}<span><strong><AnimatedNumber value={workstations} delay={600} /></strong>Workstations</span>{vms > 0 && <span><strong><AnimatedNumber value={vms} delay={650} /></strong>Virtual machines</span>}{network > 0 && <span><strong><AnimatedNumber value={network} delay={700} /></strong>Network devices</span>}</div>
      {replacements.length > 0 && <section className="replacement-overview"><div><span className="presentation-kicker">Health priority details</span><h3>{replacements.length} system{replacements.length === 1 ? "" : "s"} need replacement planning</h3><p>The primary server and Cloud Plus backup server are shown first. When several items need replacement, Advantage should review the applications and equipment involved and prepare one complete plan.</p></div><div className="replacement-device-grid">{replacements.map((device, index) => <article className={device.type === "server" ? "priority-server" : device.type === "backup-server" ? "priority-backup-server" : ""} key={`${device.type}-${device.name}`}><b>{String(index + 1).padStart(2, "0")}</b><div><span>{device.type === "server" ? "Primary server" : device.type === "backup-server" ? "Cloud Plus backup server" : deviceTypeLabel(device.type)}</span><h4>{clientDeviceDisplayName(device)}</h4><p>{device.make} {device.model}</p><small>{device.age ? `${device.age} years old` : "Age not listed"}{device.warrantyExpires ? ` · Warranty ${device.warrantyExpires}` : ""}</small></div><LifecycleStatus value={device.lifecycleStatus} /></article>)}</div></section>}
      {nextDevices.length > 0 && <div className="next-device-strip"><span>Next in the lifecycle</span><div>{nextDevices.map((device) => <article key={`${device.type}-${device.name}`}><div><h3>{clientDeviceDisplayName(device)}</h3><LifecycleStatus value={device.lifecycleStatus} /></div><small>{device.age ? `${device.age} years old` : device.type}</small></article>)}</div></div>}
    </div>
  );
}

function DeviceDetailPresentation({ project }: { project: Project }) {
  const devices = sortLifecycleDevices(reportableLifecycleDevices(project));
  const lifecycle = lifecycleSummary(project);
  const hasServer = devices.some(isServerClassDevice);
  return (
    <div className="presentation-section-layout">
      <div className="presentation-section-heading"><span className="presentation-kicker">Hardware inventory</span><h2>The devices behind the health score.</h2><p>{hasServer ? "The primary server and Cloud Plus backup server are listed first because they support daily operations and recovery. " : ""}Every named system remains visible with lifecycle and warranty status tied to the specific equipment.</p></div>
      <div className="hardware-summary-ribbon"><span><strong>{lifecycle.total}</strong>Total assets</span><span className="healthy"><strong>{lifecycle.current}</strong>Healthy now</span><span className="attention"><strong>{lifecycle.dueSoon}</strong>Plan soon</span><span className="risk"><strong>{lifecycle.overdue}</strong>Replace now</span></div>
      {devices.length ? <div className="presentation-device-table-wrap"><table className="presentation-device-table"><thead><tr><th>Device</th><th>Type</th><th>Model</th><th>Operating system</th><th>Age</th><th>Warranty status</th><th>Last check-in</th><th>Lifecycle</th></tr></thead><tbody>{devices.map((device, index) => <tr className={`device-row-${device.lifecycleStatus} device-row-type-${device.type}`} style={{ "--row-delay": `${Math.min(index, 18) * 38}ms` } as CSSProperties} key={`${device.type}-${device.name}-${device.serial}`}><td><strong>{clientDeviceDisplayName(device)}</strong><small>{device.user || device.serial}</small></td><td><span className={`device-type-badge ${device.type}`}>{deviceTypeLabel(device.type)}</span></td><td>{device.make} {device.model}</td><td>{device.os || "—"}</td><td>{device.age || "—"}</td><td><WarrantyStatusBadge device={device} project={project} /></td><td>{device.lastCheckIn || "—"}</td><td><LifecycleStatus value={device.lifecycleStatus} /></td></tr>)}</tbody></table></div> : <div className="hardware-empty-state"><strong>The lifecycle summary was read, but the detailed device rows could not be structured.</strong><p>Replace the ScalePad PDF with a text-searchable export to populate the named inventory. The summary counts remain available for the review.</p></div>}
    </div>
  );
}

function PlanPresentation({ project }: { project: Project }) {
  if (project.type === "prospect-proposal") return <ProposalPlanPresentation project={project} />;
  if (project.type !== "client-report") {
    return <div className="presentation-section-layout"><div className="presentation-section-heading"><span className="presentation-kicker">Planning</span><h2>Turn the review into a practical roadmap.</h2><p>A focused plan connected directly to the security, network-health, and readiness findings.</p></div><div className="presentation-plan">{project.recommendations.map((item, index) => <article key={item.id}><b>{String(index + 1).padStart(2, "0")}</b><div><h3>{item.title}</h3><p>{item.clientValue}</p></div></article>)}</div>{(project.pricing.monthly > 0 || project.pricing.oneTime > 0) && <div className="presentation-investment"><span><small>Monthly investment</small><strong>${project.pricing.monthly.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></span><span><small>One-time investment</small><strong>${project.pricing.oneTime.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></span></div>}</div>;
  }
  const actions = clientReportPlanActions(project);
  const lifecycle = lifecycleSummary(project);
  const hipaa = scoreHipaaAssessment(project.hipaa);
  const incidents = factNumber(project, "huntress.incidentsReported");
  const investigated = factNumber(project, "huntress.signalsInvestigated");
  const malware = factNumber(project, "huntress.malwareFilesBlocked");
  const healthPriorities = lifecycle.overdue + lifecycle.dueSoon;
  const approach = technologyPlanningApproach(project);
  const securityFollowUps = incidents + investigated + malware;
  const hipaaFollowUps = project.hipaa.enabled ? hipaa.notYetAssessedCount + hipaa.counts.no + hipaa.counts.partially : 0;
  const hasActionItems = healthPriorities > 0 || securityFollowUps > 0 || hipaaFollowUps > 0;
  const hasHardwareActions = healthPriorities > 0;
  const headline = hasHardwareActions ? approach.title : hasActionItems ? "What should happen next" : approach.title;
  const intro = hasHardwareActions
    ? approach.intro
    : hasActionItems
      ? "A guided planning session with Advantage's Technology Consultant team will turn the findings into clear decisions and next steps."
      : approach.intro;
  return <div className={`presentation-section-layout client-action-plan ${hasActionItems ? "action-mode" : "healthy-mode"}`}>
    <div className="planning-hero-grid">
      <div className="presentation-section-heading"><span className="presentation-kicker">Planning</span><h2>{headline}</h2><p>{intro}</p></div>
      <section className="planning-consultation-banner">
        <div><span className="presentation-kicker">{hasActionItems ? "Recommended next step" : "Current recommendation"}</span><h3>{hasHardwareActions ? approach.consultationTitle : hasActionItems ? "Meet with your Technology Consultant" : approach.consultationTitle}</h3><p>{hasHardwareActions ? approach.consultationCopy : hasActionItems ? "Your consultant will review the open findings, answer questions, and confirm the appropriate next steps." : approach.consultationCopy}</p></div>
        <div className="planning-session-outcomes">{(hasHardwareActions ? approach.sessionOutcomes : hasActionItems ? ["Review findings", "Confirm owners", "Agree on actions", "Set follow-up"] : approach.sessionOutcomes).map((item) => <span key={item}>{item}</span>)}</div>
      </section>
    </div>
    <div className={`planning-context-strip ${project.hipaa.enabled ? "with-hipaa" : ""}`}>
      <span className="healthy"><strong><AnimatedNumber value={lifecycle.current} delay={440} /></strong><b>Healthy assets</b></span>
      <span className={healthPriorities ? "attention" : "healthy"}><strong><AnimatedNumber value={healthPriorities} delay={510} /></strong><b>Health priorities</b></span>
      {project.hipaa.enabled && <span className={hipaaFollowUps ? "attention" : "healthy"}><div className="planning-context-value"><strong><AnimatedNumber value={hipaa.overall} delay={580} /></strong><em>/100</em></div><b>HIPAA readiness</b></span>}
      <span className={securityFollowUps ? "attention" : "healthy"}><strong><AnimatedNumber value={securityFollowUps} delay={650} /></strong><b>Security follow-ups</b></span>
    </div>
    <div className="presentation-plan action-plan-grid">{actions.map((item, index) => <article className={`plan-action-${item.tone}`} key={item.id}><b>{String(index + 1).padStart(2, "0")}</b><div><div className="plan-action-meta"><span>{item.timing}</span><span>{item.owner}</span></div><h3>{item.title}</h3><p>{item.detail}</p></div></article>)}</div>
  </div>;
}

function RecapPresentation({ project }: { project: Project }) {
  const lifecycle = lifecycleSummary(project);
  const incidents = factNumber(project, "huntress.incidentsReported");
  const investigated = factNumber(project, "huntress.signalsInvestigated");
  const malware = factNumber(project, "huntress.malwareFilesBlocked");
  const hipaa = scoreHipaaAssessment(project.hipaa);
  const incomplete = project.hipaa.enabled && hipaa.notYetAssessedCount > 0;
  const healthPriorities = lifecycle.overdue + lifecycle.dueSoon;
  const approach = technologyPlanningApproach(project);
  const securityFollowUps = incidents + investigated + malware;
  const hipaaFollowUps = project.hipaa.enabled ? hipaa.notYetAssessedCount + hipaa.counts.no + hipaa.counts.partially : 0;
  const hasActionItems = healthPriorities > 0 || securityFollowUps > 0 || hipaaFollowUps > 0;
  return <div className={`presentation-recap ${hasActionItems ? "action-mode" : "healthy-mode"}`}>
    <div className="recap-heading-row">
      <div><span className="presentation-kicker">Final recap</span><h2>Today&apos;s takeaways</h2><p>{healthPriorities ? approach.intro : hasActionItems ? "Most of the environment is healthy. The items that need attention are documented, and the next conversation can focus on practical decisions." : "The environment reviewed is in a healthy position, with no immediate replacement or corrective action recommended from this report."}</p></div>
      <aside className={`recap-next-step ${hasActionItems ? "" : "healthy"}`}><span className="presentation-kicker">{hasActionItems ? "Recommended next step" : "Looking ahead"}</span><h3>{healthPriorities ? approach.consultationTitle : hasActionItems ? "Schedule a Technology Consultant session" : "Continue the current review cadence"}</h3><p>{healthPriorities ? approach.consultationCopy : hasActionItems ? "Review the findings together, confirm the open priorities, and agree on practical next steps." : "Keep current monitoring in place and revisit technology health at the next scheduled review."}</p></aside>
    </div>
    <div className="recap-score-grid"><article><strong><AnimatedNumber value={lifecycle.total} delay={280} /></strong><span>Assets reviewed</span><small>Included in the client-facing health review</small></article><article className="healthy"><strong><AnimatedNumber value={lifecycle.current} delay={350} /></strong><span>Healthy assets</span><small>Systems that can remain in service</small></article><article className={healthPriorities ? "attention" : "healthy"}><strong><AnimatedNumber value={healthPriorities} delay={420} /></strong><span>Health priorities</span><small>{healthPriorities ? "Items to discuss in the planning session" : "No lifecycle action required"}</small></article><article className={incidents ? "risk" : "healthy"}><strong><AnimatedNumber value={incidents} delay={490} /></strong><span>Security incidents</span><small>{incidents ? "Follow-up remains open" : "No incidents reported"}</small></article></div>
    {project.hipaa.enabled && <div className={`recap-hipaa-status ${incomplete ? "attention" : "healthy"}`}><div><span className="presentation-kicker">HIPAA Security Readiness</span><strong><AnimatedNumber value={hipaa.overall} delay={520} suffix="%" /></strong></div><p>{incomplete ? `${hipaa.notYetAssessedCount} question${hipaa.notYetAssessedCount === 1 ? " remains" : "s remain"} skipped or unanswered and should be revisited during the follow-up process.` : `The assessment is complete with ${hipaa.completionPercentage}% of applicable controls assessed.`}</p></div>}
    <div className="recap-roadmap">{healthPriorities && approach.mode === "onsite-project" ? <><article><b>01</b><div><span>Review onsite</span><p>Review the server, backup, applications, computers, and connected equipment.</p></div></article><article><b>02</b><div><span>Confirm the complete scope</span><p>Include every item that needs replacement, while keeping budget and timing flexible.</p></div></article><article><b>03</b><div><span>Build the project plan</span><p>Prepare the estimate, installation plan, responsibilities, and timing.</p></div></article></> : healthPriorities ? <><article><b>01</b><div><span>Review remotely</span><p>Confirm the affected computer or computers with your Technology Consultant.</p></div></article><article><b>02</b><div><span>Prepare the estimate</span><p>Validate equipment requirements and replacement options.</p></div></article><article><b>03</b><div><span>Choose timing</span><p>Agree on the practical replacement date and next review checkpoint.</p></div></article></> : hasActionItems ? <><article><b>01</b><div><span>Review together</span><p>Walk through the report and answer remaining questions.</p></div></article><article><b>02</b><div><span>Confirm owners</span><p>Validate the open findings and responsible parties.</p></div></article><article><b>03</b><div><span>Agree on actions</span><p>Set timing and the next follow-up checkpoint.</p></div></article></> : <><article><b>01</b><div><span>Maintain the baseline</span><p>Keep healthy systems protected and within the normal lifecycle.</p></div></article><article><b>02</b><div><span>Continue monitoring</span><p>Watch for meaningful security, capacity, or support changes.</p></div></article><article><b>03</b><div><span>Schedule the next review</span><p>Revisit the environment at the normal quarterly or annual checkpoint.</p></div></article></>}</div>
    {incomplete && <div className="recap-warning"><strong>HIPAA assessment incomplete</strong><span>{hipaa.notYetAssessedCount} question{hipaa.notYetAssessedCount === 1 ? " was" : "s were"} skipped or remain unanswered. This reduced the displayed readiness result and should be revisited.</span></div>}
    <div className="recap-close"><CheckIcon /><div><strong>Thank you for reviewing your technology health with us.</strong><span>{hasActionItems ? "Advantage Technologies will use these findings to guide the next planning conversation." : "Advantage Technologies will continue monitoring the environment and support the next scheduled review."}</span></div></div>
  </div>;
}

function StandardOverview({ project }: { project: Project }) {
  return <div className="presentation-overview"><div className="presentation-overview-copy"><span className="presentation-kicker">{presentationType(project)} · Prepared for {project.client.name}</span><h1>{project.presentation.title}</h1><p>{project.presentation.executiveSummary}</p></div><div className="presentation-score-stack"><div className="presentation-score priority"><strong><AnimatedNumber value={severityCount(project.findings, "priority")} delay={240} /></strong><span>Priority</span></div><div className="presentation-score attention"><strong><AnimatedNumber value={severityCount(project.findings, "attention")} delay={320} /></strong><span>Attention</span></div><div className="presentation-score healthy"><strong><AnimatedNumber value={severityCount(project.findings, "healthy")} delay={400} /></strong><span>Healthy</span></div></div>{project.painPoints.length > 0 && <div className="presentation-pain"><span>What matters most</span><strong>{project.painPoints[0]}</strong></div>}</div>;
}

function ClientPresentation({ project, onUpdate, onClose }: { project: Project; onUpdate: (project: Project) => void; onClose: () => void }) {
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

  return <div className="presentation-overlay" role="dialog" aria-modal="true" aria-label="Client presentation"><div className="presentation-shell"><header className="presentation-topbar"><div className="presentation-brand"><img src="/advantage-mark.png" alt="" /><img className="presentation-wordmark" src="/advantage-wordmark-no-a.png" alt="Advantage Technologies" /></div><nav className="presentation-progress-nav" style={{ "--presentation-progress": `${sections.length > 1 ? (sectionIndex / (sections.length - 1)) * 100 : 100}%` } as CSSProperties}>{sections.map((item, index) => <button key={item} type="button" className={section === item ? "active" : index < sectionIndex ? "complete" : "upcoming"} onClick={() => navigateTo(item)}>{sectionLabel(item)}</button>)}</nav><div className="presentation-topbar-actions"><button className="presentation-pdf" type="button" onClick={() => downloadOutcomePdf(project)} title="Open a print-ready copy and choose Save as PDF">Download PDF</button><button className="presentation-close" type="button" onClick={onClose}>Close</button></div></header><main className={`presentation-stage presentation-stage-${section}`} aria-live="polite"><div key={section} className={`presentation-slide-motion motion-${direction}`}>
    {section === "overview" && (project.type === "client-report" && clientReportAvailable(project) ? <ClientReportOverview project={project} /> : project.type === "prospect-proposal" ? <ProposalOverviewPresentation project={project} /> : <StandardOverview project={project} />)}
    {section === "advantage" && <AdvantageStoryPresentation />}
    {section === "security" && <SecurityPresentation project={project} />}
    {section === "lifecycle" && <LifecyclePresentation project={project} />}
    {section === "details" && <DeviceDetailPresentation project={project} />}
    {section === "hipaa-review" && <HipaaReviewPresentation project={project} onUpdate={onUpdate} onComplete={() => navigateTo("hipaa-results")} />}
    {section === "hipaa-results" && <HipaaResultsPresentation project={project} onUpdate={onUpdate} onReturnToQuestions={() => navigateTo("hipaa-review")} />}
    {section === "findings" && (project.type === "prospect-proposal" ? <ProposalFindingsPresentation project={project} /> : <div className="presentation-section-layout"><div className="presentation-section-heading"><span className="presentation-kicker">The review</span><h2>What we found</h2><p>Clear priorities, without the technical noise.</p></div><div className="presentation-findings">{project.findings.map((item) => <article className={`presentation-finding ${item.severity}`} key={item.id}><div><span>{categoryLabel(item.category)}</span><em>{item.severity}</em></div><h3>{item.title}</h3><p>{item.clientSummary}</p></article>)}</div></div>)}
    {section === "plan" && <PlanPresentation project={project} />}
    {section === "investment" && <ProposalInvestmentPresentation project={project} />}
    {section === "authorization" && <ProposalAuthorizationPresentation project={project} onUpdate={onUpdate} />}
    {section === "recap" && <RecapPresentation project={project} />}
  </div></main><footer className="presentation-footer"><span>{sectionIndex + 1} / {sections.length}</span><div><button type="button" disabled={sectionIndex === 0} onClick={() => navigateTo(sections[Math.max(0, sectionIndex - 1)])}>Previous</button><button className="next" type="button" disabled={sectionIndex === sections.length - 1} onClick={() => navigateTo(sections[Math.min(sections.length - 1, sectionIndex + 1)])}>Next <ArrowIcon /></button></div></footer></div></div>;
}

function ClientReportPreview({ project, editing, updatePresentation }: { project: Project; editing: boolean; updatePresentation: (field: "title" | "executiveSummary", value: string) => void }) {
  const lifecycle = lifecycleSummary(project);
  const events = factNumber(project, "huntress.eventsAnalyzed");
  const incidents = factNumber(project, "huntress.incidentsReported");
  const canaries = factNumber(project, "huntress.canaryFiles");
  const malware = factNumber(project, "huntress.malwareFilesBlocked");
  const hipaa = scoreHipaaAssessment(project.hipaa);
  return <div className="outcome-preview client-report-preview"><div className="outcome-preview-hero"><span>{project.hipaa.enabled ? "Technology, security & compliance review" : "Technology & security review"} · {project.client.name}</span>{editing ? <input value={project.presentation.title} onChange={(event: ChangeEvent<HTMLInputElement>) => updatePresentation("title", event.target.value)} aria-label="Presentation title" /> : <h3>{project.presentation.title}</h3>}{editing ? <textarea rows={5} value={project.presentation.executiveSummary} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updatePresentation("executiveSummary", event.target.value)} aria-label="Executive summary" /> : <p>{project.presentation.executiveSummary}</p>}</div><div className="client-report-preview-stats"><article className="current"><strong><AnimatedNumber value={lifecycle.current} delay={630} /></strong><span>Healthy now</span></article><article className="overdue"><strong>{lifecycle.overdue + lifecycle.dueSoon}</strong><span>Health priorities</span></article><article><strong><AnimatedNumber value={lifecycle.total} delay={280} /></strong><span>Assets reviewed</span></article>{project.hipaa.enabled && <article className={hipaa.notYetAssessedCount ? "due-soon" : "current"}><strong><AnimatedNumber value={hipaa.overall} delay={520} suffix="%" /></strong><span>HIPAA readiness</span></article>}</div><div className="client-report-preview-security"><span className="section-kicker">Security protection</span><div><strong>{formatMetric(events)}</strong><small>events analyzed</small></div><div><strong>{canaries}</strong><small>ransomware canaries</small></div><div><strong>{malware}</strong><small>malware files blocked</small></div><div><strong>{incidents}</strong><small>incidents reported</small></div></div><div className="outcome-preview-plan"><span className="section-kicker">Recommended plan</span>{project.recommendations.slice(0, 4).map((item) => <div key={item.id}><CheckIcon /><span><strong>{item.title}</strong><small>{item.clientValue}</small></span></div>)}</div></div>;
}

export function OutcomeExperience({ project, onUpdate }: { project: Project; onUpdate: (project: Project) => void }) {
  const [presenting, setPresenting] = useState(false);
  const [editing, setEditing] = useState(false);
  const topFindings = useMemo(() => project.findings.slice(0, 4), [project.findings]);
  const richClientReport = project.type === "client-report" && clientReportAvailable(project);
  const prospectProposal = project.type === "prospect-proposal";
  function updatePresentation(field: "title" | "executiveSummary", value: string) { onUpdate({ ...project, presentation: { ...project.presentation, [field]: value }, updatedAt: new Date().toISOString() }); }
  return <>{prospectProposal && <ProposalPricingEditor project={project} onUpdate={onUpdate} />}<section className="workspace-card outcome-card" id="client-experience"><div className="outcome-card-header"><div><span className="section-kicker"><SparkIcon /> Finished package</span><h2>{richClientReport ? (project.hipaa.enabled ? "The technology, security, and HIPAA readiness story is assembled." : "The technology and security story is assembled.") : "The package is assembled and ready to present."}</h2><p>{richClientReport ? "Present the guided review from introduction through final recap, or download the self-contained package." : "Review the story once, then open presentation mode or download the self-contained package."}</p></div><div className="outcome-actions"><button className="button secondary" type="button" onClick={() => setEditing((value) => !value)}>{editing ? "Done editing" : "Edit summary"}</button><button className="button secondary" type="button" onClick={() => downloadOutcomePdf(project)} title="Open a print-ready copy and choose Save as PDF">Download PDF</button><button className="button secondary" type="button" onClick={() => downloadOutcomeHtml(project)}>Download interactive HTML</button><button className="button primary" type="button" onClick={() => setPresenting(true)}>Present package <ArrowIcon /></button></div></div>{richClientReport ? <ClientReportPreview project={project} editing={editing} updatePresentation={updatePresentation} /> : <div className="outcome-preview"><div className="outcome-preview-hero"><span>{prospectProposal ? `Prepared for ${project.client.name}` : `${presentationType(project)} · ${project.client.name}`}</span>{prospectProposal ? <h3>Advantage 360</h3> : editing ? <input value={project.presentation.title} onChange={(event: ChangeEvent<HTMLInputElement>) => updatePresentation("title", event.target.value)} aria-label="Presentation title" /> : <h3>{project.presentation.title}</h3>}{prospectProposal ? <p>We reviewed the technology supporting your practice and identified several areas that should be addressed, along with areas that are working well today. This proposal outlines our recommendations, how we will support your team, the investment required, and the next steps to move forward with confidence.</p> : editing ? <textarea rows={5} value={project.presentation.executiveSummary} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updatePresentation("executiveSummary", event.target.value)} aria-label="Executive summary" /> : <p>{project.presentation.executiveSummary}</p>}</div><div className="outcome-preview-metrics"><div className="priority"><strong>{severityCount(project.findings, "priority")}</strong><span>{prospectProposal ? "Needs attention now" : "priority"}</span></div><div className="attention"><strong>{severityCount(project.findings, "attention")}</strong><span>{prospectProposal ? "Plan for" : "attention"}</span></div><div className="healthy"><strong>{severityCount(project.findings, "healthy")}</strong><span>{prospectProposal ? "In good shape" : "healthy"}</span></div></div><div className="outcome-preview-findings">{topFindings.map((item) => <article className={item.severity} key={item.id}><span>{categoryLabel(item.category)}</span><h4>{item.title}</h4><p>{item.clientSummary}</p></article>)}</div><div className="outcome-preview-plan"><span className="section-kicker">Recommended plan</span>{project.recommendations.slice(0, 4).map((item) => <div key={item.id}><CheckIcon /><span><strong>{item.title}</strong><small>{item.clientValue}</small></span></div>)}</div>{prospectProposal && <ProposalInvestmentPreview project={project} />}</div>}</section>{presenting && <ClientPresentation project={project} onUpdate={onUpdate} onClose={() => setPresenting(false)} />}</>;
}
