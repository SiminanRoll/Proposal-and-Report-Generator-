"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type { HipaaAnswer, HipaaResponse, Project } from "@/lib/projects/types";
import {
  HIPAA_DISCLAIMER,
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

const RESPONSES: Array<{ value: Exclude<HipaaResponse, "not-yet-assessed">; label: string }> = [
  { value: "yes", label: "Yes" },
  { value: "partially", label: "Partially" },
  { value: "no", label: "No" },
  { value: "not-applicable", label: "Not Applicable" },
];

function ownerLabel(value: string): string {
  if (value === "advantage-prefill") return "Advantage technical review";
  if (value === "joint") return "Joint review";
  return "Client confirmation";
}

function draftFrom(answer: HipaaAnswer): HipaaAnswer {
  return { ...answer, deferred: false, deferredAt: "", deferredReason: "" };
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
    return <div className="hipaa-presentation-complete"><span className="hipaa-presentation-check"><CheckIcon /></span><h2>All HIPAA questions have been reviewed for this session.</h2><p>Answered controls and anything intentionally skipped are ready for the results summary.</p><button className="presentation-primary-action" type="button" onClick={onComplete}>View HIPAA results</button></div>;
  }

  const issues = answerRequirements(draft).filter((issue) => issue !== "This answer still needs to be assessed.");
  const canContinue = draft.response !== "not-yet-assessed" && issues.length === 0;
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
      <div><span className="presentation-kicker">HIPAA Security Readiness · Live review</span><h2>Complete what was not prepared in advance.</h2><p>Anything not prefilled by the consultant appears here for a simple client conversation.</p></div>
      <div className="hipaa-live-progress"><strong>{queue.length}</strong><span>remaining</span><small>{prefilledOrAnswered} already completed · {deferredCount} skipped</small></div>
    </div>

    <article className="hipaa-live-question">
      <div className="hipaa-live-question-meta"><span>{current.question.id}</span><span>{current.question.category}</span><span>{ownerLabel(current.question.ownership)}</span></div>
      <h3>{current.question.title}</h3>
      <p className="hipaa-live-question-text">{current.question.question}</p>
      <p className="hipaa-live-explanation">{current.question.plainLanguageExplanation}</p>
      {(current.question.reviewPrompts.length > 0 || current.question.clientConfirms.length > 0) && <div className="hipaa-live-prompts">{[...current.question.reviewPrompts, ...current.question.clientConfirms].slice(0, 5).map((item) => <span key={item}>{item}</span>)}</div>}

      <div className="hipaa-live-responses">{RESPONSES.map((item) => <button key={item.value} type="button" className={draft.response === item.value ? `active response-${item.value}` : ""} onClick={() => chooseResponse(item.value)}>{item.label}</button>)}</div>

      {draft.response !== "not-yet-assessed" && <div className="hipaa-live-fields">
        <label><span>{draft.response === "not-applicable" ? "Why this does not apply *" : "Client confirmation or supporting proof *"}</span><textarea rows={3} value={draft.internalNotes} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDraft({ ...draft, internalNotes: event.target.value })} placeholder="Capture the answer in plain language." /></label>
        {(draft.response === "partially" || draft.response === "no") && <label><span>Recommended next step *</span><textarea rows={3} value={draft.recommendedAction} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDraft({ ...draft, recommendedAction: event.target.value })} placeholder="What should happen next?" /></label>}
      </div>}
      {issues.length > 0 && draft.response !== "not-yet-assessed" && <div className="hipaa-live-issues">{issues.map((issue) => <span key={issue}>{issue}</span>)}</div>}
      <div className="hipaa-live-actions"><button className="presentation-skip-action" type="button" onClick={skipCurrent}>Skip for now</button><button className="presentation-primary-action" type="button" disabled={!canContinue} onClick={saveAndContinue}>Save answer and continue</button></div>
    </article>

    <button className="hipaa-skip-all-link" type="button" onClick={() => setShowSkipAll(true)}>Skip all {queue.length} remaining questions for now</button>
    {showSkipAll && <div className="hipaa-skip-confirm" role="alertdialog" aria-modal="true"><div><span className="presentation-kicker">Incomplete assessment</span><h3>Skip {queue.length} remaining question{queue.length === 1 ? "" : "s"}?</h3><p>They will remain Not Yet Assessed, materially lower the displayed HIPAA readiness score, and be called out in the final package.</p><div><button type="button" onClick={() => setShowSkipAll(false)}>Keep reviewing</button><button className="danger" type="button" onClick={() => { onUpdate(deferRemainingHipaaAnswers(project)); setShowSkipAll(false); onComplete(); }}>Skip all remaining</button></div></div></div>}
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

  function finalize() {
    try {
      setError("");
      const prepared = { ...project, hipaa: { ...project.hipaa, clientConfirmation: { ...project.hipaa.clientConfirmation, acceptedResponsibility: accepted } } };
      onUpdate(confirmHipaaAssessment(prepared, confirmer));
    } catch (value) {
      setError(value instanceof Error ? value.message : "The assessment could not be finalized.");
    }
  }

  return <div className="hipaa-results-presentation">
    <div className="hipaa-results-heading"><div><span className="presentation-kicker">HIPAA Security Readiness · Results</span><h2>{score.label}</h2><p>The displayed readiness score is reduced by unanswered controls so an incomplete assessment cannot appear stronger than it is.</p></div><div className={`hipaa-results-score ${score.notYetAssessedCount ? "incomplete" : ""}`}><strong>{score.overall}%</strong><span>displayed readiness</span></div></div>

    {score.notYetAssessedCount > 0 && <div className="hipaa-incomplete-banner"><strong>{score.notYetAssessedCount} control{score.notYetAssessedCount === 1 ? " remains" : "s remain"} Not Yet Assessed</strong><p>The confirmed answers score {score.confirmedReadiness}%, but only {score.completionPercentage}% of applicable controls were assessed. The completion adjustment lowers the reportable result to {score.overall}%.</p></div>}

    <div className="hipaa-results-metrics"><article><strong>{score.confirmedReadiness}%</strong><span>Confirmed answers</span></article><article><strong>{score.completionPercentage}%</strong><span>Assessment completion</span></article><article><strong>{score.notYetAssessedCount}</strong><span>Not yet assessed</span></article><article><strong>{score.counts.no + score.counts.partially}</strong><span>Corrective actions</span></article></div>

    <div className="hipaa-results-categories">{Object.entries(score.categories).map(([category, value]) => <article key={category}><strong>{value}%</strong><span>{category}</span><small>{score.categoryCompletion[category as keyof typeof score.categoryCompletion]}% assessed</small></article>)}</div>

    <div className="hipaa-results-lower">
      <section><span className="presentation-kicker">Priority follow-up</span>{gaps.length ? gaps.map(({ question, answer }) => <article className={`hipaa-result-gap response-${answer.response}`} key={question.id}><div><strong>{question.title}</strong><span>{answer.response === "not-yet-assessed" ? "Not Yet Assessed" : answer.response}</span></div><p>{answer.clientVisibleObservation || answer.recommendedAction || (answer.deferred ? "This item was skipped and must be revisited." : question.plainLanguageExplanation)}</p>{answer.deferred && <button type="button" onClick={() => { onUpdate(reopenHipaaAnswer(project, question.id)); onReturnToQuestions(); }}>Revisit now</button>}</article>) : <div className="hipaa-no-gaps"><CheckIcon /><span>No open gaps were identified in the completed responses.</span></div>}</section>
      <section className="hipaa-finalize-panel"><span className="presentation-kicker">Client confirmation</span><h3>Save this readiness snapshot</h3><p>Confirmation documents the review. It does not certify HIPAA compliance.</p><label><span>Name and title</span><input value={confirmer} onChange={(event: ChangeEvent<HTMLInputElement>) => setConfirmer(event.target.value)} placeholder="Client confirmer" /></label><label className="hipaa-live-checkbox"><input type="checkbox" checked={accepted} onChange={(event: ChangeEvent<HTMLInputElement>) => setAccepted(event.target.checked)} /> The client reviewed the assessment and accepts responsibility for client-provided information.</label><button className="presentation-primary-action" type="button" disabled={!accepted || unresolved.length > 0} onClick={finalize}>{project.hipaa.clientConfirmation.status === "confirmed" ? "Save another snapshot" : "Confirm and save snapshot"}</button>{unresolved.length > 0 && <small>{unresolved.length} question{unresolved.length === 1 ? " must" : "s must"} be answered or skipped before confirmation.</small>}{error && <span className="hipaa-live-error">{error}</span>}{project.hipaa.clientConfirmation.status === "confirmed" && <span className="hipaa-live-confirmed"><CheckIcon /> Confirmed by {project.hipaa.clientConfirmation.confirmer}</span>}</section>
    </div>
    {deferred.length > 0 && <div className="hipaa-deferred-list"><strong>Skipped for later</strong><span>{deferred.map((answer) => answer.questionId).join(" · ")}</span></div>}
    <div className="hipaa-results-disclaimer">{HIPAA_DISCLAIMER}</div>
  </div>;
}
