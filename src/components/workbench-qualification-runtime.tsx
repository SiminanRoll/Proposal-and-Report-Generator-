"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useCompassState } from "@/lib/compass/store";
import {
  buildTerritoryMapSnapshot,
  DEFAULT_TERRITORY_MAP_CRITERIA,
  territoryClientMatchesNeed,
} from "@/lib/compass/territory-map";
import { setWorkbenchPriorityNeedClientIds } from "@/lib/compass/workbench";

export function WorkbenchQualificationRuntime() {
  const { dataset } = useCompassState();
  const pathname = usePathname();

  const priorityNeedIds = useMemo(() => {
    if (!dataset) return new Set<string>();

    // Territory snapshots intentionally honor the active Map lens while on /map.
    // The Workbench safety catch must never inherit that temporary geography or
    // segment filter, so wait until a non-map surface is active before rebuilding
    // the global priority set. Navigating into Workbench immediately recalculates it.
    if (pathname.startsWith("/map")) return null;

    const snapshot = buildTerritoryMapSnapshot(dataset, DEFAULT_TERRITORY_MAP_CRITERIA);
    const ids = new Set<string>();
    for (const territory of snapshot.territories) {
      for (const client of territory.clients) {
        if (territoryClientMatchesNeed(client, DEFAULT_TERRITORY_MAP_CRITERIA)) ids.add(client.clientId);
      }
    }
    return ids;
  }, [dataset, pathname]);

  useEffect(() => {
    if (priorityNeedIds) setWorkbenchPriorityNeedClientIds(priorityNeedIds);
  }, [priorityNeedIds]);

  return null;
}
