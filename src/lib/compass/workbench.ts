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

function dateOnly(value: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function newestActivityDate(client: CompassClient): string {
  return (client.captainsLog?.recentActivity ?? [])
    .map((item) => dateOnly(item.completedAt || item.scheduledAt || item.createdAt))
    .filter(Boolean)
    .sort()
    .at(-1) ?? "";
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

  const latestActivity = newestActivityDate(client);
  const reviewDate = dateOnly(client.lastAccountReview || client.reviewOutcome?.reviewedAt || "");
  if (latestActivity && (!reviewDate || latestActivity > reviewDate)) return "In Progress";
  if (reviewDate) return "Completed";
  if (latestActivity) return "In Progress";
  return "Needs Action";
}
