"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type { HipaaAnswer, HipaaOwnership, HipaaResponse, Project } from "@/lib/projects/types";
import { HIPAA_QUESTIONS } from "@/lib/hipaa/questions";
import {
  HIPAA_DISCLAIMER,
  answerIsComplete,
  answerRequirements,
  confirmHipaaAssessment,
  scoreHipaaAssessment,
  withUpdatedHipaaAnswer,
} from "@/lib/hipaa/engine";
import { ArrowIcon, CheckIcon, SparkIcon } from "./icons";
import { adaptOrganizationLanguage } from "@/lib/projects/client-language";

const RESPONSES: Array<{ value: HipaaResponse; label: string }> = [
  { value: "yes", label: "Yes" },
  { value: "partially", label: "Somewhat" },
  { value: "no", label: "No" },
  { value: "not-applicable", label: "Does not apply" },
  { value: "not-yet-assessed", label: "Not sure" },
];

const OWNERSHIP: Array<{ value: HipaaOwnership; label: string; description: string }> = [
  { value: "advantage-prefill", label: "Advantage prefill", description: "2 technical checkpoints proposed from imported managed-system information" },
  { value: "joint", label: "Joint review", description: "4 short questions that combine client workflow with technical confirmation" },
  { value: "client", label: "Client confirmation", description: "6 practical policy, workforce, vendor, and incident-response questions" },
];

function responseLabel(value: HipaaResponse): string { return RESPONSES.find((item) => item.value === value)?.label ?? value; }
function ownershipLabel(value: HipaaOwnership): string { return OWNERSHIP.find((item) => item.value === value)?.label ?? value; }
function answerFor(project: Project, questionId: string): HipaaAnswer { return project.hipaa.answers.find((answer) => answer.questionId === questionId)!; }

function QuestionEditor({ project, questionId, onUpdate }: { project: Project; questionId: string; onUpdate: (project: Project) => void }) {
  const question = HIPAA_QUESTIONS.find((item) => item.id === questionId)!;
  const answer = answerFor(project, questionId);
  const issues = answerRequirements(answer);
  const prompts = [...question.reviewPrompts, ...question.clientConfirms.map((item) => `Client: ${item}`), ...question.advantageConfirms.map((item) => `Advantage: ${item}`)];

  function patch(value: Partial<HipaaAnswer>) { onUpdate(withUpdatedHipaaAnswer(project, questionId, value)); }

  return <details className={`hipaa-question ${answerIsComplete(answer) ? "complete" : "incomplete"}`}>
    <summary>
      <span className="hipaa-question-number">{question.id.replace("HIPAA-", "")}</span>
      <span className="hipaa-question-summary"><small>{question.category} · {ownershipLabel(question.ownership)}</small><strong>{question.title}</strong></span>
      <span className={`hipaa-response-badge response-${answer.response}`}>{responseLabel(answer.response)}</span>
      <span className="hipaa-completion-mark">{answerIsComplete(answer) ? <CheckIcon /> : issues.length}</span>
    </summary>
    <div className="hipaa-question-body">
      <p className="hipaa-question-text">{adaptOrganizationLanguage(question.question, project)}</p>
      <div className="hipaa-response-grid">{RESPONSES.map((item) => <button type="button" key={item.value} className={answer.response === item.value ? "active" : ""} onClick={() => patch({ response: item.value, riskSeverity: item.value === "no" ? "high" : item.value === "partially" ? "moderate" : "none" })}>{item.label}</button>)}</div>
      <label className="hipaa-quick-note"><span>Optional note</span><textarea rows={2} value={answer.internalNotes} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => patch({ internalNotes: event.target.value })} placeholder="Add context only when it will help the review." /></label>
      <details className="hipaa-question-help">
        <summary>Helpful context and prompts</summary>
        <p>{adaptOrganizationLanguage(question.plainLanguageExplanation, project)}</p>
        {prompts.length > 0 && <div className="hipaa-prompts">{prompts.map((prompt) => <small key={prompt}>{adaptOrganizationLanguage(prompt, project)}</small>)}</div>}
      </details>
      <details className="hipaa-advanced-details">
        <summary>Add a follow-up action <span>(optional)</span></summary>
        <div className="hipaa-form-grid">
          <label className="wide"><span>Client-visible observation</span><textarea rows={2} value={answer.clientVisibleObservation} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => patch({ clientVisibleObservation: event.target.value })} placeholder="Plain-language finding for the report, only when needed." /></label>
          <label className="wide"><span>Recommended next action</span><textarea rows={2} value={answer.recommendedAction} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => patch({ recommendedAction: event.target.value })} placeholder="Leave blank until planning if the next step is not known yet." /></label>
          <label><span>Responsible party</span><input value={answer.responsibleParty} onChange={(event: ChangeEvent<HTMLInputElement>) => patch({ responsibleParty: event.target.value })} placeholder="Client, Advantage, or joint" /></label>
          <label><span>Target date</span><input type="date" value={answer.targetDate} onChange={(event: ChangeEvent<HTMLInputElement>) => patch({ targetDate: event.target.value })} /></label>
        </div>
        <label className="hipaa-report-toggle"><input type="checkbox" checked={answer.includeInReport} onChange={(event: ChangeEvent<HTMLInputElement>) => patch({ includeInReport: event.target.checked })} /> Include this finding in the client report</label>
      </details>
      {issues.length > 0 && <div className="hipaa-issues">{issues.map((issue) => <span key={issue}>{issue}</span>)}</div>}
    </div>
  </details>;
}

export function HipaaReadiness({ project, onUpdate, onToggle }: { project: Project; onUpdate: (project: Project) => void; onToggle: (enabled: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [ownership, setOwnership] = useState<HipaaOwnership>("advantage-prefill");
  const [confirmer, setConfirmer] = useState(project.hipaa.clientConfirmation.confirmer);
  const [confirmError, setConfirmError] = useState("");
  const score = useMemo(() => scoreHipaaAssessment(project.hipaa), [project.hipaa]);
  const groupQuestions = HIPAA_QUESTIONS.filter((question) => question.ownership === ownership);
  const groupComplete = (value: HipaaOwnership) => HIPAA_QUESTIONS.filter((question) => question.ownership === value).filter((question) => answerIsComplete(answerFor(project, question.id))).length;

  function updateAssessment(next: Project) {
    onUpdate({ ...next, findings: [], recommendations: [], presentation: { ...next.presentation, executiveSummary: "" } });
  }


  if (!project.hipaa.enabled) return <section className="workspace-card hipaa-invite hipaa-disabled">
    <div><span className="section-kicker"><SparkIcon /> Workspace option</span><h2>HIPAA Security Readiness is off</h2><p>Turn it on to include a short 12-question readiness check, live follow-up, and any unanswered questions in the finished client PDF.</p><small className="hipaa-disclaimer-short">When off, HIPAA is omitted entirely rather than shown as incomplete. Existing answers are preserved if it is enabled again.</small></div>
    <div className="hipaa-invite-actions"><label className="workspace-toggle"><input type="checkbox" checked={false} onChange={() => { onToggle(true); setOpen(true); }} /><span aria-hidden="true" /><b>Include HIPAA Readiness</b></label><button className="button primary" type="button" onClick={() => { onToggle(true); setOpen(true); }}>Enable HIPAA <ArrowIcon /></button></div>
  </section>;

  return <section className="workspace-card hipaa-module" id="hipaa-readiness">
    <div className="hipaa-module-header">
      <div><span className="section-kicker">HIPAA Security Readiness</span><h2>{score.label}</h2><p>{score.confirmedQuestionCount} of {HIPAA_QUESTIONS.length} questions answered · {score.notYetAssessedCount} remain for the live review or finished PDF follow-up</p></div>
      <div className="hipaa-score-ring"><strong>{score.overall}%</strong><span>displayed readiness</span><small>{score.completionPercentage}% assessed</small></div>
      <div className="hipaa-module-actions"><label className="workspace-toggle"><input type="checkbox" checked onChange={(event: ChangeEvent<HTMLInputElement>) => onToggle(event.target.checked)} /><span aria-hidden="true" /><b>Include HIPAA</b></label><button className="button primary" type="button" onClick={() => setOpen((value) => !value)}>{open ? "Close review" : "Review questions"} <ArrowIcon /></button></div>
    </div>
    <div className="hipaa-category-strip">{Object.entries(score.categories).map(([category, value]) => <span key={category}><strong>{value}%</strong><small>{category.replace(" Safeguards", "")}</small></span>)}<span className="hipaa-confirmed-score"><strong>{score.assessedQuestionCount}</strong><small>Questions answered</small></span></div>
    {open && <div className="hipaa-review-panel">
      <section className="hipaa-handoff-card"><div><span className="section-kicker">Finished PDF follow-up</span><h3>{score.notYetAssessedCount ? "Unanswered questions will travel with the report." : "The HIPAA review is complete."}</h3><p>{score.notYetAssessedCount ? "Any questions left as Not sure or skipped during the meeting will be added as fillable pages in the finished client PDF. When the completed copy is returned, review the answers here and generate the revised report and score." : "No follow-up questionnaire will be added to the finished PDF unless a question is reopened or changed to Not sure."}</p></div><div><strong>{score.notYetAssessedCount}</strong><span>{score.notYetAssessedCount === 1 ? "question for follow-up" : "questions for follow-up"}</span><small>Included automatically in the finished client PDF</small></div></section>
      <div className="hipaa-review-intro"><div><span className="section-kicker">Quick readiness workflow</span><h3>Choose an answer. Add a note only when it helps.</h3><p>The workflow is condensed into 12 practical questions. Supporting files, evidence dates, owners, and target dates are not required to complete the readiness check.</p></div><details className="hipaa-assessment-settings"><summary>Optional assessment dates</summary><div className="hipaa-period"><label><span>Period start</span><input type="date" value={project.hipaa.reportingPeriod.start} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAssessment({ ...project, hipaa: { ...project.hipaa, reportingPeriod: { ...project.hipaa.reportingPeriod, start: event.target.value } } })} /></label><label><span>Period end</span><input type="date" value={project.hipaa.reportingPeriod.end} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAssessment({ ...project, hipaa: { ...project.hipaa, reportingPeriod: { ...project.hipaa.reportingPeriod, end: event.target.value } } })} /></label></div></details></div>
      <div className="hipaa-owner-tabs">{OWNERSHIP.map((item) => <button key={item.value} type="button" className={ownership === item.value ? "active" : ""} onClick={() => setOwnership(item.value)}><strong>{item.label}</strong><small>{groupComplete(item.value)}/{HIPAA_QUESTIONS.filter((q) => q.ownership === item.value).length} answered</small></button>)}</div>
      <div className="hipaa-owner-description"><span>{OWNERSHIP.find((item) => item.value === ownership)?.description}</span><strong>Only Not sure answers move into the live presentation.</strong></div>
      <div className="hipaa-question-list">{groupQuestions.map((question) => <QuestionEditor key={question.id} project={project} questionId={question.id} onUpdate={updateAssessment} />)}</div>
      <section className="hipaa-confirmation-card">
        <div><span className="section-kicker">Client confirmation</span><h3>Finalize the readiness snapshot</h3><p>The client confirms the reviewed answers and accepts responsibility for client-provided information. Questions marked Not sure remain visibly incomplete.</p></div>
        <div className="hipaa-confirmation-form"><label><span>Client confirmer</span><input value={confirmer} onChange={(event: ChangeEvent<HTMLInputElement>) => setConfirmer(event.target.value)} placeholder="Name and title" /></label><label className="confirmation-check"><input type="checkbox" checked={project.hipaa.clientConfirmation.acceptedResponsibility} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAssessment({ ...project, hipaa: { ...project.hipaa, clientConfirmation: { ...project.hipaa.clientConfirmation, acceptedResponsibility: event.target.checked } } })} /> I confirm the client reviewed the assessment and accepts responsibility for client-provided information.</label><button className="button primary" type="button" disabled={!project.hipaa.clientConfirmation.acceptedResponsibility} onClick={() => { try { setConfirmError(""); updateAssessment(confirmHipaaAssessment(project, confirmer)); } catch (error) { setConfirmError(error instanceof Error ? error.message : "Assessment could not be confirmed."); } }}>Confirm and save snapshot</button>{confirmError && <span className="field-error">{confirmError}</span>}{project.hipaa.clientConfirmation.status === "confirmed" && <span className="hipaa-confirmed"><CheckIcon /> Confirmed by {project.hipaa.clientConfirmation.confirmer}</span>}</div>
      </section>
      <div className="hipaa-disclaimer">{HIPAA_DISCLAIMER}</div>
    </div>}
  </section>;
}
