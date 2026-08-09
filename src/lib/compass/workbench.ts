"use client";

export const WORKBENCH_STORAGE_KEY = "client-compass.workbench.v1";
export const WORKBENCH_CHANGED_EVENT = "client-compass-workbench-changed";

export interface WorkbenchState {
  clientIds: string[];
  updatedAt: string;
}

function cleanIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
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

export function workbenchStage(client: { lastAccountReview?: string; reviewOutcome?: { reviewedAt?: string; status?: string }; captainsLog?: { openTasks?: unknown[]; recentActivity?: unknown[] } }): "Queued" | "In Progress" | "Scheduled" | "Completed" {
  if (client.lastAccountReview || client.reviewOutcome?.reviewedAt || client.reviewOutcome?.status === "confirmed") return "Completed";
  const openTasks = client.captainsLog?.openTasks?.length ?? 0;
  if (openTasks > 0) return "Scheduled";
  const activity = client.captainsLog?.recentActivity?.length ?? 0;
  if (activity > 0) return "In Progress";
  return "Queued";
}
