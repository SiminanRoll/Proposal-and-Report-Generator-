"use client";

import { useEffect } from "react";

const STATE_SELECTION_GROUPS = [
  ["TN", "KY", "AL"],
  ["IN", "OH"],
] as const;

function stateCodeForGroup(group: Element): string {
  const label = group.querySelector<SVGTextElement>(".territory-map-region-label")?.textContent?.trim().toUpperCase() ?? "";
  return label.slice(0, 2);
}

function clearPeerHighlights(map: Element | null) {
  map?.querySelectorAll(".territory-map-state.is-selection-peer-active").forEach((node) => node.classList.remove("is-selection-peer-active"));
}

function highlightStateGroup(map: Element, state: string) {
  clearPeerHighlights(map);
  const selectionGroup = STATE_SELECTION_GROUPS.find((states) => states.includes(state as never));
  if (!selectionGroup) return;

  map.querySelectorAll<SVGGElement>(".territory-map-state").forEach((node) => {
    const code = stateCodeForGroup(node);
    if (code !== state && selectionGroup.includes(code as never)) node.classList.add("is-selection-peer-active");
  });
}

export function MapSelectionGroupBridge() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const map = target?.closest(".territory-regional-map") ?? document.querySelector(".territory-regional-map");
      if (!map) return;

      const stateGroup = target?.closest(".territory-map-state");
      const paintedRegion = target?.closest(".territory-map-region-fill");
      if (stateGroup && paintedRegion) {
        highlightStateGroup(map, stateCodeForGroup(stateGroup));
        return;
      }

      if (target?.closest(".territory-map-canvas") && !target.closest(".territory-map-state")) clearPeerHighlights(map);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
