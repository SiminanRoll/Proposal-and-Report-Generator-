"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReviewOutcome, ReviewOutcomeItem } from "@/lib/review-outcomes/types";
import { createReviewOutcomeItem, dispositionOption, normalizeReviewOutcome, REVIEW_DISPOSITION_OPTIONS } from "@/lib/review-outcomes/model";
import { applyTailoredReportPrompt } from "@/lib/review-outcomes/tailored-prompt";

interface PresentationDraft {
  title: string;
  executiveSummary: string;
}

interface Props {
  outcome: ReviewOutcome;
  presentation?: PresentationDraft;
  suggestions?: ReviewOutcomeItem[];
  saving?: boolean;
  heading?: string;
  description?: string;
  onClose: () => void;
  onSave: (value: { outcome: ReviewOutcome; presentation?: PresentationDraft }) => Promise<void> | void;
}

function today(): string { return new Date().toISOString().slice(0, 10); }

export function ReviewOutcomeEditor({ outcome, presentation, suggestions = [], saving = false, heading = "Update review outcome", description = "Keep the technical findings intact, then document what was actually decided with the client.", onClose, onSave }: Props) {
  const [draft, setDraft] = useState<ReviewOutcome>(() => normalizeReviewOutcome(outcome));
  const [presentationDraft, setPresentationDraft] = useState<PresentationDraft | undefined>(presentation ? { title: outcome.reportTitle || presentation.title, executiveSummary: outcome.executiveSummary || presentation.executiveSummary } : undefined);
  const [error, setError] = useState("");
  const [tailoredPrompt, setTailoredPrompt] = useState("");
  const [promptFeedback, setPromptFeedback] = useState<{ tone: "success" | "warning"; message: string } | null>(null);

  useEffect(() => {
    setDraft(normalizeReviewOutcome(outcome));
    setPresentationDraft(presentation ? { title: outcome.reportTitle || presentation.title, executiveSummary: outcome.executiveSummary || presentation.executiveSummary } : undefined);
    setError("");
    setTailoredPrompt("");
    setPromptFeedback(null);
  }, [outcome, presentation]);

  const includedCount = useMemo(() => draft.items.filter((item) => item.includeInReport).length, [draft.items]);

  function patchItem(id: string, patch: Partial<ReviewOutcomeItem>) {
    setDraft((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }

  function setDisposition(item: ReviewOutcomeItem, value: ReviewOutcomeItem["disposition"]) {
    const option = dispositionOption(value);
    patchItem(item.id, {
      disposition: value,
      responsibleParty: item.responsibleParty.trim() ? item.responsibleParty : option.defaultOwner,
    });
  }

  function addItem() {
    setDraft((current) => ({ ...current, status: current.status === "not-reviewed" ? "draft" : current.status, items: [...current.items, createReviewOutcomeItem()] }));
  }

  function useSuggestions() {
    if (!suggestions.length) return;
    setDraft((current) => ({ ...current, status: "draft", reviewedAt: current.reviewedAt || today(), items: suggestions.map((item) => createReviewOutcomeItem(item)) }));
  }

  function applyPrompt() {
    setError("");
    setPromptFeedback(null);
    try {
      const result = applyTailoredReportPrompt(tailoredPrompt, draft, presentationDraft);
      setDraft(result.outcome);
      if (result.presentation) setPresentationDraft(result.presentation);
      const applied = result.appliedFields.join(", ");
      setPromptFeedback({
        tone: result.warnings.length ? "warning" : "success",
        message: result.warnings.length
          ? `Applied ${applied}. ${result.warnings.join(" ")}`
          : `Applied ${applied}. Review the populated fields, then save the outcome.`,
      });
    } catch (promptError) {
      setError(promptError instanceof Error ? promptError.message : "The tailored report summary could not be applied.");
    }
  }

  async function save() {
    setError("");
    const included = draft.items.filter((item) => item.includeInReport);
    if (draft.status === "confirmed" && !draft.reviewedAt) {
      setError("Add the review date before confirming the agreed plan.");
      return;
    }
    if (draft.status !== "not-reviewed" && !draft.meetingSummary.trim() && !draft.agreedNextStep.trim() && !included.length) {
      setError("Add a meeting summary, agreed next step, or at least one included decision.");
      return;
    }
    const finalPresentation = presentationDraft ? { title: presentationDraft.title.trim(), executiveSummary: presentationDraft.executiveSummary.trim() } : undefined;
    await onSave({
      outcome: {
        ...draft,
        reportTitle: finalPresentation?.title ?? draft.reportTitle,
        executiveSummary: finalPresentation?.executiveSummary ?? draft.executiveSummary,
        lastUpdatedAt: new Date().toISOString(),
      },
      presentation: finalPresentation,
    });
  }

  return (
    <div className="review-outcome-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="review-outcome-dialog" role="dialog" aria-modal="true" aria-labelledby="review-outcome-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span className="compass-kicker">Conversation-driven plan</span><h2 id="review-outcome-title">{heading}</h2><p>{description}</p></div>
          <button type="button" className="compass-drawer-close" onClick={onClose} aria-label="Close review outcome editor">×</button>
        </header>

        <div className="review-outcome-body">
          <section className="review-outcome-section tailored-prompt-section">
            <div className="review-outcome-section-heading"><div><span>Transcript shortcut</span><h3>Apply a tailored report summary</h3></div><small>Paste the tailored summary generated from the review transcript. Normal headings are supported, and Meeting Summary also updates Summary Framing.</small></div>
            <label><span>Tailored report prompt</span><textarea rows={7} value={tailoredPrompt} onChange={(event) => { setTailoredPrompt(event.target.value); setPromptFeedback(null); }} placeholder={`Meeting Summary\nSummarize what changed and what the client shared.\n\nAgreed Next Step\nDescribe the coordinated next action.\n\nAgreed Decisions\n\n1. Retire the legacy server\nVerify remaining dependencies before decommissioning.\n\n2. Install client-purchased computers\nSchedule deployment after all equipment arrives.`} /></label>
            <div className="tailored-prompt-actions"><p>Applying the summary fills recognized headings and replaces the unsaved decision list only when numbered decisions are included. Nothing is saved until you select <strong>Save review outcome</strong>.</p><button type="button" className="button secondary" onClick={applyPrompt}>Apply tailored summary</button></div>
            {promptFeedback && <div className={`tailored-prompt-feedback ${promptFeedback.tone}`} role="status">{promptFeedback.message}</div>}
          </section>

          {presentationDraft && <section className="review-outcome-section tailor-report-section">
            <div className="review-outcome-section-heading"><div><span>Client-facing framing</span><h3>Tailor the report</h3></div><small>A TRS Meeting Summary automatically becomes the Summary Framing unless a separate Summary Framing is provided.</small></div>
            <label><span>Report title</span><input value={presentationDraft.title} onChange={(event) => setPresentationDraft((current) => ({ title: event.target.value, executiveSummary: current?.executiveSummary ?? "" }))} /></label>
            <label><span>Summary framing</span><textarea rows={4} value={presentationDraft.executiveSummary} onChange={(event) => setPresentationDraft((current) => ({ title: current?.title ?? "", executiveSummary: event.target.value }))} placeholder="Frame the review around the client conversation, priorities, and agreed direction—not a generic count of devices or findings." /></label>
          </section>}

          <section className="review-outcome-section">
            <div className="review-outcome-section-heading"><div><span>Review record</span><h3>What happened in the conversation?</h3></div><small>{includedCount} decision{includedCount === 1 ? "" : "s"} included in the report</small></div>
            <div className="review-outcome-grid two">
              <label><span>Plan status</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ReviewOutcome["status"] })}><option value="not-reviewed">Not reviewed</option><option value="draft">Draft outcome</option><option value="confirmed">Confirmed with client</option></select></label>
              <label><span>Review date</span><input type="date" value={draft.reviewedAt.slice(0, 10)} onChange={(event) => setDraft({ ...draft, reviewedAt: event.target.value })} /></label>
            </div>
            <label><span>Meeting summary</span><textarea rows={3} value={draft.meetingSummary} onChange={(event) => setDraft({ ...draft, meetingSummary: event.target.value })} placeholder="Example: The client has already ordered five replacement computers. The legacy server no longer needs replacement and will be retired after dependencies are verified." /></label>
            <label><span>Agreed next step</span><textarea rows={3} value={draft.agreedNextStep} onChange={(event) => setDraft({ ...draft, agreedNextStep: event.target.value })} placeholder="Example: Coordinate deployment of the client-purchased computers, verify server dependencies, then schedule secure decommissioning." /></label>
          </section>

          <section className="review-outcome-section">
            <div className="review-outcome-section-heading"><div><span>Agreed decisions</span><h3>Turn findings into the actual plan</h3></div><div className="review-outcome-heading-actions">{!draft.items.length && suggestions.length > 0 && <button type="button" className="button secondary compact" onClick={useSuggestions}>Start from findings</button>}<button type="button" className="button secondary compact" onClick={addItem}>+ Add decision</button></div></div>
            {!draft.items.length ? <div className="review-outcome-empty"><strong>No conversation decisions recorded yet.</strong><p>Add only the items discussed with the client. Technical findings remain unchanged elsewhere in the report.</p></div> : <div className="review-outcome-items">{draft.items.map((item, index) => <article key={item.id}>
              <div className="review-outcome-item-top"><b>{String(index + 1).padStart(2, "0")}</b><label className="review-outcome-include"><input type="checkbox" checked={item.includeInReport} onChange={(event) => patchItem(item.id, { includeInReport: event.target.checked })} /><span>Include in PDF</span></label><button type="button" onClick={() => setDraft((current) => ({ ...current, items: current.items.filter((candidate) => candidate.id !== item.id) }))}>Remove</button></div>
              <div className="review-outcome-grid two">
                <label><span>Plan item</span><input value={item.title} onChange={(event) => patchItem(item.id, { title: event.target.value })} placeholder="Deploy client-purchased workstations" /></label>
                <label><span>Outcome</span><select value={item.disposition} onChange={(event) => setDisposition(item, event.target.value as ReviewOutcomeItem["disposition"])}>{REVIEW_DISPOSITION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              </div>
              <label><span>Technical finding</span><textarea rows={2} value={item.technicalFinding} onChange={(event) => patchItem(item.id, { technicalFinding: event.target.value })} placeholder="The factual condition identified by Ninja, ScalePad, or the review." /></label>
              <label><span>Client-facing plan language</span><textarea rows={3} value={item.clientFacingNote} onChange={(event) => patchItem(item.id, { clientFacingNote: event.target.value })} placeholder="Describe what was agreed without changing the underlying finding." /></label>
              <div className="review-outcome-grid two">
                <label><span>Responsible party</span><input value={item.responsibleParty} onChange={(event) => patchItem(item.id, { responsibleParty: event.target.value })} placeholder={dispositionOption(item.disposition).defaultOwner} /></label>
                <label><span>Target date or timing</span><input value={item.targetDate} onChange={(event) => patchItem(item.id, { targetDate: event.target.value })} placeholder={dispositionOption(item.disposition).defaultTiming} /></label>
              </div>
              <div className="review-outcome-grid two">
                <label><span>Client responsibility</span><textarea rows={2} value={item.clientResponsibility ?? ""} onChange={(event) => patchItem(item.id, { clientResponsibility: event.target.value })} placeholder="What the client needs to provide, approve, purchase, or confirm." /></label>
                <label><span>Advantage responsibility</span><textarea rows={2} value={item.advantageResponsibility ?? ""} onChange={(event) => patchItem(item.id, { advantageResponsibility: event.target.value })} placeholder="What Advantage will validate, quote, schedule, migrate, deploy, or retire." /></label>
              </div>
              <label className="review-outcome-quoted"><input type="checkbox" checked={Boolean(item.quoted)} onChange={(event) => patchItem(item.id, { quoted: event.target.checked })} /><span>Quote completed for this project</span></label>
              <label><span>Internal note</span><textarea rows={2} value={item.internalNote} onChange={(event) => patchItem(item.id, { internalNote: event.target.value })} placeholder="Internal context that should not appear in the PDF." /></label>
            </article>)}</div>}
          </section>
        </div>

        <footer>
          <div>{error && <span className="review-outcome-error" role="alert">{error}</span>}</div>
          <div><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button type="button" className="button primary" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save review outcome"}</button></div>
        </footer>
      </section>
    </div>
  );
}
