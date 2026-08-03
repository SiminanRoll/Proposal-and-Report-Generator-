"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type { Finding, Project } from "@/lib/projects/types";
import { categoryLabel } from "@/lib/outcomes/builder";
import { downloadOutcomeHtml } from "@/lib/outcomes/export-html";
import {
  clientReportAvailable,
  factNumber,
  formatMetric,
  lifecycleDevices,
  lifecycleStatusLabel,
} from "@/lib/outcomes/client-report-data";
import { ArrowIcon, CheckIcon, SparkIcon } from "./icons";
import { HipaaReviewPresentation, HipaaResultsPresentation } from "./hipaa-presentation";

const STANDARD_SECTIONS = ["overview", "findings", "plan"] as const;
const CLIENT_REPORT_SECTIONS = ["overview", "lifecycle", "security", "plan", "details"] as const;
type PresentationSection = (typeof CLIENT_REPORT_SECTIONS)[number] | (typeof STANDARD_SECTIONS)[number] | "hipaa-review" | "hipaa-results";

function sectionsFor(project: Project): PresentationSection[] {
  const base: PresentationSection[] = project.type === "client-report" && clientReportAvailable(project)
    ? [...CLIENT_REPORT_SECTIONS]
    : [...STANDARD_SECTIONS];
  if (!project.hipaa.enabled) return base;
  const planIndex = base.indexOf("plan");
  const insertion = planIndex >= 0 ? planIndex : base.length;
  return [...base.slice(0, insertion), "hipaa-review", "hipaa-results", ...base.slice(insertion)];
}

function sectionLabel(value: PresentationSection): string {
  if (value === "overview") return "Overview";
  if (value === "lifecycle") return "Technology health";
  if (value === "security") return "Security";
  if (value === "details") return "Device detail";
  if (value === "hipaa-review") return "HIPAA review";
  if (value === "hipaa-results") return "HIPAA results";
  return value === "findings" ? "What we found" : "Recommended plan";
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

function ClientReportOverview({ project }: { project: Project }) {
  const total = factNumber(project, "scalepad.totalAssets");
  const overdue = factNumber(project, "scalepad.replacement.overdue");
  const incidents = factNumber(project, "huntress.incidentsReported");
  return (
    <div className="presentation-overview client-report-overview">
      <div className="presentation-overview-copy">
        <span className="presentation-kicker">Technology & security review · Prepared for {project.client.name}</span>
        <h1>{project.presentation.title}</h1>
        <p>{project.presentation.executiveSummary}</p>
      </div>
      <div className="client-report-score-stack">
        <div><strong>{total}</strong><span>Assets reviewed</span></div>
        <div className={overdue ? "risk" : "healthy"}><strong>{overdue}</strong><span>Replace now</span></div>
        <div className={incidents ? "risk" : "healthy"}><strong>{incidents}</strong><span>Security incidents</span></div>
      </div>
      {project.painPoints.length > 0 && <div className="presentation-pain"><span>What matters most</span><strong>{project.painPoints[0]}</strong></div>}
    </div>
  );
}

function LifecyclePresentation({ project }: { project: Project }) {
  const devices = lifecycleDevices(project);
  const overdue = factNumber(project, "scalepad.replacement.overdue");
  const dueSoon = factNumber(project, "scalepad.replacement.dueSoon");
  const current = factNumber(project, "scalepad.replacement.current");
  const unknown = factNumber(project, "scalepad.replacement.unknown");
  const priorityDevices = devices.filter((device) => device.lifecycleStatus === "overdue" || device.lifecycleStatus === "due-soon").slice(0, 8);
  const servers = factNumber(project, "scalepad.servers");
  const workstations = factNumber(project, "scalepad.workstations");
  const vms = factNumber(project, "scalepad.vms");
  const network = factNumber(project, "scalepad.networkDevices");
  const osSupported = factNumber(project, "scalepad.os.supported");
  const osEnding = factNumber(project, "scalepad.os.endingSoon");
  const osUnsupported = factNumber(project, "scalepad.os.unsupported");
  return (
    <div className="presentation-section-layout">
      <div className="presentation-section-heading"><span className="presentation-kicker">Technology health</span><h2>Plan replacements before they become emergencies.</h2><p>The lifecycle picture combines age, warranty, and operating-system support into one clear plan.</p></div>
      <div className="environment-count-strip"><span><strong>{workstations}</strong>Workstations</span><span><strong>{servers}</strong>Servers</span><span><strong>{vms}</strong>Virtual machines</span><span><strong>{network}</strong>Network devices</span><span className="os-summary"><b>{osSupported} supported</b><b>{osEnding} ending soon</b><b>{osUnsupported} unsupported</b></span></div>
      <div className="lifecycle-metric-grid">
        <article className="current"><strong>{current}</strong><span>Current</span><small>Within the planned lifecycle</small></article>
        <article className="due-soon"><strong>{dueSoon}</strong><span>Plan soon</span><small>Due within the planning window</small></article>
        <article className="overdue"><strong>{overdue}</strong><span>Replace now</span><small>Past the planned lifecycle</small></article>
        <article className="unknown"><strong>{unknown}</strong><span>Under review</span><small>Lifecycle status not assigned</small></article>
      </div>
      <div className="priority-device-grid">
        {priorityDevices.map((device) => <article key={`${device.type}-${device.name}`}><div><span>{device.type}</span><LifecycleStatus value={device.lifecycleStatus} /></div><h3>{device.name}</h3><p>{device.make} {device.model}</p><small>{device.age ? `${device.age} years old` : "Age not listed"}{device.warrantyExpires ? ` · Warranty ${device.warrantyExpires}` : ""}</small></article>)}
      </div>
    </div>
  );
}

function SecurityPresentation({ project }: { project: Project }) {
  const events = factNumber(project, "huntress.eventsAnalyzed");
  const signals = factNumber(project, "huntress.signalsDetected");
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
      <div className="presentation-section-heading"><span className="presentation-kicker">Security protection</span><h2>Millions of events reviewed. No hidden technical noise.</h2><p>Security tools are valuable when they monitor continuously, filter normal activity, and act when something matters.</p></div>
      <div className="security-funnel-grid">
        <article><strong>{formatMetric(events)}</strong><span>Events analyzed</span><small>Across {entities} protected entities</small></article>
        <article><strong>{signals}</strong><span>Signals detected</span><small>Filtered through automated and human analysis</small></article>
        <article className={incidents ? "risk" : "healthy"}><strong>{incidents}</strong><span>Incidents reported</span><small>{incidents ? "Requires review" : "No targeted attacks reported"}</small></article>
      </div>
      <div className="security-feature-grid">
        <article><div className="security-feature-icon">R</div><div><span>Ransomware early warning</span><h3>{canaries} canary files protecting {endpoints || entities} endpoints</h3><p>Hidden files act like a canary in a coal mine. If ransomware begins changing files, the activity can be detected and isolated earlier.</p></div></article>
        <article><div className="security-feature-icon">AV</div><div><span>Managed antivirus</span><h3>{malware} malware file{malware === 1 ? "" : "s"} automatically blocked</h3><p>{antivirusEvents} antivirus event{antivirusEvents === 1 ? " was" : "s were"} reviewed during the reporting period, with protection acting before execution.</p></div></article>
      </div>
      <div className="security-activity-strip"><span><strong>{formatMetric(autorunEvents)}</strong><small>Autorun events</small><em>{autorunSignals} signals</em></span><span><strong>{formatMetric(processEvents)}</strong><small>Process events</small><em>{processSignals} signals</em></span><p>These additional monitoring layers look for persistence and suspicious processes before they become incidents.</p></div>
    </div>
  );
}

function DeviceDetailPresentation({ project }: { project: Project }) {
  const devices = lifecycleDevices(project);
  return (
    <div className="presentation-section-layout">
      <div className="presentation-section-heading"><span className="presentation-kicker">Supporting detail</span><h2>Every device behind the plan.</h2><p>Names, models, age, warranty, and support status remain available when the conversation needs proof.</p></div>
      <div className="presentation-device-table-wrap"><table className="presentation-device-table"><thead><tr><th>Device</th><th>Type</th><th>Model</th><th>OS</th><th>Age</th><th>Warranty</th><th>Status</th></tr></thead><tbody>{devices.map((device) => <tr key={`${device.type}-${device.name}`}><td><strong>{device.name}</strong><small>{device.user}</small></td><td>{device.type}</td><td>{device.make} {device.model}</td><td>{device.os || "—"}</td><td>{device.age || "—"}</td><td>{device.warrantyExpires || "—"}</td><td><LifecycleStatus value={device.lifecycleStatus} /></td></tr>)}</tbody></table></div>
    </div>
  );
}

function StandardOverview({ project }: { project: Project }) {
  return (
    <div className="presentation-overview">
      <div className="presentation-overview-copy"><span className="presentation-kicker">{presentationType(project)} · Prepared for {project.client.name}</span><h1>{project.presentation.title}</h1><p>{project.presentation.executiveSummary}</p></div>
      <div className="presentation-score-stack"><div className="presentation-score priority"><strong>{severityCount(project.findings, "priority")}</strong><span>Priority</span></div><div className="presentation-score attention"><strong>{severityCount(project.findings, "attention")}</strong><span>Attention</span></div><div className="presentation-score healthy"><strong>{severityCount(project.findings, "healthy")}</strong><span>Healthy</span></div></div>
      {project.painPoints.length > 0 && <div className="presentation-pain"><span>What matters most</span><strong>{project.painPoints[0]}</strong></div>}
    </div>
  );
}

function ClientPresentation({ project, onUpdate, onClose }: { project: Project; onUpdate: (project: Project) => void; onClose: () => void }) {
  const sections = useMemo(() => sectionsFor(project), [project]);
  const [section, setSection] = useState<PresentationSection>(sections[0]);
  const sectionIndex = Math.max(0, sections.indexOf(section));
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

  return (
    <div className="presentation-overlay" role="dialog" aria-modal="true" aria-label="Client presentation">
      <div className="presentation-shell">
        <header className="presentation-topbar"><div className="presentation-brand"><img src="/advantage-mark.png" alt="" /><img className="presentation-wordmark" src="/advantage-wordmark-no-a.png" alt="Advantage Technologies" /></div><nav>{sections.map((item) => <button key={item} type="button" className={section === item ? "active" : ""} onClick={() => setSection(item)}>{sectionLabel(item)}</button>)}</nav><button className="presentation-close" type="button" onClick={onClose}>Close</button></header>
        <main className={`presentation-stage presentation-${section}`}>
          {section === "overview" && (project.type === "client-report" && clientReportAvailable(project) ? <ClientReportOverview project={project} /> : <StandardOverview project={project} />)}
          {section === "lifecycle" && <LifecyclePresentation project={project} />}
          {section === "security" && <SecurityPresentation project={project} />}
          {section === "details" && <DeviceDetailPresentation project={project} />}
          {section === "hipaa-review" && <HipaaReviewPresentation project={project} onUpdate={onUpdate} onComplete={() => setSection("hipaa-results")} />}
          {section === "hipaa-results" && <HipaaResultsPresentation project={project} onUpdate={onUpdate} onReturnToQuestions={() => setSection("hipaa-review")} />}
          {section === "findings" && <div className="presentation-section-layout"><div className="presentation-section-heading"><span className="presentation-kicker">The review</span><h2>What we found</h2><p>Clear priorities, without the technical noise.</p></div><div className="presentation-findings">{project.findings.map((item) => <article className={`presentation-finding ${item.severity}`} key={item.id}><div><span>{categoryLabel(item.category)}</span><em>{item.severity}</em></div><h3>{item.title}</h3><p>{item.clientSummary}</p></article>)}</div></div>}
          {section === "plan" && <div className="presentation-section-layout"><div className="presentation-section-heading"><span className="presentation-kicker">The plan</span><h2>{project.type === "prospect-proposal" ? "The Advantage 360 approach" : "Recommended next steps"}</h2><p>A focused plan connected directly to what the review uncovered.</p></div><div className="presentation-plan">{project.recommendations.map((item, index) => <article key={item.id}><b>{String(index + 1).padStart(2, "0")}</b><div><h3>{item.title}</h3><p>{item.clientValue}</p></div></article>)}</div>{project.type !== "client-report" && (project.pricing.monthly > 0 || project.pricing.oneTime > 0) && <div className="presentation-investment"><span><small>Monthly investment</small><strong>${project.pricing.monthly.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></span><span><small>One-time investment</small><strong>${project.pricing.oneTime.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></span></div>}</div>}
        </main>
        <footer className="presentation-footer"><span>{sectionIndex + 1} / {sections.length}</span><div><button type="button" disabled={sectionIndex === 0} onClick={() => setSection(sections[Math.max(0, sectionIndex - 1)])}>Previous</button><button className="next" type="button" disabled={sectionIndex === sections.length - 1} onClick={() => setSection(sections[Math.min(sections.length - 1, sectionIndex + 1)])}>Next <ArrowIcon /></button></div></footer>
      </div>
    </div>
  );
}

function ClientReportPreview({ project, editing, updatePresentation }: { project: Project; editing: boolean; updatePresentation: (field: "title" | "executiveSummary", value: string) => void }) {
  const total = factNumber(project, "scalepad.totalAssets");
  const overdue = factNumber(project, "scalepad.replacement.overdue");
  const dueSoon = factNumber(project, "scalepad.replacement.dueSoon");
  const events = factNumber(project, "huntress.eventsAnalyzed");
  const incidents = factNumber(project, "huntress.incidentsReported");
  const canaries = factNumber(project, "huntress.canaryFiles");
  const malware = factNumber(project, "huntress.malwareFilesBlocked");
  return <div className="outcome-preview client-report-preview"><div className="outcome-preview-hero"><span>Technology & security review · {project.client.name}</span>{editing ? <input value={project.presentation.title} onChange={(event: ChangeEvent<HTMLInputElement>) => updatePresentation("title", event.target.value)} aria-label="Presentation title" /> : <h3>{project.presentation.title}</h3>}{editing ? <textarea rows={5} value={project.presentation.executiveSummary} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updatePresentation("executiveSummary", event.target.value)} aria-label="Executive summary" /> : <p>{project.presentation.executiveSummary}</p>}</div><div className="client-report-preview-stats"><article><strong>{total}</strong><span>Assets reviewed</span></article><article className="overdue"><strong>{overdue}</strong><span>Replace now</span></article><article className="due-soon"><strong>{dueSoon}</strong><span>Plan soon</span></article><article className={incidents ? "overdue" : "current"}><strong>{incidents}</strong><span>Security incidents</span></article></div><div className="client-report-preview-security"><span className="section-kicker">Security protection</span><div><strong>{formatMetric(events)}</strong><small>events analyzed</small></div><div><strong>{canaries}</strong><small>ransomware canaries</small></div><div><strong>{malware}</strong><small>malware files blocked</small></div></div><div className="outcome-preview-plan"><span className="section-kicker">Recommended plan</span>{project.recommendations.slice(0, 4).map((item) => <div key={item.id}><CheckIcon /><span><strong>{item.title}</strong><small>{item.clientValue}</small></span></div>)}</div></div>;
}

export function OutcomeExperience({ project, onUpdate }: { project: Project; onUpdate: (project: Project) => void }) {
  const [presenting, setPresenting] = useState(false);
  const [editing, setEditing] = useState(false);
  const topFindings = useMemo(() => project.findings.slice(0, 4), [project.findings]);
  const richClientReport = project.type === "client-report" && clientReportAvailable(project);

  function updatePresentation(field: "title" | "executiveSummary", value: string) {
    onUpdate({ ...project, presentation: { ...project.presentation, [field]: value }, updatedAt: new Date().toISOString() });
  }

  return <><section className="workspace-card outcome-card" id="client-experience"><div className="outcome-card-header"><div><span className="section-kicker"><SparkIcon /> Finished package</span><h2>{richClientReport ? "The ScalePad and Huntress reports are combined." : "The package is assembled and ready to present."}</h2><p>{richClientReport ? "Review one technology-and-security story, then present it or download the self-contained package." : "Review the story once, then open presentation mode or download the self-contained package."}</p></div><div className="outcome-actions"><button className="button secondary" type="button" onClick={() => setEditing((value) => !value)}>{editing ? "Done editing" : "Edit summary"}</button><button className="button secondary" type="button" onClick={() => downloadOutcomeHtml(project)}>Download interactive HTML</button><button className="button primary" type="button" onClick={() => setPresenting(true)}>Present package <ArrowIcon /></button></div></div>{richClientReport ? <ClientReportPreview project={project} editing={editing} updatePresentation={updatePresentation} /> : <div className="outcome-preview"><div className="outcome-preview-hero"><span>{presentationType(project)} · {project.client.name}</span>{editing ? <input value={project.presentation.title} onChange={(event: ChangeEvent<HTMLInputElement>) => updatePresentation("title", event.target.value)} aria-label="Presentation title" /> : <h3>{project.presentation.title}</h3>}{editing ? <textarea rows={5} value={project.presentation.executiveSummary} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updatePresentation("executiveSummary", event.target.value)} aria-label="Executive summary" /> : <p>{project.presentation.executiveSummary}</p>}</div><div className="outcome-preview-metrics"><div className="priority"><strong>{severityCount(project.findings, "priority")}</strong><span>priority</span></div><div className="attention"><strong>{severityCount(project.findings, "attention")}</strong><span>attention</span></div><div className="healthy"><strong>{severityCount(project.findings, "healthy")}</strong><span>healthy</span></div></div><div className="outcome-preview-findings">{topFindings.map((item) => <article className={item.severity} key={item.id}><span>{categoryLabel(item.category)}</span><h4>{item.title}</h4><p>{item.clientSummary}</p></article>)}</div><div className="outcome-preview-plan"><span className="section-kicker">Recommended plan</span>{project.recommendations.slice(0, 4).map((item) => <div key={item.id}><CheckIcon /><span><strong>{item.title}</strong><small>{item.clientValue}</small></span></div>)}</div></div>}</section>{presenting && <ClientPresentation project={project} onUpdate={onUpdate} onClose={() => setPresenting(false)} />}</>;
}
