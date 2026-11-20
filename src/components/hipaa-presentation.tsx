"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  withoutAutoImportedSecurityNotes,
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
  return { ...withoutAutoImportedSecurityNotes(answer), deferred: false, deferredAt: "", deferredReason: "" };
}


function responseLabel(value: HipaaResponse): string {
  if (value === "partially") return "Somewhat";
  if (value === "not-applicable") return "Does not apply";
  if (value === "not-yet-assessed") return "Not sure";
  return value === "yes" ? "Yes" : "No";
}

function HipaaAnsweredQuestionsEditor({ project, onUpdate, onClose }: { project: Project; onUpdate: (project: Project) => void; onClose: () => void }) {
  const answered = HIPAA_QUESTIONS.flatMap((question) => {
    const stored = project.hipaa.answers.find((item) => item.questionId === question.id);
    const answer = stored ? withoutAutoImportedSecurityNotes(stored) : undefined;
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
  const [selectedResponse, setSelectedResponse] = useState<HipaaResponse | null>(null);

  useEffect(() => {
    setDraft(current ? draftFrom(current.answer) : null);
    setSelectedResponse(null);
  }, [current?.question.id]);

  if (!current || !draft) {
    const skipped = project.hipaa.answers.filter((answer) => answer.deferred).length;
    const answered = project.hipaa.answers.filter(answerIsComplete).length;
    const complete = skipped === 0 && answered === project.hipaa.answers.length;
    return <div className={`hipaa-presentation-complete ${complete ? "complete" : "incomplete"}`}><span className="hipaa-presentation-check">{complete ? <CheckIcon /> : "!"}</span><h2>{complete ? "The security conversation is complete." : "The live review is finished, but some questions remain open."}</h2><p>{complete ? `All ${answered} readiness questions were answered and are ready for the results summary.` : `${answered} questions were answered and ${skipped} were skipped for now. The skipped questions will be included in the client PDF so the ${organizationTerm(project)} can complete and return them for an updated score.`}</p><button className="presentation-primary-action" type="button" onClick={onComplete}>View security summary</button></div>;
  }

  const hasChoice = selectedResponse !== null && selectedResponse === draft.response && draft.questionId === current.question.id;
  const canContinue = hasChoice && (draft.response === "not-yet-assessed" || answerRequirements(draft).length === 0);
  const questionIndex = Math.max(0, HIPAA_QUESTIONS.findIndex((item) => item.id === current.question.id));
  const decisionLabel = draft.response === "yes" ? "Yes" : draft.response === "no" ? "No" : draft.response === "partially" ? "Somewhat" : draft.response === "not-applicable" ? "Not applicable" : "Not sure";

  function chooseResponse(response: HipaaResponse) {
    setSelectedResponse(response);
    setDraft((value) => value ? {
      ...value,
      response,
      evidenceSource: response === "not-yet-assessed"
        ? "Not yet verified"
        : current.question.ownership === "client" ? "Client verbal confirmation" : "Joint review",
      verificationStatus: response === "not-yet-assessed" ? "not-reviewed" : "client-confirmed",
      riskSeverity: response === "no" ? (current.question.id === "SEC-03" ? "moderate" : "high") : response === "partially" ? "moderate" : "none",
      serviceDisposition: value.response === response ? value.serviceDisposition : "",
    } : value);
  }

  function saveAndContinue() {
    if (!canContinue || !draft) return;
    const updated = withUpdatedHipaaAnswer(project, current.question.id, draft);
    // Not sure keeps an explicit deferred follow-up instead of producing a false Yes/No.
    onUpdate(draft.response === "not-yet-assessed"
      ? deferHipaaAnswer(updated, current.question.id, "Not sure during client conversation")
      : updated);
  }

  return <div className={"hipaa-live-review " + premium.questionExperience} data-presentation-interactive="true">
    <div className={premium.questionMain}>
      <header className={premium.compactQuestionHeader}>
        <h2>Security review</h2>
        <span aria-label={"Question " + (questionIndex + 1) + " of " + HIPAA_QUESTIONS.length}>{questionIndex + 1} / {HIPAA_QUESTIONS.length}</span>
      </header>
      <div className={premium.deck}>
        <article className={"hipaa-live-question " + premium.card}>
          <div className={premium.front}>
            <div className={"hipaa-live-question-meta " + premium.cardTop}>
              <span className={premium.cardNumber}>Question {questionIndex + 1}</span>
              <span className={premium.cardCategory}>{current.question.category.replace(" Safeguards", "")}</span>
            </div>
            <h3 className={premium.cardTitle}>{current.question.title}</h3>
            <p className={"hipaa-live-question-text " + premium.cardQuestion}>{adaptOrganizationLanguage(current.question.question, project)}</p>
            {current.question.clientHint && <p className={premium.clientHint}>{adaptOrganizationLanguage(current.question.clientHint, project)}</p>}
            <div className={"hipaa-live-responses " + premium.choiceRow} role="group" aria-label="Choose an answer">
              <button type="button" className={premium.choice + " " + premium.choiceYes} data-response="yes" data-selected={selectedResponse === "yes"} aria-pressed={selectedResponse === "yes"} onClick={() => chooseResponse("yes")}><span className={premium.choiceMark} aria-hidden="true">✓</span>Yes</button>
              <button type="button" className={premium.choice + " " + premium.choiceNo} data-response="no" data-selected={selectedResponse === "no"} aria-pressed={selectedResponse === "no"} onClick={() => chooseResponse("no")}><span className={premium.choiceMark} aria-hidden="true">×</span>No</button>
              <button type="button" className={premium.choice + " " + premium.choiceNarrow} data-response="partially" data-selected={selectedResponse === "partially"} aria-pressed={selectedResponse === "partially"} onClick={() => chooseResponse("partially")}>Somewhat</button>
              <button type="button" className={premium.choice + " " + premium.choiceNarrow} data-response="not-yet-assessed" data-selected={selectedResponse === "not-yet-assessed"} aria-pressed={selectedResponse === "not-yet-assessed"} onClick={() => chooseResponse("not-yet-assessed")}>Not sure</button>
              <button type="button" className={premium.choice + " " + premium.choiceNarrow} data-response="not-applicable" data-selected={selectedResponse === "not-applicable"} aria-pressed={selectedResponse === "not-applicable"} onClick={() => chooseResponse("not-applicable")}>Not applicable</button>
            </div>
            {hasChoice && <div className={premium.inlineConfirmation} data-response={draft.response}>
              <div className={premium.inlineAnswerHeading}>
                <span className={premium.inlineAnswerPill} aria-live="polite"><CheckIcon /> {decisionLabel} selected</span>
                <span className={premium.inlineAnswerGuidance}>Add a note if needed, then confirm.</span>
              </div>
              <label className={premium.inlineNoteLabel}>
                <span>Additional notes <small>(optional)</small></span>
                <textarea rows={2} aria-label="Additional notes" value={draft.internalNotes} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDraft({ ...draft, internalNotes: event.target.value })} placeholder="Add context only if needed." />
              </label>
              <div className={premium.inlineConfirmActions}>
                <span>{draft.response === "not-yet-assessed" ? "This will remain open for follow-up." : "You can change your selection above."}</span>
                <button className={premium.primaryAction + " " + premium.inlineConfirmButton} type="button" disabled={!canContinue} onClick={saveAndContinue}><CheckIcon /> Confirm &amp; next <span aria-hidden="true">→</span></button>
              </div>
            </div>}
          </div>
        </article>
      </div>

      <button className={"hipaa-skip-all-link " + premium.skipLink} type="button" onClick={() => setShowSkipAll(true)}>Skip all {queue.length} remaining questions for now</button>
    </div>

    {showSkipAll && <div className="hipaa-skip-confirm" role="alertdialog" aria-modal="true"><div><span className="presentation-kicker">Incomplete assessment</span><h3>Skip {queue.length} remaining question{queue.length === 1 ? "" : "s"}?</h3><p>They will remain marked Not sure, keep the security conversation incomplete, and remain visible for follow-up.</p><div><button type="button" onClick={() => setShowSkipAll(false)}>Keep reviewing</button><button className="danger" type="button" onClick={() => { onUpdate(deferRemainingHipaaAnswers(project)); setShowSkipAll(false); onComplete(); }}>Skip all remaining</button></div></div></div>}
  </div>;
}

type RecapPhase = "score" | "answers" | "actions";

export function HipaaResultsPresentation({ project, onUpdate, onReturnToQuestions }: { project: Project; onUpdate: (project: Project) => void; onReturnToQuestions: () => void }) {
  const score = useMemo(() => scoreHipaaAssessment(project.hipaa), [project.hipaa]);
  const gaps = useMemo(() => hipaaTopGaps(project, 3), [project]);
  const health = project.type === "client-report" && clientReportAvailable(project) ? clientReportScores(project) : null;
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
  const [phase, setPhase] = useState<RecapPhase>("score");
  const [showAllAnswers, setShowAllAnswers] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Every phase begins at the top even if the previous phase had a long list.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [phase]);

  const recorded = score.assessedQuestionCount;
  const needsInput = score.notYetAssessedCount;
  const flagged = score.counts.no + score.counts.partially;
  const responseTotal = Math.max(1, Object.values(score.counts).reduce((sum, value) => sum + value, 0));
  const responseSegments = [
    { key: "yes", label: "Yes", count: score.counts.yes },
    { key: "partially", label: "Somewhat", count: score.counts.partially },
    { key: "no", label: "No", count: score.counts.no },
    { key: "not-applicable", label: "N/A", count: score.counts["not-applicable"] },
    { key: "not-yet-assessed", label: "Not sure", count: score.counts["not-yet-assessed"] },
  ];
  const allAnswers = HIPAA_QUESTIONS.flatMap((question) => {
    const answer = project.hipaa.answers.find((item) => item.questionId === question.id);
    return answer?.includeInReport === false ? [] : [{ question, answer }];
  });
  const steps: Array<{ id: RecapPhase; label: string }> = [
    { id: "score", label: "THR score" },
    { id: "answers", label: "Answers" },
    { id: "actions", label: "Next steps" },
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

  return <div ref={scrollRef} className={"hipaa-results-presentation " + premium.resultsRoot + " " + premium.recapFlowRoot} aria-label="Security review recap">
    <div className={premium.recapTopbar}>
      {phase !== "score" ? <button type="button" className={premium.recapBackButton} aria-label="Previous review step"
        onClick={() => setPhase(phase === "actions" ? "answers" : "score")}><span aria-hidden="true">←</span> Back</button> : <span className={premium.recapTopbarSpacer} aria-hidden="true" />}
      <nav className={premium.recapFlowNav} aria-label="Security review summary">
        {steps.map((step, index) => <button type="button" key={step.id} aria-current={phase === step.id ? "step" : undefined}
          className={phase === step.id ? premium.recapFlowNavActive : ""}
          onClick={() => setPhase(step.id)}>
          <span>{index + 1}</span>{step.label}
        </button>)}
      </nav>
      <span className={premium.recapTopbarSpacer} aria-hidden="true" />
    </div>

    <div key={phase} className={premium.recapStage} aria-live="polite">
      {phase === "score" && <section className={premium.recapScoreStage}>
        {health ? <div className={premium.thrRevealRoot} data-tone={scoreTone(health.overall)} aria-labelledby="updated-thr-heading">
          <div className={premium.thrRevealCopy}>
            <span className={premium.thrRevealKicker}>TECHNOLOGY HEALTH REVIEW</span>
            <h2 id="updated-thr-heading">{health.securityReviewIncluded ? "Your updated THR score" : "Your current THR score"}</h2>
            <p>{health.securityReviewIncluded
              ? "Your technology review now includes the security conversation."
              : "Your technology baseline. Security answers will be included when the review is complete."}</p>
            <span className={premium.recapScoreStatus}>{health.securityReviewIncluded ? "Security review included" : "Review still in progress"}</span>
          </div>
          <div className={premium.thrRevealScore} style={{ "--thr-progress": String(health.overall) + "%" } as CSSProperties}
            aria-label={"Technology health: " + health.overall + " out of 100, " + scoreLabel(health.overall)}>
            <div className={premium.thrRevealNumber}><strong><AnimatedNumber value={health.overall} delay={120} duration={1000} /></strong><em>/100</em></div>
            <span>{scoreLabel(health.overall)}</span>
            <small>{health.securityReviewIncluded ? "Updated after review" : "Current baseline"}</small>
          </div>
        </div> : <div className={premium.recapScoreFallback}>
          <span className={premium.thrRevealKicker}>SECURITY REVIEW</span>
          <h2>Review in progress</h2>
          <p>The technology score will appear when the supporting assessment is available.</p>
        </div>}
      </section>}

      {phase === "answers" && <section className={premium.recapAnswersStage}>
        <header className={premium.recapStageHeading}>
          <span className={premium.thrRevealKicker}>SECURITY CONVERSATION</span>
          <h2>Answers at a glance</h2>
          <p>A quick view of what we covered.</p>
        </header>
        <div className={premium.recapSummaryMetrics}>
          <article><strong><AnimatedNumber value={recorded} delay={80} /></strong><span>Recorded</span></article>
          <article data-tone={needsInput ? "attention" : "complete"}><strong><AnimatedNumber value={needsInput} delay={150} /></strong><span>Need input</span></article>
          <article><strong><AnimatedNumber value={flagged} delay={220} /></strong><span>To review</span></article>
        </div>
        <div className={premium.recapResponsePanel}>
          <div className={premium.recapResponsePanelHeading}><strong>Responses</strong><span>{recorded} of {score.applicableQuestionCount} recorded</span></div>
          <div className={premium.recapBar} role="img" aria-label={responseSegments.map((item) => item.count + " " + item.label).join(", ")}>
            {responseSegments.filter((item) => item.count > 0).map((item) =>
              <span key={item.key} className={premium.recapBarSegment} data-response={item.key}
                style={{ width: String((item.count / responseTotal) * 100) + "%" }} />)}
          </div>
          <div className={premium.recapLegend}>
            {responseSegments.filter((item) => item.count > 0).map((item) =>
              <span key={item.key}><i className={premium.recapLegendDot} data-response={item.key} />{item.label} <strong>{item.count}</strong></span>)}
          </div>
        </div>
        <div className={premium.recapAnswersTools}>
          <button type="button" onClick={() => setShowAllAnswers(!showAllAnswers)} aria-expanded={showAllAnswers}>
            {showAllAnswers ? "Hide answer list" : "View all answers"}
          </button>
          <button type="button" onClick={() => setEditingAnswers(true)}>Edit answers</button>
          {unresolved.length > 0 && <button type="button" onClick={onReturnToQuestions}>Revisit questions</button>}
        </div>
        {showAllAnswers && <div className={premium.recapAnswerList} aria-label="Recorded security answers">
          {allAnswers.map(({ question, answer }) => {
            const unknown = !answer || answer.deferred || answer.response === "not-yet-assessed";
            const status = unknown ? "not-yet-assessed" : answer.response;
            return <div key={question.id} className={premium.recapAnswerItem} data-response={status}>
              <span>{question.id}</span><strong>{question.title}</strong><em>{unknown || !answer ? "Not sure" : responseLabel(answer.response)}</em>
            </div>;
          })}
        </div>}
      </section>}

      {phase === "actions" && <section className={premium.recapActionsStage}>
        <header className={premium.recapStageHeading}>
          <span className={premium.thrRevealKicker}>SECURITY REVIEW</span>
          <h2>Next steps</h2>
        </header>
        <div className={premium.recapActionLayout}>
          <section className={premium.followUpRouting} aria-label="Security follow-up assignments">
            <header className={premium.followUpRoutingHeader}>
              <h3>Responsible party</h3>
              <div className={premium.followUpRoutingCounts} aria-label="Responsibility totals">
                <span>{advantageFollowUps} Advantage</span><span>{clientFollowUps} Your team</span>
              </div>
            </header>
            {followUps.length > 0 ? <div className={premium.followUpRoutingGrid}>
              {followUps.map(({ question, answer }) => <SecurityFollowUpOwnerEditor key={question.id} project={project} question={question} answer={answer} onUpdate={onUpdate} />)}
            </div> : <p className={premium.recapEmptyState}>No outstanding questions.</p>}
          </section>
          <section className={"hipaa-finalize-panel " + premium.recapConfirmation}>
            <span className="presentation-kicker">CONFIRMATION</span>
            <label><span>Name and title</span><input value={confirmer} onChange={(event: ChangeEvent<HTMLInputElement>) => setConfirmer(event.target.value)} placeholder="Client representative" /></label>
            <label className="hipaa-live-checkbox"><input type="checkbox" checked={accepted} onChange={(event: ChangeEvent<HTMLInputElement>) => setAccepted(event.target.checked)} /> The answers and responsibilities reflect our conversation.</label>
            <button className="presentation-primary-action" type="button" disabled={!accepted || unresolved.length > 0} onClick={finalize}>
              {project.hipaa.clientConfirmation.status === "confirmed" ? "Update confirmation" : "Confirm review"}
            </button>
            {unresolved.length > 0 && <div className={premium.recapConfirmationNotice}>
              <span>{unresolved.length} question{unresolved.length === 1 ? "" : "s"} still need a response or Not sure.</span>
              <button type="button" onClick={onReturnToQuestions}>Return to questions</button>
            </div>}
            {error && <span className="hipaa-live-error">{error}</span>}
            {project.hipaa.clientConfirmation.status === "confirmed" && <span className="hipaa-live-confirmed"><CheckIcon /> Confirmed by {project.hipaa.clientConfirmation.confirmer}</span>}
          </section>
        </div>
        {gaps.length > 0 && <details className={premium.recapPriorityDetails}>
          <summary>Other items to review <span>{gaps.length} priority finding{gaps.length === 1 ? "" : "s"}</span></summary>
          <div className={premium.recapPriorityList}>
            {gaps.map(({ question, answer }) => <article key={question.id} className={premium.recapPriorityItem}>
              <div><strong>{question.title}</strong><span>{answer.deferred ? "Not sure" : responseLabel(answer.response)}</span></div>
              <p>{hipaaClientFacingFollowUp(question, answer)}</p>
              {answer.deferred && <button type="button" onClick={() => { onUpdate(reopenHipaaAnswer(project, question.id)); onReturnToQuestions(); }}>Revisit</button>}
            </article>)}
          </div>
        </details>}
        <details className={premium.recapDisclosure}>
          <summary>About this review</summary>
          <p>{HIPAA_DISCLAIMER}</p>
        </details>
      </section>}
    </div>

    {phase !== "actions" && <div className={premium.recapFlowActions}>
      <button type="button" className={premium.recapNextButton}
        onClick={() => setPhase(phase === "score" ? "answers" : "actions")}>
        {phase === "score" ? "Review answers" : "Assign next steps"} <span aria-hidden="true">→</span>
      </button>
    </div>}
    {editingAnswers && <HipaaAnsweredQuestionsEditor project={project} onUpdate={onUpdate} onClose={() => setEditingAnswers(false)} />}
  </div>;
}
