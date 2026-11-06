"use client";

import { useEffect, useState } from "react";
import { addClientsToWorkbench } from "@/lib/compass/workbench";
import { WORKBENCH_SELECTION_EVENT } from "@/lib/compass/workbench-selection";

/**
 * Local-only Workbench selection listener. The Territory Map now owns its
 * React checkboxes and selection toolbar, so no DOM-owned duplicate selectors
 * are inserted. No Captain's Log / Supabase cloud membership write remains.
 */
export function WorkbenchRuntime() {
  const [added, setAdded] = useState(0);

  useEffect(() => {
    let toastTimer: ReturnType<typeof setTimeout> | null = null;
    const onSelection = (event: Event) => {
      const ids = (event as CustomEvent<{ clientIds?: string[] }>).detail?.clientIds ?? [];
      if (!ids.length) return;
      addClientsToWorkbench(ids);
      setAdded(ids.length);
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => setAdded(0), 1800);
    };
    window.addEventListener(WORKBENCH_SELECTION_EVENT, onSelection);
    return () => {
      window.removeEventListener(WORKBENCH_SELECTION_EVENT, onSelection);
      if (toastTimer) clearTimeout(toastTimer);
    };
  }, []);

  return added ? <div className="workbench-toast" role="status">
    Added {added} client{added === 1 ? "" : "s"} to Workbench
  </div> : null;
}
