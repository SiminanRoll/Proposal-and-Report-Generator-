"use client";

import { useCallback, useEffect, useState } from "react";
import { useCompassState } from "@/lib/compass/store";
import { saveCloudWorkbenchMemberships } from "@/lib/compass/workbench-cloud";
import { addClientsToWorkbench } from "@/lib/compass/workbench";
import { WORKBENCH_SELECTION_EVENT } from "@/lib/compass/workbench-selection";

export function WorkbenchRuntime() {
  const { dataset } = useCompassState();
  const [added, setAdded] = useState(0);

  const addToWorkbench = useCallback((ids: string[]) => {
    if (!ids.length) return;
    addClientsToWorkbench(ids);
    const selected = new Set(ids);
    const companyIds = (dataset?.clients ?? []).filter((client) => selected.has(client.id) && client.companyId).map((client) => client.companyId as string);
    if (companyIds.length) {
      void saveCloudWorkbenchMemberships(companyIds, true).catch((cause) => {
        if (typeof console !== "undefined") console.debug("Workbench cloud membership publish deferred", cause);
      });
    }
  }, [dataset]);

  useEffect(() => {
    const onSelection = (event: Event) => {
      const ids = (event as CustomEvent<{ clientIds?: string[] }>).detail?.clientIds ?? [];
      if (!ids.length) return;
      addToWorkbench(ids);
      setAdded(ids.length);
      window.setTimeout(() => setAdded(0), 1800);
    };
    window.addEventListener(WORKBENCH_SELECTION_EVENT, onSelection);
    return () => window.removeEventListener(WORKBENCH_SELECTION_EVENT, onSelection);
  }, [addToWorkbench]);

  useEffect(() => {
    if (!dataset) return;

    const syncMapList = () => {
      const panel = document.querySelector<HTMLElement>(".territory-client-review");
      if (!panel) return;
      const rows = [...panel.querySelectorAll<HTMLElement>(".territory-client-review-row")];
      if (!rows.length) return;

      const updateToolbar = () => {
        const checked = panel.querySelectorAll<HTMLInputElement>(".workbench-map-select input:checked").length;
        const count = panel.querySelector<HTMLElement>(".workbench-map-selected-count");
        if (count) count.textContent = checked ? `${checked} selected` : "Select clients to start a Workbench campaign";
        const add = panel.querySelector<HTMLButtonElement>(".workbench-map-add");
        if (add) add.disabled = checked === 0;
      };

      for (const row of rows) {
        if (row.querySelector(".workbench-map-name-cell")) continue;
        const nameButton = row.querySelector<HTMLButtonElement>(".territory-client-review-name");
        const strong = nameButton?.querySelector("strong");
        if (!nameButton || !strong) continue;
        const clientName = strong.textContent?.trim() || "";
        const candidates = dataset.clients.filter((client) => client.name === clientName);
        const client = candidates[0];
        if (!client) continue;

        const wrapper = document.createElement("div");
        wrapper.className = "workbench-map-name-cell";
        const label = document.createElement("label");
        label.className = "workbench-select workbench-map-select";
        label.setAttribute("aria-label", `Select ${client.name}`);
        const input = document.createElement("input");
        input.type = "checkbox";
        input.dataset.clientId = client.id;
        input.addEventListener("change", updateToolbar);
        label.appendChild(input);
        nameButton.parentElement?.insertBefore(wrapper, nameButton);
        wrapper.append(label, nameButton);
      }

      const tools = panel.querySelector<HTMLElement>(".territory-client-review-tools");
      if (tools && !panel.querySelector(".workbench-map-selection-toolbar")) {
        const toolbar = document.createElement("div");
        toolbar.className = "workbench-selection-toolbar workbench-map-selection-toolbar";
        const selectAll = document.createElement("button");
        selectAll.type = "button";
        selectAll.className = "workbench-bulk-action";
        selectAll.textContent = "Select all shown";
        selectAll.addEventListener("click", () => {
          const inputs = [...panel.querySelectorAll<HTMLInputElement>(".workbench-map-select input")];
          const shouldSelect = inputs.some((input) => !input.checked);
          inputs.forEach((input) => { input.checked = shouldSelect; });
          selectAll.textContent = shouldSelect ? "Clear selection" : "Select all shown";
          updateToolbar();
        });
        const count = document.createElement("small");
        count.className = "workbench-map-selected-count";
        count.textContent = "Select clients to start a Workbench campaign";
        const add = document.createElement("button");
        add.type = "button";
        add.className = "workbench-bulk-action workbench-map-add";
        add.textContent = "Add to Workbench";
        add.disabled = true;
        add.addEventListener("click", () => {
          const ids = [...panel.querySelectorAll<HTMLInputElement>(".workbench-map-select input:checked")].map((input) => input.dataset.clientId || "").filter(Boolean);
          if (!ids.length) return;
          addToWorkbench(ids);
          panel.querySelectorAll<HTMLInputElement>(".workbench-map-select input").forEach((input) => { input.checked = false; });
          selectAll.textContent = "Select all shown";
          updateToolbar();
          setAdded(ids.length);
          window.setTimeout(() => setAdded(0), 1800);
        });
        toolbar.append(selectAll, count, add);
        tools.insertAdjacentElement("afterend", toolbar);
        updateToolbar();
      }
    };

    syncMapList();
    const observer = new MutationObserver(syncMapList);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [addToWorkbench, dataset]);

  return added ? <div className="workbench-toast" role="status">Added {added} client{added === 1 ? "" : "s"} to Workbench</div> : null;
}
