"use client";

import type { ChangeEvent } from "react";
import type { HipaaAnswer, HipaaQuestionDefinition, Project } from "@/lib/projects/types";
import { securityFollowUpOwner } from "@/lib/hipaa/follow-up-owner";
import { withUpdatedHipaaAnswer } from "@/lib/hipaa/engine";
import styles from "./security-review-premium.module.css";

export function SecurityFollowUpOwnerEditor({
  project, question, answer, onUpdate,
}: {
  project: Project;
  question: HipaaQuestionDefinition;
  answer: HipaaAnswer;
  onUpdate: (project: Project) => void;
}) {
  const owner = securityFollowUpOwner(question, answer);
  const update = (patch: Partial<HipaaAnswer>) => onUpdate(withUpdatedHipaaAnswer(project, question.id, patch));
  return <div className={styles.followUpOwnerCard}>
    <div className={styles.followUpOwnerCardHeader}>
      <span>{question.id}</span>
      <strong>{question.title}</strong>
    </div>
    <span className={styles.followUpOwnerLabel}>Who will follow up?</span>
    <div className={styles.followUpOwnerOptions} role="group" aria-label={question.title + " follow-up owner"}>
      <button type="button" aria-pressed={owner === "advantage"} className={owner === "advantage" ? styles.followUpOwnerActive : ""} onClick={() => update({ followUpOwner: "advantage" })}>Advantage will verify</button>
      <button type="button" aria-pressed={owner === "client"} className={owner === "client" ? styles.followUpOwnerActive : ""} onClick={() => update({ followUpOwner: "client" })}>Client will confirm</button>
    </div>
    <label className={styles.followUpOwnerPlan}>
      <span>Next step</span>
      <textarea rows={2} value={answer.recommendedAction} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => update({ recommendedAction: event.target.value })}
        placeholder={owner === "advantage" ? "What should Advantage check or confirm?" : "What should the client check or provide?"} />
    </label>
    <small>{owner === "client"
      ? "A fill-in question will appear in the client's PDF."
      : "This stays on the review follow-up list; no client fill-in question."}</small>
  </div>;
}
