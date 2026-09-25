"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReviewOutcome, ReviewOutcomeItem } from "@/lib/review-outcomes/types";
import { createReviewOutcomeItem, normalizeReviewOutcome } from "@/lib/review-outcomes/model";
import { applyTailoredReportPrompt } from "@/lib/review-outcomes/tailored-prompt";
import { planningModeDefaultNextStep, type PlanningRecommendationMode } from "@/lib/outcomes/planning-mode";

interface PresentationDraft {
  title: string;
  executiveSummary: string;
}

interface Props {
  outcome: ReviewOutcome;
  presentation?: PresentationDraft;
  suggestions?: ReviewOutcomeItem[];
  planningMode?: PlanningRecommendationMode;
  saving?: boolean;
  heading?: string;
  description?: string;
  onClose: () => void;
  onSave: (value: {
    outcome: ReviewOutcome;
    presentation?: PresentationDraft;
    planningMode?: PlanningRecommendationMode;
  }) => Promise<void> | void;
}

const NEXT_STEP_OPTIONS: Array<{ value: PlanningRecommendationMode; label: string; help: string }> = [
  {
    value: "no-action-needed",
    label: "No immediate project needed",
    help: "Use when no hardware project or consultant follow-up is needed. Routine monitoring and administrative or compliance follow-up can still remain in the report.",
  },
  {
    value: "remote-consultation",
    label: "Remote consultation",
    help: "Use when a Technology Consultant should review or plan the next step remotely.",
  },
  {
    value: "onsite-review",
    label: "Onsite review",
    help: "Use when the next step is an onsite planning review.",
  },
  {
    value: "hourly-onsite-service",
    label: "Hourly onsite service call",
    help: "Use when the discussed work should move directly to an hourly onsite service visit.",
  },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeClientFacingSummaryLanguage(value: string): string {
  return value
    .replace(/\bare currently recommended for replacement(?: now)?\b/gi, "are aging and need planning attention")
    .replace(/\bis currently recommended for replacement(?: now)?\b/gi, "is aging and needs planning attention")
    .replace(/\bare recommended for replacement(?: now)?\b/gi, "are aging and need planning attention")
    .replace(/\bis recommended for replacement(?: now)?\b/gi, "is aging and needs planning attention")
    .replace(/\bcurrently recommended for replacement(?: now)?\b/gi, "currently identified as aging systems that need planning attention")
    .replace(/\brecommended for replacement(?: now)?\b/gi, "identified as aging systems that need planning attention")
    .replace(/\breplacement recommendations?\b/gi, "lifecycle priorities")
    .replace(/\breplacement priorities\b/gi, "lifecycle priorities")
    .replace(/\breplacement planning\b/gi, "technology planning")
    .replace(/\breplace now\b/gi, "needs lifecycle attention")
    .replace(/\bshould be replaced\b/gi, "needs lifecycle attention")
    .replace(/\bneeds? to be replaced\b/gi, "needs lifecycle attention")
    .replace(/\brequiring replacement\b/gi, "requiring lifecycle attention")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizedDraft(outcome: ReviewOutcome, presentation?: PresentationDraft): ReviewOutcome {
  const draft = normalizeReviewOutcome(outcome);
  const clientSummary = normalizeClientFacingSummaryLanguage(
    draft.meetingSummary.trim()
      || draft.executiveSummary.trim()
      || presentation?.executiveSummary.trim()
      || "",
  );
  return {
    ...draft,
    meetingSummary: clientSummary,
    executiveSummary: clientSummary,
  };
}

export function ReviewOutcomeEditor({
  outcome,
  presentation,
  planningMode = "onsite-review",
  saving = false,
  heading = "Finalize client review",
  description = "Capture what was discussed, what happens next, and only the actions the client actually agreed to.",
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<ReviewOutcome>(() => normalizedDraft(outcome, presentation));
  const [presentationDraft, setPresentationDraft] = useState<PresentationDraft | undefined>(() => presentation ? {
    title: outcome.reportTitle || presentation.title,
    executiveSummary: normalizeClientFacingSummaryLanguage(outcome.meetingSummary || outcome.executiveSummary || presentation.executiveSummary),
  } : undefined);
  const [nextStepMode, setNextStepMode] = useState<PlanningRecommendationMode>(outcome.nextStepMode ?? planningMode);
  const [notes, setNotes] = useState("");
  const [notesFeedback, setNotesFeedback] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const nextDraft = normalizedDraft(outcome, presentation);
    setDraft(nextDraft);
    setPresentationDraft(presentation ? {
      title: outcome.reportTitle || presentation.title,
      executiveSummary: nextDraft.meetingSummary,
    } : undefined);
    setNextStepMode(outcome.nextStepMode ?? planningMode);
    setNotes("");
    setNotesFeedback("");
    setError("");
    setSubmitting(false);
  }, [outcome, presentation, planningMode]);

  const includedCount = useMemo(
    () => draft.items.filter((item) => item.includeInReport && (item.title.trim() || item.clientFacingNote.trim())).length,
    [draft.items],
  );
  const busy = saving || submitting;
  const nextStepOption = NEXT_STEP_OPTIONS.find((option) => option.value === nextStepMode) ?? NEXT_STEP_OPTIONS[2];

  function patchItem(id: string, patch: Partial<ReviewOutcomeItem>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item),
    }));
  }

  function addItem() {
    setDraft((current) => ({
      ...current,
      status: current.status === "not-reviewed" ? "draft" : current.status,
      items: [
        ...current.items,
        createReviewOutcomeItem({
          title: "",
          clientFacingNote: "",
          disposition: "investigate",
          targetDate: "",
          includeInReport: true,
        }),
      ],
    }));
  }

  function applyNotes() {
    setError("");
    setNotesFeedback("");
    try {
      const result = applyTailoredReportPrompt(notes, draft, presentationDraft);
      const summary = normalizeClientFacingSummaryLanguage(
        result.outcome.meetingSummary
          || result.outcome.executiveSummary
          || result.presentation?.executiveSummary
          || draft.meetingSummary,
      );
      setDraft({
        ...result.outcome,
        reportTextOverrides: draft.reportTextOverrides ?? {},
        presentationConcerns: draft.presentationConcerns,
        clientConcern: draft.clientConcern,
        meetingSummary: summary,
        executiveSummary: summary,
      });
      if (presentationDraft) {
        setPresentationDraft({
          title: result.presentation?.title || presentationDraft.title,
          executiveSummary: summary,
        });
      }
      setNotesFeedback(
        result.appliedFields.length
          ? `Filled ${result.appliedFields.join(", ")}. Review the summary and actions below before saving.`
          : "Notes added. Review the summary below before saving.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The notes could not be applied.");
    }
  }

  async function save() {
    if (busy) return;
    setError("");

    const summary = normalizeClientFacingSummaryLanguage(draft.meetingSummary);
    const reviewedAt = draft.reviewedAt || (draft.status === "confirmed" ? today() : "");
    if (draft.status === "confirmed" && !reviewedAt) {
      setError("Add the review date before confirming the review.");
      return;
    }

    const noAction = nextStepMode === "no-action-needed";
    // Keep previously recorded decisions intact when the current outcome is
    // "no immediate project." The report suppresses project-roadmap cards for
    // this mode, but changing modes later should not resurrect lost data.
    const items = draft.items;
    const agreedNextStep = noAction
      ? ""
      : draft.agreedNextStep.trim() || planningModeDefaultNextStep(nextStepMode);
    const included = items.filter((item) => item.includeInReport && (item.title.trim() || item.clientFacingNote.trim()));

    if (draft.status !== "not-reviewed" && !summary && !draft.agreedNextStep.trim() && !included.length) {
      setError("Add a client summary before saving the review.");
      return;
    }

    const finalPresentation = presentationDraft ? {
      title: presentationDraft.title.trim(),
      executiveSummary: summary,
    } : undefined;

    const payload = {
      outcome: {
        ...draft,
        nextStepMode,
        reviewedAt,
        meetingSummary: summary,
        agreedNextStep,
        executiveSummary: summary,
        reportTitle: finalPresentation?.title ?? draft.reportTitle,
        items,
        lastUpdatedAt: new Date().toISOString(),
      },
      presentation: finalPresentation,
      planningMode: nextStepMode,
    };

    setSubmitting(true);
    try {
      const savePromise = Promise.resolve(onSave(payload));
      onClose();
      void savePromise.catch((saveError) => console.error("Review outcome background sync failed after the local report save.", saveError));
    } catch (saveError) {
      setSubmitting(false);
      setError(saveError instanceof Error ? saveError.message : "The review outcome could not be saved. Please try again.");
    }
  }

  return (
    <div className="review-outcome-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="review-outcome-dialog" role="dialog" aria-modal="true" aria-labelledby="review-outcome-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="compass-kicker">Client review outcome</span>
            <h2 id="review-outcome-title">{heading}</h2>
            <p>{description}</p>
          </div>
          <button type="button" className="compass-drawer-close" onClick={onClose} aria-label="Close review outcome editor">×</button>
        </header>

        <div className="review-outcome-body">
          <section className="review-outcome-section tailored-prompt-section">
            <div className="review-outcome-section-heading">
              <div><span>Optional shortcut</span><h3>Paste TRS or call notes</h3></div>
              <small>No special prompt format is required.</small>
            </div>
            <label>
              <span>TRS or notes</span>
              <textarea
                rows={6}
                value={notes}
                onChange={(event) => { setNotes(event.target.value); setNotesFeedback(""); }}
                placeholder="Paste your TRS, call summary, or review notes here. Client Compass will pull out the summary, next step, and any decisions it can recognize."
              />
            </label>
            <div className="tailored-prompt-actions">
              <p>This only fills the fields below. Nothing is saved until you select <strong>Save review</strong>.</p>
              <button type="button" className="button secondary" disabled={!notes.trim()} onClick={applyNotes}>Use these notes</button>
            </div>
            {notesFeedback && <div className="tailored-prompt-feedback success" role="status">{notesFeedback}</div>}
          </section>

          <section className="review-outcome-section">
            <div className="review-outcome-section-heading">
              <div><span>Review record</span><h3>What happened?</h3></div>
              <small>One summary drives the workspace, presentation, and PDF.</small>
            </div>
            <div className="review-outcome-grid two">
              <label>
                <span>Review status</span>
                <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ReviewOutcome["status"] })}>
                  <option value="not-reviewed">Not reviewed</option>
                  <option value="draft">Draft</option>
                  <option value="confirmed">Confirmed with client</option>
                </select>
              </label>
              <label>
                <span>Review date</span>
                <input type="date" value={draft.reviewedAt.slice(0, 10)} onChange={(event) => setDraft({ ...draft, reviewedAt: event.target.value })} />
              </label>
            </div>
            <label>
              <span>Client summary</span>
              <textarea
                rows={5}
                value={draft.meetingSummary}
                onChange={(event) => setDraft({ ...draft, meetingSummary: event.target.value, executiveSummary: event.target.value })}
                placeholder="Summarize what matters most from the review in clear client-facing language."
              />
            </label>
          </section>

          <section className="review-outcome-section">
            <div className="review-outcome-section-heading">
              <div><span>Next step</span><h3>What happens next?</h3></div>
              <small>This is the same next-step choice used by the presentation and PDF.</small>
            </div>
            <label>
              <span>Next-step type</span>
              <select value={nextStepMode} onChange={(event) => setNextStepMode(event.target.value as PlanningRecommendationMode)}>
                {NEXT_STEP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <p>{nextStepOption.help}</p>
            {nextStepMode !== "no-action-needed" && <label>
              <span>Next-step details</span>
              <textarea
                rows={3}
                value={draft.agreedNextStep}
                onChange={(event) => setDraft({ ...draft, agreedNextStep: event.target.value })}
                placeholder="Example: Marty will review the workstation scope, prepare the estimate, and follow up with the practice."
              />
            </label>}
          </section>

          {nextStepMode !== "no-action-needed" && <section className="review-outcome-section">
            <div className="review-outcome-section-heading">
              <div><span>Agreed actions</span><h3>Only add what the client actually agreed to</h3></div>
              <div className="review-outcome-heading-actions">
                <small>{includedCount} included</small>
                <button type="button" className="button secondary compact" onClick={addItem}>+ Add action</button>
              </div>
            </div>
            {!draft.items.length ? <div className="review-outcome-empty">
              <strong>No agreed actions recorded.</strong>
              <p>That is okay. The report can show the selected next step without inventing project decisions.</p>
            </div> : <div className="review-outcome-items">{draft.items.map((item, index) => <article key={item.id}>
              <div className="review-outcome-item-top">
                <b>{String(index + 1).padStart(2, "0")}</b>
                <label className="review-outcome-include">
                  <input type="checkbox" checked={item.includeInReport} onChange={(event) => patchItem(item.id, { includeInReport: event.target.checked })} />
                  <span>Include in report</span>
                </label>
                <button type="button" onClick={() => setDraft((current) => ({ ...current, items: current.items.filter((candidate) => candidate.id !== item.id) }))}>Remove</button>
              </div>
              <label>
                <span>Action</span>
                <input value={item.title} onChange={(event) => patchItem(item.id, { title: event.target.value })} placeholder="Example: Replace the two aging front-desk computers" />
              </label>
              <label>
                <span>Client-facing detail</span>
                <textarea rows={3} value={item.clientFacingNote} onChange={(event) => patchItem(item.id, { clientFacingNote: event.target.value })} placeholder="Optional detail about what was agreed." />
              </label>
              <label>
                <span>Timing</span>
                <input value={item.targetDate} onChange={(event) => patchItem(item.id, { targetDate: event.target.value })} placeholder="Example: This quarter, when ready, or after quote approval" />
              </label>
            </article>)}</div>}
          </section>}
        </div>

        <footer>
          <div>{error && <span className="review-outcome-error" role="alert">{error}</span>}</div>
          <div>
            <button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button>
            <button type="button" className="button primary" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save review"}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
