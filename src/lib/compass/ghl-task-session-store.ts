"use client";

import { useSyncExternalStore } from "react";
import type { GhlTaskReadbackSnapshot } from "./ghl-task-awareness.mjs";

const MAX_AGE_MS = 5 * 60 * 1000;
const snapshots = new Map<string, GhlTaskReadbackSnapshot>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version++;
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const getVersion = () => version;
const getServerVersion = () => 0;

/** Subscription used by Workbench to refresh its task counts after a GHL read. */
export function useGhlTaskStoreVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getServerVersion);
}

/**
 * A client-side memory cache of independently verified GHL task readbacks.
 * No browser storage, persisted credentials, Captain's Log or Supabase.
 * A refresh or stale entry is UNKNOWN, never an empty GHL task list.
 */
export function getVerifiedGhlTaskSnapshot(clientId: string, now = Date.now()): GhlTaskReadbackSnapshot | null {
  const snapshot = snapshots.get(clientId);
  if (snapshot?.status !== "verified_read" || snapshot.clientId !== clientId) return null;
  const checkedAt = Date.parse(snapshot.checkedAt);
  if (!Number.isFinite(checkedAt) || checkedAt > now + 15_000 ||
      now - checkedAt > MAX_AGE_MS) return null;
  return snapshot;
}

export function publishGhlTaskSnapshot(clientId: string, snapshot: GhlTaskReadbackSnapshot | null): void {
  if (snapshot?.clientId !== clientId || snapshot.status !== "verified_read" ||
      !getFreshReadback(snapshot)) {
    if (snapshots.delete(clientId)) emit();
    return;
  }
  snapshots.set(clientId, snapshot);
  emit();
  // Invalidate the exact snapshot after five minutes. A newer successful
  // read is not erased by the older timer. No task data is persisted.
  if (typeof window !== "undefined") {
    window.setTimeout(() => {
      if (snapshots.get(clientId) === snapshot) {
        snapshots.delete(clientId);
        emit();
      }
    }, MAX_AGE_MS + 1000);
  }
}

function getFreshReadback(snapshot: GhlTaskReadbackSnapshot): boolean {
  const checkedAt = Date.parse(snapshot.checkedAt);
  const now = Date.now();
  return Number.isFinite(checkedAt) && checkedAt <= now + 15_000 &&
    now - checkedAt <= MAX_AGE_MS && Array.isArray(snapshot.tasks);
}

export function clearGhlTaskSnapshots(): void {
  if (!snapshots.size) return;
  snapshots.clear();
  emit();
}
