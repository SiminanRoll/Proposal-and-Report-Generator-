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
    const reportCopy = preview.workspacesIncluded
      ? ` Saved reports/proposals (${preview.projectCount}) will also be restored.`
      : " This is an older backup, so current saved reports/proposals will be left alone.";
    if (preview.mode === "full") {
      const proceed = window.confirm(`Restore this full backup from ${backupDate(preview.createdAt)}?\n\nThis replaces the current Client Compass client snapshot, including inventory, with ${preview.clientCount} clients and ${preview.deviceCount} devices from the backup.${reportCopy}`);
      if (!proceed) return;
    } else {
      const proceed = window.confirm(`Restore this metadata backup from ${backupDate(preview.createdAt)}?\n\nClient details, workflow/history, settings, and segments will be restored. Existing inventory is preserved when present.${reportCopy}`);
      if (!proceed) return;
    }

    setBusy(true); setMessage(""); setError("");
    try {
      const result = await restoreCompassMasterBackup(pending.payload);
      await refresh();
      refreshProjects();
      setPending(null);
      const reports = result.workspacesIncluded ? ` · ${result.projectCount} saved report/proposal${result.projectCount === 1 ? "" : "s"} restored` : "";
      setMessage(result.mode === "full"
        ? `Full restore complete: ${result.clientCount} clients and ${result.deviceCount} devices restored${reports}.`
        : `Metadata restore complete: ${result.clientCount} clients restored${result.mergedIntoExistingInventory ? " and current inventory was preserved" : ""}${reports}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not restore this backup.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="compass-settings-section compass-master-backup-settings">
    <div className="compass-settings-section-heading">
      <div>
        <span className="compass-kicker">Client data</span>
        <h2>Master backup &amp; restore</h2>
        <p>One recovery file now covers Client Compass client data, settings, managed segments, and saved report/proposal work. Use metadata for the normal lightweight backup, or full when you also want inventory.</p>
      </div>
    </div>

    <div className="compass-master-backup-grid">
      <article className="compass-master-backup-card">
        <span>Recommended</span>
        <h3>Metadata backup</h3>
        <p>Clients, contacts, account-review and quote history, workflow fields, notes, review outcomes, Captain&apos;s Log snapshot, dashboard settings, segments, and saved report/proposal workspaces. Inventory is intentionally left out.</p>
        <strong>{dataset ? `${dataset.clients.length} clients · ${projects.length} saved report/proposal${projects.length === 1 ? "" : "s"} · inventory excluded` : "No client dataset loaded"}</strong>
        <button className="button primary" type="button" disabled={busy || !dataset} onClick={() => void download("metadata")}>Download metadata backup</button>
      </article>
      <article className="compass-master-backup-card">
        <span>Safety copy</span>
        <h3>Full backup</h3>
        <p>Everything in the metadata backup plus the complete current inventory and location snapshot. This file is larger, but it can rebuild the current Client Compass client dataset and saved report/proposal state.</p>
        <strong>{dataset ? `${dataset.clients.length} clients · ${projects.length} saved report/proposal${projects.length === 1 ? "" : "s"} · ${dataset.devices.length} devices` : "No client dataset loaded"}</strong>
        <button className="button secondary" type="button" disabled={busy || !dataset} onClick={() => void download("full")}>Download full backup</button>
      </article>
    </div>

    <input ref={inputRef} hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void chooseBackup(event)} />
    <div className="compass-master-restore-row">
      <div><strong>Restore a Client Compass backup</strong><small>The workbook is validated first. Nothing is written until you review the backup type and confirm the restore.</small></div>
      <button className="button secondary" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? "Working…" : "Choose backup file"}</button>
    </div>

    {pending && <div className={`compass-master-backup-preview is-${pending.preview.mode}`}>
      <div><span>{backupLabel(pending.preview.mode)}</span><strong>{backupDate(pending.preview.createdAt)}</strong><small>Created with Client Compass {pending.preview.appVersion}</small></div>
      <div><span>Clients</span><strong>{pending.preview.clientCount}</strong><small>{pending.preview.segmentCount} saved segment{pending.preview.segmentCount === 1 ? "" : "s"}</small></div>
      <div><span>Reports &amp; proposals</span><strong>{pending.preview.workspacesIncluded ? pending.preview.projectCount : "Legacy backup"}</strong><small>{pending.preview.workspacesIncluded ? "saved workspaces in backup" : "current work will be preserved"}</small></div>
      <div><span>Inventory</span><strong>{pending.preview.mode === "full" ? pending.preview.deviceCount : "Preserve current"}</strong><small>{pending.preview.mode === "full" ? "devices in backup" : "metadata-only restore"}</small></div>
      <button className="button primary" type="button" disabled={busy} onClick={() => void restore()}>Restore {pending.preview.mode === "full" ? "full backup" : "metadata"}</button>
      <button className="button secondary compact" type="button" disabled={busy} onClick={() => setPending(null)}>Cancel</button>
    </div>}

    {(message || error) && <div className={error ? "compass-import-error" : "compass-workspace-success"} role={error ? "alert" : "status"}>{error || message}</div>}
  </section>;
}
