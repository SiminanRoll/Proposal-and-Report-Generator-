"use client";

import { useEffect, useMemo } from "react";
import { useCompassState } from "@/lib/compass/store";
import {
  buildTerritoryMapSnapshot,
  DEFAULT_TERRITORY_MAP_CRITERIA,
  territoryClientMatchesNeed,
} from "@/lib/compass/territory-map";
import { setWorkbenchPriorityNeedClientIds } from "@/lib/compass/workbench";

export function WorkbenchQualificationRuntime() {
  const { dataset } = useCompassState();

  const priorityNeedIds = useMemo(() => {
    if (!dataset) return new Set<string>();
    const snapshot = buildTerritoryMapSnapshot(dataset, DEFAULT_TERRITORY_MAP_CRITERIA);
    const ids = new Set<string>();
    for (const territory of snapshot.territories) {
      for (const client of territory.clients) {
        if (territoryClientMatchesNeed(client, DEFAULT_TERRITORY_MAP_CRITERIA)) ids.add(client.clientId);
      }
    }
    return ids;
  }, [dataset]);

  useEffect(() => {
    setWorkbenchPriorityNeedClientIds(priorityNeedIds);
  }, [priorityNeedIds]);

  return null;
}
