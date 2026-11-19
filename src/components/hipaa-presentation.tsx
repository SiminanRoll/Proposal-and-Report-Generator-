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
import { hipaaClientFacingFollowUp } from "@/lib/hipaa/client-facing";
import { needsSecurityFollowUp, securityFollowUpOwner } from "@/lib/hipaa/follow-up-owner";
import { SecurityFollowUpOwnerEditor } from "./security-follow-up-owner-editor";
import { clientReportScores, scoreLabel, scoreTone } from "@/lib/outcomes/client-report-score";
import { clientReportAvailable } from "@/lib/outcomes/client-report-data";
import { CheckIcon } from "./icons";
import { AnimatedNumber } from "./animated-number";
import { adaptOrganizationLanguage, organizationTerm } from "@/lib/projects/client-language";
import { HIPAA_QUESTIONS } from "@/lib/hipaa/questions";
import premium from "./security-review-premium.module.css";

const RESPONSES: Array<{ value: Exclude<HipaaResponse, "not-yet-assessed">; label: string }> = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

function ownerLabel(value: string): string {
  if (value === "advantage-prefill") return "Advantage technical review";
  if (value === "joint") return "Joint review";
  return "Client confirmation";
}

function draftFrom(answer: HipaaAnswer): HipaaAnswer {
  return { ...answer, deferred: false, deferredAt: "", deferredReason: "" };
}


function responseLabel(value: HipaaResponse): string {
  if (value === "partially") return "Somewhat";
  if (value === "not-applicable") return "Does not apply";
  if (value === "not-yet-assessed") return "Not sure";
  return value === "yes" ? "Yes" : "No";
}

function HipaaAnsweredQuestionsEditor({ project, onUpdate, onClose }: { project: Project; onUpdate: (project: Project) => void; onClose: () => void }) {
  const answered = HIPAA_QUESTIONS.flatMap((question) => {
    const answer = project.hipaa.answers.find((item) => item.questionId === question.id);
    return answer && answer.response !== "not-yet-assessed" ? [{ question, answer }] : [];
  });

  function patch(questionId: string, value: Partial<HipaaAnswer>) {
    const question = HIPAA_QUESTIONS.find((item) => item.id === questionId);
    const evidenceSource = question?.ownership === "client" ? "Client verbal confirmation" : "Joint review";
    onUpdate(withUpdatedHipaaAnswer(project, questionId, {
      ...value,
      verificationStatus: "client-confirmed",
      evidenceSource,
    }));
  }

  return <div className="hipaa-answer-editor-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="hipaa-answer-editor" role="dialog" aria-modal="true" aria-labelledby="hipaa-answer-editor-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span className="presentation-kicker">Security Review</span><h3 id="hipaa-answer-editor-title">Edit recorded answers</h3><p>Corrections update the security conversation record and client report. These answers are not a compliance certification.</p></div><button type="button" aria-label="Close answered-question editor" onClick={onClose}>×</button></header>
      <div className="hipaa-answer-editor-notice"><CheckIcon /><span><strong>Corrections replace the previous response.</strong><small>If this assessment was already confirmed, it will require confirmation again after an answer changes.</small></span></div>
      <div className="hipaa-answer-editor-list">
        {answered.map(({ question, answer }) => <details className={`hipaa-answer-edit-item response-${answer.response}`} key={question.id}>
          <summary><span><small>{question.id} · {question.category}</small><strong>{question.title}</strong></span><b>{responseLabel(answer.response)}</b></summary>
          <div className="hipaa-answer-edit-body">
            <p>{adaptOrganizationLanguage(question.question, project)}</p>
            <div className="hipaa-answer-edit-responses">{RESPONSES.map((item) => <button type="button" key={item.value} className={answer.response === item.value ? `active response-${item.value}` : ""} onClick={() => patch(question.id, { response: item.value, riskSeverity: item.value === "no" ? (question.id === "SEC-03" ? "moderate" : "high") : item.value === "partially" ? "moderate" : "none" })}>{item.label}</button>)}<button type="button" className={answer.response === "not-applicable" ? "active" : ""} onClick={() => patch(question.id, { response: "not-applicable", riskSeverity: "none" })}>Not applicable</button></div>
            <div className="hipaa-answer-edit-fields"><label><span>Optional note</span><textarea rows={2} value={answer.internalNotes} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => patch(question.id, { internalNotes: event.target.value })} /></label><label><span>Optional next step</span><textarea rows={2} value={answer.recommendedAction} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => patch(question.id, { recommendedAction: event.target.value })} /></label></div>
          </div>
        </details>)}
      </div>
      <footer><span>{answered.length} answered question{answered.length === 1 ? "" : "s"}</span><button className="presentation-primary-action" type="button" onClick={onClose}>Done editing</button></footer>
    </section>
  </div>;
}

export function HipaaReviewAndResultsPresentation({ project, onUpdate }: { project: Project; onUpdate: (project: Project) => void }) {
  const openQuestionCount = hipaaQuestionsForPresentation(project).length;
  const [view, setView] = useState<"questions" | "review">(() => openQuestionCount > 0 ? "questions" : "review");

  useEffect(() => {
    if (view === "questions" && openQuestionCount === 0) setView("review");
  }, [openQuestionCount, view]);

  return <div className="hipaa-combined-presentation" data-presentation-interactive="true">
    <div className={"hipaa-combined-switch " + premium.reviewSwitcher} role="tablist" aria-label="Security conversation view">
      <button type="button" role="tab" aria-selected={view === "questions"} className={view === "questions" ? "active" : ""} disabled={openQuestionCount === 0} onClick={() => setView("questions")}>
        <span>Questions</span>
      </button>
      <button type="button" role="tab" aria-selected={view === "review"} className={view === "review" ? "active" : ""} onClick={() => setView("review")}>
        <span>Summary</span>
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
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    setDraft(current ? draftFrom(current.answer) : null);
    setIsFlipped(false);
  }, [current?.question.id]);

  if (!current || !draft) {
    const skipped = project.hipaa.answers.filter((answer) => answer.deferred).length;
    const answered = project.hipaa.answers.filter(answerIsComplete).length;
    const complete = skipped === 0 && answered === project.hipaa.answers.length;
    return <div className={`hipaa-presentation-complete ${complete ? "complete" : "incomplete"}`}><span className="hipaa-presentation-check">{complete ? <CheckIcon /> : "!"}</span><h2>{complete ? "The security conversation is complete." : "The live review is finished, but some questions remain open."}</h2><p>{complete ? `All ${answered} readiness questions were answered and are ready for the results summary.` : `${answered} questions were answered and ${skipped} were skipped for now. The skipped questions will be included in the client PDF so the ${organizationTerm(project)} can complete and return them for an updated score.`}</p><button className="presentation-primary-action" type="button" onClick={onComplete}>View security summary</button></div>;
  }

  const issues = answerRequirements(draft);
  const canContinue = draft.response !== "not-yet-assessed" && answerRequirements(draft).length === 0;
  const deferredCount = project.hipaa.answers.filter((answer) => answer.deferred).length;
  const prefilledOrAnswered = project.hipaa.answers.length - queue.length - deferredCount;

  function chooseResponse(response: Exclude<HipaaResponse, "not-yet-assessed">) {
    setDraft((value) => value ? {
      ...value,
      response,
      evidenceSource: value.evidenceSource === "Not yet verified" ? (current.question.ownership === "client" ? "Client verbal confirmation" : "Joint review") : value.evidenceSource,
      riskSeverity: response === "no" ? (current.question.id === "SEC-03" ? "moderate" : "high") : response === "partially" ? "moderate" : "none",
      serviceDisposition: value.response === response ? value.serviceDisposition : "",
    } : value);
    setIsFlipped(true);
  }

  function saveAndContinue() {
    if (!canContinue || !draft) return;
    onUpdate(withUpdatedHipaaAnswer(project, current.question.id, draft));
  }

  function skipCurrent() {
    onUpdate(deferHipaaAnswer(project, current.question.id));
  }

  const questionIndex = Math.max(0, HIPAA_QUESTIONS.findIndex((item) => item.id === current.question.id));
  const decisionLabel = draft.response === "yes" ? "Yes, in place" : draft.response === "no" ? "No, follow-up needed" : draft.response === "partially" ? "Partly in place" : draft.response === "not-applicable" ? "Does not apply" : "Answer selected";

  return <div className={"hipaa-live-review " + premium.questionExperience} data-presentation-interactive="true">
    <div className={premium.questionMain}>
      <header className={premium.compactQuestionHeader}>
        <h2>Security review</h2>
        <span aria-label={"Question " + (questionIndex + 1) + " of " + HIPAA_QUESTIONS.length}>{questionIndex + 1} / {HIPAA_QUESTIONS.length}</span>
      </header>
      <div className={premium.deck}>
        <article className={"hipaa-live-question " + premium.card + (isFlipped ? " " + premium.flipped : "")}>
          <div className={premium.front} aria-hidden={isFlipped} inert={isFlipped}>
            <div className={"hipaa-live-question-meta " + premium.cardTop}>
              <span className={premium.cardNumber}>Question {questionIndex + 1}</span>
              <span className={premium.cardCategory}>{current.question.category.replace(" Safeguards", "")}</span>
            </div>
            
            <h3 className={premium.cardTitle}>{current.question.title}</h3>
            <p className={"hipaa-live-question-text " + premium.cardQuestion}>{adaptOrganizationLanguage(current.question.question, project)}</p>
            {current.question.clientHint && <p className={premium.clientHint}>{adaptOrganizationLanguage(current.question.clientHint, project)}</p>}
            <div className={"hipaa-live-responses " + premium.choiceRow}>
              <button type="button" className={premium.choice + " " + premium.choiceYes} onClick={() => chooseResponse("yes")}><span className={premium.choiceMark} aria-hidden="true">✓</span>Yes</button>
              <button type="button" className={premium.choice + " " + premium.choiceNo} onClick={() => chooseResponse("no")}><span className={premium.choiceMark} aria-hidden="true">×</span>No</button>
              <button type="button" className={premium.choice + " " + premium.choiceNarrow} onClick={() => chooseResponse("partially")}>Somewhat</button>
              <button type="button" className={premium.choice + " " + premium.choiceNarrow} onClick={skipCurrent}>Not sure</button>
              <button type="button" className={premium.choice + " " + premium.choiceNarrow} onClick={() => chooseResponse("not-applicable")}>Not applicable</button>
            </div>
          </div>

          <div className={premium.back} aria-hidden={!isFlipped} inert={!isFlipped}>
            <div className={premium.cardTop}>
              <span className={premium.cardNumber}>Your answer</span>
              <span className={premium.cardCategory}>{current.question.category.replace(" Safeguards", "")}</span>
            </div>
            <div className={premium.backAnswer}>
              <div className={premium.answerMedallion + (draft.response === "no" ? " " + premium.no : "")} aria-hidden="true">{draft.response === "yes" ? "✓" : draft.response === "no" ? "!" : "—"}</div>
              <div><strong>{decisionLabel}</strong><small>{current.question.title}</small></div>
            </div>
            <div className={premium.backBody}>
              <label><span>Notes</span><textarea rows={2} aria-label="Notes" value={draft.internalNotes} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDraft({ ...draft, internalNotes: event.target.value })} /></label>
              {(draft.response === "no" || draft.response === "partially") && <label><span>Recommended next step <small>(optional)</small></span><textarea rows={2} value={draft.recommendedAction} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDraft({ ...draft, recommendedAction: event.target.value })} placeholder="What do we need to verify or improve?" /></label>}
              {issues.length > 0 && <div className={"hipaa-live-issues " + premium.cardError}>{issues.join(" ")}</div>}
            </div>
            <div className={"hipaa-live-actions " + premium.backActions}>
              <button className={premium.secondaryAction} type="button" onClick={() => setIsFlipped(false)}>← Change answer</button>
              <button className={premium.primaryAction} type="button" disabled={!canContinue} onClick={saveAndContinue}>Save &amp; next question <span aria-hidden="true">→</span></button>
            </div>
          </div>
        </article>
      </div>

      <button className={"hipaa-skip-all-link " + premium.skipLink} type="button" onClick={() => setShowSkipAll(true)}>Skip all {queue.length} remaining questions for now</button>
    </div>

    {showSkipAll && <div className="hipaa-skip-confirm" role="alertdialog" aria-modal="true"><div><span className="presentation-kicker">Incomplete assessment</span><h3>Skip {queue.length} remaining question{queue.length === 1 ? "" : "s"}?</h3><p>They will remain marked Not sure, keep the security conversation incomplete, and remain visible for follow-up.</p><div><button type="button" onClick={() => setShowSkipAll(false)}>Keep reviewing</button><button className="danger" type="button" onClick={() => { onUpdate(deferRemainingHipaaAnswers(project)); setShowSkipAll(false); onComplete(); }}>Skip all remaining</button></div></div></div>}
  </div>;
}

export function HipaaResultsPresentation({ project, onUpdate, onReturnToQuestions }: { project: Project; onUpdate: (project: Project) => void; onReturnToQuestions: () => void }) {
  const score = useMemo(() => scoreHipaaAssessment(project.hipaa), [project.hipaa]);
  const gaps = useMemo(() => hipaaTopGaps(project, 3), [project]);
  const health = project.type === "client-report" && clientReportAvailable(project) ? clientReportScores(project) : null;
  const deferred = project.hipaa.answers.filter((answer) => answer.deferred);
  const followUps = HIPAA_QUESTIONS.flatMap((question) => {
    const answer = project.hipaa.answers.find((item) => item.questionId === question.id);
    return answer && needsSecurityFollowUp(answer) ? [{ question, answer }] : [];
  });
  const clientFollowUps = followUps.filter(({ question, answer }) => securityFollowUpOwner(question, answer) === "client").length;
  const advantageFollowUps = followUps.length - clientFollowUps;
  const unresolved = hipaaQuestionsForPresentation(project);
  const [confirmer, setConfirmer] = useState(project.hipaa.clientConfirmation.confirmer);
  const [accepted, setAccepted] = useState(project.hipaa.clientConfirmation.acceptedResponsibility);
  const [error, setError] = useState("");
  const [editingAnswers, setEditingAnswers] = useState(false);
  const responseTotal = Math.max(1, Object.values(score.counts).reduce((sum, value) => sum + value, 0));
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

  return <div className={"hipaa-results-presentation " + premium.resultsRoot} aria-label="Security review recap">
    {health && <section className={premium.thrRevealRoot} data-tone={scoreTone(health.overall)} aria-labelledby="updated-thr-heading">
      <div className={premium.thrRevealCopy}>
        <span className={premium.thrRevealKicker}>TECHNOLOGY HEALTH REVIEW</span>
        <h2 id="updated-thr-heading">{health.securityReviewIncluded ? "Your updated THR score" : "Your current THR score"}</h2>
        <p>{health.securityReviewIncluded
          ? "Your technology health now reflects the completed security conversation alongside monitored protection and equipment condition."
          : "This is your technology baseline. Complete the remaining security questions to include the review findings."}</p>
        <div className={premium.thrRevealFacts}>
          <span><strong>{health.baselineOverall}/100</strong><small>Technology baseline</small></span>
          <span><strong>{score.assessedQuestionCount}/{score.applicableQuestionCount}</strong><small>Security checks recorded</small></span>
          <span><strong>{score.counts.no + score.counts.partially}</strong><small>Items to review</small></span>
        </div>
        <small className={premium.thrRevealFineprint}>{health.securityReviewIncluded
          ? "Safeguard answers contribute 15% of the THR score; they reflect this discussion, not independent verification or regulatory compliance."
          : "Unanswered questions do not count as failed controls. The score updates after the full review is recorded."}</small>
      </div>
      <div className={premium.thrRevealScore} style={{ "--thr-progress": `${health.overall}%` } as CSSProperties} aria-label={`Technology health: ${health.overall} out of 100, ${scoreLabel(health.overall)}`}>
        <div className={premium.thrRevealNumber}><strong><AnimatedNumber value={health.overall} delay={120} duration={1100} /></strong><em>/100</em></div>
        <span>{scoreLabel(health.overall)}</span>
        <small>{health.provisional ? "Baseline · review pending" : health.securityReviewIncluded ? "Updated after review" : "Technology baseline"}</small>
      </div>
    </section>}
    <div className="hipaa-results-heading"><div><span className="presentation-kicker">Security review · Conversation recap</span><h2>What is protected, and what needs attention?</h2><p>What we confirmed today and what still needs attention.</p></div><div className="hipaa-results-heading-actions"><div className={`hipaa-results-score ${score.notYetAssessedCount ? "incomplete" : ""}`} style={{ "--hipaa-score": score.overall } as CSSProperties}><strong><AnimatedNumber value={score.assessedQuestionCount} delay={180} duration={1050} /></strong><span>of {score.applicableQuestionCount} applicable questions discussed</span></div><button className="hipaa-edit-answers-button" type="button" onClick={() => setEditingAnswers(true)}>Edit answered questions</button></div></div>

    {score.notYetAssessedCount > 0 && <div className="hipaa-incomplete-banner"><strong>{score.notYetAssessedCount} question{score.notYetAssessedCount === 1 ? " remains" : "s remain"} unanswered or marked Not sure</strong><p>We can revisit these questions once the information is available.</p></div>}

    <div className={`hipaa-results-metrics ${score.notYetAssessedCount > 0 ? "three-up" : "two-up"}`}><article><strong><AnimatedNumber value={score.assessedQuestionCount} delay={300} /></strong><span>Questions answered</span></article><article><strong><AnimatedNumber value={score.counts.no + score.counts.partially + score.notYetAssessedCount} delay={390} /></strong><span>Follow-up items</span></article>{score.notYetAssessedCount > 0 && <article><strong><AnimatedNumber value={score.notYetAssessedCount} delay={470} /></strong><span>Not sure / unanswered</span></article>}</div>

    <div className="hipaa-answer-visual"><div className="hipaa-answer-bar">{responseSegments.map((item) => <span key={item.key} className={item.key} style={{ width: `${(item.count / responseTotal) * 100}%` }} title={`${item.label}: ${item.count}`} />)}</div><div className="hipaa-answer-legend">{responseSegments.map((item) => <span key={item.key} className={item.key}><i /> <b><AnimatedNumber value={item.count} delay={520} /></b> {item.label}</span>)}</div></div>

    <div className="hipaa-readiness-meaning"><strong>What this means</strong><p>This review highlights what is in place and what needs a follow-up.</p></div><div className="hipaa-consultant-guidance"><div><span className="presentation-kicker">Responsibility boundary</span><strong>Technology safeguards, not compliance certification</strong></div><p>We help protect supported devices, monitor threats, and coordinate recovery according to the services in place. Your organization owns its risk analysis, written policies, staff training, vendor agreements and regulatory decisions, with qualified compliance guidance when appropriate.</p></div>


    {followUps.length > 0 && <section className={premium.followUpRouting} aria-label="Security follow-up assignments">
      <header className={premium.followUpRoutingHeader}>
        <div><span>SECURITY NEXT STEPS</span><h3>Assign the open items</h3><p>Choose who will confirm each answer. Client-owned items appear in their PDF.</p></div>
        <div className={premium.followUpRoutingCounts} aria-label="Follow-up assignments"><span>{advantageFollowUps} Advantage</span><span>{clientFollowUps} Client</span></div>
      </header>
      <div className={premium.followUpRoutingGrid}>
        {followUps.map(({ question, answer }) => <SecurityFollowUpOwnerEditor key={question.id} project={project} question={question} answer={answer} onUpdate={onUpdate} />)}
      </div>
    </section>}

    <div className="hipaa-results-lower">
      <section><span className="presentation-kicker">Priority follow-up</span>{gaps.length ? gaps.map(({ question, answer }) => <article className={`hipaa-result-gap response-${answer.response}`} key={question.id}><div><strong>{question.title}</strong><span>{answer.response === "not-yet-assessed" ? "Not sure" : answer.response === "partially" ? "Somewhat" : answer.response === "not-applicable" ? "Does not apply" : answer.response}</span></div><p>{hipaaClientFacingFollowUp(question, answer)}</p>{answer.deferred && <button type="button" onClick={() => { onUpdate(reopenHipaaAnswer(project, question.id)); onReturnToQuestions(); }}>Revisit now</button>}</article>) : <div className="hipaa-no-gaps"><CheckIcon /><span>No open gaps were identified in the completed responses.</span></div>}</section>
      <section className="hipaa-finalize-panel"><span className="presentation-kicker">Client confirmation</span><h3>Confirm today&apos;s review</h3><p>Please confirm the answers and next steps we discussed.</p><label><span>Name and title</span><input value={confirmer} onChange={(event: ChangeEvent<HTMLInputElement>) => setConfirmer(event.target.value)} placeholder="Client confirmer" /></label><label className="hipaa-live-checkbox"><input type="checkbox" checked={accepted} onChange={(event: ChangeEvent<HTMLInputElement>) => setAccepted(event.target.checked)} /> The client reviewed the recorded answers, choices, and any agreed next steps; this is not a waiver of compliance responsibilities.</label><button className="presentation-primary-action" type="button" disabled={!accepted || unresolved.length > 0} onClick={finalize}>{project.hipaa.clientConfirmation.status === "confirmed" ? "Save another snapshot" : "Confirm and save snapshot"}</button>{unresolved.length > 0 && <small>{unresolved.length} question{unresolved.length === 1 ? " must" : "s must"} be answered or skipped before confirmation.</small>}{error && <span className="hipaa-live-error">{error}</span>}{project.hipaa.clientConfirmation.status === "confirmed" && <span className="hipaa-live-confirmed"><CheckIcon /> Confirmed by {project.hipaa.clientConfirmation.confirmer}</span>}</section>
    </div>
    {deferred.length > 0 && <div className="hipaa-deferred-list"><strong>Skipped for later — owners assigned above</strong><span>{deferred.map((answer) => answer.questionId).join(" · ")}</span></div>}
    <div className="hipaa-results-disclaimer">{HIPAA_DISCLAIMER}</div>
    {editingAnswers && <HipaaAnsweredQuestionsEditor project={project} onUpdate={onUpdate} onClose={() => setEditingAnswers(false)} />}
  </div>;
}
