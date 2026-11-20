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

  const ownerStatus = owner === "client" ? "Your team to confirm" : "Advantage to verify";

  return <article className={styles.followUpOwnerCard} data-owner={owner} aria-label={question.title + ": " + ownerStatus}>
    <div className={styles.followUpOwnerCardHeader}>
      <div className={styles.followUpOwnerHeading}>
        <span className={styles.followUpOwnerNumber}>{question.id.replace("SEC-", "")}</span>
        <strong>{question.title}</strong>
      </div>
      <span className={styles.followUpOwnerStatus}>{ownerStatus}</span>
    </div>
    <div className={styles.followUpOwnerAssignment}>
      <span className={styles.followUpOwnerLabel}>Responsible party</span>
      <div className={styles.followUpOwnerOptions} role="group" aria-label={question.title + " responsible party"}>
        <button type="button" aria-pressed={owner === "advantage"} className={owner === "advantage" ? styles.followUpOwnerActive : ""} onClick={() => update({ followUpOwner: "advantage" })}>Advantage</button>
        <button type="button" aria-pressed={owner === "client"} className={owner === "client" ? styles.followUpOwnerActive : ""} onClick={() => update({ followUpOwner: "client" })}>Your team</button>
      </div>
    </div>
    <details className={styles.followUpOwnerPlan} defaultOpen={Boolean(draft.trim())}>
      <summary>{draft.trim() ? "Edit next step" : "Add next step"} <small>(optional)</small></summary>
      <label>
        <span className={styles.followUpPlanLabel}>Next action</span>
        <textarea rows={2} value={draft} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => { setDraft(event.target.value); setDirty(true); }}
          onBlur={commitAction} placeholder="Add a specific follow-up if needed." aria-label={question.title + " next action"} />
      </label>
    </details>
  </article>;
}
