"use client";

import { useEffect, useMemo, useState } from "react";
import { buildImportPreview, defaultOrganizationResolutions } from "@/lib/compass/engine";
import { parseCompassSpreadsheet } from "@/lib/compass/import";
import { saveCompassDataset } from "@/lib/compass/store";
import type { CompassConfig, CompassDataset, OrganizationResolutions, ParsedCompassImport } from "@/lib/compass/types";

interface Props {
  open: boolean;
  dataset: CompassDataset | null;
  config: CompassConfig;
  onClose: () => void;
  onCommitted: () => void | Promise<void>;
}

const SUMMARY_LABELS: Array<[keyof ReturnType<typeof buildImportPreview>["summary"], string]> = [
  ["totalRows", "Rows detected"],
  ["organizationsDetected", "Organizations"],
  ["matchedOrganizations", "Matched"],
  ["unmatchedOrganizations", "Unresolved"],
  ["newOrganizations", "New clients"],
  ["devicesDetected", "Devices"],
  ["physicalServers", "Physical servers"],
  ["virtualMachines", "Virtual machines"],
  ["workstations", "Workstations"],
  ["rejectedRows", "Rejected rows"],
  ["osConcerns", "OS concerns"],
  ["storageConcerns", "Storage concerns"],
];

export function CompassDataDialog({ open, dataset, config, onClose, onCommitted }: Props) {
  const [parsed, setParsed] = useState<ParsedCompassImport | null>(null);
  const [resolutions, setResolutions] = useState<OrganizationResolutions>({});
  const [reading, setReading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [fileError, setFileError] = useState("");
  const [commitError, setCommitError] = useState("");
  const preview = useMemo(() => parsed ? buildImportPreview(parsed, dataset, resolutions, config) : null, [parsed, dataset, resolutions, config]);
  const closeDialog = () => {
    if (committing) return;
    setParsed(null);
    setResolutions({});
    setFileError("");
    setCommitError("");
    onClose();
  };
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !committing) { setParsed(null); setResolutions({}); setFileError(""); setCommitError(""); onClose(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, committing]);

  if (!open) return null;

  const selectFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setFileError("");
    setCommitError("");
    try {
      const next = await parseCompassSpreadsheet(file);
      setParsed(next);
      setResolutions(defaultOrganizationResolutions(next, dataset));
    } catch (cause) {
      setParsed(null);
      setResolutions({});
      setFileError(cause instanceof Error ? cause.message : "The spreadsheet could not be read.");
    } finally { setReading(false); }
  };

  const markAllNew = () => {
    if (!parsed) return;
    setResolutions((current) => Object.fromEntries((preview?.organizations ?? []).map((organization) => [organization, current[organization]?.mode === "existing" ? current[organization] : { mode: "new" as const }])));
  };

  const commit = async () => {
    if (!preview?.dataset || committing) return;
    setCommitting(true);
    setCommitError("");
    try {
      await saveCompassDataset(preview.dataset);
      await onCommitted();
      setParsed(null);
      setResolutions({});
      setFileError("");
      onClose();
    } catch (cause) {
      setCommitError(cause instanceof Error ? cause.message : "The current snapshot could not be saved.");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="compass-modal-backdrop" role="presentation" onMouseDown={closeDialog}>
      <section className="compass-modal compass-import-modal" role="dialog" aria-modal="true" aria-labelledby="compass-import-title" aria-busy={committing} onMouseDown={(event) => event.stopPropagation()}>
        <header className="compass-modal-header">
          <div><span className="compass-kicker">Current-state data</span><h2 id="compass-import-title">Update Client Compass Data</h2><p>Preview a Ninja master spreadsheet, resolve organizations, and replace the current technical snapshot.</p></div>
          <button className="compass-drawer-close" type="button" disabled={committing} onClick={closeDialog} aria-label="Close data import">×</button>
        </header>

        <label className="compass-file-drop">
          <input type="file" accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.tsv" onChange={(event) => void selectFile(event.target.files?.[0])} />
          <strong>{reading ? "Reading spreadsheet…" : parsed ? parsed.sourceName : "Choose Ninja master spreadsheet"}</strong>
          <span>Supported: XLSX, XLS, XLSM, XLSB, CSV, and TSV. Processing stays in this browser.</span>
        </label>
        {fileError && <div className="compass-import-error" role="alert">{fileError}</div>}

        {preview && (
          <>
            <div className="compass-import-summary">
              {SUMMARY_LABELS.map(([key, label]) => <div key={key}><strong>{preview.summary[key]}</strong><span>{label}</span></div>)}
            </div>

            <div className="compass-resolution-header">
              <div><h3>Organization matching</h3><p>Exact normalized names and saved aliases are matched automatically. Every other organization needs an explicit choice.</p></div>
              {preview.unresolvedOrganizations.length > 0 && <button className="button secondary" type="button" onClick={markAllNew}>Treat unresolved as new</button>}
            </div>
            <div className="compass-resolution-list">
              {preview.organizations.map((organization) => {
                const resolution = resolutions[organization] ?? { mode: "unresolved" as const };
                const value = resolution.mode === "existing" ? `existing:${resolution.clientId}` : resolution.mode;
                return (
                  <label key={organization} className={resolution.mode === "unresolved" ? "is-unresolved" : ""}>
                    <span><strong>{organization}</strong><small>{resolution.mode === "existing" ? "Matched to current client" : resolution.mode === "new" ? "Create a new client record" : "Action required"}</small></span>
                    <select value={value} onChange={(event) => {
                      const selected = event.target.value;
                      setResolutions((current) => ({ ...current, [organization]: selected === "new" ? { mode: "new" } : selected === "unresolved" ? { mode: "unresolved" } : { mode: "existing", clientId: selected.replace(/^existing:/, "") } }));
                    }}>
                      <option value="unresolved">Leave unresolved</option>
                      <option value="new">Create as new client</option>
                      {dataset?.clients.map((client) => <option key={client.id} value={`existing:${client.id}`}>Map to {client.name}</option>)}
                    </select>
                  </label>
                );
              })}
            </div>
            <div className="compass-import-note">Committing replaces the prior technical device snapshot. Existing contact, owner, review, mapping, follow-up, status, and note fields are preserved.</div>
          </>
        )}

        <div className={`compass-commit-feedback${committing || commitError ? " is-visible" : ""}`} aria-live="polite">
          {committing && preview?.dataset && <span>Saving {preview.dataset.devices.length.toLocaleString()} devices in this browser…</span>}
          {commitError && <span className="is-error" role="alert">{commitError}</span>}
        </div>
        <footer className="compass-modal-actions" aria-busy={committing}>
          <button className="button secondary" type="button" disabled={committing} onClick={closeDialog}>Cancel</button>
          <button className="button primary" type="button" disabled={!preview?.dataset || reading || committing} onClick={() => void commit()}>{committing ? "Saving current snapshot…" : preview?.unresolvedOrganizations.length ? `Resolve ${preview.unresolvedOrganizations.length} organization${preview.unresolvedOrganizations.length === 1 ? "" : "s"}` : "Commit current snapshot"}</button>
        </footer>
      </section>
    </div>
  );
}
