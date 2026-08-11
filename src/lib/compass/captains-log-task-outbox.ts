"use client";

import type { CaptainsLogTaskWriteRequest } from "./captains-log-task-write";

export interface CaptainsLogPendingTask {
  id: string;
  request: CaptainsLogTaskWriteRequest;
  queuedAt: string;
  lastAttemptAt: string;
  attempts: number;
}

const STORAGE_KEY = "client_compass.captains_log_task_outbox.v1";
export const CAPTAINS_LOG_TASK_OUTBOX_EVENT = "client-compass-captains-log-task-outbox";

function canStore(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function notify(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CAPTAINS_LOG_TASK_OUTBOX_EVENT));
}

export function readCaptainsLogTaskOutbox(): CaptainsLogPendingTask[] {
  if (!canStore()) return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is CaptainsLogPendingTask => Boolean(
      item && typeof item === "object" &&
      typeof (item as CaptainsLogPendingTask).id === "string" &&
      (item as CaptainsLogPendingTask).request?.clientId &&
      (item as CaptainsLogPendingTask).request?.company &&
      (item as CaptainsLogPendingTask).request?.dueDate,
    ));
  } catch {
    return [];
  }
}

function write(items: CaptainsLogPendingTask[]): CaptainsLogPendingTask[] {
  if (canStore()) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  notify();
  return items;
}

export function queueCaptainsLogTask(request: CaptainsLogTaskWriteRequest): CaptainsLogPendingTask {
  const requestId = String(request.requestId || "").trim();
  if (!requestId) throw new Error("Captain's Log task queue requires a stable request ID.");
  const existing = readCaptainsLogTaskOutbox();
  const id = `client_compass_task:${requestId}`;
  const found = existing.find((item) => item.id === id);
  if (found) return found;
  const pending: CaptainsLogPendingTask = {
    id,
    request: { ...request, requestId },
    queuedAt: new Date().toISOString(),
    lastAttemptAt: "",
    attempts: 0,
  };
  write([...existing, pending]);
  return pending;
}

export function markCaptainsLogTaskAttempt(id: string): void {
  const now = new Date().toISOString();
  write(readCaptainsLogTaskOutbox().map((item) => item.id === id
    ? { ...item, attempts: item.attempts + 1, lastAttemptAt: now }
    : item));
}

export function removeCaptainsLogTask(id: string): void {
  write(readCaptainsLogTaskOutbox().filter((item) => item.id !== id));
}
