"use client";

import { useEffect, useMemo, useState } from "react";
import { recalculateDataset } from "@/lib/compass/engine";
import { parseReviewHistorySpreadsheet, type ParsedReviewHistoryImport } from "@/lib/compass/review-history-import";
import {
  applyReviewHistoryPreview,
  buildReviewHistoryPreview,
  type ReviewHistoryClientUpdate,
  type ReviewHistoryDateAction,
  type ReviewHistoryResolutions,
} from "@/lib/compass/review-history";
import { saveCompassDataset } from "@/lib/compass/store";
import type { CompassConfig, CompassDataset } from "@/lib/compass/types";

interface Props {
  open: boolean;
  dataset: CompassDataset | null;
  config: CompassConfig;
  onClose: () => void;
  onCommitted: () => void | Promise<void>;
}

function formatDate(value: string): string {
  if (!value) return "Not recorded";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function matchLabel(kind: string): string {
  if (kind === "exact") return "Exact name";
  if (kind === "alias") return "Saved alias";
  if (kind === "smart") return "Smart match";
  if (kind === "manual") return "Selected match";
  return "Needs attention";
}

function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function downloadTemplate(dataset: CompassDataset): void {
  const rows = ["Company Name,Last Account Review Date,Quote Date", ...dataset.clients
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((client) => `${escapeCsv(client.name)},,`)];
  const blob = new Blob([rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "Client_Compass_Review_and_Quote_Date_Template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function importedDateSummary(reviewDate: string, quoteDate: string): string {
  return [reviewDate ? `Review: ${formatDate(reviewDate)}` : "", quoteDate ? `Quote: ${formatDate(quoteDate)}` : ""].filter(Boolean).join(" · ") || "No valid dates";
}

function actionDetail(label: string, action: ReviewHistoryDateAction, incoming: string, previous: string): string {
  if (action === "empty") return "";
  if (action === "update") return `${label}: ${formatDate(incoming)}${previous ? ` replaces ${formatDate(previous)}` : " will be added"}`;
  if (action === "unchanged") return `${label}: ${formatDate(incoming)} is already recorded`;
  return `${label}: ${formatDate(incoming)} is older than ${formatDate(previous)} and will be ignored`;
}

function updateDetails(update: ReviewHistoryClientUpdate): string[] {
  return [
    actionDetail("Review", update.reviewAction, update.incomingReviewDate, update.previousReviewDate),
    actionDetail("Quote", update.quoteAction, update.incomingQuoteDate, update.previousQuoteDate),
  ].filter(Boolean);
}

export function CompassReviewHistoryDialog({ open, dataset, config, onClose, onCommitted }: Props) {
  const [parsed, setParsed] = useState<ParsedReviewHistoryImport | null>(null);
  const [resolutions, setResolutions] = useState<ReviewHistoryResolutions>({});
  const [reading, setReading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [fileError, setFileError] = useState("");
  const [commitError, setCommitError] = useState("");
  const preview = useMemo(() => parsed && dataset ? buildReviewHistoryPreview(parsed.rows, dataset, resolutions) : null, [dataset, parsed, resolutions]);
  const exceptions = preview?.matches.filter((match) => !match.clientId) ?? [];

  const reset = () => {
    setParsed(null);
    setResolutions({});
    setFileError("");
    setCommitError("");
  };
  const closeDialog = () => {
    if (committing) return;
    reset();
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || committing) return;
      setParsed(null);
      setResolutions({});
      setFileError("");
      setCommitError("");
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [committing, onClose, open]);

  if (!open) return null;

  const selectFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setFileError("");
    setCommitError("");
    setResolutions({});
    try {
      setParsed(await parseReviewHistorySpreadsheet(file));
    } catch (cause) {
      setParsed(null);
      setFileError(cause instanceof Error ? cause.message : "The client-history file could not be read.");
    } finally {
      setReading(false);
    }
  };

  const acceptBestSuggestions = () => {
    if (!preview) return;
    setResolutions((current) => {
      const next = { ...current };
      for (const match of exceptions) {
        const best = match.suggestions[0];
        const second = match.suggestions[1];
        if (best && best.score >= 0.72 && best.score - (second?.score ?? 0) >= 0.04) next[match.key] = best.clientId;
      }
      return next;
    });
  };

  const commit = async () => {
    if (!dataset || !preview || committing || preview.updateCount === 0) return;
    setCommitting(true);
    setCommitError("");
    try {
      const enriched = applyReviewHistoryPreview(dataset, preview);
      await saveCompassDataset(recalculateDataset(enriched, config));
      await onCommitted();
      reset();
      onClose();
    } catch (cause) {
      setCommitError(cause instanceof Error ? cause.message : "The client history could not be saved.");
    } finally {
      setCommitting(false);
    }
  };

  const dateUpdateCount = (preview?.reviewUpdateCount ?? 0) + (preview?.quoteUpdateCount ?? 0);

  return (
    <div className="compass-modal-backdrop" role="presentation" onMouseDown={closeDialog}>
      <section className="compass-modal compass-review-history-modal" role="dialog" aria-modal="true" aria-labelledby="compass-review-history-title" aria-busy={committing} onMouseDown={(event) => event.stopPropagation()}>
        <header className="compass-modal-header">
          <div>
            <span className="compass-kicker">One-time data tool</span>
            <h2 id="compass-review-history-title">Import Review and Quote Dates</h2>
            <p>Enrich existing clients with the latest known account-review date, quote date, or both. This does not create clients, change inventory, or alter sales-interaction history.</p>
          </div>
          <button className="compass-drawer-close" type="button" disabled={committing} onClick={closeDialog} aria-label="Close client-history import">×</button>
        </header>

        {!dataset ? <div className="compass-import-error" role="alert">Import the current Ninja snapshot before adding client-history dates.</div> : <>
          <div className="compass-review-history-tools">
            <div><strong>Supported columns</strong><span>Company Name plus Last Account Review Date and/or Quote Date</span></div>
            <button className="button secondary" type="button" onClick={() => downloadTemplate(dataset)}>Download client-name template</button>
          </div>

          <label className="compass-file-drop">
            <input type="file" accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.tsv" onChange={(event) => void selectFile(event.target.files?.[0])} />
            <strong>{reading ? "Reading client history…" : parsed ? parsed.sourceName : "Choose review or quote-date spreadsheet"}</strong>
            <span>Company names are matched in bulk using exact names, saved aliases, normalized business names, and similarity scoring.</span>
          </label>
          {fileError && <div className="compass-import-error" role="alert">{fileError}</div>}

          {parsed && preview && <>
            <div className="compass-review-history-summary">
              <div><strong>{parsed.totalRows}</strong><span>Rows found</span></div>
              <div><strong>{preview.autoMatchedCount + preview.manualMatchedCount}</strong><span>Matched</span></div>
              <div><strong>{dateUpdateCount}</strong><span>Dates to add</span></div>
              <div><strong>{preview.unchangedCount + preview.olderIgnoredCount}</strong><span>Already current</span></div>
              <div className={exceptions.length ? "is-warning" : "is-good"}><strong>{exceptions.length}</strong><span>Exceptions</span></div>
            </div>

            <div className="compass-review-history-result-note">
              <strong>{preview.autoMatchedCount} companies matched automatically.</strong>
              <span>{preview.reviewUpdateCount} review date{preview.reviewUpdateCount === 1 ? "" : "s"} and {preview.quoteUpdateCount} quote date{preview.quoteUpdateCount === 1 ? "" : "s"} will be added. Quote dates automatically mark the client as quoted.</span>
            </div>

            {(parsed.skippedBlankDates > 0 || parsed.invalidRows.length > 0 || preview.duplicateRowsConsolidated > 0) && <div className="compass-review-history-notices">
              {parsed.skippedBlankDates > 0 && <span>{parsed.skippedBlankDates} row{parsed.skippedBlankDates === 1 ? " had" : "s had"} no populated date and will be skipped.</span>}
              {parsed.invalidRows.length > 0 && <span>{parsed.invalidRows.length} invalid company or date value{parsed.invalidRows.length === 1 ? " was" : "s were"} skipped.</span>}
              {preview.duplicateRowsConsolidated > 0 && <span>{preview.duplicateRowsConsolidated} duplicate row{preview.duplicateRowsConsolidated === 1 ? " was" : "s were"} consolidated using the newest date for each field.</span>}
            </div>}

            {exceptions.length > 0 && <section className="compass-review-history-exceptions">
              <div className="compass-resolution-header">
                <div><h3>Only true exceptions</h3><p>Everything above is already matched. Resolve these in one compact grid or leave them skipped.</p></div>
                <button className="button secondary" type="button" onClick={acceptBestSuggestions}>Apply strong suggestions</button>
              </div>
              <div className="compass-review-history-exception-list">
                {exceptions.map((match) => <label key={match.key}>
                  <span>
                    <strong>{match.companyName}</strong>
                    <small>{importedDateSummary(match.lastAccountReview, match.lastQuoteDate)}{match.suggestions[0] ? ` · Best suggestion: ${match.suggestions[0].clientName}` : " · No reliable suggestion"}</small>
                  </span>
                  <select value={resolutions[match.key] ?? "skip"} onChange={(event) => setResolutions((current) => ({ ...current, [match.key]: event.target.value }))}>
                    <option value="skip">Skip this row</option>
                    {match.suggestions.map((suggestion) => <option key={suggestion.clientId} value={suggestion.clientId}>Match to {suggestion.clientName}</option>)}
                    <optgroup label="All current clients">
                      {dataset.clients.slice().sort((left, right) => left.name.localeCompare(right.name)).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                    </optgroup>
                  </select>
                </label>)}
              </div>
            </section>}

            <details className="compass-review-history-details">
              <summary>Review matched updates</summary>
              <div className="compass-review-history-update-list">
                {preview.clientUpdates.map((update) => <div key={update.clientId} className={`is-${update.action}`}>
                  <span><strong>{update.clientName}</strong><small>{update.importedCompanyNames.join(", ")} · {matchLabel(update.matchKinds[0])}</small></span>
                  <span>{updateDetails(update).map((detail) => <small key={detail}>{detail}</small>)}</span>
                </div>)}
              </div>
            </details>
          </>}
        </>}

        <div className={`compass-commit-feedback${committing || commitError ? " is-visible" : ""}`} aria-live="polite">
          {committing && <span>Saving review and quote dates and recalculating campaign health…</span>}
          {commitError && <span className="is-error" role="alert">{commitError}</span>}
        </div>
        <footer className="compass-modal-actions">
          <button className="button secondary" type="button" disabled={committing} onClick={closeDialog}>Cancel</button>
          <button className="button primary" type="button" disabled={!preview || preview.updateCount === 0 || reading || committing} onClick={() => void commit()}>{committing ? "Importing client history…" : preview ? `Import ${dateUpdateCount} date${dateUpdateCount === 1 ? "" : "s"}` : "Import client history"}</button>
        </footer>
      </section>
    </div>
  );
}
