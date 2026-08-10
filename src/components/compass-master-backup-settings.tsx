"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  exportCompassMasterBackup,
  readCompassMasterBackup,
  restoreCompassMasterBackup,
  type CompassBackupMode,
  type CompassBackupReadResult,
} from "@/lib/compass/backup";
import { useCompassState } from "@/lib/compass/store";
import { useProjects } from "@/lib/projects/store";

function backupLabel(mode: CompassBackupMode): string {
  return mode === "full" ? "Full backup" : "Metadata backup";
}

function backupDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function CompassMasterBackupSettings() {
  const { dataset, refresh } = useCompassState();
  const { projects, refresh: refreshProjects } = useProjects();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<CompassBackupReadResult | null>(null);

  const download = async (mode: CompassBackupMode) => {
    if (busy) return;
    setBusy(true); setMessage(""); setError("");
    try {
      await exportCompassMasterBackup(mode);
      setMessage(`${backupLabel(mode)} downloaded.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not create this backup.");
    } finally {
      setBusy(false);
    }
  };

  const chooseBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setBusy(true); setMessage(""); setError(""); setPending(null);
    try {
      setPending(await readCompassMasterBackup(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not read this backup.");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!pending || busy) return;
    const { preview } = pending;
    const detail = preview.mode === "full"
      ? `${preview.clientCount} clients, ${preview.deviceCount} devices, ${preview.projectCount} workspaces and ${preview.sourceFileCount} attached files`
      : `${preview.clientCount} clients and ${preview.projectCount} workspaces`;
    if (!window.confirm(`Restore ${backupLabel(preview.mode).toLowerCase()} from ${backupDate(preview.createdAt)}?\n\n${detail}.`)) return;

    setBusy(true); setMessage(""); setError("");
    try {
      const result = await restoreCompassMasterBackup(pending.payload);
      await refresh();
      refreshProjects();
      setPending(null);
      setMessage(result.mode === "full"
        ? `Full restore complete · ${result.clientCount} clients · ${result.deviceCount} devices · ${result.projectCount} workspaces · ${result.sourceFileCount} files.`
        : `Metadata restore complete · ${result.clientCount} clients · ${result.projectCount} workspaces.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not restore this backup.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="compass-settings-subpanel compass-master-backup-settings">
    <div className="compass-settings-subsection-heading"><span>Recovery</span><h3>Backup &amp; restore</h3><p>Create a portable recovery file or restore one without leaving Settings.</p></div>

    <div className="compass-master-backup-grid compass-master-backup-grid-clean">
      <article className="compass-master-backup-card">
        <div className="compass-master-backup-card-heading"><span>Lightweight</span><h4>Metadata backup</h4></div>
        <div className="compass-backup-scope">Clients · activity · segments · workspaces · settings · map state</div>
        <strong>{dataset ? `${dataset.clients.length} clients · ${projects.length} workspaces` : "No client dataset loaded"}</strong>
        <button className="button secondary" type="button" disabled={busy || !dataset} onClick={() => void download("metadata")}>Download metadata</button>
      </article>
      <article className="compass-master-backup-card is-full-backup">
        <div className="compass-master-backup-card-heading"><span>Complete recovery</span><h4>Full backup</h4></div>
        <div className="compass-backup-scope">Clients · activity · inventory · locations · segments · workspaces · attachments · settings · map state</div>
        <strong>{dataset ? `${dataset.clients.length} clients · ${dataset.devices.length} devices · ${projects.length} workspaces` : "No client dataset loaded"}</strong>
        <button className="button primary" type="button" disabled={busy || !dataset} onClick={() => void download("full")}>Download full backup</button>
      </article>
    </div>

    <input ref={inputRef} hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void chooseBackup(event)} />
    <div className="compass-master-restore-row compass-master-restore-row-clean">
      <div className="compass-master-restore-copy"><strong>Restore from backup</strong><small>Choose a Client Compass backup file. Nothing is replaced until you review and confirm it.</small></div>
      <button className="button secondary" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? "Working…" : "Choose backup file"}</button>
    </div>

    {pending && <div className={`compass-master-backup-preview is-${pending.preview.mode}`}>
      <div className="compass-master-backup-preview-heading"><div><span>{backupLabel(pending.preview.mode)}</span><strong>{backupDate(pending.preview.createdAt)}</strong></div><small>Review this backup before restoring.</small></div>
      <div className="compass-master-backup-preview-grid">
        <div><span>Clients</span><strong>{pending.preview.clientCount}</strong></div>
        <div><span>Workspaces</span><strong>{pending.preview.workspacesIncluded ? pending.preview.projectCount : "Legacy"}</strong></div>
        <div><span>Inventory</span><strong>{pending.preview.mode === "full" ? pending.preview.deviceCount : "Preserve"}</strong></div>
        <div><span>Attachments</span><strong>{pending.preview.mode === "full" ? pending.preview.sourceFileCount : "—"}</strong></div>
        <div><span>Saved settings</span><strong>{pending.preview.settingsCount}</strong></div>
      </div>
      <div className="compass-master-backup-preview-actions"><button className="button primary" type="button" disabled={busy} onClick={() => void restore()}>Restore backup</button><button className="button secondary compact" type="button" disabled={busy} onClick={() => setPending(null)}>Cancel</button></div>
    </div>}

    {(message || error) && <div className={error ? "compass-import-error" : "compass-workspace-success"} role={error ? "alert" : "status"}>{error || message}</div>}
  </div>;
}
