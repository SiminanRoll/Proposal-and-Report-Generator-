"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_COMPASS_CONFIG, normalizeCompassConfig } from "./config";
import { normalizeTcSalesActivityForStorage } from "./tc-sales-activity";
import type { CompassConfig, CompassDataset } from "./types";
import { normalizeReviewOutcome } from "@/lib/review-outcomes/model";

const LEGACY_DATASET_KEY = "client-compass.current-dataset.v1";
const CONFIG_KEY = "client-compass.configuration.v1";
const CHANGE_EVENT = "client-compass-data-changed";
const DATABASE_NAME = "client-compass";
const DATABASE_VERSION = 1;
const DATASET_STORE = "current-state";
const DATASET_RECORD_KEY = "current-dataset";
const DATASET_RECOVERY_RECORD_KEY = "recovery-dataset";

let databasePromise: Promise<IDBDatabase> | null = null;
let persistencePromise: Promise<void> | null = null;

function isCompassDataset(value: unknown): value is CompassDataset {
  const dataset = value as CompassDataset | null;
  return Boolean(dataset?.schemaVersion === 1 && Array.isArray(dataset.clients) && Array.isArray(dataset.devices));
}

function hasMeaningfulDataset(dataset: CompassDataset | null): dataset is CompassDataset {
  return Boolean(dataset && (dataset.clients.length > 0 || dataset.devices.length > 0));
}

function normalizeCompassDataset(dataset: CompassDataset): CompassDataset {
  return {
    ...dataset,
    clients: dataset.clients.map((client) => ({
      ...client,
      city: String((client as CompassDataset["clients"][number] & { city?: string }).city ?? ""),
      state: String((client as CompassDataset["clients"][number] & { state?: string }).state ?? ""),
      market: String((client as CompassDataset["clients"][number] & { market?: string }).market ?? ""),
      industry: String((client as CompassDataset["clients"][number] & { industry?: string }).industry ?? ""),
      tags: Array.isArray((client as CompassDataset["clients"][number] & { tags?: unknown }).tags) ? ((client as CompassDataset["clients"][number] & { tags?: string[] }).tags ?? []).map(String).filter(Boolean) : [],
      primaryContactRole: String((client as CompassDataset["clients"][number] & { primaryContactRole?: string }).primaryContactRole ?? ""),
      primaryContactEmail: String((client as CompassDataset["clients"][number] & { primaryContactEmail?: string }).primaryContactEmail ?? ""),
      primaryContactPhone: String((client as CompassDataset["clients"][number] & { primaryContactPhone?: string }).primaryContactPhone ?? ""),
      ...normalizeTcSalesActivityForStorage(client),
      lastQuoteDate: String((client as CompassDataset["clients"][number] & { lastQuoteDate?: string }).lastQuoteDate ?? ""),
      quoted: Boolean((client as CompassDataset["clients"][number] & { quoted?: boolean }).quoted),
      workflowStatus: client.workflowStatus === "Project Mapping Needed" ? "Quote Needed" : client.workflowStatus,
      recordReviewNeeded: Boolean((client as CompassDataset["clients"][number] & { recordReviewNeeded?: boolean }).recordReviewNeeded),
      recordReviewReason: String((client as CompassDataset["clients"][number] & { recordReviewReason?: string }).recordReviewReason ?? ""),
      reviewOutcome: normalizeReviewOutcome((client as CompassDataset["clients"][number] & { reviewOutcome?: unknown }).reviewOutcome),
      captainsLog: (() => {
        const raw = (client as CompassDataset["clients"][number] & { captainsLog?: unknown }).captainsLog;
        if (!raw || typeof raw !== "object") return undefined;
        const value = raw as unknown as Record<string, unknown>;
        const normalizeTask = (item: unknown) => {
          const task = item && typeof item === "object" ? item as Record<string, unknown> : {};
          return {
            id: String(task.id ?? ""), type: String(task.type ?? "Task"), tag: String(task.tag ?? ""), title: String(task.title ?? "Task"),
            status: String(task.status ?? "open"), scheduledAt: String(task.scheduledAt ?? task.scheduled_at ?? ""), createdAt: String(task.createdAt ?? task.created_at ?? ""), source: String(task.source ?? ""),
          };
        };
        const normalizeActivity = (item: unknown) => {
          const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
          return {
            id: String(row.id ?? ""), type: String(row.type ?? "Activity"), tag: String(row.tag ?? ""), title: String(row.title ?? "Activity"), status: String(row.status ?? ""),
            scheduledAt: String(row.scheduledAt ?? row.scheduled_at ?? ""), completedAt: String(row.completedAt ?? row.completed_at ?? ""), createdAt: String(row.createdAt ?? row.created_at ?? ""), source: String(row.source ?? ""),
          };
        };
        return {
          matched: Boolean(value.matched), linkedCompany: String(value.linkedCompany ?? ""), closestCompany: String(value.closestCompany ?? ""), matchMethod: String(value.matchMethod ?? ""),
          matchScore: Number(value.matchScore ?? 0) || 0, syncedAt: String(value.syncedAt ?? ""), openTaskCount: Number(value.openTaskCount ?? 0) || 0,
          openTasks: Array.isArray(value.openTasks) ? value.openTasks.map(normalizeTask) : [],
          recentActivity: Array.isArray(value.recentActivity) ? value.recentActivity.map(normalizeActivity) : [],
        };
      })(),
    })),
  };
}

function parseDataset(raw: string | null): CompassDataset | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    return isCompassDataset(value) ? value : null;
  } catch {
    return null;
  }
}

function storageError(cause: unknown): Error {
  if (cause instanceof Error && !(cause instanceof DOMException)) return cause;
  const name = cause instanceof DOMException ? cause.name : "";
  if (name === "QuotaExceededError") {
    return new Error("The browser does not have enough available site storage for this snapshot. Free browser storage for this site and try again.");
  }
  if (name === "SecurityError" || name === "InvalidStateError") {
    return new Error("Browser storage is blocked for this page. Allow site storage or open Client Compass in a standard browser window, then try again.");
  }
  return new Error("Client Compass could not save the current snapshot in this browser. The import is still open, so no data has been lost.");
}

function requestPersistentBrowserStorage(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.storage || typeof navigator.storage.persist !== "function") return Promise.resolve();
  if (persistencePromise) return persistencePromise;
  persistencePromise = (async () => {
    try {
      const alreadyPersistent = typeof navigator.storage.persisted === "function" ? await navigator.storage.persisted() : false;
      if (!alreadyPersistent) await navigator.storage.persist();
    } catch {
      // Persistence is a best-effort browser protection; IndexedDB remains usable if denied.
    }
  })();
  return persistencePromise;
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB is unavailable."));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DATASET_STORE)) database.createObjectStore(DATASET_STORE);
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
      reject(request.error ?? new Error("Client Compass storage could not be opened."));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error("Client Compass storage is blocked by another open version of the app."));
    };
  });

  return databasePromise;
}

async function readIndexedDatasetRecord(key: string): Promise<CompassDataset | null> {
  const database = await openDatabase();
  return new Promise<CompassDataset | null>((resolve, reject) => {
    const transaction = database.transaction(DATASET_STORE, "readonly");
    const request = transaction.objectStore(DATASET_STORE).get(key);
    request.onsuccess = () => resolve(isCompassDataset(request.result) ? request.result : null);
    request.onerror = () => reject(request.error ?? transaction.error ?? new Error("The current snapshot could not be read."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The current snapshot read was interrupted."));
  });
}

async function seedRecoveryDataset(dataset: CompassDataset): Promise<void> {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(DATASET_STORE, "readwrite");
    transaction.objectStore(DATASET_STORE).put(dataset, DATASET_RECOVERY_RECORD_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("The recovery snapshot could not be saved."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The recovery snapshot save was interrupted."));
  });
}

async function restoreIndexedDataset(dataset: CompassDataset): Promise<void> {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(DATASET_STORE, "readwrite");
    const store = transaction.objectStore(DATASET_STORE);
    store.put(dataset, DATASET_RECORD_KEY);
    store.put(dataset, DATASET_RECOVERY_RECORD_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("The local recovery snapshot could not be restored."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The local recovery restore was interrupted."));
  });
}

async function writeIndexedDataset(dataset: CompassDataset): Promise<void> {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(DATASET_STORE, "readwrite");
    const store = transaction.objectStore(DATASET_STORE);
    const currentRequest = store.get(DATASET_RECORD_KEY);
    let protectedFailure: Error | null = null;

    currentRequest.onsuccess = () => {
      const current = isCompassDataset(currentRequest.result) ? currentRequest.result : null;
      if (hasMeaningfulDataset(current) && !hasMeaningfulDataset(dataset)) {
        protectedFailure = new Error("Client Compass blocked an empty snapshot from replacing your saved client data. Your existing local dataset was kept intact.");
        transaction.abort();
        return;
      }

      if (hasMeaningfulDataset(current)) store.put(current, DATASET_RECOVERY_RECORD_KEY);
      else if (hasMeaningfulDataset(dataset)) store.put(dataset, DATASET_RECOVERY_RECORD_KEY);
      store.put(dataset, DATASET_RECORD_KEY);
    };
    currentRequest.onerror = () => {
      protectedFailure = currentRequest.error ?? new Error("The existing snapshot could not be checked before saving.");
      transaction.abort();
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(protectedFailure ?? transaction.error ?? new Error("The current snapshot could not be saved."));
    transaction.onabort = () => reject(protectedFailure ?? transaction.error ?? new Error("The current snapshot save was interrupted."));
  });
}

export async function loadCompassDataset(): Promise<CompassDataset | null> {
  if (typeof window === "undefined") return null;
  void requestPersistentBrowserStorage();

  try {
    const [indexedDataset, recoveryDataset] = await Promise.all([
      readIndexedDatasetRecord(DATASET_RECORD_KEY),
      readIndexedDatasetRecord(DATASET_RECOVERY_RECORD_KEY),
    ]);

    if (hasMeaningfulDataset(indexedDataset)) {
      if (!hasMeaningfulDataset(recoveryDataset)) {
        try { await seedRecoveryDataset(indexedDataset); } catch { /* Primary snapshot is still valid. */ }
      }
      return normalizeCompassDataset(indexedDataset);
    }

    if (hasMeaningfulDataset(recoveryDataset)) {
      try { await restoreIndexedDataset(recoveryDataset); } catch { /* Recovery can still be used for this session. */ }
      return normalizeCompassDataset(recoveryDataset);
    }

    if (indexedDataset) return normalizeCompassDataset(indexedDataset);
  } catch {
    // A legacy localStorage snapshot can still be used if IndexedDB is temporarily unavailable.
  }

  const legacyDataset = parseDataset(window.localStorage.getItem(LEGACY_DATASET_KEY));
  if (!legacyDataset) return null;

  try {
    await writeIndexedDataset(legacyDataset);
    window.localStorage.removeItem(LEGACY_DATASET_KEY);
  } catch {
    // Keep the readable legacy copy in place if migration cannot complete.
  }
  return normalizeCompassDataset(legacyDataset);
}

export async function saveCompassDataset(dataset: CompassDataset): Promise<void> {
  if (typeof window === "undefined") return;
  void requestPersistentBrowserStorage();
  try {
    await writeIndexedDataset(dataset);
    window.localStorage.removeItem(LEGACY_DATASET_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch (cause) {
    throw storageError(cause);
  }
}

export function loadCompassConfig(): CompassConfig {
  if (typeof window === "undefined") return structuredClone(DEFAULT_COMPASS_CONFIG);
  try {
    return normalizeCompassConfig(JSON.parse(window.localStorage.getItem(CONFIG_KEY) || "null"));
  } catch {
    return structuredClone(DEFAULT_COMPASS_CONFIG);
  }
}

export function saveCompassConfig(config: CompassConfig): void {
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(normalizeCompassConfig(config)));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export async function saveCompassConfigAndDataset(config: CompassConfig, dataset: CompassDataset | null): Promise<void> {
  if (typeof window === "undefined") return;
  void requestPersistentBrowserStorage();
  const normalized = normalizeCompassConfig(config);
  try {
    if (dataset) {
      await writeIndexedDataset(dataset);
      window.localStorage.removeItem(LEGACY_DATASET_KEY);
    }
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch (cause) {
    throw storageError(cause);
  }
}

export function useCompassState(): {
  dataset: CompassDataset | null;
  config: CompassConfig;
  ready: boolean;
  refresh: () => Promise<void>;
} {
  const [dataset, setDataset] = useState<CompassDataset | null>(null);
  const [config, setConfig] = useState<CompassConfig>(structuredClone(DEFAULT_COMPASS_CONFIG));
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const [nextDataset, nextConfig] = await Promise.all([
      loadCompassDataset(),
      Promise.resolve(loadCompassConfig()),
    ]);
    setDataset(nextDataset);
    setConfig(nextConfig);
    setReady(true);
  }, []);

  useEffect(() => {
    const handleChange = () => { void refresh(); };
    void refresh();
    window.addEventListener(CHANGE_EVENT, handleChange);
    window.addEventListener("storage", handleChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, [refresh]);

  return { dataset, config, ready, refresh };
}
