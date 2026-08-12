"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { useCompassState } from "@/lib/compass/store";
import type { CompassClient } from "@/lib/compass/types";
import { ClientTrackedAction } from "./client-tracked-action";
import { ListColumnResizeHandle, ListViewSettings, useListViewPreferences, type ListViewColumn } from "./list-view-settings";

type MapColumnKey = "client" | "health" | "value" | "review" | "salesActivity" | "tc" | "quote" | "assets" | "tracked" | "actions";
type RuntimeSortKey = "salesActivity" | "tc" | "quote" | "assets" | "tracked";
type SortDirection = "asc" | "desc";
type RowTarget = { element: HTMLElement; client: CompassClient; nativeCells: HTMLElement[] };

const MAP_COLUMNS: readonly ListViewColumn<MapColumnKey>[] = [
  { key: "client", label: "Client", description: "Client name, city, and territory", defaultWidth: 230, minWidth: 175, maxWidth: 390, required: true },
  { key: "health", label: "Need", description: "Replace Now · Plan Soon · Current", defaultWidth: 135, minWidth: 110, maxWidth: 195 },
  { key: "value", label: "Value", description: "Estimated project need", defaultWidth: 120, minWidth: 100, maxWidth: 190 },
  { key: "review", label: "Last review", description: "Most recent account review", defaultWidth: 130, minWidth: 110, maxWidth: 210 },
  { key: "salesActivity", label: "Last sales activity", description: "Latest TC sales activity", defaultWidth: 145, minWidth: 120, maxWidth: 220 },
  { key: "tc", label: "TC", description: "TC tied to latest sales activity", defaultWidth: 140, minWidth: 100, maxWidth: 240 },
  { key: "quote", label: "Last quote", description: "Most recent quote", defaultWidth: 125, minWidth: 105, maxWidth: 200, defaultVisible: false },
  { key: "assets", label: "Assets", description: "Managed device count", defaultWidth: 85, minWidth: 72, maxWidth: 140, defaultVisible: false },
  { key: "tracked", label: "Captain's Log", description: "Captain's Log activity lane", defaultWidth: 135, minWidth: 115, maxWidth: 210, defaultVisible: false },
  { key: "actions", label: "Actions", description: "Open and report", defaultWidth: 180, minWidth: 150, maxWidth: 250, required: true },
];

const NATIVE_COLUMN_INDEX: Partial<Record<MapColumnKey, number>> = {
  client: 0,
  health: 1,
  review: 2,
  value: 3,
  actions: 4,
};

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
  const view = useListViewPreferences("map-clients", MAP_COLUMNS);
  const [headTarget, setHeadTarget] = useState<HTMLElement | null>(null);
  const [toolsTarget, setToolsTarget] = useState<HTMLElement | null>(null);
  const [tableTarget, setTableTarget] = useState<HTMLElement | null>(null);
  const [nativeHeadCells, setNativeHeadCells] = useState<HTMLElement[]>([]);
  const [rowTargets, setRowTargets] = useState<RowTarget[]>([]);
  const [sortKey, setSortKey] = useState<RuntimeSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const clientsByName = useMemo(() => new Map((dataset?.clients ?? []).map((client) => [normalized(client.name), client])), [dataset?.clients]);
  const assetCountByClient = useMemo(() => {
    const result = new Map<string, number>();
    for (const device of dataset?.devices ?? []) result.set(device.clientId, (result.get(device.clientId) ?? 0) + 1);
    return result;
  }, [dataset?.devices]);

  useEffect(() => {
    const sync = () => {
      const head = document.querySelector<HTMLElement>(".territory-client-review-head");
      const tools = document.querySelector<HTMLElement>(".territory-client-review-tools");
      const table = document.querySelector<HTMLElement>(".territory-client-review-table");
      setHeadTarget((current) => current === head ? current : head);
      setToolsTarget((current) => current === tools ? current : tools);
      setTableTarget((current) => current === table ? current : table);
      if (!head) {
        setNativeHeadCells((current) => current.length ? [] : current);
        setRowTargets((current) => current.length ? [] : current);
        return;
      }
      const headCells = [...head.children].slice(0, 5).filter((element): element is HTMLElement => element instanceof HTMLElement);
      setNativeHeadCells((current) => current.length === headCells.length && current.every((item, index) => item === headCells[index]) ? current : headCells);
      const next = [...document.querySelectorAll<HTMLElement>(".territory-client-review-row")].map((element) => {
        const name = element.querySelector<HTMLElement>(".territory-client-review-name strong")?.textContent?.trim() ?? "";
        const client = clientsByName.get(normalized(name));
        const nativeCells = [...element.children].slice(0, 5).filter((item): item is HTMLElement => item instanceof HTMLElement);
        return client ? { element, client, nativeCells } : null;
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
    if (!headTarget || !tableTarget) return;
    tableTarget.classList.add("list-view-grid-scroll");
    headTarget.classList.add("list-view-grid");
    const width = `${Math.max(view.totalWidth, 760)}px`;
    headTarget.style.setProperty("--list-view-columns", view.gridTemplate);
    headTarget.style.setProperty("--list-view-width", width);

    const renderedIndex = new Map(view.rendered.map((key, index) => [key, index]));
    for (const [key, nativeIndex] of Object.entries(NATIVE_COLUMN_INDEX) as Array<[MapColumnKey, number]>) {
      const headCell = nativeHeadCells[nativeIndex];
      if (!headCell) continue;
      const order = renderedIndex.get(key);
      headCell.classList.add("list-view-column-head");
      headCell.style.order = order === undefined ? "" : String(order);
      headCell.style.display = order === undefined ? "none" : "";
    }
    for (const row of rowTargets) {
      row.element.classList.add("list-view-grid");
      row.element.style.setProperty("--list-view-columns", view.gridTemplate);
      row.element.style.setProperty("--list-view-width", width);
      for (const [key, nativeIndex] of Object.entries(NATIVE_COLUMN_INDEX) as Array<[MapColumnKey, number]>) {
        const cell = row.nativeCells[nativeIndex];
        if (!cell) continue;
        const order = renderedIndex.get(key);
        cell.style.order = order === undefined ? "" : String(order);
        cell.style.display = order === undefined ? "none" : "";
      }
    }
    return () => {
      tableTarget.classList.remove("list-view-grid-scroll");
      headTarget.classList.remove("list-view-grid");
      headTarget.style.removeProperty("--list-view-columns");
      headTarget.style.removeProperty("--list-view-width");
      for (const cell of nativeHeadCells) { cell.classList.remove("list-view-column-head"); cell.style.removeProperty("order"); cell.style.removeProperty("display"); }
      for (const row of rowTargets) {
        row.element.classList.remove("list-view-grid");
        row.element.style.removeProperty("--list-view-columns");
        row.element.style.removeProperty("--list-view-width");
        for (const cell of row.nativeCells) { cell.style.removeProperty("order"); cell.style.removeProperty("display"); }
      }
    };
  }, [headTarget, nativeHeadCells, rowTargets, tableTarget, view.gridTemplate, view.rendered, view.totalWidth]);

  useEffect(() => {
    if (!headTarget) return;
    const clearRuntimeSort = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest(".map-list-runtime-sort")) setSortKey(null);
    };
    headTarget.addEventListener("click", clearRuntimeSort);
    return () => headTarget.removeEventListener("click", clearRuntimeSort);
  }, [headTarget]);

  useEffect(() => {
    for (const { element } of rowTargets) element.style.removeProperty("order");
    if (!sortKey) return;
    const direction = sortDirection === "asc" ? 1 : -1;
    const sorted = [...rowTargets].sort((left, right) => {
      if (sortKey === "salesActivity" || sortKey === "quote") {
        const a = dateValue(sortKey === "salesActivity" ? left.client.lastSalesInteraction : left.client.lastQuoteDate);
        const b = dateValue(sortKey === "salesActivity" ? right.client.lastSalesInteraction : right.client.lastQuoteDate);
        if (!a && b) return sortDirection === "asc" ? -1 : 1;
        if (a && !b) return sortDirection === "asc" ? 1 : -1;
        return direction * (a - b || left.client.name.localeCompare(right.client.name));
      }
      if (sortKey === "assets") return direction * ((assetCountByClient.get(left.client.id) ?? 0) - (assetCountByClient.get(right.client.id) ?? 0) || left.client.name.localeCompare(right.client.name));
      if (sortKey === "tracked") {
        const a = Boolean(left.client.captainsLog?.recentActivity?.length || left.client.captainsLog?.openTasks?.length);
        const b = Boolean(right.client.captainsLog?.recentActivity?.length || right.client.captainsLog?.openTasks?.length);
        return direction * (Number(a) - Number(b) || left.client.name.localeCompare(right.client.name));
      }
      const a = (left.client.technicalConsultant || "").trim();
      const b = (right.client.technicalConsultant || "").trim();
      if (!a && b) return 1;
      if (a && !b) return -1;
      return direction * (a.localeCompare(b, undefined, { sensitivity: "base" }) || left.client.name.localeCompare(right.client.name));
    });
    sorted.forEach((item, index) => { item.element.style.order = String(index); });
    return () => { for (const { element } of rowTargets) element.style.removeProperty("order"); };
  }, [assetCountByClient, rowTargets, sortDirection, sortKey]);

  if (!headTarget || !rowTargets.length) return null;

  const renderedIndex = new Map(view.rendered.map((key, index) => [key, index]));
  const runtimeSortButton = (key: RuntimeSortKey, label: string) => <button type="button" className={`compass-column-sort map-list-runtime-sort${sortKey === key ? " is-active" : ""}`} onClick={() => {
    if (sortKey === key) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDirection(key === "tc" || key === "salesActivity" || key === "quote" ? "asc" : "desc"); }
  }}>{label}<span aria-hidden="true">{sortKey !== key ? "↕" : sortDirection === "asc" ? "↑" : "↓"}</span></button>;

  const addedColumns: RuntimeSortKey[] = ["salesActivity", "tc", "quote", "assets", "tracked"];

  return <>
    {toolsTarget && createPortal(<ListViewSettings view={view} />, toolsTarget)}
    {Object.entries(NATIVE_COLUMN_INDEX).map(([key, nativeIndex]) => {
      const target = nativeHeadCells[nativeIndex];
      return target ? createPortal(<ListColumnResizeHandle key={`resize-${key}`} column={key as MapColumnKey} view={view} />, target) : null;
    })}
    {addedColumns.map((column) => {
      const order = renderedIndex.get(column);
      const meta = view.byKey.get(column)!;
      return createPortal(<span key={`head-${column}`} className="list-view-column-head map-list-added-head" style={{ order: order ?? 0, display: order === undefined ? "none" : undefined }}>{runtimeSortButton(column, meta.label)}<ListColumnResizeHandle column={column} view={view} /></span>, headTarget);
    })}
    {rowTargets.flatMap(({ element, client }) => addedColumns.map((column) => {
      const order = renderedIndex.get(column);
      let content: React.ReactNode;
      if (column === "salesActivity") content = formatDate(client.lastSalesInteraction);
      else if (column === "tc") content = client.technicalConsultant || "Not assigned";
      else if (column === "quote") content = formatDate(client.lastQuoteDate);
      else if (column === "assets") content = assetCountByClient.get(client.id) ?? 0;
      else content = <ClientTrackedAction clientId={client.id} clientName={client.name} tracked={Boolean(client.captainsLog?.recentActivity?.length || client.captainsLog?.openTasks?.length)} />;
      return createPortal(<span key={`${client.id}-${column}`} className={`map-list-added-cell is-${column}`} style={{ order: order ?? 0, display: order === undefined ? "none" : undefined }}>{content}</span>, element, `${client.id}-${column}`);
    }))}
  </>;
}
