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

const MEETING_SUMMARY_FORMULA = "Context → scope → aging/risk → security → HIPAA when applicable → purpose. Keep replacement recommendations and prescribed actions in Agreed Decisions, not the Meeting Summary.";

function today(): string { return new Date().toISOString().slice(0, 10); }

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

function normalizeTailoredMeetingSummary(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let inMeetingSummary = false;
  const topLevel = new Set(["meeting summary", "agreed next step", "next step", "agreed decisions", "decisions", "plan status", "status", "review date", "reviewed at", "report title", "title", "executive summary", "summary framing"]);

  return lines.map((line) => {
    const heading = line.trim().replace(/^#{1,6}\s*/, "").replace(/^\*\*(.*?)\*\*$/, "$1").replace(/:$/, "").trim().toLowerCase();
    if (topLevel.has(heading)) {
      inMeetingSummary = heading === "meeting summary";
      return line;
    }
    return inMeetingSummary ? normalizeClientFacingSummaryLanguage(line) : line;
  }).join("\n");
}

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
      const normalizedPrompt = normalizeTailoredMeetingSummary(tailoredPrompt);
      const result = applyTailoredReportPrompt(normalizedPrompt, draft, presentationDraft);
      const normalizedOutcome = {
        ...result.outcome,
        meetingSummary: normalizeClientFacingSummaryLanguage(result.outcome.meetingSummary),
        executiveSummary: normalizeClientFacingSummaryLanguage(result.outcome.executiveSummary),
      };
      setDraft(normalizedOutcome);
      if (result.presentation) setPresentationDraft({ ...result.presentation, executiveSummary: normalizeClientFacingSummaryLanguage(result.presentation.executiveSummary) });
      const applied = result.appliedFields.join(", ");
      setPromptFeedback({
        tone: result.warnings.length ? "warning" : "success",
        message: result.warnings.length
          ? `Applied ${applied}. ${result.warnings.join(" ")}`
          : `Applied ${applied}. Meeting Summary was kept client-facing; replacement decisions remain in Agreed Decisions.`,
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
    const normalizedMeetingSummary = normalizeClientFacingSummaryLanguage(draft.meetingSummary);
    const normalizedExecutiveSummary = normalizeClientFacingSummaryLanguage(presentationDraft?.executiveSummary ?? draft.executiveSummary);
    const finalPresentation = presentationDraft ? { title: presentationDraft.title.trim(), executiveSummary: normalizedExecutiveSummary } : undefined;
    await onSave({
      outcome: {
        ...draft,
        meetingSummary: normalizedMeetingSummary,
        reportTitle: finalPresentation?.title ?? draft.reportTitle,
        executiveSummary: finalPresentation?.executiveSummary ?? normalizedExecutiveSummary,
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
            <div className="review-outcome-section-heading"><div><span>Transcript shortcut</span><h3>Apply a tailored report summary</h3></div><small>{MEETING_SUMMARY_FORMULA}</small></div>
            <label><span>Tailored report prompt</span><textarea rows={8} value={tailoredPrompt} onChange={(event) => { setTailoredPrompt(event.target.value); setPromptFeedback(null); }} placeholder={`Meeting Summary\nStart with the meeting context, then summarize scope, aging/risk, security, HIPAA when applicable, and the purpose of the report. Describe condition and risk here — not the prescribed replacement solution.\n\nAgreed Next Step\nDescribe the coordinated next action.\n\nAgreed Decisions\n\n1. Review aging computer options\nSupporting detail: Document the specific systems and timing discussed with the client.`} /></label>
            <div className="tailored-prompt-actions"><p>Applying the summary fills recognized headings. Meeting Summary is automatically kept focused on condition, risk, security, readiness, and planning context; explicit replacement actions belong in Agreed Decisions. Nothing is saved until you select <strong>Save review outcome</strong>.</p><button type="button" className="button secondary" onClick={applyPrompt}>Apply tailored summary</button></div>
            {promptFeedback && <div className={`tailored-prompt-feedback ${promptFeedback.tone}`} role="status">{promptFeedback.message}</div>}
          </section>

          {presentationDraft && <section className="review-outcome-section tailor-report-section">
            <div className="review-outcome-section-heading"><div><span>Client-facing framing</span><h3>Tailor the report</h3></div><small>Context → scope → aging/risk → security → HIPAA when applicable → purpose. Keep prescribed replacement actions in Agreed Decisions.</small></div>
            <label><span>Report title</span><input value={presentationDraft.title} onChange={(event) => setPresentationDraft((current) => ({ title: event.target.value, executiveSummary: current?.executiveSummary ?? "" }))} /></label>
            <label><span>Summary framing</span><textarea rows={4} value={presentationDraft.executiveSummary} onChange={(event) => setPresentationDraft((current) => ({ title: current?.title ?? "", executiveSummary: event.target.value }))} placeholder="Example: The review brings together the current technology environment, aging systems that need planning attention, security health, and HIPAA readiness so priorities are easier to understand and plan for." /></label>
          </section>}

          <section className="review-outcome-section">
            <div className="review-outcome-section-heading"><div><span>Review record</span><h3>What happened in the conversation?</h3></div><small>{includedCount} decision{includedCount === 1 ? "" : "s"} included in the report</small></div>
            <div className="review-outcome-grid two">
              <label><span>Plan status</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ReviewOutcome["status"] })}><option value="not-reviewed">Not reviewed</option><option value="draft">Draft outcome</option><option value="confirmed">Confirmed with client</option></select></label>
              <label><span>Review date</span><input type="date" value={draft.reviewedAt.slice(0, 10)} onChange={(event) => setDraft({ ...draft, reviewedAt: event.target.value })} /></label>
            </div>
            <label><span>Meeting summary</span><textarea rows={4} value={draft.meetingSummary} onChange={(event) => setDraft({ ...draft, meetingSummary: event.target.value })} placeholder="Example: We weren’t able to connect for the scheduled review today, so the report has been provided for review in the meantime. It brings together the key areas of the technology environment, including aging systems that need planning attention, overall system health, security, and HIPAA Security Readiness. The goal is to make priorities easier to review and technology planning easier going forward." /></label>
            <label><span>Agreed next step</span><textarea rows={3} value={draft.agreedNextStep} onChange={(event) => setDraft({ ...draft, agreedNextStep: event.target.value })} placeholder="Example: Reconnect to review the report together, confirm the aging-system priorities, answer questions, and agree on the appropriate next actions." /></label>
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
