"use client";

export const WORKBENCH_SELECTION_EVENT = "client-compass-workbench-selection";

export function dispatchWorkbenchSelection(clientIds: string[]): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WORKBENCH_SELECTION_EVENT, { detail: { clientIds } }));
}
