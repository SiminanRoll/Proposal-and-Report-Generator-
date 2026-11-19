"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import type { HipaaAnswer, HipaaQuestionDefinition, Project } from "@/lib/projects/types";
import { securityFollowUpOwner } from "@/lib/hipaa/follow-up-owner";
import { withUpdatedHipaaAnswer } from "@/lib/hipaa/engine";
import styles from "./security-review-premium.module.css";

/** Presenter-only ownership controls, not a client-facing questionnaire card. */
export function SecurityFollowUpOwnerEditor({
  project, question, answer, onUpdate,
}: {
  project: Project;
  question: HipaaQuestionDefinition;
  answer: HipaaAnswer;
  onUpdate: (project: Project) => void;
}) {
  const owner = securityFollowUpOwner(question, answer);
  const [draft, setDraft] = useState(answer.recommendedAction);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setDraft(answer.recommendedAction);
    else if (draft === answer.recommendedAction) setDirty(false);
  }, [answer.recommendedAction, dirty, draft]);

  // Include any pending text when changing the owner so a button click cannot
  // overwrite a not-yet-saved next step from the same card.
  function update(patch: Partial<HipaaAnswer>) {
    const pendingText = dirty && draft !== answer.recommendedAction ? { recommendedAction: draft } : {};
    onUpdate(withUpdatedHipaaAnswer(project, question.id, { ...pendingText, ...patch }));
  }
  function commitAction() {
    if (dirty && draft !== answer.recommendedAction) update({ recommendedAction: draft });
  }

  const hint = owner === "advantage"
    ? question.advantageConfirms[0] || "What will Advantage verify?"
    : question.clientConfirms[0] || "What will the client confirm?";

  return <article className={styles.followUpOwnerCard} data-owner={owner}>
    <div className={styles.followUpOwnerCardHeader}>
      <div className={styles.followUpOwnerHeading}>
        <span>{question.id}</span>
        <strong>{question.title}</strong>
      </div>
      <span className={styles.followUpOwnerStatus}>{owner === "client" ? "Client PDF" : "Our follow-up"}</span>
    </div>
    <div className={styles.followUpOwnerAssignment}>
      <span className={styles.followUpOwnerLabel}>Assigned to</span>
      <div className={styles.followUpOwnerOptions} role="group" aria-label={question.title + " follow-up owner"}>
        <button type="button" aria-pressed={owner === "advantage"} className={owner === "advantage" ? styles.followUpOwnerActive : ""} onClick={() => update({ followUpOwner: "advantage" })}>Advantage</button>
        <button type="button" aria-pressed={owner === "client"} className={owner === "client" ? styles.followUpOwnerActive : ""} onClick={() => update({ followUpOwner: "client" })}>Client</button>
      </div>
    </div>
    <label className={styles.followUpOwnerPlan}>
      <span>Next action</span>
      <textarea rows={2} value={draft} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => { setDraft(event.target.value); setDirty(true); }}
        onBlur={commitAction} placeholder={hint} aria-label={question.title + " next action"} />
    </label>
  </article>;
}
