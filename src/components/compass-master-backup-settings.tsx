"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  exportCompassMasterBackup,
  readCompassMasterBackup,
  restoreCompassMasterBackup,
  type CompassBackupMode,
  type CompassBackupReadResult,
} from "@/lib/compass/backup";
import {
  chooseDurableDataFolder,
  disconnectDurableDataFolder,
  DURABLE_DATABASE_FILE,
  DURABLE_DEFAULT_LOCATION_LABEL,
  DURABLE_STORAGE_STATUS_EVENT,
  getDurableStorageStatus,
  reconnectDurableDataFolder,
  saveDurableDatabaseMirrorNow,
  type DurableStorageStatus,
} from "@/lib/compass/durable-storage";
import { useCompassState } from "@/lib/compass/store";
import { importProjectsBackup, useProjects } from "@/lib/projects/store";
import { isProjectType } from "@/lib/projects/types";

function backupLabel(mode: CompassBackupMode): string {
  return mode === "full" ? "Full backup" : "Metadata backup";
}

function backupDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function emptyDurableStatus(): DurableStorageStatus {
  return { supported: true, connected: false, folderName: "", permission: "none", lastSavedAt: "", currentFile: DURABLE_DATABASE_FILE };
}

type WorkspaceBackupPreview = {
  file: File;
  count: number;
  names: string[];
  exportedAt: string;
};

function readWorkspaceBackupPreview(file: File, parsed: unknown): WorkspaceBackupPreview {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("This JSON file is not a Client Compass workspace recovery backup.");
  const value = parsed as Record<string, unknown>;
  if (value.format !== "advantage-proposal-report-generator-backup" || !Array.isArray(value.projects)) {
    throw new Error("This JSON file is not a Client Compass workspace recovery backup.");
  }
  const projects = value.projects.filter((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const candidate = entry as Record<string, unknown>;
    return candidate.schemaVersion === 2 && typeof candidate.id === "string" && typeof candidate.type === "string" && isProjectType(candidate.type);
  }) as Array<Record<string, unknown>>;
  if (!projects.length) throw new Error("No valid Client Compass workspaces were found in this recovery file.");
  return {
    file,
    count: projects.length,
    names: projects.map((project) => String(project.name || "Recovered workspace")).slice(0, 4),
    exportedAt: String(value.exportedAt || ""),
  };
}

export function CompassMasterBackupSettings() {
  const { dataset, refresh } = useCompassState();
  const { projects, refresh: refreshProjects } = useProjects();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [durableBusy, setDurableBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<CompassBackupReadResult | null>(null);
  const [pendingWorkspace, setPendingWorkspace] = useState<WorkspaceBackupPreview | null>(null);
  const [durableStatus, setDurableStatus] = useState<DurableStorageStatus>(emptyDurableStatus);

  useEffect(() => {
    let mounted = true;
    const loadDurable = () => {
      void getDurableStorageStatus().then((status) => { if (mounted) setDurableStatus(status); }).catch(() => undefined);
    };
    loadDurable();
    window.addEventListener(DURABLE_STORAGE_STATUS_EVENT, loadDurable);
    return () => {
      mounted = false;
      window.removeEventListener(DURABLE_STORAGE_STATUS_EVENT, loadDurable);
    };
  }, []);

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

  const connectDurableFolder = async () => {
    if (durableBusy) return;
    setDurableBusy(true); setMessage(""); setError("");
    try {
      const result = await chooseDurableDataFolder();
      setDurableStatus(result.status);
      await refresh();
      refreshProjects();
      setMessage(result.recovered
        ? `Recovered your Client Compass database from ${result.status.folderName} and reconnected Documents protection.`
        : `Documents protection is on in ${result.status.folderName}.`);
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : "";
      if (name !== "AbortError") setError(cause instanceof Error ? cause.message : "Client Compass could not enable Documents protection.");
    } finally {
      setDurableBusy(false);
    }
  };

  const reconnectDurableFolder = async () => {
    if (durableBusy) return;
    setDurableBusy(true); setMessage(""); setError("");
    try {
      const result = await reconnectDurableDataFolder();
      setDurableStatus(result.status);
      await refresh();
      refreshProjects();
      setMessage(result.recovered ? "Database recovered from your Documents copy." : "Documents folder access restored.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not reconnect the Documents folder.");
    } finally {
      setDurableBusy(false);
    }
  };

  const saveDurableNow = async () => {
    if (durableBusy) return;
    setDurableBusy(true); setMessage(""); setError("");
    try {
      const status = await saveDurableDatabaseMirrorNow();
      setDurableStatus(status);
      setMessage(`Database mirror saved to ${status.folderName || DURABLE_DEFAULT_LOCATION_LABEL}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not save the Documents database mirror.");
    } finally {
      setDurableBusy(false);
    }
  };

  const disconnectDurable = async () => {
    if (durableBusy || !durableStatus.connected) return;
    if (!window.confirm("Disconnect Documents protection? The recovery files already written to the folder will stay there.")) return;
    setDurableBusy(true); setMessage(""); setError("");
    try {
      await disconnectDurableDataFolder();
      setDurableStatus(await getDurableStorageStatus());
      setMessage("Documents protection disconnected. Existing recovery files were left untouched.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not disconnect the durable folder.");
    } finally {
      setDurableBusy(false);
    }
  };

  const chooseBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setBusy(true); setMessage(""); setError(""); setPending(null); setPendingWorkspace(null);
    try {
      const isJson = file.name.toLowerCase().endsWith(".json") || file.type === "application/json";
      if (isJson) {
        const parsed = JSON.parse(await file.text()) as unknown;
        setPendingWorkspace(readWorkspaceBackupPreview(file, parsed));
      } else {
        setPending(await readCompassMasterBackup(file));
      }
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

  const restoreWorkspace = async () => {
    if (!pendingWorkspace || busy) return;
    const label = pendingWorkspace.count === 1 ? "workspace" : "workspaces";
    const names = pendingWorkspace.names.length ? `\n\n${pendingWorkspace.names.join("\n")}` : "";
    if (!window.confirm(`Import ${pendingWorkspace.count} recovered ${label}?${names}\n\nExisting clients, inventory, activity, segments, settings, map state, and other workspaces will be preserved.`)) return;

    setBusy(true); setMessage(""); setError("");
    try {
      const imported = await importProjectsBackup(pendingWorkspace.file);
      refreshProjects();
      await saveDurableDatabaseMirrorNow().catch(() => undefined);
      setPendingWorkspace(null);
      setMessage(`Workspace recovery complete · ${imported} ${imported === 1 ? "workspace" : "workspaces"} imported · existing Client Compass data preserved.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not import this workspace recovery.");
    } finally {
      setBusy(false);
    }
  };

  const permissionLabel = durableStatus.permission === "granted" ? "Protected" : durableStatus.permission === "prompt" ? "Reconnect needed" : durableStatus.permission === "denied" ? "Permission blocked" : durableStatus.connected ? "Connected" : "Enable once";

  return <div className="compass-settings-subpanel compass-master-backup-settings">
    <div className="compass-settings-subsection-heading"><span>Recovery</span><h3>Backup &amp; restore</h3><p>Private recovery stays local; Supabase is reserved for shared operational records.</p></div>

    <div className={`compass-durable-folder-card${durableStatus.connected ? " is-connected" : ""}`}>
      <div className="compass-durable-folder-copy">
        <div className="compass-durable-folder-heading"><span>Private automatic protection</span><h4>{DURABLE_DEFAULT_LOCATION_LABEL}</h4></div>
        <p>Compass keeps its private working database in the browser and mirrors it to its own Documents folder. The browser requires one permission approval the first time; after that the database mirror is maintained automatically.</p>
        <div className="compass-durable-folder-status">
          <strong>{durableStatus.connected ? durableStatus.folderName : durableStatus.supported ? DURABLE_DEFAULT_LOCATION_LABEL : "Folder access unavailable"}</strong>
          <span className={`durable-status-pill is-${durableStatus.permission}`}>{permissionLabel}</span>
        </div>
        {durableStatus.connected && <small>{durableStatus.currentFile}{durableStatus.lastSavedAt ? ` · Last saved ${backupDate(durableStatus.lastSavedAt)}` : ""}</small>}
        {!durableStatus.supported && <small>Documents mirroring requires desktop Microsoft Edge, Chrome, or another browser that supports direct folder access.</small>}
        <small className="compass-durable-folder-note">Raw imports, inventory, source documents and project working data stay in private recovery. Supabase receives only the approved shared company, task, review, OTA and aggregate technology records.</small>
      </div>
      <div className="compass-durable-folder-actions">
        {durableStatus.supported && (!durableStatus.connected || durableStatus.permission === "granted") && <button className="button primary" type="button" disabled={durableBusy} onClick={() => void connectDurableFolder()}>{durableBusy ? "Working…" : durableStatus.connected ? "Change folder" : "Enable Documents protection"}</button>}
        {durableStatus.supported && durableStatus.connected && durableStatus.permission !== "granted" && <button className="button primary" type="button" disabled={durableBusy} onClick={() => void reconnectDurableFolder()}>{durableBusy ? "Working…" : "Reconnect Documents"}</button>}
        {durableStatus.connected && durableStatus.permission === "granted" && <button className="button secondary" type="button" disabled={durableBusy || !dataset} onClick={() => void saveDurableNow()}>Save local now</button>}
        {durableStatus.connected && <button className="button secondary compact" type="button" disabled={durableBusy} onClick={() => void disconnectDurable()}>Disconnect</button>}
      </div>
    </div>

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

    <input ref={inputRef} hidden type="file" accept=".xlsx,.json,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void chooseBackup(event)} />
    <div className="compass-master-restore-row compass-master-restore-row-clean">
      <div className="compass-master-restore-copy"><strong>Restore or recover</strong><small>Choose a master backup (.xlsx) or a workspace recovery (.json). Nothing changes until you review and confirm it.</small></div>
      <button className="button secondary" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? "Working…" : "Choose backup file"}</button>
    </div>

    {pendingWorkspace && <div className="compass-master-backup-preview is-workspace-recovery">
      <div className="compass-master-backup-preview-heading"><div><span>Workspace recovery</span><strong>{pendingWorkspace.count} {pendingWorkspace.count === 1 ? "workspace" : "workspaces"}</strong></div><small>Additive import — your existing Client Compass database is preserved.</small></div>
      <div className="compass-master-backup-preview-grid">
        <div><span>Workspaces</span><strong>{pendingWorkspace.count}</strong></div>
        <div><span>Clients</span><strong>Preserve</strong></div>
        <div><span>Inventory</span><strong>Preserve</strong></div>
        <div><span>Settings</span><strong>Preserve</strong></div>
        <div><span>Map state</span><strong>Preserve</strong></div>
      </div>
      {pendingWorkspace.names.length > 0 && <div className="compass-backup-scope">{pendingWorkspace.names.join(" · ")}</div>}
      <div className="compass-master-backup-preview-actions"><button className="button primary" type="button" disabled={busy} onClick={() => void restoreWorkspace()}>Import recovered workspace</button><button className="button secondary compact" type="button" disabled={busy} onClick={() => setPendingWorkspace(null)}>Cancel</button></div>
    </div>}

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
