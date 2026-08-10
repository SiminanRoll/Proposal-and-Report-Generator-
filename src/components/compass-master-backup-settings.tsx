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
  CLOUD_SNAPSHOT_STATUS_EVENT,
  getCloudSnapshotStatus,
  saveCloudDatabaseSnapshotNow,
  type CloudSnapshotStatus,
} from "@/lib/compass/cloud-snapshot";
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
import { useProjects } from "@/lib/projects/store";

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

function emptyCloudStatus(): CloudSnapshotStatus {
  return { configured: false, signedIn: false, protected: false, lastSavedAt: "", appVersion: "", error: "" };
}

export function CompassMasterBackupSettings() {
  const { dataset, refresh } = useCompassState();
  const { projects, refresh: refreshProjects } = useProjects();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [durableBusy, setDurableBusy] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<CompassBackupReadResult | null>(null);
  const [durableStatus, setDurableStatus] = useState<DurableStorageStatus>(emptyDurableStatus);
  const [cloudStatus, setCloudStatus] = useState<CloudSnapshotStatus>(emptyCloudStatus);

  useEffect(() => {
    let mounted = true;
    const loadDurable = () => {
      void getDurableStorageStatus().then((status) => { if (mounted) setDurableStatus(status); }).catch(() => undefined);
    };
    const loadCloud = () => {
      void getCloudSnapshotStatus().then((status) => { if (mounted) setCloudStatus(status); }).catch(() => undefined);
    };
    loadDurable();
    loadCloud();
    window.addEventListener(DURABLE_STORAGE_STATUS_EVENT, loadDurable);
    window.addEventListener(CLOUD_SNAPSHOT_STATUS_EVENT, loadCloud);
    return () => {
      mounted = false;
      window.removeEventListener(DURABLE_STORAGE_STATUS_EVENT, loadDurable);
      window.removeEventListener(CLOUD_SNAPSHOT_STATUS_EVENT, loadCloud);
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

  const saveCloudNow = async () => {
    if (cloudBusy) return;
    setCloudBusy(true); setMessage(""); setError("");
    try {
      const status = await saveCloudDatabaseSnapshotNow();
      setCloudStatus(status);
      setMessage(status.protected ? "Supabase recovery snapshot saved." : "Sign in to the shared Supabase connection to enable automatic cloud recovery.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not save the Supabase recovery snapshot.");
    } finally {
      setCloudBusy(false);
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

  const permissionLabel = durableStatus.permission === "granted" ? "Protected" : durableStatus.permission === "prompt" ? "Reconnect needed" : durableStatus.permission === "denied" ? "Permission blocked" : durableStatus.connected ? "Connected" : "Enable once";
  const cloudLabel = cloudStatus.error ? "Setup needed" : cloudStatus.protected ? "Protected" : cloudStatus.signedIn ? "Ready" : "Sign in needed";
  const cloudPillClass = cloudStatus.error ? "is-denied" : cloudStatus.protected ? "is-granted" : cloudStatus.signedIn ? "is-prompt" : "is-none";

  return <div className="compass-settings-subpanel compass-master-backup-settings">
    <div className="compass-settings-subsection-heading"><span>Recovery</span><h3>Backup &amp; restore</h3><p>Automatic protection plus portable recovery files, all in one place.</p></div>

    <div className={`compass-durable-folder-card${cloudStatus.protected ? " is-connected" : ""}`}>
      <div className="compass-durable-folder-copy">
        <div className="compass-durable-folder-heading"><span>Automatic protection</span><h4>Supabase recovery snapshot</h4></div>
        <p>When the shared Supabase connection is signed in, Compass automatically keeps a current recovery copy outside this browser. If the local database disappears, Compass can restore from this copy.</p>
        <div className="compass-durable-folder-status">
          <strong>{cloudStatus.signedIn ? "Shared Compass / Captain's Log Supabase" : "Shared Supabase connection not signed in"}</strong>
          <span className={`durable-status-pill ${cloudPillClass}`}>{cloudLabel}</span>
        </div>
        {cloudStatus.lastSavedAt && <small>Last cloud snapshot {backupDate(cloudStatus.lastSavedAt)}{cloudStatus.appVersion ? ` · v${cloudStatus.appVersion}` : ""}</small>}
        {cloudStatus.error && <small className="compass-durable-folder-note">{cloudStatus.error}</small>}
      </div>
      <div className="compass-durable-folder-actions">
        <button className="button secondary" type="button" disabled={cloudBusy || !dataset || !cloudStatus.signedIn} onClick={() => void saveCloudNow()}>{cloudBusy ? "Working…" : "Save cloud now"}</button>
      </div>
    </div>

    <div className={`compass-durable-folder-card${durableStatus.connected ? " is-connected" : ""}`}>
      <div className="compass-durable-folder-copy">
        <div className="compass-durable-folder-heading"><span>Local safety copy</span><h4>{DURABLE_DEFAULT_LOCATION_LABEL}</h4></div>
        <p>Compass defaults local protection to its own folder in Documents. The browser requires one permission approval the first time; after that the database mirror is maintained automatically.</p>
        <div className="compass-durable-folder-status">
          <strong>{durableStatus.connected ? durableStatus.folderName : durableStatus.supported ? DURABLE_DEFAULT_LOCATION_LABEL : "Folder access unavailable"}</strong>
          <span className={`durable-status-pill is-${durableStatus.permission}`}>{permissionLabel}</span>
        </div>
        {durableStatus.connected && <small>{durableStatus.currentFile}{durableStatus.lastSavedAt ? ` · Last saved ${backupDate(durableStatus.lastSavedAt)}` : ""}</small>}
        {!durableStatus.supported && <small>Documents mirroring requires desktop Microsoft Edge, Chrome, or another browser that supports direct folder access.</small>}
        <small className="compass-durable-folder-note">The folder picker starts in Documents and Compass creates/uses “Client Compass Data” automatically. Full backup below still includes source/evidence attachments.</small>
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
