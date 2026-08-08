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

function syncPeerHighlights(map: Element) {
  const activeState = map.querySelector(".territory-map-state.is-active");
  const activeCode = activeState ? stateCodeForGroup(activeState) : "";
  const selectionGroup = STATE_SELECTION_GROUPS.find((states) => states.includes(activeCode as never));

  map.querySelectorAll<SVGGElement>(".territory-map-state").forEach((node) => {
    const code = stateCodeForGroup(node);
    const shouldHighlight = Boolean(selectionGroup && code !== activeCode && selectionGroup.includes(code as never));
    node.classList.toggle("is-selection-peer-active", shouldHighlight);
  });
}

export function MapSelectionGroupBridge() {
  useEffect(() => {
    let observer: MutationObserver | null = null;
    let currentMap: Element | null = null;

    const attach = () => {
      const map = document.querySelector(".territory-regional-map");
      if (map === currentMap) return;
      observer?.disconnect();
      currentMap = map;
      if (!map) return;

      syncPeerHighlights(map);
      observer = new MutationObserver(() => syncPeerHighlights(map));
      observer.observe(map, { subtree: true, attributes: true, attributeFilter: ["class"] });
    };

    attach();
    const pageObserver = new MutationObserver(attach);
    pageObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      pageObserver.disconnect();
    };
  }, []);

  return null;
}
