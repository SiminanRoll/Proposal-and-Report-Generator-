"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Project } from "@/lib/projects/types";
import type { MultiPracticeData, PracticeReview } from "@/lib/outcomes/multi-practice-review";
import {
  MultiPracticeSecuritySection,
  MultiPracticeLifecycleSection,
  MultiPracticeInventorySection,
  MultiPracticeBackupSection,
  MultiPracticeBudgetSection,
} from "./multi-practice-native-sections";

type Section = "overview" | "security" | "backup" | "lifecycle" | "details" | "hipaa" | "plan" | "budget" | "recap";
type PracticeSelection = "all" | string;
const labels: Record<Section, string> = {
  overview: "Introduction",
  security: "Security",
  backup: "Backup & recovery",
  lifecycle: "Equipment age",
  details: "Hardware inventory",
  hipaa: "HIPAA review",
  plan: "Planning",
  budget: "Budget outlook",
  recap: "Recap",
};
function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
function findingStatus(p: PracticeReview): string {
  if (p.lifecycle.overdue) return "Replacement priorities";
  if (p.lifecycle.dueSoon) return "Planning recommended";
  if (p.lifecycle.unknown) return "Age verification needed";
  return p.lifecycle.total ? "Within equipment-age range" : "Age status not assessed";
}
function amount(value: number, known: boolean): string {
  return known ? value.toLocaleString("en-US") : "Not reported";
}
function SectionHeading({ kicker, title, description }: { kicker: string; title: string; description: string }) {
  return <div className="presentation-section-heading">
    <span className="presentation-kicker">{kicker}</span>
    <h2>{title}</h2>
    <p>{description}</p>
  </div>;
}
function PracticeCard({ practice, onSelect, children }: { practice: PracticeReview; onSelect: () => void; children: React.ReactNode }) {
  return <article className="multi-native-practice-card">
    <div className="multi-native-practice-card-top">
      <div><span>Independent practice review</span><h3>{practice.name}</h3></div>
      <button type="button" onClick={onSelect} aria-label={"Explore " + practice.name}>Explore practice <span aria-hidden="true">→</span></button>
    </div>
    <div className="multi-native-practice-card-content">{children}</div>
  </article>;
}
function Metric({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return <div className={"multi-native-metric " + (tone || "")}>
    <strong>{value}</strong><span>{label}</span>
  </div>;
}
function Overview({ data, select }: { data: MultiPracticeData; select: (id: string) => void }) {
  const totalAssets = data.practices.reduce((n, p) => n + p.assetCount, 0);
  const priorities = data.practices.reduce((n, p) => n + p.lifecycle.overdue + p.lifecycle.dueSoon, 0);
  const os = data.practices.reduce((n, p) => n + p.os.attention, 0);
  return <div className="presentation-health-cover multi-native-overview">
    <div className="multi-native-cover-main">
      <section className="health-cover-intro">
        <span className="presentation-kicker">Technology overview · {data.review.ownerLabel}</span>
        <h1>Technology<br />Health Review</h1>
        <p>One ownership view. Separate security, equipment, readiness and planning priorities for each practice.</p>
        <div className="presentation-periods"><span>{data.practices.length} independent practice reviews</span></div>
      </section>
      <div className="multi-native-cover-practices">
        {data.practices.map((p) => <button type="button" className="multi-native-cover-practice" key={p.id} onClick={() => select(p.id)}>
          <span className="presentation-kicker">Practice technology health</span>
          <strong>{p.name}</strong>
          <b className={p.lifecycle.overdue ? "attention" : "healthy"}>{findingStatus(p)}</b>
          <div className="multi-native-cover-metrics">
            <span><em>{p.assetCount}</em> assets</span>
            <span><em>{p.lifecycle.overdue}</em> replace now</span>
            <span><em>{p.lifecycle.dueSoon}</em> plan soon</span>
          </div>
          <small>{p.os.attention} OS support concerns · HIPAA: {p.hipaaEnabled ? p.hipaaLabel : "Not assessed"}</small>
          <span className="multi-native-cover-open">Explore this practice →</span>
        </button>)}
      </div>
    </div>
    <div className="health-evidence-strip four-up">
      <span><strong>{data.practices.length}</strong> managed practices</span>
      <span><strong>{totalAssets}</strong> reported asset entries</span>
      <span className="attention"><strong>{priorities}</strong> equipment priorities</span>
      <span className="attention"><strong>{os}</strong> OS support concerns</span>
    </div>
  </div>;
}
function Compare({ data, section, select }: { data: MultiPracticeData; section: Section; select: (id: string) => void }) {
  const headings: Record<string, [string, string, string]> = {
    security: ["Security protection", "Protection across both practices.", "Review the reporting available for each practice. Security events are not combined across different reporting periods."],
    backup: ["Backup & disaster recovery", "Two recovery paths. Two independent responsibilities.", "An inventoried backup device does not confirm successful backups or tested recovery."],
    lifecycle: ["Equipment health", "See where replacement planning matters.", "Physical equipment-age priorities and operating-system support concerns stay separate for each practice."],
    details: ["Hardware inventory", "The equipment behind each practice.", "Choose a practice to explore its interactive inventory, device filters and replacement priorities."],
    hipaa: ["HIPAA readiness", "Separate readiness assessments.", "Each practice retains its own safeguards, outstanding questions and administrative responsibilities."],
    plan: ["Technology planning", "One ownership roadmap. Clear practice priorities.", "The next steps stay attached to the practice and decision-maker responsible for them."],
    budget: ["Budget outlook", "Plan investments across both practices.", "Each practice is estimated independently. Totals are preliminary planning figures, not approved quotes or project dates."],
    recap: ["Final recap", "What should happen next.", "Priorities and next steps for each operation, viewed together without blending their individual findings."],
  };
  const [kicker, title, description] = headings[section] || headings.recap;
  return <div className="presentation-section-layout multi-native-comparison">
    <SectionHeading kicker={kicker} title={title} description={description} />
    <div className="multi-native-compare-grid">
      {data.practices.map((p) => <PracticeCard key={p.id} practice={p} onSelect={() => select(p.id)}>
        {section === "security" && <div className="multi-native-metrics">
          <Metric label="Events analyzed" value={amount(p.securityEvents, p.securityEventsReported)} />
          <Metric label="Investigations" value={amount(p.securityInvestigations, p.securityInvestigationsReported)} />
          <Metric label="Incidents reported" value={amount(p.securityIncidents, p.securityIncidentsReported)} tone={p.securityIncidentsReported && p.securityIncidents ? "attention" : ""}/>
          {!p.securityEvidence && <p className="multi-native-disclosure">Security report unavailable. No zero-incident conclusion is implied.</p>}
        </div>}
        {section === "backup" && <div className="multi-native-metrics">
          <Metric label="BDR devices inventoried" value={p.bdrCount} />
          <Metric label="Server-class devices" value={p.devices.filter((d) => d.type === "server" || d.type === "backup-server").length}/>
          <p className="multi-native-disclosure">Recovery tests, offsite replication and backup success require separate verification.</p>
        </div>}
        {(section === "lifecycle" || section === "details") && <>
          <div className="multi-native-metrics"><Metric label="Replace now" value={p.lifecycle.overdue} tone={p.lifecycle.overdue ? "attention" : ""} />
            <Metric label="Plan soon" value={p.lifecycle.dueSoon}/><Metric label="Healthy age" value={p.lifecycle.current}/><Metric label="OS attention" value={p.os.attention}/></div>
          <div className="multi-native-lifecycle-bar"><span style={{ width: p.lifecycle.total ? (100 * p.lifecycle.current / p.lifecycle.total) + "%" : "0%" }}/><span style={{ width: p.lifecycle.total ? (100 * p.lifecycle.dueSoon / p.lifecycle.total) + "%" : "0%" }}/><span style={{ width: p.lifecycle.total ? (100 * p.lifecycle.overdue / p.lifecycle.total) + "%" : "0%" }}/></div>
          {section === "details" && <p className="multi-native-disclosure">{p.assetCount} reported assets · Select this practice for the full device inventory.</p>}
        </>}
        {section === "hipaa" && <><div className="multi-native-status">{p.hipaaEnabled ? p.hipaaLabel : "Not assessed"}</div><div className="multi-native-metrics">
          <Metric label="Unanswered questions" value={p.hipaaEnabled ? p.hipaaOpen : "Not assessed"}/><Metric label="Open findings shown" value={p.hipaaGaps.length}/></div><p className="multi-native-disclosure">Readiness is not a legal compliance certification.</p></>}
        {section === "plan" && <div className="multi-native-action-preview">{p.actions.slice(0,3).map((a, i) => <div key={a.id + i}><b>{String(i + 1).padStart(2, "0")}</b><span><strong>{a.title}</strong><small>{a.timing} · {a.owner}</small></span></div>)}</div>}
        {section === "budget" && <><div className="multi-native-budget-range">{money(p.budget.replacementBudgetLow)} – {money(p.budget.replacementBudgetHigh)}</div><p className="multi-native-disclosure">12-month equipment replacement planning · {p.budget.planningServers} servers · {p.budget.planningWorkstations} workstations</p></>}
        {section === "recap" && <><div className="multi-native-status">{findingStatus(p)}</div><div className="multi-native-metrics">
          <Metric label="Replacement" value={p.lifecycle.overdue}/><Metric label="Planning" value={p.lifecycle.dueSoon}/><Metric label="OS support" value={p.os.attention}/></div><p className="multi-native-disclosure">{p.actions[0]?.title || "Continue monitoring and set a follow-up review."}</p></>}
      </PracticeCard>)}
    </div>
    {section === "budget" && <div className="multi-native-owner-total"><div><span>Combined ownership planning range</span><strong>{money(data.combinedBudgetLow)} – {money(data.combinedBudgetHigh)}</strong></div><p>Indicative planning only. Possible shared equipment and scopes need review before finalizing estimates.</p></div>}
    {section === "recap" && <div className="multi-native-owner-total"><div><span>Recommended next step</span><strong>Agree on priorities and timing for each practice.</strong></div><p>Advantage can coordinate the scope and next technology planning conversation.</p></div>}
  </div>;
}
function PracticeDetail({ data, practice, project, section }: { data: MultiPracticeData; practice: PracticeReview; project: Project; section: Section }) {
  if (section === "security" && practice.securityEvidence) return <MultiPracticeSecuritySection project={project} />;
  if (section === "lifecycle") return <MultiPracticeLifecycleSection project={project} />;
  if (section === "details") return <MultiPracticeInventorySection project={project} />;
  if (section === "backup") return <MultiPracticeBackupSection project={project} />;
  if (section === "budget") return <MultiPracticeBudgetSection project={project} />;
  return <div className="presentation-section-layout multi-native-detail">
    <SectionHeading kicker={labels[section] + " · " + practice.name}
      title={section === "security" ? "Security information needs confirmation."
        : section === "hipaa" ? (practice.hipaaEnabled ? practice.hipaaLabel : "Assessment not completed")
        : section === "plan" ? "A practical roadmap for this practice."
        : "Priorities and next decisions."}
      description={section === "security" ? "No verified security source was found for this practice."
        : section === "hipaa" ? "These are practice-specific readiness findings, not an official compliance determination."
        : "Recommendations and ownership remain linked to the original practice report."}/>
    {section === "hipaa" ? <div className="multi-native-detail-list">
      <article><small>Unanswered HIPAA questions</small><strong>{practice.hipaaEnabled ? practice.hipaaOpen : "Not assessed"}</strong></article>
      {practice.hipaaGaps.map((gap, i) => <article key={gap + i}><small>Readiness question to revisit</small><strong>{gap}</strong></article>)}
      {!practice.hipaaGaps.length && <article><strong>No reportable gaps listed in the current assessment.</strong></article>}
    </div> : <div className="presentation-plan multi-native-plan-list">
      {practice.actions.map((action, index) => <article key={action.id + index}>
        <b>{String(index + 1).padStart(2, "0")}</b><div><span className="presentation-kicker">{action.timing} · {action.owner}</span><h3>{action.title}</h3><p>{action.detail}</p></div>
      </article>)}
    </div>}
    {section === "recap" && <aside className="multi-native-owner-total"><span>Thank you for reviewing your technology health with Advantage Technologies.</span></aside>}
  </div>;
}
export function MultiPracticePresentation({ data, projects, onClose, onDownloadPdf, pdfBusy }: {
  data: MultiPracticeData;
  projects: Project[];
  onClose: () => void;
  onDownloadPdf: () => void;
  pdfBusy: boolean;
}) {
  const sections = useMemo<Section[]>(() => [
    "overview", "security",
    ...(data.practices.some((p) => p.bdrCount > 0) ? ["backup" as const] : []),
    "lifecycle", "details",
    ...(data.practices.some((p) => p.hipaaEnabled) ? ["hipaa" as const] : []),
    "plan", ...(data.review.includeBudget ? ["budget" as const] : []), "recap",
  ], [data]);
  const [section, setSection] = useState<Section>("overview");
  const [selection, setSelection] = useState<PracticeSelection>("all");
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const index = Math.max(0, sections.indexOf(section));
  const chosen = data.practices.find((p) => p.id === selection);
  const project = chosen ? projects.find((p) => p.id === chosen.id) : undefined;
  const documentLabel = data.review.title + " - " + data.review.ownerLabel;
  useEffect(() => {
    const previous = document.title;
    const overflow = document.body.style.overflow;
    document.title = "Client Compass - " + documentLabel;
    document.body.style.overflow = "hidden";
    return () => { document.title = previous; document.body.style.overflow = overflow; };
  }, [documentLabel]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.closest('[data-presentation-interactive="true"]') || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setSection(sections[Math.min(sections.length - 1, index + 1)]);
        setSelection("all"); setDirection("forward");
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setSection(sections[Math.max(0, index - 1)]);
        setSelection("all"); setDirection("backward");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onClose, sections]);
  function navigate(next: Section) {
    setDirection(sections.indexOf(next) < index ? "backward" : "forward");
    setSection(next); setSelection("all");
  }
  function choose(id: string) { setSelection(id); }
  return <div className="presentation-overlay multi-native-presentation" role="dialog" aria-modal="true" aria-label="Multi-practice Technology Health Review">
    <div className="presentation-shell">
      <header className="presentation-topbar">
        <div className="presentation-brand"><img src="/advantage-mark.png" alt="" /><img className="presentation-wordmark" src="/advantage-wordmark-no-a.png" alt="Advantage Technologies" /></div>
        <nav className="presentation-progress-nav" data-section-count={sections.length}
          style={{ "--presentation-progress": (sections.length > 1 ? (index / (sections.length - 1)) * 100 : 100) + "%" } as CSSProperties}>
          {sections.map((item, n) => <button key={item} type="button" className={section === item ? "active" : n < index ? "complete" : "upcoming"} onClick={() => navigate(item)}>{labels[item]}</button>)}
        </nav>
        <div className="presentation-topbar-actions">
          <button className="presentation-pdf" type="button" disabled={pdfBusy} onClick={onDownloadPdf}>{pdfBusy ? "Preparing PDF…" : "Download PDF"}</button>
          <button className="presentation-close" type="button" onClick={onClose}>Close</button>
        </div>
      </header>
      {section !== "overview" && <nav className="multi-native-practice-tabs" aria-label="Choose practice for this section" data-presentation-interactive="true">
        <button type="button" className={selection === "all" ? "active" : ""} aria-pressed={selection === "all"} onClick={() => choose("all")}>Both practices</button>
        {data.practices.map((p) => <button key={p.id} type="button" className={selection === p.id ? "active" : ""} aria-pressed={selection === p.id} onClick={() => choose(p.id)}>{p.name}</button>)}
      </nav>}
      <main className={"presentation-stage presentation-stage-" + section} aria-live="polite">
        <div className={"presentation-slide-motion motion-" + direction} key={section + "-" + selection}>
          {section === "overview" ? <Overview data={data} select={(id) => {setSelection(id); setSection("lifecycle"); setDirection("forward");}} />
            : chosen && project ? <div className="multi-native-selected-practice"><div className="multi-native-selected-label"><span>Practice view</span><strong>{chosen.name}</strong></div>
              <PracticeDetail data={data} practice={chosen} project={project} section={section}/></div>
            : <Compare data={data} section={section} select={choose} />}
        </div>
      </main>
      <footer className="presentation-footer"><span>{index + 1} / {sections.length}</span><div>
        <button type="button" disabled={index === 0} onClick={() => navigate(sections[Math.max(0, index - 1)])}>Previous</button>
        <button className="next" type="button" disabled={index === sections.length - 1} onClick={() => navigate(sections[Math.min(sections.length - 1, index + 1)])}>Next <span aria-hidden="true">→</span></button>
      </div></footer>
    </div>
  </div>;
}
