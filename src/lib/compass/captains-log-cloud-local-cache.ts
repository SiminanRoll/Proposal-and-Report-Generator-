"use client";

const DATABASE_NAME = "client-compass-cloud-connection-cache";
const DATABASE_VERSION = 1;
const STORE_NAME = "connection";
const RECORD_KEY = "latest";

const CONFIG_KEY = "client_compass_captains_log_cloud_config";
const SESSION_KEY = "client_compass_captains_log_cloud_session";

type CachedCloudConnection = {
  savedAt: string;
  config: string;
  session: string;
};

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.reject(new Error("Cloud connection cache is unavailable."));
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
      reject(request.error ?? new Error("Cloud connection cache could not be opened."));
    };
  });
  return databasePromise;
}

function validRecord(value: unknown): value is CachedCloudConnection {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<CachedCloudConnection>;
  return typeof record.config === "string" && typeof record.session === "string";
}

async function readRecord(): Promise<CachedCloudConnection | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(RECORD_KEY);
    request.onsuccess = () => resolve(validRecord(request.result) ? request.result : null);
    request.onerror = () => reject(request.error ?? transaction.error ?? new Error("Cloud connection cache could not be read."));
  });
}

async function writeRecord(record: CachedCloudConnection): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(record, RECORD_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Cloud connection cache could not be saved."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Cloud connection cache save was interrupted."));
  });
}

export async function saveCaptainsLogCloudLocalCacheNow(): Promise<void> {
  if (typeof window === "undefined") return;
  await writeRecord({
    savedAt: new Date().toISOString(),
    config: window.localStorage.getItem(CONFIG_KEY) || "",
    session: window.localStorage.getItem(SESSION_KEY) || "",
  });
}

export async function restoreCaptainsLogCloudLocalCache(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const record = await readRecord().catch(() => null);
  if (!record) return false;
  let restored = false;
  if (!window.localStorage.getItem(CONFIG_KEY) && record.config) {
    window.localStorage.setItem(CONFIG_KEY, record.config);
    restored = true;
  }
  if (!window.localStorage.getItem(SESSION_KEY) && record.session) {
    window.localStorage.setItem(SESSION_KEY, record.session);
    restored = true;
  }
  return restored;
}

export async function clearCaptainsLogCloudCachedSession(): Promise<void> {
  if (typeof window === "undefined") return;
  const current = await readRecord().catch(() => null);
  await writeRecord({
    savedAt: new Date().toISOString(),
    config: window.localStorage.getItem(CONFIG_KEY) || current?.config || "",
    session: "",
  });
}
