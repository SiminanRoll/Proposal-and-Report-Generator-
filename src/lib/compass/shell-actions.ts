export const COMPASS_SHELL_ACTION_EVENT = "client-compass:shell-action";
export const COMPASS_SEGMENT_ROUTE_EVENT = "client-compass:segment-route";

export const COMPASS_SHELL_ACTION_HASHES = {
  "find-client": "find-client",
  "update-data": "update-data",
  "import-review-history": "import-review-history",
  "refresh-calculations": "refresh-calculations",
  "estimate-assumptions": "estimate-assumptions",
  "project-thresholds": "project-thresholds",
  "technical-card-config": "technical-card-config",
  "dashboard-preferences": "dashboard-preferences",
} as const;

export type CompassShellAction = keyof typeof COMPASS_SHELL_ACTION_HASHES;

const ACTIONS_BY_HASH = new Map<string, CompassShellAction>(
  Object.entries(COMPASS_SHELL_ACTION_HASHES).map(([action, hash]) => [hash, action as CompassShellAction]),
);

export function compassShellActionHref(action: CompassShellAction): string {
  return `/#${COMPASS_SHELL_ACTION_HASHES[action]}`;
}

export function compassShellActionFromHash(hash: string): CompassShellAction | null {
  return ACTIONS_BY_HASH.get(hash.replace(/^#/, "")) ?? null;
}

export function dispatchCompassShellAction(action: CompassShellAction): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CompassShellAction>(COMPASS_SHELL_ACTION_EVENT, { detail: action }));
}
