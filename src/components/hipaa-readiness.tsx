"use client";

import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { createId } from "@/lib/projects/factory";
import { deleteLocalSourceFiles, saveLocalSourceFile } from "@/lib/projects/file-store";
import type { HipaaAnswer, HipaaEvidenceSource, HipaaOwnership, HipaaResponse, Project } from "@/lib/projects/types";
import { HIPAA_QUESTIONS } from "@/lib/hipaa/questions";
import {
  HIPAA_DISCLAIMER,
  answerIsComplete,
  answerRequirements,
  confirmHipaaAssessment,
  enableHipaaAssessment,
  scoreHipaaAssessment,
  withUpdatedHipaaAnswer,
} from "@/lib/hipaa/engine";
import { downloadHipaaAppendixHtml } from "@/lib/hipaa/export";
import { ArrowIcon, CheckIcon, FileIcon, SparkIcon } from "./icons";

const RESPONSES: Array<{ value: HipaaResponse; label: string }> = [
  { value: "yes", label: "Yes" },
  { value: "partially", label: "Partially" },
  { value: "no", label: "No" },
  { value: "not-applicable", label: "Not Applicable" },
  { value: "not-yet-assessed", label: "Not Yet Assessed" },
];
const EVIDENCE_SOURCES: HipaaEvidenceSource[] = [
  "Imported technical report",
  "Advantage-managed system",
  "Advantage technician verification",
  "Client-provided documentation",
  "Client verbal confirmation",
  "Joint review",
  "Vendor documentation",
  "Not yet verified",
];
const OWNERSHIP: Array<{ value: HipaaOwnership; label: string; description: string }> = [
  { value: "advantage-prefill", label: "Advantage prefill", description: "7 technical controls proposed from managed-system evidence" },
  { value: "joint", label: "Joint review", description: "8 controls requiring technical and operational confirmation" },
  { value: "client", label: "Client confirmation", description: "16 policy, workforce, vendor, and facility controls" },
];

function responseLabel(value: HipaaResponse): string { return RESPONSES.find((item) => item.value === value)?.label ?? value; }
function ownershipLabel(value: HipaaOwnership): string { return OWNERSHIP.find((item) => item.value === value)?.label ?? value; }
function answerFor(project: Project, questionId: string): HipaaAnswer { return project.hipaa.answers.find((answer) => answer.questionId === questionId)!; }

function QuestionEditor({ project, questionId, onUpdate }: { project: Project; questionId: string; onUpdate: (project: Project) => void }) {
  const question = HIPAA_QUESTIONS.find((item) => item.id === questionId)!;
  const answer = answerFor(project, questionId);
  const issues = answerRequirements(answer);
  const fileRef = useRef<HTMLInputElement>(null);
  const prompts = [...question.reviewPrompts, ...question.clientConfirms.map((item) => `Client: ${item}`), ...question.advantageConfirms.map((item) => `Advantage: ${item}`), ...question.evidenceHints];

  function patch(value: Partial<HipaaAnswer>) { onUpdate(withUpdatedHipaaAnswer(project, questionId, value)); }
  async function attachEvidence(file: File) {
    const id = createId("hipaa_evidence");
    try {
      if (answer.evidenceAttachment?.id) await deleteLocalSourceFiles([answer.evidenceAttachment.id]);
      await saveLocalSourceFile(id, file);
      patch({ evidenceAttachment: { id, name: file.name, mimeType: file.type, size: file.size, addedAt: new Date().toISOString() }, evidenceSource: answer.evidenceSource === "Not yet verified" ? "Client-provided documentation" : answer.evidenceSource });
    } catch {
      patch({ internalNotes: `${answer.internalNotes}${answer.internalNotes ? "\n" : ""}Evidence file selected but could not be cached by this browser: ${file.name}` });
    }
  }

  return <details className={`hipaa-question ${answerIsComplete(answer) ? "complete" : "incomplete"}`}>
    <summary>
      <span className="hipaa-question-number">{question.id.replace("HIPAA-", "")}</span>
      <span className="hipaa-question-summary"><small>{question.category} · {ownershipLabel(question.ownership)}</small><strong>{question.title}</strong></span>
      <span className={`hipaa-response-badge response-${answer.response}`}>{responseLabel(answer.response)}</span>
      <span className="hipaa-completion-mark">{answerIsComplete(answer) ? <CheckIcon /> : issues.length}</span>
    </summary>
    <div className="hipaa-question-body">
      <p className="hipaa-question-text">{question.question}</p>
      <p className="hipaa-explanation">{question.plainLanguageExplanation}</p>
      {prompts.length > 0 && <div className="hipaa-prompts"><span>Review prompts</span>{prompts.map((item) => <small key={item}>{item}</small>)}</div>}
      <div className="hipaa-response-grid" role="group" aria-label={`Response for ${question.id}`}>
        {RESPONSES.map((item) => <button key={item.value} type="button" className={answer.response === item.value ? "active" : ""} onClick={() => patch({ response: item.value, riskSeverity: item.value === "no" ? "high" : item.value === "partially" ? "moderate" : "none" })}>{item.label}</button>)}
      </div>
      <div className="hipaa-form-grid">
        <label className="wide"><span>{answer.response === "not-applicable" ? "Why this does not apply *" : "Notes and supporting evidence"}</span><textarea rows={4} value={answer.internalNotes} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => patch({ internalNotes: event.target.value })} placeholder="Document the policy, process, technical proof, or client confirmation." /></label>
        <label><span>Evidence source</span><select value={answer.evidenceSource} onChange={(event: ChangeEvent<HTMLSelectElement>) => patch({ evidenceSource: event.target.value as HipaaEvidenceSource })}>{EVIDENCE_SOURCES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Evidence date</span><input type="date" value={answer.evidenceDate.slice(0, 10)} onChange={(event: ChangeEvent<HTMLInputElement>) => patch({ evidenceDate: event.target.value })} /></label>
        <label className="wide"><span>Client-visible observation</span><textarea rows={3} value={answer.clientVisibleObservation} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => patch({ clientVisibleObservation: event.target.value })} placeholder="Plain-language finding for the executive report." /></label>
        {(answer.response === "partially" || answer.response === "no") && <label className="wide"><span>Recommended corrective action *</span><textarea rows={3} value={answer.recommendedAction} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => patch({ recommendedAction: event.target.value })} placeholder="What should be done next?" /></label>}
        <label><span>Responsible party</span><input value={answer.responsibleParty} onChange={(event: ChangeEvent<HTMLInputElement>) => patch({ responsibleParty: event.target.value })} placeholder="Client, Advantage, or joint" /></label>
        <label><span>Target date</span><input type="date" value={answer.targetDate} onChange={(event: ChangeEvent<HTMLInputElement>) => patch({ targetDate: event.target.value })} /></label>
      </div>
      <div className="hipaa-evidence-row"><input ref={fileRef} hidden type="file" onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void attachEvidence(file); }} /><button className="button secondary compact" type="button" onClick={() => fileRef.current?.click()}><FileIcon />{answer.evidenceAttachment ? "Replace evidence" : "Attach evidence"}</button>{answer.evidenceAttachment && <span>{answer.evidenceAttachment.name}</span>}<label className="hipaa-report-toggle"><input type="checkbox" checked={answer.includeInReport} onChange={(event: ChangeEvent<HTMLInputElement>) => patch({ includeInReport: event.target.checked })} /> Include in report</label></div>
      {issues.length > 0 && <div className="hipaa-issues">{issues.map((issue) => <span key={issue}>{issue}</span>)}</div>}
    </div>
  </details>;
}

export function HipaaReadiness({ project, onUpdate }: { project: Project; onUpdate: (project: Project) => void }) {
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

  if (!project.hipaa.enabled) return <section className="workspace-card hipaa-invite">
    <div><span className="section-kicker"><SparkIcon /> Optional assessment</span><h2>Add HIPAA Security Readiness</h2><p>Use the 31-question ownership workflow to combine technical evidence with client-confirmed policies, practices, and vendor responsibilities.</p></div>
    <div className="hipaa-invite-actions"><span><strong>7</strong> technical prefills</span><span><strong>8</strong> joint questions</span><span><strong>16</strong> client questions</span><button className="button primary" type="button" onClick={() => { updateAssessment(enableHipaaAssessment(project)); setOpen(true); }}>Start HIPAA assessment <ArrowIcon /></button></div>
    <small className="hipaa-disclaimer-short">Readiness assessment only—not a certification, formal audit, legal opinion, or guarantee of compliance.</small>
  </section>;

  return <section className="workspace-card hipaa-module" id="hipaa-readiness">
    <div className="hipaa-module-header">
      <div><span className="section-kicker">HIPAA Security Readiness</span><h2>{score.label}</h2><p>{score.confirmedQuestionCount} of 31 questions complete · {score.notYetAssessedCount} will move into the client presentation</p></div>
      <div className="hipaa-score-ring"><strong>{score.overall}%</strong><span>displayed readiness</span><small>{score.completionPercentage}% assessed</small></div>
      <div className="hipaa-module-actions"><button className="button secondary" type="button" onClick={() => downloadHipaaAppendixHtml(project)}>Download appendix</button><button className="button primary" type="button" onClick={() => setOpen((value) => !value)}>{open ? "Close review" : "Review assessment"} <ArrowIcon /></button></div>
    </div>
    <div className="hipaa-category-strip">{Object.entries(score.categories).map(([category, value]) => <span key={category}><strong>{value}%</strong><small>{category.replace(" Safeguards", "")}</small></span>)}<span className="hipaa-confirmed-score"><strong>{score.confirmedReadiness}%</strong><small>Confirmed answers</small></span></div>
    {open && <div className="hipaa-review-panel">
      <div className="hipaa-review-intro"><div><span className="section-kicker">Ownership workflow</span><h3>Review the right questions with the right owner.</h3><p>Technical answers are proposed from imported evidence. Joint and client-owned questions remain clearly separated.</p></div><div className="hipaa-period"><label><span>Reporting period start</span><input type="date" value={project.hipaa.reportingPeriod.start} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAssessment({ ...project, hipaa: { ...project.hipaa, reportingPeriod: { ...project.hipaa.reportingPeriod, start: event.target.value } } })} /></label><label><span>Reporting period end</span><input type="date" value={project.hipaa.reportingPeriod.end} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAssessment({ ...project, hipaa: { ...project.hipaa, reportingPeriod: { ...project.hipaa.reportingPeriod, end: event.target.value } } })} /></label></div></div>
      <div className="hipaa-owner-tabs">{OWNERSHIP.map((item) => <button key={item.value} type="button" className={ownership === item.value ? "active" : ""} onClick={() => setOwnership(item.value)}><strong>{item.label}</strong><small>{groupComplete(item.value)}/{HIPAA_QUESTIONS.filter((q) => q.ownership === item.value).length} complete</small></button>)}</div>
      <div className="hipaa-owner-description"><span>{OWNERSHIP.find((item) => item.value === ownership)?.description}</span><strong>Anything not completed here becomes a live presentation question.</strong></div>
      <div className="hipaa-question-list">{groupQuestions.map((question) => <QuestionEditor key={question.id} project={project} questionId={question.id} onUpdate={updateAssessment} />)}</div>
      <section className="hipaa-confirmation-card">
        <div><span className="section-kicker">Client confirmation</span><h3>Finalize the readiness snapshot</h3><p>The client confirms reviewed answers and accepts responsibility for client-provided information. Questions skipped during the presentation remain visibly incomplete in the snapshot.</p></div>
        <div className="hipaa-confirmation-form"><label><span>Client confirmer</span><input value={confirmer} onChange={(event: ChangeEvent<HTMLInputElement>) => setConfirmer(event.target.value)} placeholder="Name and title" /></label><label className="confirmation-check"><input type="checkbox" checked={project.hipaa.clientConfirmation.acceptedResponsibility} onChange={(event: ChangeEvent<HTMLInputElement>) => updateAssessment({ ...project, hipaa: { ...project.hipaa, clientConfirmation: { ...project.hipaa.clientConfirmation, acceptedResponsibility: event.target.checked } } })} /> I confirm the client has reviewed the completed assessment and accepts responsibility for client-provided information.</label><button className="button primary" type="button" disabled={!project.hipaa.clientConfirmation.acceptedResponsibility} onClick={() => { try { setConfirmError(""); updateAssessment(confirmHipaaAssessment(project, confirmer)); } catch (error) { setConfirmError(error instanceof Error ? error.message : "Assessment could not be confirmed."); } }}>Confirm and save snapshot</button>{confirmError && <span className="field-error">{confirmError}</span>}{project.hipaa.clientConfirmation.status === "confirmed" && <span className="hipaa-confirmed"><CheckIcon /> Confirmed by {project.hipaa.clientConfirmation.confirmer}</span>}</div>
      </section>
      <div className="hipaa-disclaimer">{HIPAA_DISCLAIMER}</div>
    </div>}
  </section>;
}
