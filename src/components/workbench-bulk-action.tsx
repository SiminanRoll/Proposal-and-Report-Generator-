"use client";

import { addClientsToWorkbench } from "@/lib/compass/workbench";

export function WorkbenchBulkAction({ clientIds, onAdded }: { clientIds: string[]; onAdded?: () => void }) {
  if (!clientIds.length) return null;
  return <button className="workbench-bulk-action" type="button" onClick={() => { addClientsToWorkbench(clientIds); onAdded?.(); }}><span aria-hidden="true">▱</span>Add {clientIds.length} to Workbench</button>;
}
