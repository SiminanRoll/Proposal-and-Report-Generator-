"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import type { FarReviewItem, Project } from "@/lib/projects/types";
import { farCandidates, farReviewEntry, farSourceFile, safeFarClientText } from "@/lib/far/far-review";
import { FAR_PRIORITY_STATUSES } from "@/lib/far/far-priorities";
import styles from "./far-generation-review-dialog.module.css";

type DraftItem = FarReviewItem & { included: boolean };

function suggestionsFor(project: Project): DraftItem[] {
  const source = farSourceFile(project);
  if (!source) return [];
  const candidates: FarReviewItem[] = farCandidates(project)
    .filter((candidate) => candidate.category !== "service-value")
    .map((candidate) => farReviewEntry(project, candidate.recordId) ?? {
      id: candidate.recordId,
      sourceFileId: candidate.sourceFileId,
      category: candidate.category,
      clientText: candidate.suggestion,
      evidence: candidate.evidence,
      approved: false,
      priorityStatus: "verify" as const,
      priorityOwner: "advantage" as const,
    });
  const manual = (project.farReview?.items ?? [])
    .filter((item) => item.sourceFileId === source.id && item.category !== "service-value" && !candidates.some((candidate) => candidate.id === item.id));
  const all = [...candidates, ...manual];
  const order = (item: FarReviewItem) => item.prioritySelected ? 0 : item.approved ? 1 : 2;
  const sorted = all.sort((a, b) => order(a) - order(b));
  const selected = sorted.filter((item) => item.prioritySelected && item.approved && safeFarClientText(item.clientText)).slice(0, 3);
  const initial = selected.length ? selected.map((item) => item.id) : sorted.filter((item) => safeFarClientText(item.clientText)).slice(0, 3).map((item) => item.id);
  return sorted.map((item) => ({ ...item, included: initial.includes(item.id) }));
}

/** An intentional, presenter-only review gate before building a report from FAR material. */
export function FarGenerationReviewDialog({
  project, onCancel, onGenerate,
}: {
  project: Project;
  onCancel: () => void;
  onGenerate: (next: Project) => void;
}) {
  const [rows, setRows] = useState<DraftItem[]>(() => suggestionsFor(project));
  const [manualCount, setManualCount] = useState(0);
  const selected = rows.filter((item) => item.included);
  const available = rows.filter((item) => !item.included);
  const hasUnsafeSelection = selected.some((item) => !safeFarClientText(item.clientText));
  const hasSelection = selected.length > 0;
  const canGenerate = skipFAR || (hasSelection && !hasUnsafeSelection && selected.length <= 3);
  const farName = farSourceFile(project)?.name ?? "FAR attachment";
  const headingId = "far-generation-review-title";

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onCancel]);

  function updateDraft(id: string, patch: Partial<DraftItem>) {
    setRows((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function addManualConcern() {
    if (rows.length >= 18) return;
    const source = farSourceFile(project);
    if (!source) return;
    const nextId = source.id + ":manual_review_" + Date.now() + "_" + manualCount;
    setManualCount((count) => count + 1);
    setRows((current) => [
      ...current,
      { id: nextId, sourceFileId: source.id, category: "open-decision", clientText: "", evidence: "Added during report preparation", approved: false, prioritySelected: false, included: current.filter((item) => item.included).length < 3, priorityStatus: "verify", priorityOwner: "advantage" },
    ]);
  }

  function prepareProject(skip: boolean): Project {
    const source = farSourceFile(project);
    if (!source) return project;
    const existing = project.farReview?.items ?? [];
    const selectedIds = new Set(skip ? [] : selected.map((row) => row.id));
    // Existing talking points are retained. Only the selected concerns are allowed
    // into the client-facing top-three decision section for this generated report.
    const retained = existing.map((item) => item.sourceFileId === source.id && item.category !== "service-value"
      ? { ...item, approved: selectedIds.has(item.id), prioritySelected: selectedIds.has(item.id) }
      : item);
    const written = rows.filter((row) => !skip && selectedIds.has(row.id)).map((row) => {
      const item: FarReviewItem = { ...row };
      return {
        ...item,
        approved: true,
        prioritySelected: true,
        clientText: item.clientText.trim(),
        priorityStatus: item.priorityStatus ?? "verify" as const,
      };
    });
    const updated = [...retained.filter((item) => !written.some((row) => row.id === item.id)), ...written];
    return { ...project, farReview: { items: updated, updatedAt: new Date().toISOString() } };
  }

  function generate(skip = false) {
    if (!skip && !canGenerate) return;
    onGenerate(prepareProject(skip));
  }

  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={headingId} aria-describedby="far-review-explainer">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>PRE-GENERATION REVIEW · INTERNAL</span>
          <h2 id={headingId}>Review your three FAR concerns</h2>
          <p id="far-review-explainer">Confirm which concerns belong in the Technology Health Review before anything is presented to your client.</p>
        </div>
        <button type="button" className={styles.close} onClick={onCancel} aria-label="Close FAR review">×</button>
      </header>
      <div className={styles.sourceLine}><span aria-hidden="true">◉</span><strong>{farName}</strong><span>Up to three priorities · {selected.length} selected</span></div>

      <div className={styles.body}>
        {rows.length === 0 && <div className={styles.empty}>
          <strong>No clear concerns were extracted from this FAR.</strong>
          <p>Add a concern in your own client-friendly wording, or generate the report without FAR findings.</p>
        </div>}
        {selected.map((item, index) => <article className={styles.concern} key={item.id}>
          <div className={styles.concernHeading}>
            <span className={styles.index}>{String(index + 1).padStart(2, "0")}</span>
            <strong>Concern {index + 1}</strong>
            <button className={styles.remove} type="button" onClick={() => updateDraft(item.id, { included: false })}>Remove from Top 3</button>
          </div>
          <label className={styles.field}>
            <span>Client-facing concern</span>
            <textarea rows={2} maxLength={165} value={item.clientText} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateDraft(item.id, { clientText: event.target.value })} />
          </label>
          {!safeFarClientText(item.clientText) && <p className={styles.validation}>Use 12–165 characters and remove internal identifiers, names with titles, email addresses, and pricing.</p>}
          <div className={styles.controls}>
            <label className={styles.field}>
              <span>Decision</span>
              <select value={item.priorityStatus ?? "verify"} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateDraft(item.id, { priorityStatus: event.target.value as FarReviewItem["priorityStatus"] })}>
                {FAR_PRIORITY_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span>Next-step owner</span>
              <select value={item.priorityOwner ?? "advantage"} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateDraft(item.id, { priorityOwner: event.target.value as FarReviewItem["priorityOwner"] })}>
                <option value="advantage">Advantage</option><option value="client">Client</option>
              </select>
            </label>
          </div>
          <details className={styles.detail}>
            <summary>Next action and source context <span aria-hidden="true">⌄</span></summary>
            <label className={styles.field}>
              <span>{item.priorityStatus === "resolved" ? "What was resolved?" : "Agreed next action (optional)"}</span>
              <textarea rows={2} maxLength={210} value={item.priorityStatus === "resolved" ? item.priorityResolutionNote ?? "" : item.priorityNextAction ?? ""}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateDraft(item.id, item.priorityStatus === "resolved" ? { priorityResolutionNote: event.target.value } : { priorityNextAction: event.target.value })} />
            </label>
            {item.evidence && <p className={styles.evidence}><strong>Internal source context:</strong> {item.evidence}</p>}
          </details>
        </article>)}
        {available.length > 0 && <div className={styles.more}>
          <strong>Other FAR suggestions</strong>
          {available.map((item) => <button type="button" key={item.id} disabled={selected.length >= 3}
            onClick={() => updateDraft(item.id, { included: true })}>
            <span aria-hidden="true">+</span><span>{item.clientText || "New concern"}</span>
          </button>)}
        </div>}
        {selected.length < 3 && <button className={styles.add} type="button" onClick={addManualConcern}>+ Add a concern</button>}
        <p className={styles.scoreNote}>Only approved wording is included. FAR history does not directly change the THR health score.</p>
      </div>
      <footer className={styles.footer}>
        <button type="button" className={styles.skip} onClick={() => generate(true)}>Generate without FAR priorities</button>
        <div>
          <button type="button" className={styles.cancel} onClick={onCancel}>Back</button>
          <button type="button" className={styles.generate} disabled={!canGenerate || !hasSelection} onClick={() => generate(false)}>Approve &amp; generate report <span aria-hidden="true">→</span></button>
        </div>
      </footer>
    </section>
  </div>;
}
