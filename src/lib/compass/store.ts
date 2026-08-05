"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_COMPASS_CONFIG, normalizeCompassConfig } from "./config";
import type { CompassConfig, CompassDataset } from "./types";

const LEGACY_DATASET_KEY = "client-compass.current-dataset.v1";
const CONFIG_KEY = "client-compass.configuration.v1";
const CHANGE_EVENT = "client-compass-data-changed";
const DATABASE_NAME = "client-compass";
const DATABASE_VERSION = 1;
const DATASET_STORE = "current-state";
const DATASET_RECORD_KEY = "current-dataset";

let databasePromise: Promise<IDBDatabase> | null = null;

function isCompassDataset(value: unknown): value is CompassDataset {
  const dataset = value as CompassDataset | null;
  return Boolean(dataset?.schemaVersion === 1 && Array.isArray(dataset.clients) && Array.isArray(dataset.devices));
}


function normalizeCompassDataset(dataset: CompassDataset): CompassDataset {
  return {
    ...dataset,
    clients: dataset.clients.map((client) => ({
      ...client,
      primaryContactRole: String((client as CompassDataset["clients"][number] & { primaryContactRole?: string }).primaryContactRole ?? ""),
      primaryContactEmail: String((client as CompassDataset["clients"][number] & { primaryContactEmail?: string }).primaryContactEmail ?? ""),
      primaryContactPhone: String((client as CompassDataset["clients"][number] & { primaryContactPhone?: string }).primaryContactPhone ?? ""),
      quoted: Boolean((client as CompassDataset["clients"][number] & { quoted?: boolean }).quoted),
      workflowStatus: client.workflowStatus === "Project Mapping Needed" ? "Quote Needed" : client.workflowStatus,
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
  const name = cause instanceof DOMException ? cause.name : "";
  if (name === "QuotaExceededError") {
    return new Error("The browser does not have enough available site storage for this snapshot. Free browser storage for this site and try again.");
  }
  if (name === "SecurityError" || name === "InvalidStateError") {
    return new Error("Browser storage is blocked for this page. Allow site storage or open Client Compass in a standard browser window, then try again.");
  }
  return new Error("Client Compass could not save the current snapshot in this browser. The import is still open, so no data has been lost.");
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

async function readIndexedDataset(): Promise<CompassDataset | null> {
  const database = await openDatabase();
  return new Promise<CompassDataset | null>((resolve, reject) => {
    const transaction = database.transaction(DATASET_STORE, "readonly");
    const request = transaction.objectStore(DATASET_STORE).get(DATASET_RECORD_KEY);
    request.onsuccess = () => resolve(isCompassDataset(request.result) ? request.result : null);
    request.onerror = () => reject(request.error ?? transaction.error ?? new Error("The current snapshot could not be read."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The current snapshot read was interrupted."));
  });
}

async function writeIndexedDataset(dataset: CompassDataset): Promise<void> {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(DATASET_STORE, "readwrite");
    transaction.objectStore(DATASET_STORE).put(dataset, DATASET_RECORD_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("The current snapshot could not be saved."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The current snapshot save was interrupted."));
  });
}

export async function loadCompassDataset(): Promise<CompassDataset | null> {
  if (typeof window === "undefined") return null;

  try {
    const indexedDataset = await readIndexedDataset();
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
  refresh: () => Promise<void>;
} {
  const [dataset, setDataset] = useState<CompassDataset | null>(null);
  const [config, setConfig] = useState<CompassConfig>(structuredClone(DEFAULT_COMPASS_CONFIG));

  const refresh = useCallback(async () => {
    const [nextDataset, nextConfig] = await Promise.all([
      loadCompassDataset(),
      Promise.resolve(loadCompassConfig()),
    ]);
    setDataset(nextDataset);
    setConfig(nextConfig);
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

  return { dataset, config, refresh };
}
