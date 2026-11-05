"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ADVANTAGE_360_PILLARS } from "@/lib/advantage-360-pillars";
import { formatPlanningAppointment } from "@/lib/outcomes/planning-appointment";
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
import { GuidedThrQuestion, GuidedThrEnvironment, environmentSteps } from "./prospect-thr-guided-question";
import { ProspectThrSnapshot, ProspectThrReportPreview, ProspectThrReport } from "./prospect-thr-report";

const DRAFT_KEY = "client-compass-prospect-thr-draft-v1";
const STAGES = ["Welcome", "Priorities", "Environment", "Health", "HIPAA", "Snapshot", "Report", "A360", "Estimate", "Onsite visit"] as const;

function emptyAnswers(): ProspectThrAnswers {
  return { responses: {}, notes: {} };
}

function initialSession(): ProspectThrSession {
  return {
    discovery: emptyA360Prospect(),
    appointment: null,
    conversationContext: "",
    health: emptyAnswers(),
    hipaaEnabled: true,
    hipaa: emptyAnswers(),
  };
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function ThrPresentation({ initial, onClose }: { initial: ProspectThrSession; onClose: () => void }) {
  const [session, setSession] = useState(initial);
  const [index, setIndex] = useState(0);
  const [environmentQuestion, setEnvironmentQuestion] = useState(0);
  const [healthQuestion, setHealthQuestion] = useState(0);
  const [hipaaQuestion, setHipaaQuestion] = useState(0);
  const [questionLeaving, setQuestionLeaving] = useState(false);
  const questionTimer = useRef<number | null>(null);
  const appointment = session.appointment ?? null;
  const confirmAppointment = (value: PlanningAppointment) => setSession((current) => ({ ...current, appointment: value }));
  const [copyStatus, setCopyStatus] = useState("");
  const d = session.discovery;
  const estimate = useMemo(() => preliminaryA360Estimate(d), [d]);
  const environmentCount = environmentSteps(d).length;

  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(session)); } catch { /* optional local draft */ }
  }, [session]);

  useEffect(() => {
    return () => {
      if (questionTimer.current !== null) window.clearTimeout(questionTimer.current);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (document.querySelector("[data-planning-scheduler-open='true']")) return;
      if (event.key === "Escape") { onClose(); return; }
      if (event.target !== document.body) return;
      if (event.key === "ArrowRight") { event.preventDefault(); advanceStep(); }
      if (event.key === "ArrowLeft") { event.preventDefault(); previousStep(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, index, environmentQuestion, healthQuestion, hipaaQuestion, session.hipaaEnabled, environmentCount]);

  function clearTransition() {
    if (questionTimer.current !== null) {
      window.clearTimeout(questionTimer.current);
      questionTimer.current = null;
    }
    setQuestionLeaving(false);
  }

  function jumpToStage(stage: number) {
    clearTransition();
    setIndex(stage);
    if (stage === 2) setEnvironmentQuestion(0);
    if (stage === 3) setHealthQuestion(0);
    if (stage === 4) setHipaaQuestion(0);
  }

  function advanceStep() {
    clearTransition();
    if (index === 2) {
      if (environmentQuestion < environmentCount - 1) setEnvironmentQuestion((current) => current + 1);
      else { setIndex(3); setHealthQuestion(0); }
    } else if (index === 3) {
      if (healthQuestion < THR_QUESTIONS.length - 1) setHealthQuestion((current) => current + 1);
      else if (session.hipaaEnabled) { setIndex(4); setHipaaQuestion(0); }
      else setIndex(5);
    } else if (index === 4) {
      if (session.hipaaEnabled && hipaaQuestion < THR_HIPAA_QUESTIONS.length - 1) setHipaaQuestion((current) => current + 1);
      else setIndex(5);
    } else {
      setIndex((current) => Math.min(STAGES.length - 1, current + 1));
    }
  }

  function previousStep() {
    clearTransition();
    if (index === 2 && environmentQuestion > 0) setEnvironmentQuestion((current) => current - 1);
    else if (index === 3 && healthQuestion > 0) setHealthQuestion((current) => current - 1);
    else if (index === 3) { setIndex(2); setEnvironmentQuestion(environmentCount - 1); }
    else if (index === 4 && session.hipaaEnabled && hipaaQuestion > 0) setHipaaQuestion((current) => current - 1);
    else if (index === 4) { setIndex(3); setHealthQuestion(THR_QUESTIONS.length - 1); }
    else if (index === 5 && !session.hipaaEnabled) { setIndex(3); setHealthQuestion(THR_QUESTIONS.length - 1); }
    else if (index === 5 && session.hipaaEnabled) { setIndex(4); setHipaaQuestion(THR_HIPAA_QUESTIONS.length - 1); }
    else setIndex((current) => Math.max(0, current - 1));
  }

  function animatedAdvance() {
    if (questionTimer.current !== null) return;
    setQuestionLeaving(true);
    questionTimer.current = window.setTimeout(() => {
      questionTimer.current = null;
      advanceStep();
    }, 280);
  }


  function patchDiscovery<K extends keyof A360ProspectDiscovery>(key: K, value: A360ProspectDiscovery[K]) {
    setSession((current) => ({ ...current, discovery: { ...current.discovery, [key]: value } }));
  }

  function togglePriority(priority: string) {
    patchDiscovery("priorities", d.priorities.includes(priority) ? d.priorities.filter((item) => item !== priority) : [...d.priorities, priority]);
  }

  function answer(area: "health" | "hipaa", id: string, value: ThrAnswer, autoAdvance: boolean) {
    if (questionTimer.current !== null) return;
    setSession((current) => ({
      ...current,
      [area]: { ...current[area], responses: { ...current[area].responses, [id]: value } },
    }));
    if (autoAdvance) animatedAdvance();
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
          {STAGES.map((stage, i) => <button type="button" key={stage} className={i === index ? "active" : i < index ? "complete" : "upcoming"} onClick={() => jumpToStage(i)}>{stage}</button>)}
        </nav>
        <button className="presentation-close" type="button" onClick={onClose}>Close</button>
      </header>

      <main className="presentation-stage thr-stage">
        <div className="prospect-slide thr-slide">
          {index === 0 && <section className="thr-welcome">
            <div className="thr-hero-glow" aria-hidden="true"><span/><span/><span/></div>
            <div className="thr-welcome-content">
              <span className="prospect-kicker">Prepared for {d.organizationName}</span>
              <h1>Technology<br />Health Review</h1>
              <p className="thr-hero-subtitle">Let’s take a simple look at how your technology is doing today.</p>
              <button type="button" className="thr-start-review" onClick={() => jumpToStage(1)}>Start the review <span aria-hidden="true">→</span></button>
            </div>
          </section>}

          {index === 1 && <section>
            <span className="prospect-kicker">Start with what matters to you</span>
            <h2>What are your top technology priorities?</h2>
            
            <div className="prospect-choice-grid">{A360_PRIORITY_OPTIONS.map((priority) => <button type="button" key={priority} className={d.priorities.includes(priority) ? "selected" : ""} onClick={() => togglePriority(priority)}>{d.priorities.includes(priority) && <b>{d.priorities.indexOf(priority) + 1}</b>}{priority}</button>)}</div>
          </section>}

          {index === 2 && <GuidedThrEnvironment
            key={"environment-" + environmentQuestion}
            discovery={d} position={environmentQuestion + 1} total={environmentCount} leaving={questionLeaving}
            onPatch={patchDiscovery} onContinue={animatedAdvance}
          />}

          {index === 3 && <GuidedThrQuestion
            key={"health-" + healthQuestion}
            question={THR_QUESTIONS[healthQuestion]} position={healthQuestion + 1} total={THR_QUESTIONS.length}
            current={session.health.responses[THR_QUESTIONS[healthQuestion].id]}
            note={session.health.notes[THR_QUESTIONS[healthQuestion].id] || ""}
            leaving={questionLeaving}
            onAnswer={(value, autoAdvance) => answer("health", THR_QUESTIONS[healthQuestion].id, value, autoAdvance)}
            onNote={(value) => note("health", THR_QUESTIONS[healthQuestion].id, value)}
            onContinue={animatedAdvance}
          />}

          {index === 4 && (session.hipaaEnabled ? <div className="thr-hipaa-guided">
            <GuidedThrQuestion
              key={"hipaa-" + hipaaQuestion}
              question={THR_HIPAA_QUESTIONS[hipaaQuestion]} position={hipaaQuestion + 1} total={THR_HIPAA_QUESTIONS.length}
              current={session.hipaa.responses[THR_HIPAA_QUESTIONS[hipaaQuestion].id]}
              note={session.hipaa.notes[THR_HIPAA_QUESTIONS[hipaaQuestion].id] || ""}
              leaving={questionLeaving}
              onAnswer={(value, autoAdvance) => answer("hipaa", THR_HIPAA_QUESTIONS[hipaaQuestion].id, value, autoAdvance)}
              onNote={(value) => note("hipaa", THR_HIPAA_QUESTIONS[hipaaQuestion].id, value)}
              onContinue={animatedAdvance}
            />
            <button className="thr-hipaa-skip" type="button" onClick={() => { clearTransition(); setSession((current) => ({ ...current, hipaaEnabled: false })); setIndex(5); }}>Skip HIPAA questions</button>
          </div> : <section className="thr-no-hipaa-slide">
            <span className="prospect-kicker">Optional review</span>
            <h2>HIPAA readiness</h2>
            <button type="button" className="thr-start-review" onClick={() => { setSession((current) => ({ ...current, hipaaEnabled: true })); setHipaaQuestion(0); }}>Include HIPAA questions →</button>
            <button type="button" className="thr-note-toggle" onClick={() => setIndex(5)}>Continue without HIPAA</button>
          </section>)}


          {index === 5 && <section className="thr-snapshot-stage">
            <ProspectThrSnapshot session={session} />
            <details className="thr-report-context">
              <summary>Add a brief note to the report (optional)</summary>
              <label>Conversation context
                <textarea rows={3} value={session.conversationContext} onChange={(event) => setSession((current) => ({ ...current, conversationContext: event.target.value }))} placeholder="Anything important from your conversation..." />
              </label>
            </details>
          </section>}

          {index === 6 && <section className="thr-report-section">
            <ProspectThrReportPreview session={session} />
            <div className="thr-report-action-band">
              <div><span className="prospect-kicker">Next, let's confirm the details</span><p>We can choose a time for a complimentary onsite technology assessment before we finish.</p></div>
              <ProspectA360Scheduler appointment={appointment} onConfirm={confirmAppointment} requireAvailabilityCheck />
              <button type="button" className="thr-secondary" onClick={() => window.print()}>Save your report as PDF</button>
            </div>
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
            <span className="prospect-kicker">Your next step</span>
            <h2>Let's see your technology firsthand.</h2>
            <p className="prospect-intro">The next step is a complimentary onsite technology assessment. A Technology Consultant will see your environment firsthand, verify the questions we discussed and help us prepare an accurate plan. We can choose a date and time together before we finish.</p>
            <div className="thr-ota-actions"><ProspectA360Scheduler appointment={appointment} onConfirm={confirmAppointment} requireAvailabilityCheck /></div>
            {appointment && <div className="thr-appointment"><span className="prospect-kicker">Date and time agreed</span><strong>{formatPlanningAppointment(appointment)}</strong><span>With {appointment.consultantName}</span><small>Your Advantage contact will coordinate the formal appointment invitation.</small></div>}
            <details className="thr-presenter-help"><summary>Presenter details and consultant handoff</summary><p>Confirm consultant availability in Outlook before choosing the date. This screen records the agreed appointment and adds it to the report, but does not create a calendar invitation or send a ConnectWise ticket.</p><button type="button" className="thr-secondary" onClick={copyBrief}>Copy consultant assessment briefing</button>{copyStatus && <p className="thr-copy-status" role="status">{copyStatus}</p>}<textarea rows={10} readOnly value={brief} aria-label="Technology Consultant assessment briefing" /></details>
          </section>}
        </div>
      </main>
      <footer className="presentation-footer">
        <span>{index + 1} / {STAGES.length} · Technology Health Review</span>
        <div>
          <button type="button" disabled={index === 0} onClick={previousStep}>Previous</button>
          <button type="button" className="next" disabled={index === STAGES.length - 1} onClick={() => [2, 3, 4].includes(index) ? animatedAdvance() : advanceStep()}>
            {[2, 3, 4].includes(index) ? "Next question →" : "Next →"}
          </button>
        </div>
      </footer>
    </div>
    <div className="prospect-thr-print-document"><ProspectThrReport session={session} appointment={appointment} /></div>
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
