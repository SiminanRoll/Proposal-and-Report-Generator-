"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { MAP_LENS_CHANGE_EVENT } from "@/lib/segments/map-lens";

function regionName(region: Element): string {
  return (region.getAttribute("aria-label") || "").split(":")[0]?.trim() || "";
}

function findRegion(name: string): SVGGElement | null {
  if (!name) return null;
  return [...document.querySelectorAll<SVGGElement>(".territory-map-region")]
    .find((region) => regionName(region) === name) ?? null;
}

function simplifyNeedSettings() {
  const settings = document.querySelector<HTMLElement>(".territory-map-settings");
  if (!settings) return;
  settings.querySelectorAll<HTMLLabelElement>("label").forEach((label) => {
    const text = label.textContent?.trim().toLowerCase() || "";
    // Need is now defined as Replace Now. Plan Soon remains visible in the
    // territory health bars, but it is no longer an actionable Need filter.
    if (text.startsWith("plan soon") || text.startsWith("value follows need filter")) {
      label.style.display = "none";
    }
  });
}

export function MapNeedIntegrityRuntime() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/map")) return;

    let pendingRegion = "";
    let replayTimer = 0;

    const replayExactRegion = () => {
      const name = pendingRegion;
      pendingRegion = "";
      if (!name) return;
      window.clearTimeout(replayTimer);
      replayTimer = window.setTimeout(() => {
        const region = findRegion(name);
        if (!region) return;
        // The map's React state historically focuses the whole state on the
        // first click. Replay against the freshly rendered region so click and
        // hover resolve to the same exact territory and therefore the same
        // counts. The selection bridge ignores this untrusted replay.
        region.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      }, 40);
    };

    const onTrustedRegionClick = (event: MouseEvent) => {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      const region = event.target.closest<SVGGElement>(".territory-map-region");
      if (!region) return;
      pendingRegion = regionName(region);
    };

    const syncUi = () => simplifyNeedSettings();

    document.addEventListener("click", onTrustedRegionClick, true);
    window.addEventListener(MAP_LENS_CHANGE_EVENT, replayExactRegion);
    document.addEventListener("click", syncUi, true);
    const timer = window.setInterval(syncUi, 500);
    syncUi();

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(replayTimer);
      document.removeEventListener("click", onTrustedRegionClick, true);
      document.removeEventListener("click", syncUi, true);
      window.removeEventListener(MAP_LENS_CHANGE_EVENT, replayExactRegion);
    };
  }, [pathname]);

  return null;
}
