"use client";

const DATABASE_NAME = "advantage.proposal-report-generator.local-files";
const DATABASE_VERSION = 1;
const STORE_NAME = "source-files";

interface StoredSourceFile {
  id: string;
  name: string;
  type: string;
  lastModified: number;
  storedAt: string;
  blob: Blob;
}

export interface LocalSourceFileBackup {
  id: string;
  name: string;
  type: string;
  lastModified: number;
  dataBase64: string;
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("Local browser file storage is unavailable."));
  }
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local browser file storage could not be opened."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Local file operation failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Local file operation was cancelled."));
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunk, bytes.length)));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function saveLocalSourceFile(fileId: string, file: File): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const record: StoredSourceFile = {
      id: fileId,
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      storedAt: new Date().toISOString(),
      blob: file,
    };
    transaction.objectStore(STORE_NAME).put(record);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function getLocalSourceFile(fileId: string): Promise<File | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(fileId);
    const record = await new Promise<StoredSourceFile | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as StoredSourceFile | undefined);
      request.onerror = () => reject(request.error ?? new Error("Local source file could not be read."));
    });
    await transactionDone(transaction);
    return record ? new File([record.blob], record.name, { type: record.type, lastModified: record.lastModified }) : null;
  } finally {
    database.close();
  }
}

export async function exportLocalSourceFiles(fileIds: string[]): Promise<LocalSourceFileBackup[]> {
  const backups: LocalSourceFileBackup[] = [];
  for (const fileId of [...new Set(fileIds.filter(Boolean))]) {
    const file = await getLocalSourceFile(fileId);
    if (!file) continue;
    backups.push({
      id: fileId,
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      dataBase64: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
    });
  }
  return backups;
}

export async function restoreLocalSourceFiles(backups: LocalSourceFileBackup[]): Promise<number> {
  let restored = 0;
  for (const backup of backups) {
    if (!backup?.id || !backup?.dataBase64) continue;
    const file = new File([base64ToBytes(backup.dataBase64)], backup.name || "restored-file", {
      type: backup.type || "application/octet-stream",
      lastModified: Number(backup.lastModified) || Date.now(),
    });
    await saveLocalSourceFile(backup.id, file);
    restored += 1;
  }
  return restored;
}

export async function deleteLocalSourceFiles(fileIds: string[]): Promise<void> {
  if (!fileIds.length) return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    for (const fileId of fileIds) store.delete(fileId);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}
