"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ADVANTAGE_360_PILLARS } from "@/lib/advantage-360-pillars";
import type { PlanningAppointment } from "@/lib/projects/types";
import {
  A360_PRIORITY_OPTIONS,
  emptyA360Prospect,
  preliminaryA360Estimate,
  priorityStory,
  type A360ProspectDiscovery,
  type ProspectIndustry,
  type OrganizationLanguage,
  type ServerAnswer,
} from "@/lib/prospects/a360";
import {
  PROSPECT_THR_HIPAA_DISCLAIMER,
  THR_HIPAA_QUESTIONS,
  THR_QUESTIONS,
  THR_STATUS_LABELS,
  observationsFor,
  prospectThrConsultantBrief,
  prospectThrEnvironment,
  prospectThrHipaaObservations,
  prospectThrObservations,
  prospectThrOpenItems,
  prospectThrSummary,
  type ProspectThrAnswers,
  type ProspectThrSession,
  type ThrAnswer,
  type ThrObservation,
} from "@/lib/prospects/technology-health";
import { ProspectA360Scheduler } from "./prospect-a360-scheduler";

const DRAFT_KEY = "client-compass-prospect-thr-draft-v1";
const STAGES = ["Welcome", "Priorities", "Environment", "Health", "HIPAA", "Snapshot", "Report", "A360", "Estimate", "OTA"] as const;
const ANSWERS: ThrAnswer[] = ["positive", "partial", "concern", "unknown"];

function emptyAnswers(): ProspectThrAnswers {
  return { responses: {}, notes: {} };
}

function initialSession(): ProspectThrSession {
  return {
    discovery: emptyA360Prospect(),
    conversationContext: "",
    health: emptyAnswers(),
    hipaaEnabled: true,
    hipaa: emptyAnswers(),
  };
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function ThrStepNumber({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <div className="prospect-stepper">
    <button type="button" onClick={() => onChange(Math.max(0, value - 1))} aria-label="Decrease">−</button>
    <strong>{value}</strong>
    <button type="button" onClick={() => onChange(value + 1)} aria-label="Increase">+</button>
  </div>;
}

function ObservationRows({ items }: { items: ThrObservation[] }) {
  return <div className="thr-observations">
    {items.map((item) => <article className={"thr-observation tone-" + item.status} key={item.id}>
      <div><span>{item.category}</span><strong>{item.question}</strong>{item.note && <small>{item.note}</small>}</div>
      <div className="thr-observation-result"><b>{THR_STATUS_LABELS[item.status]}</b><small>{item.answer}</small></div>
    </article>)}
  </div>;
}

function AnswerCard({
  question,
  current,
  note,
  onAnswer,
  onNote,
}: {
  question: (typeof THR_QUESTIONS)[number];
  current?: ThrAnswer;
  note: string;
  onAnswer: (answer: ThrAnswer) => void;
  onNote: (note: string) => void;
}) {
  return <article className="thr-answer-card">
    <h3>{question.question}</h3>
    <div className="thr-answer-buttons">{ANSWERS.map((answer, index) =>
      <button type="button" key={answer} className={current === answer ? "selected answer-" + answer : ""} onClick={() => onAnswer(answer)} aria-pressed={current === answer}>{question.options[index]}</button>)}
    </div>
    <label>Optional note <input value={note} onChange={(event) => onNote(event.target.value)} placeholder="Only if it helps the conversation" /></label>
  </article>;
}

function ReviewReport({ session }: { session: ProspectThrSession }) {
  const items = prospectThrObservations(session);
  const hipaa = prospectThrHipaaObservations(session);
  const focus = prospectThrOpenItems(session);
  const d = session.discovery;
  return <article className="thr-document">
    <header>
      <div className="thr-document-brand"><img src="/advantage-mark.png" alt="" /><span>ADVANTAGE TECHNOLOGIES</span></div>
      <small>Conversation-based technology overview · {new Date().toLocaleDateString("en-US")}</small>
      <h1>Technology Health Report</h1>
      <p>Prepared for <strong>{d.organizationName || "Prospective client"}</strong> · {d.contactName || "Contact not recorded"}</p>
    </header>
    <section className="thr-document-intro">
      <h2>Executive overview</h2>
      <p>{session.conversationContext.trim() || prospectThrSummary(session)}</p>
      {session.conversationContext.trim() && <p>{prospectThrSummary(session)}</p>}
      <p className="thr-document-caution">This review reflects information shared in conversation. It does not confirm technical condition, product coverage, security effectiveness, or regulatory compliance.</p>
    </section>
    <section>
      <h2>Reported technology environment</h2>
      <div className="thr-document-facts">{prospectThrEnvironment(session).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <p>Priorities: {d.priorities.length ? d.priorities.join(" · ") : "Not yet selected"}</p>
    </section>
    <section>
      <h2>Technology health observations</h2>
      <ObservationRows items={items} />
    </section>
    {session.hipaaEnabled && <section>
      <h2>HIPAA security readiness discussion</h2>
      <p>{PROSPECT_THR_HIPAA_DISCLAIMER}</p>
      <ObservationRows items={hipaa} />
    </section>}
    <section>
      <h2>Items for further evaluation</h2>
      {focus.length ? <ul>{focus.map((item) => <li key={item.id}><strong>{item.category}:</strong> {item.answer}. {item.verification}</li>)}</ul> :
        <p>No specific concerns were recorded. Any decision about technical health still requires verification of the reported environment.</p>}
    </section>
    <footer>
      <strong>Recommended next step: Onsite Technology Assessment</strong>
      <p>An optional complimentary onsite assessment allows a Technology Consultant to verify the equipment, protection, backups, infrastructure and any concerns highlighted above. It also provides the foundation for a tailored, formal proposal if requested.</p>
      <small>This report is yours to keep whether or not an onsite assessment is arranged. A preliminary A360 estimate is separate from this health report.</small>
    </footer>
  </article>;
}

function ThrPresentation({ initial, onClose }: { initial: ProspectThrSession; onClose: () => void }) {
  const [session, setSession] = useState(initial);
  const [index, setIndex] = useState(0);
  const [questionGroup, setQuestionGroup] = useState<"Everyday technology" | "Protection and planning">("Everyday technology");
  const [appointment, setAppointment] = useState<PlanningAppointment | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const d = session.discovery;
  const estimate = useMemo(() => preliminaryA360Estimate(d), [d]);
  const observations = useMemo(() => prospectThrObservations(session), [session]);
  const focus = useMemo(() => prospectThrOpenItems(session), [session]);
  const reportedProblems = observations.filter((item) => item.status === "reported-problem").length;
  const unresolved = focus.filter((item) => item.status === "needs-verification" || item.status === "not-discussed").length;
  const healthQuestions = THR_QUESTIONS.filter((question) => question.category === questionGroup);
  const isHealthcare = d.industry === "Dental" || d.industry === "Medical";

  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(session)); } catch { /* optional local draft */ }
  }, [session]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (document.querySelector("[data-planning-scheduler-open='true']")) return;
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" && event.target === document.body) setIndex((current) => Math.min(STAGES.length - 1, current + 1));
      if (event.key === "ArrowLeft" && event.target === document.body) setIndex((current) => Math.max(0, current - 1));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function patchDiscovery<K extends keyof A360ProspectDiscovery>(key: K, value: A360ProspectDiscovery[K]) {
    setSession((current) => ({ ...current, discovery: { ...current.discovery, [key]: value } }));
  }

  function togglePriority(priority: string) {
    patchDiscovery("priorities", d.priorities.includes(priority) ? d.priorities.filter((item) => item !== priority) : [...d.priorities, priority]);
  }

  function answer(area: "health" | "hipaa", id: string, value: ThrAnswer) {
    setSession((current) => ({
      ...current,
      [area]: { ...current[area], responses: { ...current[area].responses, [id]: value } },
    }));
  }

  function note(area: "health" | "hipaa", id: string, value: string) {
    setSession((current) => ({
      ...current,
      [area]: { ...current[area], notes: { ...current[area].notes, [id]: value } },
    }));
  }

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(prospectThrConsultantBrief(session, appointment));
      setCopyStatus("OTA briefing copied. Paste it into the associated GHL call summary or handoff record.");
    } catch {
      setCopyStatus("Clipboard unavailable. Use your browser's copy permission or select the briefing from the text box below.");
    }
  }

  const brief = prospectThrConsultantBrief(session, appointment);
  return <div className="presentation-overlay prospect-presentation prospect-thr-presentation" role="dialog" aria-modal="true" aria-label="Prospect Technology Health Review">
    <div className="presentation-shell">
      <header className="presentation-topbar">
        <div className="presentation-brand"><img src="/advantage-mark.png" alt="" /><img className="presentation-wordmark" src="/advantage-wordmark-no-a.png" alt="Advantage Technologies" /></div>
        <nav className="presentation-progress-nav thr-stage-nav" aria-label="Review sections" style={{ "--presentation-progress": String(index / (STAGES.length - 1) * 100) + "%" } as CSSProperties}>
          {STAGES.map((stage, i) => <button type="button" key={stage} className={i === index ? "active" : i < index ? "complete" : "upcoming"} onClick={() => setIndex(i)}>{stage}</button>)}
        </nav>
        <button className="presentation-close" type="button" onClick={onClose}>Close</button>
      </header>

      <main className="presentation-stage thr-stage">
        <div className="prospect-slide thr-slide">
          {index === 0 && <section className="thr-welcome">
            <span className="prospect-kicker">Prepared for {d.organizationName}</span>
            <h1>Technology<br />Health Review</h1>
            <p className="prospect-intro">A practical conversation about what is working, what concerns you, and what deserves a closer look. No downloads, passwords or scanners required.</p>
            <label className="thr-context-label">What prompted today's conversation? (optional)
              <textarea rows={3} value={session.conversationContext} onChange={(event) => setSession((current) => ({ ...current, conversationContext: event.target.value }))} placeholder="The priorities, frustrations, plans or context the prospect shared..." />
            </label>
            <p className="thr-quiet">We'll build a report to keep, whether or not you decide to take the next step.</p>
          </section>}

          {index === 1 && <section>
            <span className="prospect-kicker">Start with what matters to you</span>
            <h2>What would you most like technology to do better?</h2>
            <p className="prospect-intro">Select the priorities that came up. The first choice becomes the lead topic later in the Advantage 360 conversation.</p>
            <div className="prospect-choice-grid">{A360_PRIORITY_OPTIONS.map((priority) => <button type="button" key={priority} className={d.priorities.includes(priority) ? "selected" : ""} onClick={() => togglePriority(priority)}>{d.priorities.includes(priority) && <b>{d.priorities.indexOf(priority) + 1}</b>}{priority}</button>)}</div>
          </section>}

          {index === 2 && <section className="thr-environment-section">
            <span className="prospect-kicker">A quick starting picture</span>
            <h2>Tell me a little about your setup.</h2>
            <p className="prospect-intro">Rough estimates are fine. A Technology Consultant can verify models, operating systems, protection and hardware age during the onsite assessment.</p>
            <div className="prospect-input-cards">
              <article><span>About how many computers?</span><ThrStepNumber value={d.workstations} onChange={(value) => patchDiscovery("workstations", value)} /></article>
              <article><span>Do you have an onsite server?</span><div className="prospect-segmented">{(["yes", "no", "not-sure"] as ServerAnswer[]).map((value) => <button type="button" key={value} className={d.server === value ? "active" : ""} onClick={() => patchDiscovery("server", value)}>{value === "not-sure" ? "Not sure" : value === "yes" ? "Yes" : "No"}</button>)}</div></article>
              <article><span>How many locations?</span><ThrStepNumber value={d.locations} onChange={(value) => patchDiscovery("locations", Math.max(1, value))} /></article>
            </div>
            <div className="thr-software-fields">
              <label>Practice / business software<input value={d.managementSoftware} onChange={(event) => patchDiscovery("managementSoftware", event.target.value)} placeholder="Dentrix, Open Dental, EHR, accounting, etc." /></label>
              {d.industry === "Dental" && <label>Imaging software<input value={d.imagingSoftware} onChange={(event) => patchDiscovery("imagingSoftware", event.target.value)} placeholder="DEXIS, Carestream, etc. or not sure" /></label>}
              <label>Other important software<input value={d.otherSoftware} onChange={(event) => patchDiscovery("otherSoftware", event.target.value)} placeholder="Only if relevant" /></label>
            </div>
          </section>}

          {index === 3 && <section className="thr-question-section">
            <span className="prospect-kicker">Conversational health review</span>
            <h2>What do you know today?</h2>
            <p className="prospect-intro">Tap an answer, or choose Not sure. These are reported observations, not technical findings.</p>
            <div className="thr-question-tabs">
              {(["Everyday technology", "Protection and planning"] as const).map((group) => <button key={group} type="button" className={questionGroup === group ? "active" : ""} onClick={() => setQuestionGroup(group)}>{group} <small>{THR_QUESTIONS.filter((q) => q.category === group && !!session.health.responses[q.id]).length}/4 answered</small></button>)}
            </div>
            <div className="thr-question-grid">
              {healthQuestions.map((question) => <AnswerCard key={question.id} question={question} current={session.health.responses[question.id]} note={session.health.notes[question.id] || ""} onAnswer={(value) => answer("health", question.id, value)} onNote={(value) => note("health", question.id, value)} />)}
            </div>
          </section>}

          {index === 4 && <section className="thr-question-section">
            <span className="prospect-kicker">For applicable healthcare practices</span>
            <h2>HIPAA technical readiness</h2>
            <p className="prospect-intro">Five quick discussion starters, not an audit. Unanswered questions can be carried into the report.</p>
            <label className="thr-include-hipaa"><input type="checkbox" checked={session.hipaaEnabled} onChange={(event) => setSession((current) => ({ ...current, hipaaEnabled: event.target.checked }))} /> Include HIPAA readiness discussion</label>
            {session.hipaaEnabled ? <>
              {!isHealthcare && <p className="thr-quiet">This module is optional for your selected industry.</p>}
              <div className="thr-question-grid">{THR_HIPAA_QUESTIONS.map((question) => <AnswerCard key={question.id} question={question} current={session.hipaa.responses[question.id]} note={session.hipaa.notes[question.id] || ""} onAnswer={(value) => answer("hipaa", question.id, value)} onNote={(value) => note("hipaa", question.id, value)} />)}</div>
              <p className="thr-quiet">{PROSPECT_THR_HIPAA_DISCLAIMER}</p>
            </> : <div className="thr-no-hipaa">HIPAA questions skipped. The Technology Health Report will focus on the other technology topics.</div>}
          </section>}

          {index === 5 && <section className="thr-snapshot-section">
            <span className="prospect-kicker">Based on our conversation</span>
            <h2>Your technology health snapshot.</h2>
            <p className="prospect-intro">This is a starting picture. Nothing here claims we have scanned your systems or verified a vulnerability.</p>
            <div className="thr-snapshot-metrics"><article><strong>{observations.filter((o) => o.status === "reported-positive").length}</strong><span>Reported positives</span></article><article><strong>{reportedProblems}</strong><span>Reported problems</span></article><article><strong>{unresolved}</strong><span>Unverified / not discussed</span></article></div>
            <ObservationRows items={observations} />
          </section>}

          {index === 6 && <section className="thr-report-section">
            <span className="prospect-kicker">Your report to keep</span>
            <h2>Technology Health Report</h2>
            <p className="prospect-intro">This document summarizes the conversation, areas needing verification and a practical next step. It belongs to the prospect, even if they don't schedule an OTA.</p>
            <div className="thr-report-actions"><button type="button" className="thr-primary" onClick={() => window.print()}>Print / Save as PDF</button><span>In the browser print dialog, select Save as PDF to deliver the report.</span></div>
            <div className="thr-report-preview"><ReviewReport session={session} /></div>
          </section>}

          {index === 7 && <section>
            <span className="prospect-kicker">How Advantage Technologies helps</span>
            <h2>Advantage 360, built around your priorities.</h2>
            <p className="prospect-intro">{priorityStory(d.priorities[0] || "Better support", d.organizationLanguage).body}</p>
            <div className="thr-pillars">{ADVANTAGE_360_PILLARS.map((pillar) => <article key={pillar.key}><span>{pillar.title}</span><strong>{pillar.backTitle}</strong><p>{pillar.detail}</p></article>)}</div>
            <p className="thr-quiet">This is a discussion of how Advantage works, not a claim that any particular protection is currently present in the prospect's environment.</p>
          </section>}

          {index === 8 && <section className="prospect-estimate-slide">
            <span className="prospect-kicker">Separate from your health report</span>
            <h2>{estimate.low === estimate.high ? formatMoney(estimate.low) : formatMoney(estimate.low) + "–" + formatMoney(estimate.high)}<small> / month</small></h2>
            <p>Preliminary Advantage 360 estimate based on reported workstations, locations and whether a server may be present.</p>
            <div className="prospect-assumptions">{estimate.assumptions.map((assumption) => <span key={assumption}>{assumption}</span>)}</div>
            <aside><strong>Why this is not a proposal</strong><p>We have not inspected the environment. A Technology Consultant will confirm device counts, technical dependencies, backups and onboarding needs before a formal quote is prepared. The Technology Health Report remains available whether you proceed or not.</p></aside>
          </section>}

          {index === 9 && <section className="thr-ota-section">
            <span className="prospect-kicker">A natural next step</span>
            <h2>Let's verify the details onsite.</h2>
            <p className="prospect-intro">The complimentary Onsite Technology Assessment lets a Technology Consultant investigate the items identified during the conversation and prepare reliable recommendations.</p>
            <div className="thr-ota-actions"><ProspectA360Scheduler appointment={appointment} onConfirm={setAppointment} /><button type="button" className="thr-secondary" onClick={copyBrief}>Copy OTA / TC briefing</button></div>
            <p className="thr-quiet">The date entered here is an agreed planning record, not a verified calendar reservation. Confirm the consultant's Outlook availability and use the existing GHL/ConnectWise process to dispatch the assessment. This screen does not send an invitation or ticket.</p>
            {appointment && <div className="thr-appointment"><strong>Recorded onsite plan</strong><span>{appointment.date} at {appointment.time} ({appointment.timeZone}), {appointment.consultantName}</span></div>}
            {copyStatus && <p className="thr-copy-status" role="status">{copyStatus}</p>}
            <details className="thr-brief-preview"><summary>View the consultant briefing</summary><textarea rows={12} readOnly value={brief} aria-label="Technology Consultant assessment briefing" /></details>
          </section>}
        </div>
      </main>
      <footer className="presentation-footer">
        <span>{index + 1} / {STAGES.length} · Conversation-based, not a technical audit</span>
        <div><button type="button" disabled={index === 0} onClick={() => setIndex((current) => Math.max(0, current - 1))}>Previous</button><button type="button" className="next" disabled={index === STAGES.length - 1} onClick={() => setIndex((current) => Math.min(STAGES.length - 1, current + 1))}>Next →</button></div>
      </footer>
    </div>
    <div className="prospect-thr-print-document"><ReviewReport session={session} /></div>
  </div>;
}

export function ProspectThrGlobal() {
  const [mounted, setMounted] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [draft, setDraft] = useState<ProspectThrSession>(initialSession);
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as ProspectThrSession;
      if (parsed?.discovery?.organizationName && parsed.health?.responses && parsed.hipaa?.responses) {
        setDraft(parsed);
        setHasDraft(true);
      }
    } catch { /* an invalid draft starts a fresh session */ }
  }, []);

  function start() {
    if (!draft.discovery.contactName.trim() || !draft.discovery.organizationName.trim()) return;
    setLaunching(false);
    setPresenting(true);
  }

  function startNew() {
    setDraft(initialSession());
    setHasDraft(false);
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* optional */ }
  }

  function patch<K extends keyof A360ProspectDiscovery>(key: K, value: A360ProspectDiscovery[K]) {
    setDraft((current) => ({
      ...current,
      discovery: { ...current.discovery, [key]: value },
      ...(key === "industry" ? { hipaaEnabled: value === "Dental" || value === "Medical" } : {}),
    }));
  }

  return <>
    <button className="global-quick-present-button prospect-thr-launch-button" type="button" onClick={() => setLaunching(true)} title="Start the prospect Technology Health Review"><span aria-hidden="true">✦</span><span>Prospect THR</span></button>
    {mounted && launching && createPortal(<div className="quick-present-backdrop prospect-launcher-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setLaunching(false); }}>
      <section className="quick-present-dialog prospect-launcher" role="dialog" aria-modal="true" aria-labelledby="thr-launcher-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span className="compass-kicker">First-time prospect</span><h2 id="thr-launcher-title">Technology Health Review</h2></div><button type="button" aria-label="Close" onClick={() => setLaunching(false)}>×</button></header>
        <div className="prospect-launcher-body">
          {hasDraft && <button type="button" className="thr-resume" onClick={startNew}>Start a new review instead of the saved draft</button>}
          <label><span>Contact name</span><input autoFocus value={draft.discovery.contactName} onChange={(event) => patch("contactName", event.target.value)} placeholder="Dr. Sarah Smith" /></label>
          <label><span>Business / practice name</span><input value={draft.discovery.organizationName} onChange={(event) => patch("organizationName", event.target.value)} placeholder="Smith Family Dental" /></label>
          <fieldset><legend>Industry</legend><div className="prospect-segmented">{(["Dental", "Medical", "Legal", "Accounting", "Other"] as ProspectIndustry[]).map((industry) => <button type="button" key={industry} className={draft.discovery.industry === industry ? "active" : ""} onClick={() => patch("industry", industry)}>{industry}</button>)}</div></fieldset>
          <fieldset><legend>Organization language</legend><div className="prospect-segmented">{(["practice", "firm", "business", "organization"] as OrganizationLanguage[]).map((term) => <button type="button" key={term} className={draft.discovery.organizationLanguage === term ? "active" : ""} onClick={() => patch("organizationLanguage", term)}>{term}</button>)}</div></fieldset>
          <button type="button" className="button primary full" disabled={!draft.discovery.contactName.trim() || !draft.discovery.organizationName.trim()} onClick={start}>{hasDraft ? "Continue review →" : "Start health review →"}</button>
          <small className="prospect-launcher-note">The review is temporarily saved in this browser tab. The client report can be printed or saved as PDF at the end. Nothing is sent automatically.</small>
        </div>
      </section>
    </div>, document.body)}
    {mounted && presenting && createPortal(<ThrPresentation initial={draft} onClose={() => { setPresenting(false); try { const stored = sessionStorage.getItem(DRAFT_KEY); if (stored) { setDraft(JSON.parse(stored) as ProspectThrSession); setHasDraft(true); } } catch { /* ignored */ } }} />, document.body)}
  </>;
}
