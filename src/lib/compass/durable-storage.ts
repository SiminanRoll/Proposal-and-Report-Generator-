"use client";

import { exportLocalSourceFiles, getLocalSourceFile, restoreLocalSourceFiles, type LocalSourceFileBackup } from "@/lib/projects/file-store";
import { getProjectsSnapshot, restoreProjectsSnapshot } from "@/lib/projects/store";
import type { Project } from "@/lib/projects/types";
import { loadSegments, saveSegments } from "@/lib/segments/store";
import type { SegmentDefinition } from "@/lib/segments/types";
import { loadCompassConfig, loadCompassDataset, saveCompassConfigAndDataset } from "./store";
import type { CompassConfig, CompassDataset } from "./types";

export const DURABLE_STORAGE_STATUS_EVENT = "client-compass-durable-storage-status";
export const DURABLE_DATABASE_FILE = "Client Compass Durable Database.json";
export const DURABLE_DATABASE_PREVIOUS_FILE = "Client Compass Durable Database Previous.json";
export const DURABLE_DEFAULT_FOLDER_NAME = "Client Compass Data";
export const DURABLE_DEFAULT_LOCATION_LABEL = `Documents\\${DURABLE_DEFAULT_FOLDER_NAME}`;

const HANDLE_DATABASE = "client-compass-durable-folder";
const HANDLE_DATABASE_VERSION = 1;
const HANDLE_STORE = "handles";
const HANDLE_KEY = "database-folder";
const LAST_SAVED_KEY = "client-compass.durable.last-saved-at";
const FORMAT = "client-compass-durable-database";
const SCHEMA_VERSION = 2;

const APP_STATE_PREFIXES = ["client-compass.", "client_compass_", "advantage.proposal-report-generator."];
const CANONICAL_STATE_KEYS = new Set([
  "client-compass.current-dataset.v1",
  "client-compass.configuration.v1",
  "client-compass.segments.v1",
  "advantage.proposal-report-generator.projects.v1",
  "advantage.proposal-report-generator.projects.v2",
  LAST_SAVED_KEY,
]);
const SENSITIVE_STATE_KEYS = new Set(["client_compass_captains_log_cloud_session"]);

interface DurableWritable {
  write(data: string | Blob): Promise<void>;
  close(): Promise<void>;
}

interface DurableFileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<DurableWritable>;
}

interface DurableDirectoryHandle {
  kind: "directory";
  name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<DurableFileHandle>;
  getDirectoryHandle?(name: string, options?: { create?: boolean }): Promise<DurableDirectoryHandle>;
  queryPermission?(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission?(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: "read" | "readwrite";
    id?: string;
    startIn?: "documents" | "desktop" | "downloads" | "music" | "pictures" | "videos";
  }) => Promise<DurableDirectoryHandle>;
};

type RecoveryCandidate = {
  handle: DurableDirectoryHandle;
  snapshot: DurableDatabaseSnapshot;
  timestamp: number;
};

export interface DurableDatabaseSnapshot {
  format: typeof FORMAT;
  schemaVersion: 1 | 2;
  savedAt: string;
  dataset: CompassDataset;
  config: CompassConfig;
  segments: SegmentDefinition[];
  projects: Project[];
  browserState: Record<string, string>;
  sourceFiles?: LocalSourceFileBackup[];
}

export interface DurableStorageStatus {
  supported: boolean;
  connected: boolean;
  folderName: string;
  permission: PermissionState | "none" | "unsupported";
  lastSavedAt: string;
  currentFile: string;
}

function supported(): boolean {
  return typeof window !== "undefined" && typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function" && Boolean(window.indexedDB);
}

function hasMeaningfulDataset(dataset: CompassDataset | null): dataset is CompassDataset {
  return Boolean(dataset && (dataset.clients.length > 0 || dataset.devices.length > 0));
}

function isRestorableAppStateKey(key: string): boolean {
  return APP_STATE_PREFIXES.some((prefix) => key.startsWith(prefix))
    && !CANONICAL_STATE_KEYS.has(key)
    && !SENSITIVE_STATE_KEYS.has(key);
}

function captureBrowserState(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const state: Record<string, string> = {};
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !isRestorableAppStateKey(key)) continue;
    const value = window.localStorage.getItem(key);
    if (value !== null) state[key] = value;
  }
  return state;
}

function restoreBrowserState(state: Record<string, string>): void {
  if (typeof window === "undefined") return;
  const currentKeys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && isRestorableAppStateKey(key)) currentKeys.push(key);
  }
  for (const key of currentKeys) window.localStorage.removeItem(key);
  for (const [key, value] of Object.entries(state || {})) {
    if (isRestorableAppStateKey(key)) window.localStorage.setItem(key, String(value));
  }
  window.dispatchEvent(new Event("storage"));
  window.dispatchEvent(new Event("client-compass-map-lens-changed"));
}

function projectSourceFileIds(projects: Project[]): string[] {
  const ids = projects.flatMap((project) => [
    ...project.sources.flatMap((source) => source.files.map((file) => file.id)),
    ...project.hipaa.answers.flatMap((answer) => answer.evidenceAttachment?.id ? [answer.evidenceAttachment.id] : []),
  ]);
  return [...new Set(ids.filter(Boolean))];
}

function projectTimestamp(project: Project): string {
  return String(project.updatedAt || project.createdAt || "");
}

function mergeProjectsFromRecovery(incoming: Project[]): number {
  const current = getProjectsSnapshot();
  const merged = new Map(current.map((project) => [project.id, project]));
  let changed = 0;
  for (const project of incoming) {
    const existing = merged.get(project.id);
    if (!existing || projectTimestamp(project) > projectTimestamp(existing)) {
      merged.set(project.id, project);
      changed += 1;
    }
  }
  if (changed) restoreProjectsSnapshot([...merged.values()]);
  return changed;
}

async function protectedSourceFiles(projects: Project[], previous: DurableDatabaseSnapshot | null): Promise<LocalSourceFileBackup[]> {
  const referencedIds = projectSourceFileIds(projects);
  if (!referencedIds.length) return [];

  const previousById = new Map((previous?.sourceFiles ?? []).filter((file) => Boolean(file?.id)).map((file) => [file.id, file]));
  const protectedFiles: LocalSourceFileBackup[] = [];
  const missingIds: string[] = [];

  for (const id of referencedIds) {
    const alreadyProtected = previousById.get(id);
    if (alreadyProtected) protectedFiles.push(alreadyProtected);
    else missingIds.push(id);
  }

  if (missingIds.length) protectedFiles.push(...await exportLocalSourceFiles(missingIds));
  return protectedFiles;
}

async function restoreMissingLocalSourceFiles(backups: LocalSourceFileBackup[]): Promise<number> {
  const missing: LocalSourceFileBackup[] = [];
  for (const backup of backups) {
    if (!backup?.id || !backup.dataBase64) continue;
    let exists = false;
    try { exists = Boolean(await getLocalSourceFile(backup.id)); } catch { exists = false; }
    if (!exists) missing.push(backup);
  }
  return missing.length ? restoreLocalSourceFiles(missing) : 0;
}

function openHandleDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.reject(new Error("Browser database storage is unavailable."));
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(HANDLE_DATABASE, HANDLE_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(HANDLE_STORE)) request.result.createObjectStore(HANDLE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The durable folder connection could not be opened."));
  });
}

async function loadDirectoryHandle(): Promise<DurableDirectoryHandle | null> {
  if (!supported()) return null;
  const database = await openHandleDatabase();
  try {
    return await new Promise<DurableDirectoryHandle | null>((resolve, reject) => {
      const transaction = database.transaction(HANDLE_STORE, "readonly");
      const request = transaction.objectStore(HANDLE_STORE).get(HANDLE_KEY);
      request.onsuccess = () => resolve((request.result as DurableDirectoryHandle | undefined) ?? null);
      request.onerror = () => reject(request.error ?? transaction.error ?? new Error("The durable folder connection could not be read."));
    });
  } finally {
    database.close();
  }
}

async function saveDirectoryHandle(handle: DurableDirectoryHandle): Promise<void> {
  const database = await openHandleDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(HANDLE_STORE, "readwrite");
      transaction.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("The durable folder connection could not be saved."));
      transaction.onabort = () => reject(transaction.error ?? new Error("The durable folder connection save was interrupted."));
    });
  } finally {
    database.close();
  }
}

async function removeDirectoryHandle(): Promise<void> {
  if (!supported()) return;
  const database = await openHandleDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(HANDLE_STORE, "readwrite");
      transaction.objectStore(HANDLE_STORE).delete(HANDLE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("The durable folder connection could not be removed."));
    });
  } finally {
    database.close();
  }
}

async function permissionFor(handle: DurableDirectoryHandle, request = false): Promise<PermissionState> {
  try {
    const method = request ? handle.requestPermission : handle.queryPermission;
    if (!method) return "granted";
    return await method.call(handle, { mode: "readwrite" });
  } catch {
    return "denied";
  }
}

async function readTextFile(handle: DurableDirectoryHandle, name: string): Promise<{ text: string; modifiedAt: string } | null> {
  try {
    const fileHandle = await handle.getFileHandle(name);
    const file = await fileHandle.getFile();
    return { text: await file.text(), modifiedAt: new Date(file.lastModified).toISOString() };
  } catch {
    return null;
  }
}

async function writeTextFile(handle: DurableDirectoryHandle, name: string, content: string): Promise<void> {
  const fileHandle = await handle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

export function isDurableDatabaseSnapshot(value: unknown): value is DurableDatabaseSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<DurableDatabaseSnapshot>;
  return snapshot.format === FORMAT
    && (snapshot.schemaVersion === 1 || snapshot.schemaVersion === SCHEMA_VERSION)
    && Boolean(snapshot.dataset && snapshot.dataset.schemaVersion === 1 && Array.isArray(snapshot.dataset.clients) && Array.isArray(snapshot.dataset.devices))
    && Boolean(snapshot.config)
    && Array.isArray(snapshot.segments)
    && Array.isArray(snapshot.projects)
    && Boolean(snapshot.browserState && typeof snapshot.browserState === "object")
    && (snapshot.sourceFiles === undefined || Array.isArray(snapshot.sourceFiles));
}

export function parseDurableDatabaseSnapshot(raw: string): DurableDatabaseSnapshot | null {
  try {
    const value = JSON.parse(raw) as unknown;
    return isDurableDatabaseSnapshot(value) ? value : null;
  } catch {
    return null;
  }
}

export async function buildDurableDatabaseSnapshot(previous: DurableDatabaseSnapshot | null = null): Promise<DurableDatabaseSnapshot> {
  const dataset = await loadCompassDataset();
  if (!hasMeaningfulDataset(dataset)) throw new Error("There is no Client Compass database loaded to protect yet.");
  const projects = getProjectsSnapshot();
  return {
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    dataset,
    config: loadCompassConfig(),
    segments: loadSegments(),
    projects,
    browserState: captureBrowserState(),
    sourceFiles: await protectedSourceFiles(projects, previous),
  };
}

export async function restoreDurableDatabaseSnapshot(snapshot: DurableDatabaseSnapshot): Promise<void> {
  if (snapshot.sourceFiles?.length) await restoreLocalSourceFiles(snapshot.sourceFiles);
  restoreBrowserState(snapshot.browserState);
  saveSegments(snapshot.segments);
  restoreProjectsSnapshot(snapshot.projects);
  await saveCompassConfigAndDataset(snapshot.config, snapshot.dataset);
  window.dispatchEvent(new Event("client-compass-data-changed"));
}

function recoveryTimestamp(snapshot: DurableDatabaseSnapshot, modifiedAt: string): number {
  const saved = Date.parse(snapshot.savedAt || "");
  if (Number.isFinite(saved)) return saved;
  const modified = Date.parse(modifiedAt || "");
  return Number.isFinite(modified) ? modified : 0;
}

async function recoveryCandidateFromHandle(handle: DurableDirectoryHandle): Promise<RecoveryCandidate | null> {
  let best: RecoveryCandidate | null = null;
  for (const fileName of [DURABLE_DATABASE_FILE, DURABLE_DATABASE_PREVIOUS_FILE]) {
    const record = await readTextFile(handle, fileName);
    const snapshot = record ? parseDurableDatabaseSnapshot(record.text) : null;
    if (!record || !snapshot || !hasMeaningfulDataset(snapshot.dataset)) continue;
    const candidate = { handle, snapshot, timestamp: recoveryTimestamp(snapshot, record.modifiedAt) };
    if (!best || candidate.timestamp > best.timestamp) best = candidate;
  }
  return best;
}

async function recoverFromCandidate(candidate: RecoveryCandidate): Promise<boolean> {
  if (!hasMeaningfulDataset(await loadCompassDataset())) {
    await restoreDurableDatabaseSnapshot(candidate.snapshot);
    return true;
  }
  const restoredFiles = await restoreMissingLocalSourceFiles(candidate.snapshot.sourceFiles ?? []);
  const mergedProjects = mergeProjectsFromRecovery(candidate.snapshot.projects);
  return restoredFiles > 0 || mergedProjects > 0;
}

async function existingDefaultDataFolder(selected: DurableDirectoryHandle): Promise<DurableDirectoryHandle | null> {
  if (selected.name.trim().toLowerCase() === DURABLE_DEFAULT_FOLDER_NAME.toLowerCase()) return selected;
  if (typeof selected.getDirectoryHandle !== "function") return null;
  try {
    return await selected.getDirectoryHandle(DURABLE_DEFAULT_FOLDER_NAME);
  } catch {
    return null;
  }
}

async function bestSelectedRecoveryCandidate(selected: DurableDirectoryHandle): Promise<RecoveryCandidate | null> {
  const child = await existingDefaultDataFolder(selected);
  const handles = child && child !== selected ? [selected, child] : [selected];
  const candidates = (await Promise.all(handles.map(recoveryCandidateFromHandle))).filter((value): value is RecoveryCandidate => Boolean(value));
  return candidates.sort((left, right) => right.timestamp - left.timestamp)[0] ?? null;
}

async function recoverFromHandle(handle: DurableDirectoryHandle): Promise<boolean> {
  const candidate = await recoveryCandidateFromHandle(handle);
  return candidate ? recoverFromCandidate(candidate) : false;
}

async function resolveDefaultDataFolder(selected: DurableDirectoryHandle): Promise<DurableDirectoryHandle> {
  if (selected.name.trim().toLowerCase() === DURABLE_DEFAULT_FOLDER_NAME.toLowerCase()) return selected;
  if (typeof selected.getDirectoryHandle !== "function") return selected;
  try {
    return await selected.getDirectoryHandle(DURABLE_DEFAULT_FOLDER_NAME, { create: true });
  } catch {
    return selected;
  }
}

function dispatchStatus(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DURABLE_STORAGE_STATUS_EVENT));
}

export async function getDurableStorageStatus(): Promise<DurableStorageStatus> {
  if (!supported()) return { supported: false, connected: false, folderName: "", permission: "unsupported", lastSavedAt: "", currentFile: DURABLE_DATABASE_FILE };
  const handle = await loadDirectoryHandle();
  if (!handle) return { supported: true, connected: false, folderName: "", permission: "none", lastSavedAt: "", currentFile: DURABLE_DATABASE_FILE };
  const permission = await permissionFor(handle);
  let lastSavedAt = typeof window !== "undefined" ? window.localStorage.getItem(LAST_SAVED_KEY) || "" : "";
  if (permission === "granted") {
    const current = await readTextFile(handle, DURABLE_DATABASE_FILE);
    if (current?.modifiedAt) lastSavedAt = current.modifiedAt;
  }
  return { supported: true, connected: true, folderName: handle.name, permission, lastSavedAt, currentFile: DURABLE_DATABASE_FILE };
}

export async function chooseDurableDataFolder(): Promise<{ recovered: boolean; status: DurableStorageStatus }> {
  if (!supported()) throw new Error("Durable folder storage requires desktop Microsoft Edge, Chrome, or another browser with folder access support.");
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) throw new Error("Folder selection is unavailable in this browser.");
  const selected = await picker({ mode: "readwrite", id: "client-compass-data", startIn: "documents" });

  let recovered = false;
  const candidate = await bestSelectedRecoveryCandidate(selected);
  if (candidate) recovered = await recoverFromCandidate(candidate);

  const handle = await resolveDefaultDataFolder(selected);
  await saveDirectoryHandle(handle);
  if (!recovered) recovered = await recoverFromHandle(handle);
  if (hasMeaningfulDataset(await loadCompassDataset())) await saveDurableDatabaseMirrorNow();
  dispatchStatus();
  return { recovered, status: await getDurableStorageStatus() };
}

export async function reconnectDurableDataFolder(): Promise<{ recovered: boolean; status: DurableStorageStatus }> {
  const handle = await loadDirectoryHandle();
  if (!handle) throw new Error("Enable Documents protection first.");
  const permission = await permissionFor(handle, true);
  if (permission !== "granted") throw new Error("Client Compass does not have permission to write to that folder.");
  const recovered = await recoverFromHandle(handle);
  if (hasMeaningfulDataset(await loadCompassDataset())) await saveDurableDatabaseMirrorNow();
  dispatchStatus();
  return { recovered, status: await getDurableStorageStatus() };
}

export async function disconnectDurableDataFolder(): Promise<void> {
  await removeDirectoryHandle();
  if (typeof window !== "undefined") window.localStorage.removeItem(LAST_SAVED_KEY);
  dispatchStatus();
}

export async function saveDurableDatabaseMirrorNow(): Promise<DurableStorageStatus> {
  const handle = await loadDirectoryHandle();
  if (!handle) return getDurableStorageStatus();
  if (await permissionFor(handle) !== "granted") return getDurableStorageStatus();

  const current = await readTextFile(handle, DURABLE_DATABASE_FILE);
  const currentSnapshot = current?.text ? parseDurableDatabaseSnapshot(current.text) : null;
  const snapshot = await buildDurableDatabaseSnapshot(currentSnapshot);
  const content = JSON.stringify(snapshot);
  if (current?.text && currentSnapshot) await writeTextFile(handle, DURABLE_DATABASE_PREVIOUS_FILE, current.text);
  await writeTextFile(handle, DURABLE_DATABASE_FILE, content);
  window.localStorage.setItem(LAST_SAVED_KEY, snapshot.savedAt);
  dispatchStatus();
  return getDurableStorageStatus();
}

export async function recoverDurableDatabaseIfNeeded(): Promise<boolean> {
  const handle = await loadDirectoryHandle();
  if (!handle || await permissionFor(handle) !== "granted") return false;
  const recovered = await recoverFromHandle(handle);
  if (recovered) dispatchStatus();
  return recovered;
}
