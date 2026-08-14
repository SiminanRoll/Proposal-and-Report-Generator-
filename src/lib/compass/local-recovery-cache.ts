"use client";

import { getProjectsSnapshot, restoreProjectsSnapshot } from "@/lib/projects/store";
import type { Project } from "@/lib/projects/types";
import { loadSegments, saveSegments } from "@/lib/segments/store";
import type { SegmentDefinition } from "@/lib/segments/types";
import { loadCompassConfig, loadCompassDataset, saveCompassConfigAndDataset } from "./store";
import type { CompassConfig, CompassDataset } from "./types";

const DATABASE_NAME = "client-compass-local-recovery";
const DATABASE_VERSION = 1;
const STORE_NAME = "snapshots";
const SNAPSHOT_KEY = "latest";
const FORMAT = "client-compass-local-recovery";

interface LocalRecoverySnapshot {
  format: typeof FORMAT;
  schemaVersion: 1;
  savedAt: string;
  dataset: CompassDataset;
  config: CompassConfig;
  segments: SegmentDefinition[];
  projects: Project[];
}

let databasePromise: Promise<IDBDatabase> | null = null;

function hasMeaningfulDataset(dataset: CompassDataset | null): dataset is CompassDataset {
  return Boolean(dataset && (dataset.clients.length > 0 || dataset.devices.length > 0));
}

function validSnapshot(value: unknown): value is LocalRecoverySnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<LocalRecoverySnapshot>;
  return snapshot.format === FORMAT
    && snapshot.schemaVersion === 1
    && Boolean(snapshot.dataset && snapshot.dataset.schemaVersion === 1 && Array.isArray(snapshot.dataset.clients) && Array.isArray(snapshot.dataset.devices))
    && Boolean(snapshot.config)
    && Array.isArray(snapshot.segments)
    && Array.isArray(snapshot.projects);
}

async function requestPersistentStorage(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.storage || typeof navigator.storage.persist !== "function") return;
  try {
    const alreadyPersistent = typeof navigator.storage.persisted === "function" ? await navigator.storage.persisted() : false;
    if (!alreadyPersistent) await navigator.storage.persist();
  } catch {
    // This cache remains useful even when the browser declines persistent-storage status.
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.reject(new Error("Browser recovery storage is unavailable."));
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error("Browser recovery storage could not be opened."));
    };
  });
  return databasePromise;
}

async function readSnapshot(): Promise<LocalRecoverySnapshot | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(SNAPSHOT_KEY);
    request.onsuccess = () => resolve(validSnapshot(request.result) ? request.result : null);
    request.onerror = () => reject(request.error ?? transaction.error ?? new Error("The local recovery cache could not be read."));
  });
}

async function writeSnapshot(snapshot: LocalRecoverySnapshot): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(snapshot, SNAPSHOT_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("The local recovery cache could not be saved."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The local recovery cache save was interrupted."));
  });
}

export async function saveLocalRecoverySnapshotNow(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const dataset = await loadCompassDataset();
  if (!hasMeaningfulDataset(dataset)) return false;
  void requestPersistentStorage();
  await writeSnapshot({
    format: FORMAT,
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    dataset,
    config: loadCompassConfig(),
    segments: loadSegments(),
    projects: getProjectsSnapshot(),
  });
  return true;
}

export async function recoverLocalRecoverySnapshotIfNeeded(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (hasMeaningfulDataset(await loadCompassDataset())) return false;
  const snapshot = await readSnapshot().catch(() => null);
  if (!snapshot || !hasMeaningfulDataset(snapshot.dataset)) return false;
  void requestPersistentStorage();
  saveSegments(snapshot.segments);
  restoreProjectsSnapshot(snapshot.projects);
  await saveCompassConfigAndDataset(snapshot.config, snapshot.dataset);
  window.dispatchEvent(new Event("client-compass-data-changed"));
  return true;
}
