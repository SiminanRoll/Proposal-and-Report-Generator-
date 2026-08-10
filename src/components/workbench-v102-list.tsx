"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SortDirection, SortKey, WorkbenchRow } from "./workbench-v102-model";
import { formatWorkbenchDate, formatWorkbenchMoney, reportUrl, sortIndicator } from "./workbench-v102-model";

type Props = {
  rows: WorkbenchRow[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  onSchedule: (row: WorkbenchRow) => void;
  onResolve: (clientId: string) => void;
  onOpen: (clientId: string) => void;
  onSnooze: (row: WorkbenchRow) => void;
};

type WorkbenchColumnKey = "client" | "stage" | "activity" | "tasks" | "review" | "value" | "actions";
type WorkbenchColumnWidths = Record<WorkbenchColumnKey, number>;

const WORKBENCH_COLUMN_STORAGE_KEY = "client-compass.workbench.columns.v1";

const DEFAULT_COLUMN_WIDTHS: WorkbenchColumnWidths = {
  client: 210,
  stage: 130,
  activity: 300,
  tasks: 90,
  review: 125,
  value: 110,
  actions: 240,
};

const COLUMN_LIMITS: Record<WorkbenchColumnKey, { min: number; max: number }> = {
  client: { min: 150, max: 420 },
  stage: { min: 100, max: 240 },
  activity: { min: 190, max: 520 },
  tasks: { min: 72, max: 160 },
  review: { min: 100, max: 220 },
  value: { min: 90, max: 200 },
  actions: { min: 160, max: 420 },
};

const COLUMN_ORDER: WorkbenchColumnKey[] = ["client", "stage", "activity", "tasks", "review", "value", "actions"];

function clampColumnWidth(column: WorkbenchColumnKey, value: number): number {
  const limits = COLUMN_LIMITS[column];
  return Math.max(limits.min, Math.min(limits.max, Math.round(value)));
}

function loadColumnWidths(): WorkbenchColumnWidths {
  if (typeof window === "undefined") return DEFAULT_COLUMN_WIDTHS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WORKBENCH_COLUMN_STORAGE_KEY) || "{}") as Partial<Record<WorkbenchColumnKey, unknown>>;
    const next = { ...DEFAULT_COLUMN_WIDTHS };
    for (const column of COLUMN_ORDER) {
      const value = Number(parsed[column]);
      if (Number.isFinite(value)) next[column] = clampColumnWidth(column, value);
    }
    return next;
  } catch {
    return DEFAULT_COLUMN_WIDTHS;
  }
}

export function WorkbenchV102List({ rows, sortKey, sortDirection, onSort, onSchedule, onResolve, onOpen, onSnooze }: Props) {
  const [columnWidths, setColumnWidths] = useState<WorkbenchColumnWidths>(DEFAULT_COLUMN_WIDTHS);
  const [columnPreferencesReady, setColumnPreferencesReady] = useState(false);

  useEffect(() => {
    setColumnWidths(loadColumnWidths());
    setColumnPreferencesReady(true);
  }, []);

  useEffect(() => {
    if (!columnPreferencesReady || typeof window === "undefined") return;
    window.localStorage.setItem(WORKBENCH_COLUMN_STORAGE_KEY, JSON.stringify(columnWidths));
  }, [columnPreferencesReady, columnWidths]);

  const totalWidth = useMemo(() => COLUMN_ORDER.reduce((sum, column) => sum + columnWidths[column], 0), [columnWidths]);

  const sortButton = (column: SortKey, label: string) => <button type="button" className={`workbench-sort${sortKey === column ? " is-active" : ""}`} onClick={() => onSort(column)}>{label}<span aria-hidden="true">{sortIndicator(column, sortKey, sortDirection)}</span></button>;

  const beginResize = (column: WorkbenchColumnKey, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "touch") return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = columnWidths[column];
    document.body.classList.add("is-resizing-workbench-column");

    const move = (moveEvent: PointerEvent) => {
      const nextWidth = clampColumnWidth(column, startWidth + moveEvent.clientX - startX);
      setColumnWidths((current) => current[column] === nextWidth ? current : { ...current, [column]: nextWidth });
    };
    const stop = () => {
      document.body.classList.remove("is-resizing-workbench-column");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  };

  const resizeHandle = (column: WorkbenchColumnKey, label: string) => <button
    type="button"
    className="workbench-column-resizer"
    aria-label={`Resize ${label} column`}
    title={`Drag to resize ${label}. Double-click to reset.`}
    onPointerDown={(event) => beginResize(column, event)}
    onDoubleClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      setColumnWidths((current) => ({ ...current, [column]: DEFAULT_COLUMN_WIDTHS[column] }));
    }}
  />;

  if (!rows.length) return <div className="workbench-empty"><strong>No clients in this view.</strong><span>Known reviews enter automatically at the annual due date. Clients with no recorded review date stay in Reviews Due until you intentionally add or begin work on them.</span></div>;

  return <div className="workbench-table-wrap workbench-table-wrap-resizable">
    <table className="workbench-table workbench-table-resizable" style={{ width: `max(100%, ${totalWidth}px)` }}>
      <colgroup>{COLUMN_ORDER.map((column) => <col key={column} style={{ width: `${columnWidths[column]}px` }} />)}</colgroup>
      <thead><tr>
        <th className="workbench-resizable-head">{sortButton("client", "Client")}{resizeHandle("client", "Client")}</th>
        <th className="workbench-resizable-head">{sortButton("stage", "Stage")}{resizeHandle("stage", "Stage")}</th>
        <th className="workbench-resizable-head">{sortButton("activity", "Latest activity")}{resizeHandle("activity", "Latest activity")}</th>
        <th className="workbench-resizable-head">{sortButton("tasks", "Open tasks")}{resizeHandle("tasks", "Open tasks")}</th>
        <th className="workbench-resizable-head">{sortButton("review", "Last review")}{resizeHandle("review", "Last review")}</th>
        <th className="workbench-resizable-head">{sortButton("value", "Est. need")}{resizeHandle("value", "Estimated need")}</th>
        <th className="workbench-resizable-head"><span className="workbench-static-head">Actions</span>{resizeHandle("actions", "Actions")}</th>
      </tr></thead><tbody>
      {rows.map((row) => <tr key={row.client.id}>
        <td><strong>{row.client.name}</strong><small>{row.client.city}{row.client.state ? `${row.client.city ? ", " : ""}${row.client.state}` : ""}</small></td>
        <td><span className={`workbench-stage stage-${row.stage.toLowerCase().replace(/\s+/g, "-")}`}>{row.stage}</span></td>
        <td className="workbench-activity-cell"><div className="workbench-activity-main">
          <span className={`workbench-activity-kind kind-${row.activity.kind}`}>{row.activity.kind === "open" ? "Open" : row.activity.kind === "review" ? "Review" : row.activity.kind === "last" ? "Last" : "—"}</span>
          <span className="workbench-activity-copy"><strong title={row.activity.title}>{row.activity.title}</strong><small>{formatWorkbenchDate(row.activity.date)}</small></span>
          {row.activity.task && <button className="workbench-reschedule" type="button" onClick={() => onSchedule(row)} title="Adjust task schedule" aria-label={`Adjust schedule for ${row.client.name}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16"/><path d="m14.5 14.5 1.5 1.5 3-3"/></svg></button>}
        </div></td>
        <td>{row.openTaskCount}</td>
        <td>{formatWorkbenchDate(row.reviewDate)}</td>
        <td><strong>{formatWorkbenchMoney(row.estimatedValue)}</strong></td>
        <td><div className="workbench-row-actions">
          {row.stage === "Needs Action" && <button className="is-resolve" type="button" onClick={() => onResolve(row.client.id)}>Resolve</button>}
          <button type="button" onClick={() => onOpen(row.client.id)}>Open</button>
          <Link href={reportUrl(row.client.id, row.client.name)}>Report</Link>
          <button className="is-quiet" type="button" onClick={() => onSnooze(row)} title={`Remove ${row.client.name} from Workbench for 90 days`}>Snooze 90d</button>
        </div></td>
      </tr>)}
    </tbody></table>
  </div>;
}
