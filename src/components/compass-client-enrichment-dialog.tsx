"use client";

import { useEffect, useMemo, useState } from "react";
import { recalculateDataset } from "@/lib/compass/engine";
import { parseClientEnrichmentSpreadsheet, type ParsedClientEnrichmentImport } from "@/lib/compass/client-enrichment-import";
import { applyClientEnrichmentPreview, buildClientEnrichmentPreview, type ClientEnrichmentResolutions } from "@/lib/compass/client-enrichment";
import { saveCompassDataset } from "@/lib/compass/store";
import type { CompassConfig, CompassDataset } from "@/lib/compass/types";

interface Props {
  open: boolean;
  dataset: CompassDataset | null;
  config: CompassConfig;
  onClose: () => void;
  onCommitted: () => void | Promise<void>;
}

const TEMPLATE_HEADERS = [
  "Company Name", "City", "State", "Territory", "Industry", "Client Tags", "Primary Contact", "Primary Contact Role", "Primary Contact Email", "Primary Contact Phone", "Assigned Owner", "TC", "Latest Sales Activity", "Last Account Review Date", "Last Quote Date", "Next Follow Up", "Workflow Status", "Internal Note",
];

function escapeCsv(value: string): string { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function downloadTemplate(dataset: CompassDataset): void {
  const rows = [TEMPLATE_HEADERS.map(escapeCsv).join(","), ...dataset.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map((client) => [
    client.name, client.city, client.state, client.market, client.industry, client.tags.join(", "), client.primaryContact, client.primaryContactRole, client.primaryContactEmail, client.primaryContactPhone, client.assignedOwner, client.technicalConsultant ?? "", client.lastSalesInteraction, client.lastAccountReview, client.lastQuoteDate, client.nextFollowUp, client.workflowStatus, client.internalNote,
  ].map(escapeCsv).join(","))];
  const blob = new Blob([rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "Client_Compass_Client_Record_Enrichment_Template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CompassClientEnrichmentDialog({ open, dataset, config, onClose, onCommitted }: Props) {
  const [parsed, setParsed] = useState<ParsedClientEnrichmentImport | null>(null);
  const [resolutions, setResolutions] = useState<ClientEnrichmentResolutions>({});
  const [reading, setReading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [fileError, setFileError] = useState("");
  const [commitError, setCommitError] = useState("");
  const preview = useMemo(() => parsed && dataset ? buildClientEnrichmentPreview(parsed.rows, dataset, resolutions) : null, [dataset, parsed, resolutions]);
  const exceptions = preview?.matches.filter((match) => !match.clientId) ?? [];

  const reset = () => { setParsed(null); setResolutions({}); setFileError(""); setCommitError(""); };
  const closeDialog = () => { if (committing) return; reset(); onClose(); };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !committing) closeDialog(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [committing, open]);

  if (!open) return null;

  const selectFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true); setFileError(""); setCommitError(""); setResolutions({});
    try { setParsed(await parseClientEnrichmentSpreadsheet(file)); }
    catch (cause) { setParsed(null); setFileError(cause instanceof Error ? cause.message : "The client-enrichment file could not be read."); }
    finally { setReading(false); }
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
    setCommitting(true); setCommitError("");
    try {
      const enriched = applyClientEnrichmentPreview(dataset, preview);
      await saveCompassDataset(recalculateDataset(enriched, config));
      await onCommitted();
      reset(); onClose();
    } catch (cause) { setCommitError(cause instanceof Error ? cause.message : "Client record enrichment could not be saved."); }
    finally { setCommitting(false); }
  };

  return <div className="compass-modal-backdrop" role="presentation" onMouseDown={closeDialog}>
    <section className="compass-modal compass-review-history-modal" role="dialog" aria-modal="true" aria-labelledby="client-enrichment-title" aria-busy={committing} onMouseDown={(event) => event.stopPropagation()}>
      <header className="compass-modal-header">
        <div><span className="compass-kicker">Client records & contacts</span><h2 id="client-enrichment-title">Client Record Enrichment</h2><p>Bulk-update client profile, geography, territory, contacts, sales coverage, review history, and quote history without touching hardware inventory.</p></div>
        <button className="compass-drawer-close" type="button" disabled={committing} onClick={closeDialog} aria-label="Close client enrichment">×</button>
      </header>

      {!dataset ? <div className="compass-import-error" role="alert">Import the current hardware snapshot before enriching client records.</div> : <>
        <div className="compass-review-history-tools"><div><strong>Spreadsheet-friendly enrichment</strong><span>Company Name is required. Any populated supported field can be imported; blank fields leave current data alone.</span></div><button className="button secondary" type="button" onClick={() => downloadTemplate(dataset)}>Download enrichment template</button></div>
        <label className="compass-file-drop">
          <input type="file" accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.tsv" onChange={(event) => void selectFile(event.target.files?.[0])} />
          <strong>{reading ? "Reading client records…" : parsed ? parsed.sourceName : "Choose client record enrichment spreadsheet"}</strong>
          <span>Recognizes City, State, Territory/Market, Industry, Client Tags, contacts, owner, TC, Last Sales Activity, account review, last quote, next follow-up, status, and notes.</span>
        </label>
        {fileError && <div className="compass-import-error" role="alert">{fileError}</div>}

        {parsed && preview && <>
          <div className="compass-review-history-summary">
            <div><strong>{parsed.totalRows}</strong><span>Rows found</span></div>
            <div><strong>{preview.autoMatchedCount + preview.manualMatchedCount}</strong><span>Matched</span></div>
            <div><strong>{preview.clientUpdates.length}</strong><span>Existing updates</span></div>
            <div className={preview.newClientCount ? "is-good" : ""}><strong>{preview.newClientCount}</strong><span>New companies</span></div>
            <div className={preview.ambiguousCount + preview.unmatchedCount ? "is-warning" : "is-good"}><strong>{preview.ambiguousCount + preview.unmatchedCount}</strong><span>Needs match</span></div>
          </div>
          <div className="compass-review-history-result-note"><strong>{parsed.detectedHeaders.join(" · ")}</strong><span>Territory maps into the client Territory / market field. Account-review, quote, and sales-activity dates only move forward. The TC follows the latest sales-activity date, and same-day TC ties are preserved. Tags are merged. Newly created companies are flagged for record review.</span></div>
          {(parsed.invalidRows.length > 0 || parsed.skippedEmptyRows > 0 || preview.duplicateRowsConsolidated > 0) && <div className="compass-review-history-notices">
            {parsed.invalidRows.length > 0 && <span>{parsed.invalidRows.length} invalid value{parsed.invalidRows.length === 1 ? "" : "s"} will be skipped.</span>}
            {parsed.skippedEmptyRows > 0 && <span>{parsed.skippedEmptyRows} row{parsed.skippedEmptyRows === 1 ? " had" : "s had"} no enrichment values.</span>}
            {preview.duplicateRowsConsolidated > 0 && <span>{preview.duplicateRowsConsolidated} duplicate row{preview.duplicateRowsConsolidated === 1 ? " was" : "s were"} consolidated.</span>}
          </div>}

          {exceptions.length > 0 && <section className="compass-review-history-exceptions"><div className="compass-resolution-header"><div><h3>Match review</h3><p>Truly unmatched names default to a new company record. Ambiguous names stay review-first so Client Compass does not create an avoidable duplicate.</p></div><button className="button secondary" type="button" onClick={acceptBestSuggestions}>Apply strong suggestions</button></div><div className="compass-review-history-exception-list">
            {exceptions.map((match) => <label key={match.key}><span><strong>{match.companyName}</strong><small>{match.market ? `${match.market} · ` : ""}{match.city || match.state ? `${match.city}${match.city && match.state ? ", " : ""}${match.state}` : "Client record"}{match.suggestions[0] ? ` · Best suggestion: ${match.suggestions[0].clientName}` : " · No reliable suggestion"}</small></span><select value={resolutions[match.key] ?? (match.kind === "create" ? "create" : "skip")} onChange={(event) => setResolutions((current) => ({ ...current, [match.key]: event.target.value }))}><option value="create">Create new company record</option><option value="skip">Skip this row</option>{match.suggestions.map((suggestion) => <option key={suggestion.clientId} value={suggestion.clientId}>Match to {suggestion.clientName}</option>)}<optgroup label="All current clients">{dataset.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</optgroup></select></label>)}
          </div></section>}

          <details className="compass-review-history-details"><summary>Review matched updates</summary><div className="compass-review-history-update-list">{preview.clientUpdates.map((update) => <div key={update.clientId} className="is-update"><span><strong>{update.clientName}</strong><small>{update.importedCompanyNames.join(", ")}</small></span><span><small>{update.changedFields.join(" · ")}</small></span></div>)}</div></details>
        </>}
      </>}

      <div className={`compass-commit-feedback${committing || commitError ? " is-visible" : ""}`} aria-live="polite">{committing && <span>Saving client record enrichment and refreshing segment data…</span>}{commitError && <span className="is-error" role="alert">{commitError}</span>}</div>
      <footer className="compass-modal-actions"><button className="button secondary" type="button" disabled={committing} onClick={closeDialog}>Cancel</button><button className="button primary" type="button" disabled={!preview || preview.updateCount === 0 || reading || committing} onClick={() => void commit()}>{committing ? "Applying enrichment…" : preview ? `Apply ${preview.updateCount} record${preview.updateCount === 1 ? "" : "s"}` : "Import client records"}</button></footer>
    </section>
  </div>;
}
