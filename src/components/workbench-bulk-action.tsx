"use client";

import { useCompassState } from "@/lib/compass/store";
import { saveCloudWorkbenchMemberships } from "@/lib/compass/workbench-cloud";
import { addClientsToWorkbench } from "@/lib/compass/workbench";

export function WorkbenchBulkAction({ clientIds, onAdded }: { clientIds: string[]; onAdded?: () => void }) {
  const { dataset } = useCompassState();
  if (!clientIds.length) return null;

  const add = () => {
    addClientsToWorkbench(clientIds);
    const selected = new Set(clientIds);
    const companyIds = (dataset?.clients ?? []).filter((client) => selected.has(client.id) && client.companyId).map((client) => client.companyId as string);
    if (companyIds.length) {
      void saveCloudWorkbenchMemberships(companyIds, true).catch((cause) => {
        if (typeof console !== "undefined") console.debug("Workbench cloud membership publish deferred", cause);
      });
    }
    onAdded?.();
  };

  return <button className="workbench-bulk-action" type="button" onClick={add}><span aria-hidden="true">▱</span>Add {clientIds.length} to Workbench</button>;
}
