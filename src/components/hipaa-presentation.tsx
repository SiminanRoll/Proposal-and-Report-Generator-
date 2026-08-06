"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import type { HipaaAnswer, HipaaResponse, Project } from "@/lib/projects/types";
import {
  HIPAA_DISCLAIMER,
  answerIsComplete,
  answerRequirements,
  confirmHipaaAssessment,
  deferHipaaAnswer,
  deferRemainingHipaaAnswers,
  hipaaQuestionsForPresentation,
  hipaaTopGaps,
  reopenHipaaAnswer,
  scoreHipaaAssessment,
  withUpdatedHipaaAnswer,
} from "@/lib/hipaa/engine";
import { CheckIcon } from "./icons";
import { AnimatedNumber } from "./animated-number";
import { adaptOrganizationLanguage, organizationTerm } from "@/lib/projects/client-language";
import { hipaaConsultantGuidance } from "@/lib/hipaa/consultant-guidance";

const RESPONSES: Array<{ value: Exclude<HipaaResponse, "not-yet-assessed">; label: string }> = [
  { value: "yes", label: "Yes" },
  { value: "partially", label: "Somewhat" },
  { value: "no", label: "No" },
  { value: "not-applicable", label: "Does not apply" },
];

function ownerLabel(value: string): string {
  if (value === "advantage-prefill") return "Advantage technical review";
  if (value === "joint") return "Joint review";
  return "Client confirmation";
}

function draftFrom(answer: HipaaAnswer): HipaaAnswer {
  return { ...answer, deferred: false, deferredAt: "", deferredReason: "" };
}

export function HipaaReviewAndResultsPresentation({ project, onUpdate }: { project: Project; onUpdate: (project: Project) => void }) {
  const openQuestionCount = hipaaQuestionsForPresentation(project).length;
  const [view, setView] = useState<"questions" | "review">(() => openQuestionCount > 0 ? "questions" : "review");

  useEffect(() => {
    if (view === "questions" && openQuestionCount === 0) setView("review");
  }, [openQuestionCount, view]);

  return <div className="hipaa-combined-presentation" data-presentation-interactive="true">
    <div className="hipaa-combined-switch" role="tablist" aria-label="HIPAA review view">
      <button type="button" role="tab" aria-selected={view === "questions"} className={view === "questions" ? "active" : ""} disabled={openQuestionCount === 0} onClick={() => setView("questions")}>
        <span>Questions</span><small>{openQuestionCount > 0 ? `${openQuestionCount} remaining` : "Complete"}</small>
      </button>
      <button type="button" role="tab" aria-selected={view === "review"} className={view === "review" ? "active" : ""} onClick={() => setView("review")}>
        <span>Review</span><small>Readiness results</small>
      </button>
    </div>
    <div className={`hipaa-combined-panel view-${view}`}>
      {view === "questions"
        ? <HipaaReviewPresentation project={project} onUpdate={onUpdate} onComplete={() => setView("review")} />
        : <HipaaResultsPresentation project={project} onUpdate={onUpdate} onReturnToQuestions={() => setView("questions")} />}
    </div>
  </div>;
}

export function HipaaReviewPresentation({ project, onUpdate, onComplete }: { project: Project; onUpdate: (project: Project) => void; onComplete: () => void }) {
  const queue = useMemo(() => hipaaQuestionsForPresentation(project), [project]);
  const current = queue[0];
  const [draft, setDraft] = useState<HipaaAnswer | null>(current ? draftFrom(current.answer) : null);
  const [showSkipAll, setShowSkipAll] = useState(false);

  useEffect(() => {
    setDraft(current ? draftFrom(current.answer) : null);
  }, [current?.question.id]);

  if (!current || !draft) {
    const skipped = project.hipaa.answers.filter((answer) => answer.deferred).length;
    const answered = project.hipaa.answers.filter(answerIsComplete).length;
    const complete = skipped === 0 && answered === project.hipaa.answers.length;
    return <div className={`hipaa-presentation-complete ${complete ? "complete" : "incomplete"}`}><span className="hipaa-presentation-check">{complete ? <CheckIcon /> : "!"}</span><h2>{complete ? "The HIPAA readiness check is complete." : "The live review is finished, but some questions remain open."}</h2><p>{complete ? `All ${answered} readiness questions were answered and are ready for the results summary.` : `${answered} questions were answered and ${skipped} were skipped for now. The skipped questions will be included in the client PDF so the ${organizationTerm(project)} can complete and return them for an updated score.`}</p><button className="presentation-primary-action" type="button" onClick={onComplete}>View HIPAA review</button></div>;
  }

  const issues = answerRequirements(draft);
  const canContinue = draft.response !== "not-yet-assessed";
  const deferredCount = project.hipaa.answers.filter((answer) => answer.deferred).length;
  const prefilledOrAnswered = project.hipaa.answers.length - queue.length - deferredCount;

  function chooseResponse(response: Exclude<HipaaResponse, "not-yet-assessed">) {
    setDraft((value) => value ? {
      ...value,
      response,
      evidenceSource: value.evidenceSource === "Not yet verified" ? (current.question.ownership === "client" ? "Client verbal confirmation" : "Joint review") : value.evidenceSource,
      riskSeverity: response === "no" ? "high" : response === "partially" ? "moderate" : "none",
    } : value);
  }

  function saveAndContinue() {
    if (!canContinue || !draft) return;
    onUpdate(withUpdatedHipaaAnswer(project, current.question.id, draft));
  }

  function skipCurrent() {
    onUpdate(deferHipaaAnswer(project, current.question.id));
  }

  return <div className="hipaa-live-review">
    <div className="hipaa-live-heading">
      <div><span className="presentation-kicker">HIPAA Security Readiness · Live review</span><h2>Finish only the questions that remain open.</h2><p>Choose the best answer. Notes are optional and can be added only when context will help the follow-up.</p></div>
      <div className="hipaa-live-progress"><strong><AnimatedNumber value={queue.length} delay={180} /></strong><span>remaining</span><small><AnimatedNumber value={prefilledOrAnswered} delay={300} /> already completed · <AnimatedNumber value={deferredCount} delay={380} /> skipped</small></div>
    </div>

    <article className="hipaa-live-question">
      <div className="hipaa-live-question-meta"><span>{current.question.id}</span><span>{current.question.category}</span><span>{ownerLabel(current.question.ownership)}</span></div>
      <h3>{current.question.title}</h3>
      <p className="hipaa-live-question-text">{adaptOrganizationLanguage(current.question.question, project)}</p>
      <p className="hipaa-live-explanation">{adaptOrganizationLanguage(current.question.plainLanguageExplanation, project)}</p>
      {(current.question.reviewPrompts.length > 0 || current.question.clientConfirms.length > 0) && <div className="hipaa-live-prompts">{[...current.question.reviewPrompts, ...current.question.clientConfirms].slice(0, 5).map((item) => <span key={item}>{adaptOrganizationLanguage(item, project)}</span>)}</div>}

      <div className="hipaa-live-responses">{RESPONSES.map((item) => <button key={item.value} type="button" className={draft.response === item.value ? `active response-${item.value}` : ""} onClick={() => chooseResponse(item.value)}>{item.label}</button>)}</div>

      {draft.response !== "not-yet-assessed" && <div className="hipaa-live-fields">
        <label><span>Optional note</span><textarea rows={2} value={draft.internalNotes} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDraft({ ...draft, internalNotes: event.target.value })} placeholder="Add context only when it will help the review." /></label>
        {(draft.response === "partially" || draft.response === "no") && <label><span>Optional next step</span><textarea rows={2} value={draft.recommendedAction} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDraft({ ...draft, recommendedAction: event.target.value })} placeholder="This can also be completed later during planning." /></label>}
      </div>}
      {issues.length > 0 && draft.response !== "not-yet-assessed" && <div className="hipaa-live-issues">{issues.map((issue) => <span key={issue}>{issue}</span>)}</div>}
      <div className="hipaa-live-actions"><button className="presentation-skip-action" type="button" onClick={skipCurrent}>Skip for now</button><button className="presentation-primary-action" type="button" disabled={!canContinue} onClick={saveAndContinue}>Save answer and continue</button></div>
    </article>

    <button className="hipaa-skip-all-link" type="button" onClick={() => setShowSkipAll(true)}>Skip all {queue.length} remaining questions for now</button>
    {showSkipAll && <div className="hipaa-skip-confirm" role="alertdialog" aria-modal="true"><div><span className="presentation-kicker">Incomplete assessment</span><h3>Skip {queue.length} remaining question{queue.length === 1 ? "" : "s"}?</h3><p>They will remain marked Not sure, lower the displayed HIPAA readiness score, and remain visible for follow-up.</p><div><button type="button" onClick={() => setShowSkipAll(false)}>Keep reviewing</button><button className="danger" type="button" onClick={() => { onUpdate(deferRemainingHipaaAnswers(project)); setShowSkipAll(false); onComplete(); }}>Skip all remaining</button></div></div></div>}
  </div>;
}

export function HipaaResultsPresentation({ project, onUpdate, onReturnToQuestions }: { project: Project; onUpdate: (project: Project) => void; onReturnToQuestions: () => void }) {
  const score = useMemo(() => scoreHipaaAssessment(project.hipaa), [project.hipaa]);
  const gaps = useMemo(() => hipaaTopGaps(project, 6), [project]);
  const deferred = project.hipaa.answers.filter((answer) => answer.deferred);
  const unresolved = hipaaQuestionsForPresentation(project);
  const [confirmer, setConfirmer] = useState(project.hipaa.clientConfirmation.confirmer);
  const [accepted, setAccepted] = useState(project.hipaa.clientConfirmation.acceptedResponsibility);
  const [error, setError] = useState("");
  const responseTotal = Math.max(1, Object.values(score.counts).reduce((sum, value) => sum + value, 0));
  const consultantGuidance = hipaaConsultantGuidance(project);
  const responseSegments = [
    { key: "yes", label: "Yes", count: score.counts.yes },
    { key: "partially", label: "Somewhat", count: score.counts.partially },
    { key: "no", label: "No", count: score.counts.no },
    { key: "not-applicable", label: "N/A", count: score.counts["not-applicable"] },
    { key: "not-yet-assessed", label: "Skipped / unanswered", count: score.counts["not-yet-assessed"] },
  ];

  function finalize() {
    try {
      setError("");
      const prepared = { ...project, hipaa: { ...project.hipaa, clientConfirmation: { ...project.hipaa.clientConfirmation, acceptedResponsibility: accepted } } };
      onUpdate(confirmHipaaAssessment(prepared, confirmer));
    } catch (value) {
      setError(value instanceof Error ? value.message : "The assessment could not be finalized.");
    }
  }

  return <div className="hipaa-results-presentation" aria-label="HIPAA readiness review">
    <div className="hipaa-results-heading"><div><span className="presentation-kicker">HIPAA Security Readiness · Review</span><h2>{score.label}</h2><p>Your current score is based on the information available today. Unanswered questions remain visible and will be included in the client PDF.</p></div><div className={`hipaa-results-score ${score.notYetAssessedCount ? "incomplete" : ""}`} style={{ "--hipaa-score": score.overall } as CSSProperties}><strong><AnimatedNumber value={score.overall} delay={180} duration={1050} suffix="%" /></strong><span>displayed readiness</span></div></div>

    {score.notYetAssessedCount > 0 && <div className="hipaa-incomplete-banner"><strong>{score.notYetAssessedCount} question{score.notYetAssessedCount === 1 ? " remains" : "s remain"} unanswered or marked Not sure</strong><p>Skipped questions remain marked Not sure until they are completed. The questions answered so far score {score.confirmedReadiness}%, but only {score.completionPercentage}% of applicable questions were assessed. Complete the missing questions in the PDF and email the completed document to your Technology Consultant, or Patric.Beckman@adv-tech.com. Once reviewed, Advantage will update the assessment and provide a revised score. Completing the missing information may improve the displayed result.</p></div>}

    <div className="hipaa-results-metrics"><article><strong><AnimatedNumber value={score.assessedQuestionCount} delay={300} /></strong><span>Questions answered</span></article><article><strong><AnimatedNumber value={score.completionPercentage} delay={370} suffix="%" /></strong><span>Assessment completion</span></article><article><strong><AnimatedNumber value={score.notYetAssessedCount} delay={440} /></strong><span>Skipped / unanswered</span></article><article><strong><AnimatedNumber value={score.counts.no + score.counts.partially} delay={510} /></strong><span>Follow-up answers</span></article></div>

    <div className="hipaa-answer-visual"><div className="hipaa-answer-bar">{responseSegments.map((item) => <span key={item.key} className={item.key} style={{ width: `${(item.count / responseTotal) * 100}%` }} title={`${item.label}: ${item.count}`} />)}</div><div className="hipaa-answer-legend">{responseSegments.map((item) => <span key={item.key} className={item.key}><i /> <b><AnimatedNumber value={item.count} delay={520} /></b> {item.label}</span>)}</div></div>

    <div className="hipaa-results-categories">{Object.entries(score.categories).map(([category, value]) => <article key={category}><div><strong><AnimatedNumber value={value} delay={560} suffix="%" /></strong><small><AnimatedNumber value={score.categoryCompletion[category as keyof typeof score.categoryCompletion]} delay={640} suffix="%" /> assessed</small></div><span>{category}</span><div className="hipaa-category-meter"><i style={{ width: `${value}%` }} /></div></article>)}</div>

    <div className={`hipaa-consultant-guidance ${consultantGuidance.tone}`}><div><span className="presentation-kicker">Ongoing HIPAA guidance</span><strong>{consultantGuidance.title}</strong></div><p>{consultantGuidance.copy}</p></div>

    <div className="hipaa-results-lower">
      <section><span className="presentation-kicker">Priority follow-up</span>{gaps.length ? gaps.map(({ question, answer }) => <article className={`hipaa-result-gap response-${answer.response}`} key={question.id}><div><strong>{question.title}</strong><span>{answer.response === "not-yet-assessed" ? "Not sure" : answer.response === "partially" ? "Somewhat" : answer.response === "not-applicable" ? "Does not apply" : answer.response}</span></div><p>{answer.clientVisibleObservation || answer.recommendedAction || (answer.deferred ? "This item was skipped and must be revisited." : question.plainLanguageExplanation)}</p>{answer.deferred && <button type="button" onClick={() => { onUpdate(reopenHipaaAnswer(project, question.id)); onReturnToQuestions(); }}>Revisit now</button>}</article>) : <div className="hipaa-no-gaps"><CheckIcon /><span>No open gaps were identified in the completed responses.</span></div>}</section>
      <section className="hipaa-finalize-panel"><span className="presentation-kicker">Client confirmation</span><h3>Save this readiness snapshot</h3><p>Confirmation documents the review. It does not certify HIPAA compliance.</p><label><span>Name and title</span><input value={confirmer} onChange={(event: ChangeEvent<HTMLInputElement>) => setConfirmer(event.target.value)} placeholder="Client confirmer" /></label><label className="hipaa-live-checkbox"><input type="checkbox" checked={accepted} onChange={(event: ChangeEvent<HTMLInputElement>) => setAccepted(event.target.checked)} /> The client reviewed the assessment and accepts responsibility for client-provided information.</label><button className="presentation-primary-action" type="button" disabled={!accepted || unresolved.length > 0} onClick={finalize}>{project.hipaa.clientConfirmation.status === "confirmed" ? "Save another snapshot" : "Confirm and save snapshot"}</button>{unresolved.length > 0 && <small>{unresolved.length} question{unresolved.length === 1 ? " must" : "s must"} be answered or skipped before confirmation.</small>}{error && <span className="hipaa-live-error">{error}</span>}{project.hipaa.clientConfirmation.status === "confirmed" && <span className="hipaa-live-confirmed"><CheckIcon /> Confirmed by {project.hipaa.clientConfirmation.confirmer}</span>}</section>
    </div>
    {deferred.length > 0 && <div className="hipaa-deferred-list"><strong>Skipped for later — included in the client PDF</strong><span>{deferred.map((answer) => answer.questionId).join(" · ")}</span></div>}
    <div className="hipaa-results-disclaimer">{HIPAA_DISCLAIMER}</div>
  </div>;
}
