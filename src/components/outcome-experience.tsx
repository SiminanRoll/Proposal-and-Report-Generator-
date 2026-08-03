"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type { Finding, Project } from "@/lib/projects/types";
import { categoryLabel } from "@/lib/outcomes/builder";
import { downloadOutcomeHtml } from "@/lib/outcomes/export-html";
import {
  clientReportAvailable,
  factNumber,
  factText,
  formatMetric,
  lifecycleDevices,
  lifecycleStatusLabel,
  lifecycleSummary,
  replacementDevices,
  sortLifecycleDevices,
} from "@/lib/outcomes/client-report-data";
import { scoreHipaaAssessment } from "@/lib/hipaa/engine";
import { clientReportScores, scoreLabel, scoreTone } from "@/lib/outcomes/client-report-score";
import { clientReportPlanActions } from "@/lib/outcomes/client-report-plan";
import { ArrowIcon, CheckIcon, SparkIcon } from "./icons";
import { HipaaReviewPresentation, HipaaResultsPresentation } from "./hipaa-presentation";

const STANDARD_SECTIONS = ["overview", "findings", "plan", "recap"] as const;
const CLIENT_REPORT_SECTIONS = ["overview", "security", "lifecycle", "details", "plan", "recap"] as const;
type PresentationSection = (typeof CLIENT_REPORT_SECTIONS)[number] | (typeof STANDARD_SECTIONS)[number] | "hipaa-review" | "hipaa-results";

function sectionsFor(project: Project): PresentationSection[] {
  if (project.type === "client-report" && clientReportAvailable(project)) {
    const beginning: PresentationSection[] = ["overview", "security", "lifecycle", "details"];
    const hipaa: PresentationSection[] = project.hipaa.enabled ? ["hipaa-review", "hipaa-results"] : [];
    return [...beginning, ...hipaa, "plan", "recap"];
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

function LifecycleStatus({ value }: { value: "current" | "due-soon" | "overdue" | "unknown" }) {
  return <span className={`device-status device-status-${value}`}>{lifecycleStatusLabel(value)}</span>;
}

function HealthScoreCard({ score, label, detail, className = "" }: { score: number | null; label: string; detail: string; className?: string }) {
  const value = score ?? 0;
  return <article className={`health-score-card ${score === null ? "unavailable" : scoreTone(value)} ${className}`}><div><strong>{score === null ? "—" : value}</strong>{score !== null && <em>/100</em>}</div><span>{label}</span><small>{detail}</small></article>;
}

function ClientReportOverview({ project }: { project: Project }) {
  const lifecycle = lifecycleSummary(project);
  const replacements = replacementDevices(project);
  const hipaa = scoreHipaaAssessment(project.hipaa);
  const scores = clientReportScores(project);
  const incidents = factNumber(project, "huntress.incidentsReported");
  const securityPeriod = factText(project, "huntress.reportPeriod");
  const lifecyclePeriod = factText(project, "scalepad.reportPeriod");
  return (
    <div className="presentation-health-cover">
      <div className="health-cover-heading">
        <span className="presentation-kicker">Technology overview · Prepared for {project.client.name}</span>
        <h1>Technology Health Review</h1>
        <p>Security, infrastructure, lifecycle, and HIPAA readiness—summarized into one clear view of what is healthy, what needs attention, and what should happen next.</p>
        <div className="presentation-periods">
          {lifecyclePeriod && <span>Lifecycle: {lifecyclePeriod}</span>}
          {securityPeriod && <span>Security: {securityPeriod}</span>}
        </div>
      </div>
      <div className="health-cover-score-layout">
        <article className={`overall-health-score ${scoreTone(scores.overall)}`}>
          <span>{scores.provisional ? "Provisional score" : "Overall technology health"}</span>
          <div><strong>{scores.overall}</strong><em>/100</em></div>
          <b>{scoreLabel(scores.overall)}</b>
          <small>{scores.provisional ? `${hipaa.notYetAssessedCount} HIPAA question${hipaa.notYetAssessedCount === 1 ? " remains" : "s remain"} unanswered, so this score will update as the assessment is completed.` : "A combined view of protection, lifecycle, readiness, and planning."}</small>
        </article>
        <div className="health-score-card-grid">
          <HealthScoreCard score={scores.security} label="Security protection" detail="Monitoring coverage, detections, response, and reported incidents" className="security" />
          <HealthScoreCard score={scores.network} label="Network & lifecycle" detail={`${lifecycle.current} healthy · ${lifecycle.dueSoon} plan soon · ${lifecycle.overdue} replace now`} className="network" />
          <HealthScoreCard score={scores.hipaa} label="HIPAA readiness" detail={project.hipaa.enabled ? `${hipaa.completionPercentage}% assessed · ${hipaa.notYetAssessedCount} unanswered` : "Assessment not enabled"} className="compliance" />
          <HealthScoreCard score={scores.planning} label="Resilience & planning" detail="Action coverage, replacement readiness, and follow-through" className="planning" />
        </div>
      </div>
      <div className="health-evidence-strip">
        <span><strong>{lifecycle.total}</strong> assets reviewed</span>
        <span className="healthy"><strong>{lifecycle.current}</strong> healthy</span>
        <span className="attention"><strong>{lifecycle.dueSoon}</strong> aging</span>
        <span className="risk"><strong>{lifecycle.overdue}</strong> replace now</span>
        <span className={incidents ? "risk" : "healthy"}><strong>{incidents}</strong> security incidents</span>
      </div>
      {replacements.length > 0 && <div className="health-cover-replacements"><span>Priority replacements</span><div>{replacements.map((device) => <strong key={`${device.type}-${device.name}`}>{device.name}<small>{device.age ? `${device.age} years` : device.type}</small></strong>)}</div></div>}
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
  return (
    <div className="presentation-section-layout">
      <div className="presentation-section-heading"><span className="presentation-kicker">Security protection</span><h2>Continuous monitoring turns millions of events into a few meaningful decisions.</h2><p>The security story is not just what was detected. It also shows the protection actively watching, filtering, blocking, and escalating activity.</p></div>
      <div className="security-funnel-visual" aria-label={`${events} events became ${signals} signals and ${incidents} incidents`}>
        <div className="security-funnel-step events"><strong>{formatMetric(events)}</strong><span>Events analyzed</span><small>Across {entities} protected entities</small></div>
        <div className="security-funnel-arrow">→</div>
        <div className="security-funnel-step signals"><strong>{signals}</strong><span>Signals detected</span><small>{investigated} required investigation</small></div>
        <div className="security-funnel-arrow">→</div>
        <div className={`security-funnel-step incidents ${incidents ? "risk" : "healthy"}`}><strong>{incidents}</strong><span>Incidents reported</span><small>{incidents ? "Follow-up required" : "No targeted attacks reported"}</small></div>
      </div>
      <div className="security-feature-grid">
        <article><div className="security-feature-icon">R</div><div><span>Ransomware early warning</span><h3>{canaries} canary files across {endpoints || entities} endpoints</h3><p>Hidden early-warning files are monitored for changes associated with ransomware, helping isolate activity before it spreads.</p></div></article>
        <article><div className="security-feature-icon">AV</div><div><span>Managed antivirus</span><h3>{malware} malware file{malware === 1 ? "" : "s"} automatically blocked</h3><p>{antivirusEvents} antivirus event{antivirusEvents === 1 ? " was" : "s were"} processed, with protection acting before a blocked file could execute.</p></div></article>
      </div>
      <div className="security-activity-strip"><span><strong>{formatMetric(autorunEvents)}</strong><small>Autorun events</small><em>{autorunSignals} signals</em></span><span><strong>{formatMetric(processEvents)}</strong><small>Process events</small><em>{processSignals} signals</em></span><p>Additional monitoring looks for persistence and suspicious processes that may appear before a larger incident.</p></div>
    </div>
  );
}

function LifecyclePresentation({ project }: { project: Project }) {
  const devices = sortLifecycleDevices(lifecycleDevices(project));
  const lifecycle = lifecycleSummary(project);
  const replacements = devices.filter((device) => device.lifecycleStatus === "overdue");
  const nextDevices = devices.filter((device) => device.lifecycleStatus !== "overdue").slice(0, 4);
  const servers = factNumber(project, "scalepad.servers");
  const workstations = factNumber(project, "scalepad.workstations");
  const vms = factNumber(project, "scalepad.vms");
  const network = factNumber(project, "scalepad.networkDevices");
  const osSupported = factNumber(project, "scalepad.os.supported");
  const osEnding = factNumber(project, "scalepad.os.endingSoon");
  const osUnsupported = factNumber(project, "scalepad.os.unsupported");
  const segment = (count: number) => lifecycle.total ? `${Math.max(0, (count / lifecycle.total) * 100)}%` : "0%";
  return (
    <div className="presentation-section-layout">
      <div className="presentation-section-heading"><span className="presentation-kicker">Network health & lifecycle</span><h2>Protect what is healthy. Plan what is aging. Replace what creates risk.</h2><p>This view combines the complete inventory, device age, warranty position, and operating-system support.</p></div>
      <div className="network-health-overview">
        <div className="lifecycle-health-score"><strong>{lifecycle.healthyPercentage}%</strong><span>currently healthy</span><small>{lifecycle.current} of {lifecycle.total} assets are within the planned lifecycle</small></div>
        <div className="lifecycle-story">
          <div className="lifecycle-segmented-bar"><span className="current" style={{ width: segment(lifecycle.current) }} /><span className="due-soon" style={{ width: segment(lifecycle.dueSoon) }} /><span className="overdue" style={{ width: segment(lifecycle.overdue) }} /><span className="unknown" style={{ width: segment(lifecycle.unknown) }} /></div>
          <div className="lifecycle-legend"><span className="current"><b>{lifecycle.current}</b> Healthy now</span><span className="due-soon"><b>{lifecycle.dueSoon}</b> Plan soon</span><span className="overdue"><b>{lifecycle.overdue}</b> Replace now</span><span className="unknown"><b>{lifecycle.unknown}</b> Under review</span></div>
        </div>
      </div>
      <div className="environment-count-strip"><span><strong>{workstations}</strong>Workstations</span><span><strong>{servers}</strong>Servers</span><span><strong>{vms}</strong>Virtual machines</span><span><strong>{network}</strong>Network devices</span><span className="os-summary"><b>{osSupported} supported</b><b>{osEnding} ending soon</b><b>{osUnsupported} unsupported</b></span></div>
      <div className="lifecycle-metric-grid">
        <article className="current"><strong>{lifecycle.current}</strong><span>Healthy now</span><small>Keep in service and continue monitoring</small></article>
        <article className="due-soon"><strong>{lifecycle.dueSoon}</strong><span>Plan soon</span><small>Budget within the planning window</small></article>
        <article className="overdue"><strong>{lifecycle.overdue}</strong><span>Replace now</span><small>Prioritize by business impact</small></article>
        <article className="unknown"><strong>{lifecycle.unknown}</strong><span>Under review</span><small>Confirm status before final planning</small></article>
      </div>
      {replacements.length > 0 && <section className="replacement-overview"><div><span className="presentation-kicker">Priority replacements</span><h3>{replacements.length} machine{replacements.length === 1 ? "" : "s"} should be addressed first</h3><p>These systems are grouped together here before the full inventory so the immediate replacement decision is clear.</p></div><div className="replacement-device-grid">{replacements.map((device, index) => <article key={`${device.type}-${device.name}`}><b>{String(index + 1).padStart(2, "0")}</b><div><span>{device.type}</span><h4>{device.name}</h4><p>{device.make} {device.model}</p><small>{device.age ? `${device.age} years old` : "Age not listed"}{device.warrantyExpires ? ` · Warranty ${device.warrantyExpires}` : ""}</small></div><LifecycleStatus value={device.lifecycleStatus} /></article>)}</div></section>}
      {nextDevices.length > 0 && <div className="next-device-strip"><span>Next in the lifecycle</span><div>{nextDevices.map((device) => <article key={`${device.type}-${device.name}`}><div><h3>{device.name}</h3><LifecycleStatus value={device.lifecycleStatus} /></div><small>{device.age ? `${device.age} years old` : device.type}</small></article>)}</div></div>}
    </div>
  );
}

function DeviceDetailPresentation({ project }: { project: Project }) {
  const devices = sortLifecycleDevices(lifecycleDevices(project));
  const lifecycle = lifecycleSummary(project);
  return (
    <div className="presentation-section-layout">
      <div className="presentation-section-heading"><span className="presentation-kicker">Hardware inventory</span><h2>The devices behind the health score.</h2><p>Every named system remains visible so recommendations can be tied to specific equipment rather than general assumptions.</p></div>
      <div className="hardware-summary-ribbon"><span><strong>{lifecycle.total}</strong>Total assets</span><span className="healthy"><strong>{lifecycle.current}</strong>Healthy now</span><span className="attention"><strong>{lifecycle.dueSoon}</strong>Plan soon</span><span className="risk"><strong>{lifecycle.overdue}</strong>Replace now</span></div>
      {devices.length ? <div className="presentation-device-table-wrap"><table className="presentation-device-table"><thead><tr><th>Device</th><th>Type</th><th>Model</th><th>Operating system</th><th>Age</th><th>Warranty</th><th>Last check-in</th><th>Status</th></tr></thead><tbody>{devices.map((device) => <tr className={`device-row-${device.lifecycleStatus}`} key={`${device.type}-${device.name}-${device.serial}`}><td><strong>{device.name}</strong><small>{device.user || device.serial}</small></td><td>{device.type}</td><td>{device.make} {device.model}</td><td>{device.os || "—"}</td><td>{device.age || "—"}</td><td>{device.warrantyExpires || "—"}</td><td>{device.lastCheckIn || "—"}</td><td><LifecycleStatus value={device.lifecycleStatus} /></td></tr>)}</tbody></table></div> : <div className="hardware-empty-state"><strong>The lifecycle summary was read, but the detailed device rows could not be structured.</strong><p>Replace the ScalePad PDF with a text-searchable export to populate the named inventory. The summary counts remain available for the review.</p></div>}
    </div>
  );
}

function PlanPresentation({ project }: { project: Project }) {
  if (project.type !== "client-report") {
    return <div className="presentation-section-layout"><div className="presentation-section-heading"><span className="presentation-kicker">Planning</span><h2>{project.type === "prospect-proposal" ? "The Advantage 360 approach" : "Turn the review into a practical roadmap."}</h2><p>A focused plan connected directly to the security, network-health, and readiness findings.</p></div><div className="presentation-plan">{project.recommendations.map((item, index) => <article key={item.id}><b>{String(index + 1).padStart(2, "0")}</b><div><h3>{item.title}</h3><p>{item.clientValue}</p></div></article>)}</div>{(project.pricing.monthly > 0 || project.pricing.oneTime > 0) && <div className="presentation-investment"><span><small>Monthly investment</small><strong>${project.pricing.monthly.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></span><span><small>One-time investment</small><strong>${project.pricing.oneTime.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></span></div>}</div>;
  }
  const actions = clientReportPlanActions(project);
  const lifecycle = lifecycleSummary(project);
  const hipaa = scoreHipaaAssessment(project.hipaa);
  const incidents = factNumber(project, "huntress.incidentsReported");
  const investigated = factNumber(project, "huntress.signalsInvestigated");
  return <div className="presentation-section-layout client-action-plan"><div className="presentation-section-heading"><span className="presentation-kicker">Planning</span><h2>Turn the review into clear next steps.</h2><p>The roadmap below is generated from the actual replacement list, HIPAA readiness result, and security activity reviewed in this package.</p></div><div className="planning-context-strip"><span className={lifecycle.overdue ? "risk" : "healthy"}><strong>{lifecycle.overdue}</strong> replace now</span><span className={hipaa.notYetAssessedCount ? "attention" : "healthy"}><strong>{project.hipaa.enabled ? `${hipaa.overall}/100` : "—"}</strong> HIPAA readiness</span><span className={incidents || investigated ? "attention" : "healthy"}><strong>{incidents + investigated}</strong> security follow-ups</span></div><div className="presentation-plan action-plan-grid">{actions.map((item, index) => <article className={`plan-action-${item.tone}`} key={item.id}><b>{String(index + 1).padStart(2, "0")}</b><div><div className="plan-action-meta"><span>{item.timing}</span><span>{item.owner}</span></div><h3>{item.title}</h3><p>{item.detail}</p></div></article>)}</div></div>;
}

function RecapPresentation({ project }: { project: Project }) {
  const lifecycle = lifecycleSummary(project);
  const incidents = factNumber(project, "huntress.incidentsReported");
  const hipaa = scoreHipaaAssessment(project.hipaa);
  const incomplete = project.hipaa.enabled && hipaa.notYetAssessedCount > 0;
  return <div className="presentation-recap"><div><span className="presentation-kicker">Final recap</span><h2>What is healthy, what needs attention, and what happens next.</h2><p>This recap keeps the full review connected: protection, infrastructure, compliance readiness, and the recommended plan.</p></div><div className="recap-score-grid"><article className="healthy"><strong>{lifecycle.current}</strong><span>Healthy assets</span><small>Systems that can remain in service</small></article><article className={incidents ? "risk" : "healthy"}><strong>{incidents}</strong><span>Security incidents</span><small>{incidents ? "Follow-up remains open" : "No incidents reported"}</small></article>{project.hipaa.enabled && <article className={incomplete ? "attention" : "healthy"}><strong>{hipaa.overall}%</strong><span>HIPAA readiness</span><small>{hipaa.completionPercentage}% assessed · {hipaa.notYetAssessedCount} skipped or unanswered</small></article>}<article><strong>{project.type === "client-report" ? clientReportPlanActions(project).length : project.recommendations.length}</strong><span>Planning priorities</span><small>Connected to the findings reviewed today</small></article></div><div className="recap-lower"><section><span className="presentation-kicker">Keep doing</span><h3>Preserve the healthy baseline</h3><p>Continue monitoring protected systems and keep currently healthy devices inside the planned review cycle.</p></section><section><span className="presentation-kicker">Address next</span><h3>{lifecycle.overdue + lifecycle.dueSoon} lifecycle item{lifecycle.overdue + lifecycle.dueSoon === 1 ? "" : "s"} and {project.hipaa.enabled ? hipaa.counts.no + hipaa.counts.partially : 0} readiness action{project.hipaa.enabled && (hipaa.counts.no + hipaa.counts.partially === 1) ? "" : "s"}</h3><p>Use the planning section as the working roadmap, with skipped HIPAA questions revisited before the next finalized readiness snapshot.</p></section></div>{incomplete && <div className="recap-warning"><strong>HIPAA assessment incomplete</strong><span>{hipaa.notYetAssessedCount} question{hipaa.notYetAssessedCount === 1 ? " was" : "s were"} skipped or remain unanswered. This reduced the displayed readiness result and should be revisited.</span></div>}<div className="recap-close"><CheckIcon /><div><strong>Review complete</strong><span>Advantage Technologies will use these findings to guide the next planning conversation.</span></div></div></div>;
}

function StandardOverview({ project }: { project: Project }) {
  return <div className="presentation-overview"><div className="presentation-overview-copy"><span className="presentation-kicker">{presentationType(project)} · Prepared for {project.client.name}</span><h1>{project.presentation.title}</h1><p>{project.presentation.executiveSummary}</p></div><div className="presentation-score-stack"><div className="presentation-score priority"><strong>{severityCount(project.findings, "priority")}</strong><span>Priority</span></div><div className="presentation-score attention"><strong>{severityCount(project.findings, "attention")}</strong><span>Attention</span></div><div className="presentation-score healthy"><strong>{severityCount(project.findings, "healthy")}</strong><span>Healthy</span></div></div>{project.painPoints.length > 0 && <div className="presentation-pain"><span>What matters most</span><strong>{project.painPoints[0]}</strong></div>}</div>;
}

function ClientPresentation({ project, onUpdate, onClose }: { project: Project; onUpdate: (project: Project) => void; onClose: () => void }) {
  const sections = useMemo(() => sectionsFor(project), [project]);
  const [section, setSection] = useState<PresentationSection>(sections[0]);
  const sectionIndex = Math.max(0, sections.indexOf(section));
  useEffect(() => {
    if (!sections.includes(section)) setSection(sections[0]);
  }, [section, sections]);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "ArrowRight") setSection(sections[Math.min(sections.length - 1, sectionIndex + 1)]);
      if (event.key === "ArrowLeft") setSection(sections[Math.max(0, sectionIndex - 1)]);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, sectionIndex, sections]);

  return <div className="presentation-overlay" role="dialog" aria-modal="true" aria-label="Client presentation"><div className="presentation-shell"><header className="presentation-topbar"><div className="presentation-brand"><img src="/advantage-mark.png" alt="" /><img className="presentation-wordmark" src="/advantage-wordmark-no-a.png" alt="Advantage Technologies" /></div><nav>{sections.map((item) => <button key={item} type="button" className={section === item ? "active" : ""} onClick={() => setSection(item)}>{sectionLabel(item)}</button>)}</nav><button className="presentation-close" type="button" onClick={onClose}>Close</button></header><main className={`presentation-stage presentation-${section}`}>
    {section === "overview" && (project.type === "client-report" && clientReportAvailable(project) ? <ClientReportOverview project={project} /> : <StandardOverview project={project} />)}
    {section === "security" && <SecurityPresentation project={project} />}
    {section === "lifecycle" && <LifecyclePresentation project={project} />}
    {section === "details" && <DeviceDetailPresentation project={project} />}
    {section === "hipaa-review" && <HipaaReviewPresentation project={project} onUpdate={onUpdate} onComplete={() => setSection("hipaa-results")} />}
    {section === "hipaa-results" && <HipaaResultsPresentation project={project} onUpdate={onUpdate} onReturnToQuestions={() => setSection("hipaa-review")} />}
    {section === "findings" && <div className="presentation-section-layout"><div className="presentation-section-heading"><span className="presentation-kicker">The review</span><h2>What we found</h2><p>Clear priorities, without the technical noise.</p></div><div className="presentation-findings">{project.findings.map((item) => <article className={`presentation-finding ${item.severity}`} key={item.id}><div><span>{categoryLabel(item.category)}</span><em>{item.severity}</em></div><h3>{item.title}</h3><p>{item.clientSummary}</p></article>)}</div></div>}
    {section === "plan" && <PlanPresentation project={project} />}
    {section === "recap" && <RecapPresentation project={project} />}
  </main><footer className="presentation-footer"><span>{sectionIndex + 1} / {sections.length}</span><div><button type="button" disabled={sectionIndex === 0} onClick={() => setSection(sections[Math.max(0, sectionIndex - 1)])}>Previous</button><button className="next" type="button" disabled={sectionIndex === sections.length - 1} onClick={() => setSection(sections[Math.min(sections.length - 1, sectionIndex + 1)])}>Next <ArrowIcon /></button></div></footer></div></div>;
}

function ClientReportPreview({ project, editing, updatePresentation }: { project: Project; editing: boolean; updatePresentation: (field: "title" | "executiveSummary", value: string) => void }) {
  const lifecycle = lifecycleSummary(project);
  const events = factNumber(project, "huntress.eventsAnalyzed");
  const incidents = factNumber(project, "huntress.incidentsReported");
  const canaries = factNumber(project, "huntress.canaryFiles");
  const malware = factNumber(project, "huntress.malwareFilesBlocked");
  const hipaa = scoreHipaaAssessment(project.hipaa);
  return <div className="outcome-preview client-report-preview"><div className="outcome-preview-hero"><span>Technology, security & compliance review · {project.client.name}</span>{editing ? <input value={project.presentation.title} onChange={(event: ChangeEvent<HTMLInputElement>) => updatePresentation("title", event.target.value)} aria-label="Presentation title" /> : <h3>{project.presentation.title}</h3>}{editing ? <textarea rows={5} value={project.presentation.executiveSummary} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updatePresentation("executiveSummary", event.target.value)} aria-label="Executive summary" /> : <p>{project.presentation.executiveSummary}</p>}</div><div className="client-report-preview-stats"><article className="current"><strong>{lifecycle.current}</strong><span>Healthy now</span></article><article className="overdue"><strong>{lifecycle.overdue}</strong><span>Replace now</span></article><article className="due-soon"><strong>{lifecycle.dueSoon}</strong><span>Plan soon</span></article><article className={project.hipaa.enabled && hipaa.notYetAssessedCount ? "due-soon" : "current"}><strong>{project.hipaa.enabled ? `${hipaa.overall}%` : "—"}</strong><span>HIPAA readiness</span></article></div><div className="client-report-preview-security"><span className="section-kicker">Security protection</span><div><strong>{formatMetric(events)}</strong><small>events analyzed</small></div><div><strong>{canaries}</strong><small>ransomware canaries</small></div><div><strong>{malware}</strong><small>malware files blocked</small></div><div><strong>{incidents}</strong><small>incidents reported</small></div></div><div className="outcome-preview-plan"><span className="section-kicker">Recommended plan</span>{project.recommendations.slice(0, 4).map((item) => <div key={item.id}><CheckIcon /><span><strong>{item.title}</strong><small>{item.clientValue}</small></span></div>)}</div></div>;
}

export function OutcomeExperience({ project, onUpdate }: { project: Project; onUpdate: (project: Project) => void }) {
  const [presenting, setPresenting] = useState(false);
  const [editing, setEditing] = useState(false);
  const topFindings = useMemo(() => project.findings.slice(0, 4), [project.findings]);
  const richClientReport = project.type === "client-report" && clientReportAvailable(project);
  function updatePresentation(field: "title" | "executiveSummary", value: string) { onUpdate({ ...project, presentation: { ...project.presentation, [field]: value }, updatedAt: new Date().toISOString() }); }
  return <><section className="workspace-card outcome-card" id="client-experience"><div className="outcome-card-header"><div><span className="section-kicker"><SparkIcon /> Finished package</span><h2>{richClientReport ? "The technology, security, and HIPAA readiness story is assembled." : "The package is assembled and ready to present."}</h2><p>{richClientReport ? "Present the guided review from introduction through final recap, or download the self-contained package." : "Review the story once, then open presentation mode or download the self-contained package."}</p></div><div className="outcome-actions"><button className="button secondary" type="button" onClick={() => setEditing((value) => !value)}>{editing ? "Done editing" : "Edit summary"}</button><button className="button secondary" type="button" onClick={() => downloadOutcomeHtml(project)}>Download interactive HTML</button><button className="button primary" type="button" onClick={() => setPresenting(true)}>Present package <ArrowIcon /></button></div></div>{richClientReport ? <ClientReportPreview project={project} editing={editing} updatePresentation={updatePresentation} /> : <div className="outcome-preview"><div className="outcome-preview-hero"><span>{presentationType(project)} · {project.client.name}</span>{editing ? <input value={project.presentation.title} onChange={(event: ChangeEvent<HTMLInputElement>) => updatePresentation("title", event.target.value)} aria-label="Presentation title" /> : <h3>{project.presentation.title}</h3>}{editing ? <textarea rows={5} value={project.presentation.executiveSummary} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updatePresentation("executiveSummary", event.target.value)} aria-label="Executive summary" /> : <p>{project.presentation.executiveSummary}</p>}</div><div className="outcome-preview-metrics"><div className="priority"><strong>{severityCount(project.findings, "priority")}</strong><span>priority</span></div><div className="attention"><strong>{severityCount(project.findings, "attention")}</strong><span>attention</span></div><div className="healthy"><strong>{severityCount(project.findings, "healthy")}</strong><span>healthy</span></div></div><div className="outcome-preview-findings">{topFindings.map((item) => <article className={item.severity} key={item.id}><span>{categoryLabel(item.category)}</span><h4>{item.title}</h4><p>{item.clientSummary}</p></article>)}</div><div className="outcome-preview-plan"><span className="section-kicker">Recommended plan</span>{project.recommendations.slice(0, 4).map((item) => <div key={item.id}><CheckIcon /><span><strong>{item.title}</strong><small>{item.clientValue}</small></span></div>)}</div></div>}</section>{presenting && <ClientPresentation project={project} onUpdate={onUpdate} onClose={() => setPresenting(false)} />}</>;
}
