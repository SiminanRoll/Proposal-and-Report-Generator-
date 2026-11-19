"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import type { FarReviewItem, Project } from "@/lib/projects/types";
import { updateFarReviewItem } from "@/lib/far/far-review";
import { FAR_PRIORITY_STATUSES, farPriorityScoreLink, farPriorityStatus, farTopPriorities } from "@/lib/far/far-priorities";
import styles from "./far-top-priorities-presentation.module.css";

function PriorityCard({
  project, item, index, expanded, onExpand, onUpdate,
}: {
  project: Project; item: FarReviewItem; index: number; expanded: boolean;
  onExpand: () => void; onUpdate: (project: Project) => void;
}) {
  const status = farPriorityStatus(item);
  const link = farPriorityScoreLink(project, item);
  const [draft, setDraft] = useState(item.priorityNextAction ?? "");
  const [resolution, setResolution] = useState(item.priorityResolutionNote ?? "");
  const [dirty, setDirty] = useState(false);
  const [resolutionDirty, setResolutionDirty] = useState(false);
  useEffect(() => { if (!dirty) setDraft(item.priorityNextAction ?? ""); }, [item.priorityNextAction, dirty]);
  useEffect(() => { if (!resolutionDirty) setResolution(item.priorityResolutionNote ?? ""); }, [item.priorityResolutionNote, resolutionDirty]);
  function patch(changes: Partial<FarReviewItem>) {
    const pending = {
      ...(dirty ? { priorityNextAction: draft } : {}),
      ...(resolutionDirty ? { priorityResolutionNote: resolution } : {}),
    };
    onUpdate(updateFarReviewItem(project, { ...item, ...pending, ...changes }));
    setDirty(false);
    setResolutionDirty(false);
  }
  function saveDrafts() {
    if ((dirty && draft !== (item.priorityNextAction ?? "")) ||
        (resolutionDirty && resolution !== (item.priorityResolutionNote ?? ""))) patch({});
  }

  return <article className={styles.card} data-active={expanded} data-status={status}>
    <button type="button" className={styles.cardTop} aria-expanded={expanded} onClick={onExpand}>
      <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
      <span className={styles.cardCopy}>
        <strong>{item.clientText}</strong>
        <small>{link.area} <i>·</i> {link.note}</small>
      </span>
      <span className={styles.currentStatus}>{FAR_PRIORITY_STATUSES.find((row) => row.value === status)?.label}</span>
      <span className={styles.chevron} aria-hidden="true">{expanded ? "−" : "+"}</span>
    </button>
    {expanded && <div className={styles.cardDetails} data-presentation-interactive="true">
      <div className={styles.statusOptions} role="group" aria-label={"Decision for priority " + (index + 1)}>
        {FAR_PRIORITY_STATUSES.map((option) => <button type="button" key={option.value}
          className={status === option.value ? styles.selectedStatus : ""}
          aria-pressed={status === option.value}
          onClick={() => patch({ priorityStatus: option.value })}>{option.label}</button>)}
      </div>
      {status !== "later" && <div className={styles.decisionFields}>
        {status !== "resolved" && <div className={styles.ownerField}>
          <span>Owner</span>
          <div className={styles.ownerButtons} role="group" aria-label={"Priority " + (index + 1) + " owner"}>
            <button type="button" aria-pressed={(item.priorityOwner ?? "advantage") === "advantage"} onClick={() => patch({ priorityOwner: "advantage" })}>Advantage</button>
            <button type="button" aria-pressed={item.priorityOwner === "client"} onClick={() => patch({ priorityOwner: "client" })}>Client</button>
          </div>
        </div>}
        {status === "resolved"
          ? <label className={styles.actionField}><span>What was resolved?</span>
            <textarea rows={2} value={resolution} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => { setResolution(event.target.value); setResolutionDirty(true); }}
              onBlur={saveDrafts} placeholder="Briefly record what changed" />
          </label>
          : <label className={styles.actionField}><span>Next action</span>
            <textarea rows={2} value={draft} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => { setDraft(event.target.value); setDirty(true); }}
              onBlur={saveDrafts} placeholder={status === "verify" ? "What needs checking?" : "What happens next?"} />
          </label>}
        {status !== "resolved" && <label className={styles.dateField}><span>Target (optional)</span>
          <input type="date" value={item.priorityTargetDate ?? ""} onChange={(event: ChangeEvent<HTMLInputElement>) => patch({ priorityTargetDate: event.target.value })} />
        </label>}
      </div>}
      <p className={styles.insight}>{status === "resolved"
        ? "Reported resolved. The THR score only changes when current technical evidence confirms improvement."
        : status === "later"
        ? "Retained for a future review. No current score adjustment."
        : "Linked to the relevant review area, not a separate score. Confirmed measurements control the THR score."}</p>
    </div>}
  </article>;
}

export function FarTopPrioritiesPresentation({ project, onUpdate }: { project: Project; onUpdate: (project: Project) => void }) {
  const priorities = farTopPriorities(project);
  const [openId, setOpenId] = useState<string | null>(priorities[0]?.id ?? null);
  if (!priorities.length) return null;
  return <section className={styles.root} aria-labelledby="top-priorities-heading">
    <header className={styles.hero}>
      <div><span className={styles.eyebrow}>YOUR TECHNOLOGY ROADMAP</span>
        <h2 id="top-priorities-heading">Your top {priorities.length} priorit{priorities.length === 1 ? "y" : "ies"}</h2>
        <p>Three focused decisions. A clear plan for what comes next.</p></div>
      <div className={styles.heroMark} aria-hidden="true"><span>01</span><span>02</span><span>03</span></div>
    </header>
    <div className={styles.cards}>
      {priorities.map((item, index) => <PriorityCard key={item.id} project={project} item={item} index={index}
        expanded={openId === item.id} onExpand={() => setOpenId(openId === item.id ? null : item.id)} onUpdate={onUpdate} />)}
    </div>
    <footer className={styles.footer}>Suggested from the FAR and reviewed for client use. Only current verified evidence changes the THR score.</footer>
  </section>;
}
