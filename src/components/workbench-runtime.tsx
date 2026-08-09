"use client";

import { useEffect, useState } from "react";
import { addClientsToWorkbench } from "@/lib/compass/workbench";
import { WORKBENCH_SELECTION_EVENT } from "@/lib/compass/workbench-selection";

export function WorkbenchRuntime() {
  const [added, setAdded] = useState(0);
  useEffect(() => {
    const onSelection = (event: Event) => {
      const ids = (event as CustomEvent<{ clientIds?: string[] }>).detail?.clientIds ?? [];
      if (!ids.length) return;
      addClientsToWorkbench(ids);
      setAdded(ids.length);
      window.setTimeout(() => setAdded(0), 1800);
    };
    window.addEventListener(WORKBENCH_SELECTION_EVENT, onSelection);
    return () => window.removeEventListener(WORKBENCH_SELECTION_EVENT, onSelection);
  }, []);
  return added ? <div className="workbench-toast" role="status">Added {added} client{added === 1 ? "" : "s"} to Workbench</div> : null;
}
