"use client";

import { addClientsToWorkbench } from "@/lib/compass/workbench";

/**
 * Workbench selection is local-only during the GHL preview phase.
 * The prior cloud membership writer was backed by Supabase and must not
 * be called by this control. GHL task creation is a separate, gated action.
 */
export function WorkbenchBulkAction({ clientIds, onAdded }: { clientIds: string[]; onAdded?: () => void }) {
  if (!clientIds.length) return null;

  const add = () => {
    addClientsToWorkbench(clientIds);
    onAdded?.();
  };

  return <button className="workbench-bulk-action" type="button" onClick={add}>
    <span aria-hidden="true">▱</span>Add {clientIds.length} to Workbench
  </button>;
}
