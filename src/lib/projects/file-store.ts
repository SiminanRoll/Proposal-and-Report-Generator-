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
