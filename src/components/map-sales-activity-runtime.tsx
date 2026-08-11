"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { useCompassState } from "@/lib/compass/store";
import type { CompassClient } from "@/lib/compass/types";

type MapSalesSort = "salesActivity" | "tc";
type SortDirection = "asc" | "desc";
type RowTarget = { element: HTMLElement; client: CompassClient };

function formatDate(value: string): string {
  if (!value) return "Not recorded";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function dateValue(value: string): number {
  if (!value) return 0;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function normalized(value: string): string { return value.trim().toLowerCase(); }

export function MapSalesActivityRuntime() {
  const { dataset } = useCompassState();
  const [headTarget, setHeadTarget] = useState<HTMLElement | null>(null);
  const [rowTargets, setRowTargets] = useState<RowTarget[]>([]);
  const [sortKey, setSortKey] = useState<MapSalesSort | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const clientsByName = useMemo(() => new Map((dataset?.clients ?? []).map((client) => [normalized(client.name), client])), [dataset?.clients]);

  useEffect(() => {
    const sync = () => {
      const head = document.querySelector<HTMLElement>(".territory-client-review-head");
      setHeadTarget((current) => current === head ? current : head);
      if (!head) {
        setRowTargets((current) => current.length ? [] : current);
        return;
      }
      const next = [...document.querySelectorAll<HTMLElement>(".territory-client-review-row")].map((element) => {
        const name = element.querySelector<HTMLElement>(".territory-client-review-name strong")?.textContent?.trim() ?? "";
        const client = clientsByName.get(normalized(name));
        return client ? { element, client } : null;
      }).filter((item): item is RowTarget => Boolean(item));
      setRowTargets((current) => {
        if (current.length === next.length && current.every((item, index) => item.element === next[index]?.element && item.client.id === next[index]?.client.id)) return current;
        return next;
      });
    };
    sync();
    const timer = window.setInterval(sync, 300);
    return () => window.clearInterval(timer);
  }, [clientsByName]);

  useEffect(() => {
    for (const { element } of rowTargets) element.style.removeProperty("order");
    if (!sortKey) return;
    const direction = sortDirection === "asc" ? 1 : -1;
    const sorted = [...rowTargets].sort((left, right) => {
      if (sortKey === "salesActivity") {
        const a = dateValue(left.client.lastSalesInteraction);
        const b = dateValue(right.client.lastSalesInteraction);
        if (!a && b) return sortDirection === "asc" ? -1 : 1;
        if (a && !b) return sortDirection === "asc" ? 1 : -1;
        return direction * (a - b || left.client.name.localeCompare(right.client.name));
      }
      const a = (left.client.technicalConsultant || "").trim();
      const b = (right.client.technicalConsultant || "").trim();
      if (!a && b) return 1;
      if (a && !b) return -1;
      return direction * (a.localeCompare(b, undefined, { sensitivity: "base" }) || left.client.name.localeCompare(right.client.name));
    });
    sorted.forEach((item, index) => { item.element.style.order = String(index); });
    return () => { for (const { element } of rowTargets) element.style.removeProperty("order"); };
  }, [rowTargets, sortDirection, sortKey]);

  if (!headTarget || !rowTargets.length) return null;

  const sortButton = (key: MapSalesSort, label: string) => <button type="button" className={`compass-column-sort map-sales-sort-v1127${sortKey === key ? " is-active" : ""}`} onClick={() => {
    if (sortKey === key) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDirection("asc"); }
  }}>{label}<span aria-hidden="true">{sortKey !== key ? "↕" : sortDirection === "asc" ? "↑" : "↓"}</span></button>;

  return <>
    {createPortal(<><span className="map-sales-head-v1127 is-sales">{sortButton("salesActivity", "Last sales activity")}</span><span className="map-sales-head-v1127 is-tc">{sortButton("tc", "TC")}</span></>, headTarget)}
    {rowTargets.map(({ element, client }) => createPortal(<><span className="map-sales-cell-v1127 is-sales">{formatDate(client.lastSalesInteraction)}</span><span className="map-sales-cell-v1127 is-tc">{client.technicalConsultant || "Not assigned"}</span></>, element, client.id))}
  </>;
}
