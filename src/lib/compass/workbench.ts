"use client";

import type { CompassClient } from "./types";

export const WORKBENCH_STORAGE_KEY = "client-compass.workbench.v1";
export const WORKBENCH_CHANGED_EVENT = "client-compass-workbench-changed";

export interface WorkbenchState {
  clientIds: string[];
  updatedAt: string;
}

export type WorkbenchStage = "Needs Action" | "In Progress" | "Scheduled" | "Completed";

function cleanIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function dateTime(value: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function newestActivityTime(client: CompassClient): number {
  return Math.max(0, ...(client.captainsLog?.recentActivity ?? []).map((item) => dateTime(item.completedAt || item.scheduledAt || item.createdAt)));
}

export function loadWorkbenchState(): WorkbenchState {
  if (typeof window === "undefined") return { clientIds: [], updatedAt: "" };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WORKBENCH_STORAGE_KEY) || "null") as Partial<WorkbenchState> | null;
    return { clientIds: cleanIds(parsed?.clientIds), updatedAt: String(parsed?.updatedAt ?? "") };
  } catch {
    return { clientIds: [], updatedAt: "" };
  }
}

export function saveWorkbenchState(state: WorkbenchState): WorkbenchState {
  const next = { clientIds: cleanIds(state.clientIds), updatedAt: state.updatedAt || new Date().toISOString() };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(WORKBENCH_CHANGED_EVENT));
  }
  return next;
}

export function addClientsToWorkbench(clientIds: string[]): WorkbenchState {
  const current = loadWorkbenchState();
  return saveWorkbenchState({ clientIds: [...current.clientIds, ...clientIds], updatedAt: new Date().toISOString() });
}

export function removeClientFromWorkbench(clientId: string): WorkbenchState {
  const current = loadWorkbenchState();
  return saveWorkbenchState({ clientIds: current.clientIds.filter((id) => id !== clientId), updatedAt: new Date().toISOString() });
}

export function workbenchStage(client: CompassClient): WorkbenchStage {
  const openTasks = client.captainsLog?.openTasks?.length ?? 0;
  if (openTasks > 0) return "Scheduled";

  const latestActivity = newestActivityTime(client);
  const reviewTime = dateTime(client.lastAccountReview || client.reviewOutcome?.reviewedAt || "");
  if (latestActivity > reviewTime) return "In Progress";
  if (reviewTime > 0) return "Completed";
  if (latestActivity > 0) return "In Progress";
  return "Needs Action";
}
