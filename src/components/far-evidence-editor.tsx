"use client";

import type { ChangeEvent } from "react";
import type { Project, FarReviewItem } from "@/lib/projects/types";
import type { FarCategory } from "@/lib/intelligence/browser/far-evidence";
import {
  addFarManualItem,
  farCandidates,
  farReviewEntry,
  farSourceFile,
  FAR_CATEGORY_LABEL,
  FAR_CATEGORY_LIMIT,
  safeFarClientText,
  updateFarReviewItem,
} from "@/lib/far/far-review";
import styles from "./far-evidence.module.css";

const CATEGORY_ORDER: FarCategory[] = ["service-value", "open-decision", "potential-adjustment"];

export function FarEvidenceEditor({ project, onUpdate }: { project: Project; onUpdate: (value: Project) => void }) {
  const source = farSourceFile(project);
  if (!source) return null;
  const candidates = farCandidates(project);
  const manual = (project.farReview?.items ?? []).filter((item) => item.sourceFileId === source.id && item.id.includes(":manual_"));
  const rows: FarReviewItem[] = [
    ...candidates.map((item) => farReviewEntry(project, item.recordId) ?? {
      id: item.recordId, sourceFileId: item.sourceFileId, category: item.category,
      clientText: item.suggestion, evidence: item.evidence, approved: false,
    }),
    ...manual,
  ];
  const approvedCount = rows.filter((item) => item.approved && safeFarClientText(item.clientText)).length;
  const selectedPriorityCount = rows.filter((item) => item.prioritySelected && item.approved && item.category !== "service-value").length;

  function patch(item: FarReviewItem, change: Partial<FarReviewItem>) {
    onUpdate(updateFarReviewItem(project, { ...item, ...change }));
  }

  return (
    <section className={styles.root} aria-labelledby="far-editor-heading">
      <div className={styles.heading}>
        <div>
          <span className={styles.kicker}>INTERNAL PREPARATION</span>
          <h3 id="far-editor-heading">FAR talking points</h3>
          <p>Pick the strongest evidence, adjust the wording, and approve only what the client should see.</p>
        </div>
        <span className={styles.count}>{approvedCount} approved · {Math.min(3, selectedPriorityCount)} priority picks</span>
      </div>
      {candidates.length === 0 && <p className={styles.empty}>No standard sections detected. Add your own talking points below using the FAR.</p>}
      {CATEGORY_ORDER.map((category) => {
        const entries = rows.filter((item) => item.category === category);
        return <div key={category} className={styles.group}>
          <div className={styles.groupHeading}><strong>{FAR_CATEGORY_LABEL[category]}</strong><small>Up to {FAR_CATEGORY_LIMIT[category]} shown</small><button type="button" onClick={() => onUpdate(addFarManualItem(project, category))}>+ Add point</button></div>
          {entries.map((item) => {
            const allowed = safeFarClientText(item.clientText);
            const approvedInCategory = entries.filter((other) => other.approved && safeFarClientText(other.clientText));
            const atLimit = !item.approved && approvedInCategory.length >= FAR_CATEGORY_LIMIT[category];
            return <article key={item.id} className={styles.row}>
              <div className={styles.sourceExcerpt}><span>From FAR · internal only</span><p>{item.evidence}</p></div>
              <label className={styles.clientLine}><span>Client-facing text</span>
                <input value={item.clientText} maxLength={165} onChange={(event: ChangeEvent<HTMLInputElement>) => patch(item, { clientText: event.target.value, approved: false })} placeholder="Short, neutral, source-supported statement" />
              </label>
              <div className={styles.selection}>
                <label className={styles.approve}><input type="checkbox" checked={Boolean(item.approved && allowed)} disabled={!allowed || atLimit} onChange={(event: ChangeEvent<HTMLInputElement>) => patch(item, { approved: event.target.checked })} /><span>Client approved</span></label>
                {category !== "service-value" && <label className={styles.approve}>
                  <input type="checkbox" checked={Boolean(item.prioritySelected && item.approved)} disabled={!item.approved || !allowed || (!item.prioritySelected && selectedPriorityCount >= 3)}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => patch(item, { prioritySelected: event.target.checked })} />
                  <span>Top 3 priority</span>
                </label>}
              </div>
              {!allowed && <small className={styles.warning}>Keep it to 12–165 characters; remove ticket numbers, names with titles, emails and prices.</small>}
            </article>;
          })}
        </div>;
      })}
      <p className={styles.footnote}>Only approved points can appear for clients. Choose up to three to feature; if none are selected, the first approved open decisions are suggested. FAR history never changes the THR score.</p>
    </section>
  );
}
