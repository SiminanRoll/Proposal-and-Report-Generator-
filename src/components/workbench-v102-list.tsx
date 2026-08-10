"use client";

import { useEffect, useMemo, useState } from "react";
import type { SortDirection, SortKey, WorkbenchRow } from "./workbench-v102-model";
import { formatWorkbenchDate, formatWorkbenchMoney, reportUrl, sortIndicator } from "./workbench-v102-model";

export type WorkbenchScheduleRequest = { clientId: string; taskId: string };

type WorkbenchColumnKey =
  | "client"
  | "stage"
  | "activity"
  | "tasks"
  | "review"
  | "quote"
  | "value"
  | "followUp"
  | "owner"
  | "market"
  | "industry"
  | "salesInteraction"
  | "workflow"
  | "actions";

type WorkbenchColumnWidths = Record<WorkbenchColumnKey, number>;
type WorkbenchColumnLayout = { order: WorkbenchColumnKey[]; visible: WorkbenchColumnKey[] };

const WORKBENCH_COLUMN_STORAGE_KEY = "client-compass.workbench.columns.v1";
const WORKBENCH_COLUMN_LAYOUT_STORAGE_KEY = "client-compass.workbench.column-layout.v1";

const ALL_COLUMN_ORDER: WorkbenchColumnKey[] = [
  "client", "stage", "activity", "tasks", "review", "quote", "value",
  "followUp", "owner", "market", "industry", "salesInteraction", "workflow", "actions",
];
const MOBILE_COLUMN_ORDER: WorkbenchColumnKey[] = ["client", "stage", "activity", "tasks", "review", "value", "actions"];
const DEFAULT_VISIBLE_COLUMNS: WorkbenchColumnKey[] = ["client", "stage", "activity", "tasks", "review", "quote", "value", "actions"];
const REQUIRED_COLUMNS = new Set<WorkbenchColumnKey>(["client", "actions"]);

const COLUMN_META: Record<WorkbenchColumnKey, { label: string; description: string }> = {
  client: { label: "Client", description: "Client name and location" },
  stage: { label: "Stage", description: "Current review stage" },
  activity: { label: "Latest activity", description: "Most relevant review activity" },
  tasks: { label: "Open tasks", description: "Open Account Review tasks" },
  review: { label: "Last review", description: "Most recent Account Review" },
  quote: { label: "Last quote", description: "Latest recorded quote date" },
  value: { label: "Est. need", description: "Estimated technology need" },
  followUp: { label: "Next follow-up", description: "Next planned follow-up date" },
  owner: { label: "Owner", description: "Assigned account owner" },
  market: { label: "Market", description: "Client market or territory" },
  industry: { label: "Industry", description: "Client industry" },
  salesInteraction: { label: "Last sales interaction", description: "Latest recorded sales touch" },
  workflow: { label: "Workflow status", description: "Current workflow status" },
  actions: { label: "Actions", description: "Open, report, and row actions" },
};

const DEFAULT_COLUMN_WIDTHS: WorkbenchColumnWidths = {
  client: 210,
  stage: 130,
  activity: 280,
  tasks: 90,
  review: 125,
  quote: 125,
  value: 110,
  followUp: 125,
  owner: 150,
  market: 130,
  industry: 160,
  salesInteraction: 135,
  workflow: 150,
  actions: 240,
};

const COLUMN_LIMITS: Record<WorkbenchColumnKey, { min: number; max: number }> = {
  client: { min: 150, max: 420 },
  stage: { min: 100, max: 240 },
  activity: { min: 190, max: 520 },
  tasks: { min: 72, max: 160 },
  review: { min: 100, max: 220 },
  quote: { min: 100, max: 220 },
  value: { min: 90, max: 200 },
  followUp: { min: 100, max: 220 },
  owner: { min: 110, max: 280 },
  market: { min: 100, max: 240 },
  industry: { min: 110, max: 280 },
  salesInteraction: { min: 110, max: 230 },
  workflow: { min: 110, max: 280 },
  actions: { min: 160, max: 420 },
};

function isColumnKey(value: unknown): value is WorkbenchColumnKey {
  return typeof value === "string" && ALL_COLUMN_ORDER.includes(value as WorkbenchColumnKey);
}

function loadColumnWidths(): WorkbenchColumnWidths {
  if (typeof window === "undefined") return DEFAULT_COLUMN_WIDTHS;
  try {
    const raw = window.localStorage.getItem(WORKBENCH_COLUMN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<Record<WorkbenchColumnKey, unknown>> : {};
    return ALL_COLUMN_ORDER.reduce((next, key) => {
      const candidate = Number(parsed[key]);
      const limits = COLUMN_LIMITS[key];
      next[key] = Number.isFinite(candidate) ? Math.max(limits.min, Math.min(limits.max, candidate)) : DEFAULT_COLUMN_WIDTHS[key];
      return next;
    }, {} as WorkbenchColumnWidths);
  } catch {
    return DEFAULT_COLUMN_WIDTHS;
  }
}

function loadColumnLayout(): WorkbenchColumnLayout {
  if (typeof window === "undefined") return { order: ALL_COLUMN_ORDER, visible: DEFAULT_VISIBLE_COLUMNS };
  try {
    const raw = window.localStorage.getItem(WORKBENCH_COLUMN_LAYOUT_STORAGE_KEY);
    if (!raw) return { order: ALL_COLUMN_ORDER, visible: DEFAULT_VISIBLE_COLUMNS };
    const parsed = JSON.parse(raw) as { order?: unknown[]; visible?: unknown[] };
    const storedOrder = Array.isArray(parsed.order) ? parsed.order.filter(isColumnKey) : [];
    const order = [...storedOrder, ...ALL_COLUMN_ORDER.filter((key) => !storedOrder.includes(key))];
    const storedVisible = Array.isArray(parsed.visible) ? parsed.visible.filter(isColumnKey) : [];
    const visible = storedVisible.length ? [...new Set([...storedVisible, "client" as WorkbenchColumnKey, "actions" as WorkbenchColumnKey])] : DEFAULT_VISIBLE_COLUMNS;
    return { order, visible };
  } catch {
    return { order: ALL_COLUMN_ORDER, visible: DEFAULT_VISIBLE_COLUMNS };
  }
}

function displayText(value: string): string {
  return value?.trim() || "—";
}

export function WorkbenchV102List({
  rows,
  sortKey,
  sortDirection,
  onSort,
  onSchedule,
  onSnooze,
}: {
  rows: WorkbenchRow[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  onSchedule: (request: WorkbenchScheduleRequest) => void;
  onSnooze: (clientId: string) => void;
}) {
  const [columnWidths, setColumnWidths] = useState<WorkbenchColumnWidths>(DEFAULT_COLUMN_WIDTHS);
  const [columnOrder, setColumnOrder] = useState<WorkbenchColumnKey[]>(ALL_COLUMN_ORDER);
  const [visibleColumns, setVisibleColumns] = useState<WorkbenchColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
  const [columnPreferencesReady, setColumnPreferencesReady] = useState(false);
  const [desktopColumns, setDesktopColumns] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState<WorkbenchColumnKey | null>(null);
  const [dragTarget, setDragTarget] = useState<WorkbenchColumnKey | null>(null);

  useEffect(() => {
    setColumnWidths(loadColumnWidths());
    const layout = loadColumnLayout();
    setColumnOrder(layout.order);
    setVisibleColumns(layout.visible);
    setColumnPreferencesReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 761px)");
    const sync = () => setDesktopColumns(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!columnPreferencesReady || typeof window === "undefined") return;
    window.localStorage.setItem(WORKBENCH_COLUMN_STORAGE_KEY, JSON.stringify(columnWidths));
  }, [columnPreferencesReady, columnWidths]);

  useEffect(() => {
    if (!columnPreferencesReady || typeof window === "undefined") return;
    window.localStorage.setItem(WORKBENCH_COLUMN_LAYOUT_STORAGE_KEY, JSON.stringify({ order: columnOrder, visible: visibleColumns }));
  }, [columnOrder, columnPreferencesReady, visibleColumns]);

  const renderedColumns = useMemo(
    () => desktopColumns ? columnOrder.filter((key) => visibleColumns.includes(key)) : MOBILE_COLUMN_ORDER,
    [columnOrder, desktopColumns, visibleColumns],
  );
  const totalWidth = useMemo(() => renderedColumns.reduce((sum, key) => sum + columnWidths[key], 0), [columnWidths, renderedColumns]);

  function resizeColumn(key: WorkbenchColumnKey, event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "touch") return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = columnWidths[key];
    const limits = COLUMN_LIMITS[key];
    const target = event.currentTarget;
    target.setPointerCapture?.(event.pointerId);
    document.body.classList.add("is-resizing-workbench-column");

    const move = (moveEvent: PointerEvent) => {
      const next = Math.max(limits.min, Math.min(limits.max, Math.round(startWidth + moveEvent.clientX - startX)));
      setColumnWidths((current) => current[key] === next ? current : { ...current, [key]: next });
    };
    const finish = () => {
      document.body.classList.remove("is-resizing-workbench-column");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
    window.addEventListener("pointercancel", finish, { once: true });
  }

  function moveColumn(source: WorkbenchColumnKey, target: WorkbenchColumnKey) {
    if (source === target) return;
    setColumnOrder((current) => {
      const next = current.filter((key) => key !== source);
      const targetIndex = next.indexOf(target);
      next.splice(targetIndex < 0 ? next.length : targetIndex, 0, source);
      return next;
    });
  }

  function toggleColumn(key: WorkbenchColumnKey) {
    if (REQUIRED_COLUMNS.has(key)) return;
    setVisibleColumns((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function resetColumnLayout() {
    setColumnOrder(ALL_COLUMN_ORDER);
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
  }

  if (!rows.length) return <div className="workbench-empty"><strong>No clients match this Workbench view.</strong><p>Change the stage, date window, or search to widen the list.</p></div>;

  const sortButton = (key: SortKey, label: string) => <button className="workbench-sort" type="button" onClick={() => onSort(key)}>{label}<span>{sortIndicator(key, sortKey, sortDirection)}</span></button>;

  function headerFor(column: WorkbenchColumnKey) {
    if (column === "client") return sortButton("client", "Client");
    if (column === "stage") return sortButton("stage", "Stage");
    if (column === "activity") return sortButton("activity", "Latest activity");
    if (column === "tasks") return sortButton("tasks", "Open tasks");
    if (column === "review") return sortButton("review", "Last review");
    if (column === "value") return sortButton("value", "Est. need");
    return <span className="workbench-static-head">{COLUMN_META[column].label}</span>;
  }

  function resizeHandle(key: WorkbenchColumnKey) {
    return <button
      className="workbench-column-resizer"
      type="button"
      aria-label={`Resize ${COLUMN_META[key].label} column`}
      title={`Drag to resize ${COLUMN_META[key].label}. Double-click to reset.`}
      onPointerDown={(event) => resizeColumn(key, event)}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setColumnWidths((current) => ({ ...current, [key]: DEFAULT_COLUMN_WIDTHS[key] }));
      }}
    />;
  }

  function activityCell(row: WorkbenchRow) {
    return <div className="workbench-activity-cell"><div className="workbench-activity-main"><span className={`workbench-activity-kind is-${row.activity.kind}`}>{row.activity.kind === "open" ? "Next" : row.activity.kind === "review" ? "Review" : row.activity.kind === "last" ? "Latest" : "None"}</span><span className="workbench-activity-copy"><strong>{row.activity.title}</strong><small>{formatWorkbenchDate(row.activity.date)}</small></span>{row.activity.task ? <button className="workbench-reschedule" type="button" title="Reschedule task" aria-label={`Reschedule ${row.activity.task.title}`} onClick={() => onSchedule({ clientId: row.client.id, taskId: row.activity.task?.id ?? "" })}>↗</button> : null}</div></div>;
  }

  function cellFor(column: WorkbenchColumnKey, row: WorkbenchRow) {
    if (column === "client") return <td key={column}><strong>{row.client.name}</strong><small>{[row.client.city, row.client.state].filter(Boolean).join(", ") || "Location not listed"}{row.manual ? " · Manual" : ""}</small></td>;
    if (column === "stage") return <td key={column}><span className={`workbench-stage is-${row.stage.toLowerCase().replaceAll(" ", "-")}`}>{row.stage}</span></td>;
    if (column === "activity") return <td key={column}>{activityCell(row)}</td>;
    if (column === "tasks") return <td key={column}>{row.openTaskCount}</td>;
    if (column === "review") return <td key={column}>{formatWorkbenchDate(row.reviewDate)}</td>;
    if (column === "quote") return <td key={column} className="workbench-quote-cell"><strong>{formatWorkbenchDate(row.client.lastQuoteDate)}</strong><small>{row.client.lastQuoteDate ? row.client.quoted ? "Quoted" : "Quote activity" : row.client.quoted ? "Quoted · date not recorded" : "No quote recorded"}</small></td>;
    if (column === "value") return <td key={column}>{formatWorkbenchMoney(row.estimatedValue)}</td>;
    if (column === "followUp") return <td key={column}>{formatWorkbenchDate(row.client.nextFollowUp)}</td>;
    if (column === "owner") return <td key={column}>{displayText(row.client.assignedOwner)}</td>;
    if (column === "market") return <td key={column}>{displayText(row.client.market)}</td>;
    if (column === "industry") return <td key={column}>{displayText(row.client.industry)}</td>;
    if (column === "salesInteraction") return <td key={column}>{formatWorkbenchDate(row.client.lastSalesInteraction)}</td>;
    if (column === "workflow") return <td key={column}>{displayText(row.client.workflowStatus)}</td>;
    return <td key={column}><div className="workbench-row-actions"><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("client-compass:open-workspace", { detail: { clientId: row.client.id } }))}>Open</button><a href={reportUrl(row.client.id, row.client.name)}>Report</a><button className="is-quiet" type="button" onClick={() => onSnooze(row.client.id)}>Snooze</button></div></td>;
  }

  return <>
    <div className="workbench-column-layout-bar">
      <span className="workbench-column-help">Drag column grips to reorder · drag dividers to resize</span>
      <button className="workbench-column-customize" type="button" aria-expanded={customizeOpen} onClick={() => setCustomizeOpen((value) => !value)}>Customize columns</button>
      {customizeOpen && <section className="workbench-column-customizer" aria-label="Customize Workbench columns">
        <header><div><strong>Customize columns</strong><small>Choose what belongs in your Workbench table.</small></div><button type="button" aria-label="Close column settings" onClick={() => setCustomizeOpen(false)}>×</button></header>
        <div className="workbench-column-options">{ALL_COLUMN_ORDER.map((key) => <label key={key} className={REQUIRED_COLUMNS.has(key) ? "is-required" : ""}><input type="checkbox" checked={visibleColumns.includes(key)} disabled={REQUIRED_COLUMNS.has(key)} onChange={() => toggleColumn(key)} /><span><strong>{COLUMN_META[key].label}</strong><small>{REQUIRED_COLUMNS.has(key) ? "Always shown" : COLUMN_META[key].description}</small></span></label>)}</div>
        <footer><button type="button" onClick={resetColumnLayout}>Reset layout</button><button className="primary" type="button" onClick={() => setCustomizeOpen(false)}>Done</button></footer>
      </section>}
    </div>
    <div className="workbench-table-wrap workbench-table-wrap-resizable"><table className="workbench-table workbench-table-resizable" style={{ width: `max(100%, ${totalWidth}px)` }}>
      <colgroup>{renderedColumns.map((column) => <col key={column} style={{ width: `${columnWidths[column]}px` }} />)}</colgroup>
      <thead><tr>{renderedColumns.map((column) => <th
        className={`workbench-resizable-head${draggedColumn === column ? " is-column-dragging" : ""}${dragTarget === column && draggedColumn !== column ? " is-column-drop-target" : ""}`}
        key={column}
        onDragOver={(event) => { if (!desktopColumns || !draggedColumn || draggedColumn === column) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragTarget(column); }}
        onDragLeave={() => { if (dragTarget === column) setDragTarget(null); }}
        onDrop={(event) => { event.preventDefault(); if (draggedColumn) moveColumn(draggedColumn, column); setDraggedColumn(null); setDragTarget(null); }}
      ><div className="workbench-column-head-content">{headerFor(column)}<span
        className="workbench-column-grip"
        draggable={desktopColumns}
        title={`Drag ${COLUMN_META[column].label} to reorder`}
        aria-hidden="true"
        onDragStart={(event) => { setDraggedColumn(column); setDragTarget(null); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", column); }}
        onDragEnd={() => { setDraggedColumn(null); setDragTarget(null); }}
      >⋮⋮</span></div>{resizeHandle(column)}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.client.id}>{renderedColumns.map((column) => cellFor(column, row))}</tr>)}</tbody>
    </table></div>
  </>;
}
