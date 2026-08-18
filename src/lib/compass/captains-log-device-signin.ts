"use client";

import type { CaptainsLogCloudConfig } from "./captains-log-cloud";

const PREF_KEY = "client_compass_captains_log_remember_device_v1";
const DATABASE_NAME = "client-compass-cloud-device-signin";
const DATABASE_VERSION = 1;
const STORE_NAME = "credential";
const KEY_RECORD = "device-key";
const CREDENTIAL_RECORD = "saved-password";

type SavedCredential = {
  version: 1;
  url: string;
  email: string;
  iv: number[];
  ciphertext: number[];
  savedAt: string;
};

let databasePromise: Promise<IDBDatabase> | null = null;

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.indexedDB) && Boolean(window.crypto?.subtle);
}

function normalizedIdentity(config: Pick<CaptainsLogCloudConfig, "url" | "email">): { url: string; email: string } {
  return {
    url: String(config.url || "").trim().replace(/\/+$/, "").toLowerCase(),
    email: String(config.email || "").trim().toLowerCase(),
  };
}

function openDatabase(): Promise<IDBDatabase> {
  if (!canUseBrowserStorage()) return Promise.reject(new Error("Secure device sign-in storage is unavailable in this browser."));
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
      reject(request.error ?? new Error("Secure device sign-in storage could not be opened."));
    };
  });
  return databasePromise;
}

async function readRecord<T>(key: string): Promise<T | null> {
  const database = await openDatabase();
  return new Promise<T | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error ?? transaction.error ?? new Error("Secure device sign-in storage could not be read."));
  });
}

async function writeRecord(key: string, value: unknown): Promise<void> {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Secure device sign-in storage could not be saved."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Secure device sign-in save was interrupted."));
  });
}

async function deleteRecord(key: string): Promise<void> {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Secure device sign-in storage could not be cleared."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Secure device sign-in clear was interrupted."));
  });
}

async function deviceKey(): Promise<CryptoKey> {
  const current = await readRecord<CryptoKey>(KEY_RECORD).catch(() => null);
  if (current) return current;
  const key = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await writeRecord(KEY_RECORD, key);
  return key;
}

export function getCaptainsLogRememberDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PREF_KEY) === "1";
}

export async function setCaptainsLogRememberDevice(enabled: boolean): Promise<void> {
  if (typeof window === "undefined") return;
  if (enabled) window.localStorage.setItem(PREF_KEY, "1");
  else {
    window.localStorage.removeItem(PREF_KEY);
    await clearCaptainsLogRememberedPassword();
  }
}

export async function saveCaptainsLogRememberedPassword(config: CaptainsLogCloudConfig, password: string): Promise<void> {
  if (!getCaptainsLogRememberDevice()) return;
  if (!password) throw new Error("Enter the Supabase password before saving auto-connect on this device.");
  if (!canUseBrowserStorage()) throw new Error("This browser cannot securely store an auto-connect credential.");
  const key = await deviceKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(password);
  const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const identity = normalizedIdentity(config);
  const record: SavedCredential = {
    version: 1,
    ...identity,
    iv: Array.from(iv),
    ciphertext: Array.from(new Uint8Array(encrypted)),
    savedAt: new Date().toISOString(),
  };
  await writeRecord(CREDENTIAL_RECORD, record);
}

export async function loadCaptainsLogRememberedPassword(config: CaptainsLogCloudConfig): Promise<string> {
  if (!getCaptainsLogRememberDevice() || !canUseBrowserStorage()) return "";
  const record = await readRecord<SavedCredential>(CREDENTIAL_RECORD).catch(() => null);
  if (!record || record.version !== 1 || !Array.isArray(record.iv) || !Array.isArray(record.ciphertext)) return "";
  const identity = normalizedIdentity(config);
  if (record.url !== identity.url || record.email !== identity.email) return "";
  try {
    const key = await deviceKey();
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(record.iv) },
      key,
      new Uint8Array(record.ciphertext),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return "";
  }
}

export async function hasCaptainsLogRememberedPassword(config: CaptainsLogCloudConfig): Promise<boolean> {
  return Boolean(await loadCaptainsLogRememberedPassword(config));
}

export async function clearCaptainsLogRememberedPassword(): Promise<void> {
  if (!canUseBrowserStorage()) return;
  await deleteRecord(CREDENTIAL_RECORD).catch(() => undefined);
}
