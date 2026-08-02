"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type { Finding, Project } from "@/lib/projects/types";
import { categoryLabel } from "@/lib/outcomes/builder";
import { downloadOutcomeHtml } from "@/lib/outcomes/export-html";
import { ArrowIcon, CheckIcon, SparkIcon } from "./icons";

const SECTIONS = ["overview", "findings", "plan"] as const;
type PresentationSection = (typeof SECTIONS)[number];

function sectionLabel(value: PresentationSection): string {
  return value === "overview" ? "Overview" : value === "findings" ? "What we found" : "Recommended plan";
}

function presentationType(project: Project): string {
  if (project.type === "client-report") return "Client technology review";
  if (project.type === "legacy-modernization") return "Modernized proposal";
  return "Advantage 360 proposal";
}

function severityCount(findings: Finding[], severity: Finding["severity"]): number {
  return findings.filter((item) => item.severity === severity).length;
}

function ClientPresentation({ project, onClose }: { project: Project; onClose: () => void }) {
  const [section, setSection] = useState<PresentationSection>("overview");
  const sectionIndex = SECTIONS.indexOf(section);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setSection(SECTIONS[Math.min(SECTIONS.length - 1, sectionIndex + 1)]);
      if (event.key === "ArrowLeft") setSection(SECTIONS[Math.max(0, sectionIndex - 1)]);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, sectionIndex]);

  return (
    <div className="presentation-overlay" role="dialog" aria-modal="true" aria-label="Client presentation">
      <div className="presentation-shell">
        <header className="presentation-topbar">
          <div className="presentation-brand"><img src="/advantage-mark.png" alt="" /><img className="presentation-wordmark" src="/advantage-wordmark-no-a.png" alt="Advantage Technologies" /></div>
          <nav>{SECTIONS.map((item) => <button key={item} type="button" className={section === item ? "active" : ""} onClick={() => setSection(item)}>{sectionLabel(item)}</button>)}</nav>
          <button className="presentation-close" type="button" onClick={onClose}>Close</button>
        </header>

        <main className={`presentation-stage presentation-${section}`}>
          {section === "overview" && (
            <div className="presentation-overview">
              <div className="presentation-overview-copy">
                <span className="presentation-kicker">{presentationType(project)} · Prepared for {project.client.name}</span>
                <h1>{project.presentation.title}</h1>
                <p>{project.presentation.executiveSummary}</p>
              </div>
              <div className="presentation-score-stack">
                <div className="presentation-score priority"><strong>{severityCount(project.findings, "priority")}</strong><span>Priority</span></div>
                <div className="presentation-score attention"><strong>{severityCount(project.findings, "attention")}</strong><span>Attention</span></div>
                <div className="presentation-score healthy"><strong>{severityCount(project.findings, "healthy")}</strong><span>Healthy</span></div>
              </div>
              {project.painPoints.length > 0 && <div className="presentation-pain"><span>What matters most</span><strong>{project.painPoints[0]}</strong></div>}
            </div>
          )}

          {section === "findings" && (
            <div className="presentation-section-layout">
              <div className="presentation-section-heading"><span className="presentation-kicker">The review</span><h2>What we found</h2><p>Clear priorities, without the technical noise.</p></div>
              <div className="presentation-findings">{project.findings.map((item) => <article className={`presentation-finding ${item.severity}`} key={item.id}><div><span>{categoryLabel(item.category)}</span><em>{item.severity}</em></div><h3>{item.title}</h3><p>{item.clientSummary}</p></article>)}</div>
            </div>
          )}

          {section === "plan" && (
            <div className="presentation-section-layout">
              <div className="presentation-section-heading"><span className="presentation-kicker">The plan</span><h2>{project.type === "prospect-proposal" ? "The Advantage 360 approach" : "Recommended next steps"}</h2><p>A focused plan connected directly to what the review uncovered.</p></div>
              <div className="presentation-plan">{project.recommendations.map((item, index) => <article key={item.id}><b>{String(index + 1).padStart(2, "0")}</b><div><h3>{item.title}</h3><p>{item.clientValue}</p></div></article>)}</div>
              {project.type !== "client-report" && (project.pricing.monthly > 0 || project.pricing.oneTime > 0) && <div className="presentation-investment"><span><small>Monthly investment</small><strong>${project.pricing.monthly.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></span><span><small>One-time investment</small><strong>${project.pricing.oneTime.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></span></div>}
            </div>
          )}
        </main>

        <footer className="presentation-footer">
          <span>{sectionIndex + 1} / {SECTIONS.length}</span>
          <div><button type="button" disabled={sectionIndex === 0} onClick={() => setSection(SECTIONS[Math.max(0, sectionIndex - 1)])}>Previous</button><button className="next" type="button" disabled={sectionIndex === SECTIONS.length - 1} onClick={() => setSection(SECTIONS[Math.min(SECTIONS.length - 1, sectionIndex + 1)])}>Next <ArrowIcon /></button></div>
        </footer>
      </div>
    </div>
  );
}

export function OutcomeExperience({ project, onUpdate }: { project: Project; onUpdate: (project: Project) => void }) {
  const [presenting, setPresenting] = useState(false);
  const [editing, setEditing] = useState(false);
  const topFindings = useMemo(() => project.findings.slice(0, 4), [project.findings]);

  function updatePresentation(field: "title" | "executiveSummary", value: string) {
    onUpdate({ ...project, presentation: { ...project.presentation, [field]: value }, updatedAt: new Date().toISOString() });
  }

  return (
    <>
      <section className="workspace-card outcome-card" id="client-experience">
        <div className="outcome-card-header">
          <div><span className="section-kicker"><SparkIcon /> Client experience</span><h2>The report is assembled and ready to present.</h2><p>Review the story once, then open presentation mode or download a self-contained client file.</p></div>
          <div className="outcome-actions"><button className="button secondary" type="button" onClick={() => setEditing((value) => !value)}>{editing ? "Done editing" : "Edit summary"}</button><button className="button secondary" type="button" onClick={() => downloadOutcomeHtml(project)}>Download interactive HTML</button><button className="button primary" type="button" onClick={() => setPresenting(true)}>Present to client <ArrowIcon /></button></div>
        </div>

        <div className="outcome-preview">
          <div className="outcome-preview-hero">
            <span>{presentationType(project)} · {project.client.name}</span>
            {editing ? <input value={project.presentation.title} onChange={(event: ChangeEvent<HTMLInputElement>) => updatePresentation("title", event.target.value)} aria-label="Presentation title" /> : <h3>{project.presentation.title}</h3>}
            {editing ? <textarea rows={5} value={project.presentation.executiveSummary} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updatePresentation("executiveSummary", event.target.value)} aria-label="Executive summary" /> : <p>{project.presentation.executiveSummary}</p>}
          </div>
          <div className="outcome-preview-metrics"><div className="priority"><strong>{severityCount(project.findings, "priority")}</strong><span>priority</span></div><div className="attention"><strong>{severityCount(project.findings, "attention")}</strong><span>attention</span></div><div className="healthy"><strong>{severityCount(project.findings, "healthy")}</strong><span>healthy</span></div></div>
          <div className="outcome-preview-findings">{topFindings.map((item) => <article className={item.severity} key={item.id}><span>{categoryLabel(item.category)}</span><h4>{item.title}</h4><p>{item.clientSummary}</p></article>)}</div>
          <div className="outcome-preview-plan"><span className="section-kicker">Recommended plan</span>{project.recommendations.slice(0, 4).map((item) => <div key={item.id}><CheckIcon /><span><strong>{item.title}</strong><small>{item.clientValue}</small></span></div>)}</div>
        </div>
      </section>
      {presenting && <ClientPresentation project={project} onClose={() => setPresenting(false)} />}
    </>
  );
}
