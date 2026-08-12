"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { captainsLogCloudRest } from "@/lib/compass/captains-log-cloud";
import { saveCompassDataset, useCompassState } from "@/lib/compass/store";
import type { CompassCaptainsLogActivity, CompassCaptainsLogTask, CompassClient, CompassClientSummary } from "@/lib/compass/types";
import {
  loadWorkbenchState,
  removeClientFromWorkbench,
  WORKBENCH_CHANGED_EVENT,
  workbenchActionableOpenTaskCount,
  workbenchActionableOpenTasks,
  workbenchStage,
  type WorkbenchStage,
} from "@/lib/compass/workbench";
import { CompassClientWorkspace } from "./compass-client-workspace";
import { WorkbenchReviewResolutionDialog } from "./workbench-review-resolution-dialog";

const STAGES: WorkbenchStage[] = ["Needs Action", "In Progress", "Scheduled", "Completed"];
type StageFilter = WorkbenchStage | "All";
type SortKey = "client" | "stage" | "activity" | "tasks" | "review" | "value";
type SortDirection = "asc" | "desc";
type DateWindow = 14 | 30 | 90 | "all";
type ViewMode = "table" | "calendar";

type WorkbenchActivity = {
  kind: "open" | "last" | "review" | "none";
  title: string;
  date: string;
  task: CompassCaptainsLogTask | null;
};

type WorkbenchRow = {
  client: CompassClient;
  stage: WorkbenchStage;
  manual: boolean;
  activity: WorkbenchActivity;
  openTaskCount: number;
  reviewDate: string;
  estimatedValue: number;
};

type ScheduleEditor = {
  clientId: string;
  clientName: string;
  task: CompassCaptainsLogTask;
};

function formatDate(value: string): string {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function dateTime(value: string): number {
  if (!value) return 0;
  const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateKey(value: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDate(): string {
  return dateKey(new Date().toISOString());
}

function activityMoment(item: CompassCaptainsLogActivity): number {
  return dateTime(item.completedAt || item.scheduledAt || item.createdAt);
}

function primaryOpenTask(client: CompassClient): CompassCaptainsLogTask | null {
  const tasks = [...workbenchActionableOpenTasks(client)];
  tasks.sort((left, right) => {
    const leftScheduled = dateTime(left.scheduledAt);
    const rightScheduled = dateTime(right.scheduledAt);
    if (leftScheduled && rightScheduled) return leftScheduled - rightScheduled;
    if (leftScheduled) return -1;
    if (rightScheduled) return 1;
    return dateTime(right.createdAt) - dateTime(left.createdAt);
  });
  return tasks[0] ?? null;
}

function latestActivity(client: CompassClient): CompassCaptainsLogActivity | null {
  return [...(client.captainsLog?.recentActivity ?? [])].sort((left, right) => activityMoment(right) - activityMoment(left))[0] ?? null;
}

function workbenchReviewSignal(client: CompassClient, summary: CompassClientSummary | undefined): boolean {
  if (summary?.opportunities.some((opportunity) => opportunity.cardCategory === "reviews-due")) return true;
  if (client.recordReviewNeeded) return true;
  return Boolean(
    client.accountReviewStatus
    || client.accountReviewDisposition
    || client.accountReviewCycleResolvedDate
    || client.accountReviewActivityThrough
    || client.accountReviewNextDate
  );
}

function workbenchActivity(client: CompassClient): WorkbenchActivity {
  const openTask = primaryOpenTask(client);
  if (openTask) return { kind: "open", title: openTask.title || openTask.tag || "Open task", date: openTask.scheduledAt || openTask.createdAt, task: openTask };
  const recent = latestActivity(client);
  if (recent) return { kind: "last", title: recent.title || recent.tag || "Client activity", date: recent.completedAt || recent.scheduledAt || recent.createdAt, task: null };

  const reviewStatus = String(client.accountReviewStatus || "").toLowerCase();
  const disposition = String(client.accountReviewDisposition || "").toLowerCase();
  if (reviewStatus === "scheduled" && client.accountReviewNextDate) {
    return { kind: "review", title: "Account review scheduled", date: client.accountReviewNextDate, task: null };
  }
  if (disposition === "client-declined" && client.accountReviewCycleResolvedDate) {
    return { kind: "review", title: "Review cycle declined", date: client.accountReviewCycleResolvedDate, task: null };
  }
  if (disposition === "activity-reviewed" && client.accountReviewActivityThrough) {
    return { kind: "review", title: "Review activity handled", date: client.accountReviewActivityThrough, task: null };
  }

  const reviewDate = client.lastAccountReview || client.reviewOutcome?.reviewedAt || "";
  if (reviewDate) return { kind: "review", title: "Account review completed", date: reviewDate, task: null };
  return { kind: "none", title: "No activity yet", date: "", task: null };
}

function reportUrl(clientId: string, clientName: string): string {
  const params = new URLSearchParams({ type: "client-report", compassClientId: clientId, client: clientName });
  return `/create/?${params.toString()}`;
}

function matchesDateWindow(row: WorkbenchRow, window: DateWindow): boolean {
  if (row.stage === "Needs Action" || row.stage === "Scheduled") return true;
  if (window === "all") return true;
  if (!row.activity.date) return row.stage === "Needs Action";
  const time = dateTime(row.activity.date);
  if (!time) return row.stage === "Needs Action";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();
  const span = window * 24 * 60 * 60 * 1000;
  if (row.activity.kind === "open") return time <= todayTime || time <= todayTime + span;
  return time >= todayTime - span;
}

function sortIndicator(column: SortKey, active: SortKey, direction: SortDirection): string {
  if (column !== active) return "↕";
  return direction === "asc" ? "↑" : "↓";
}

function monthLabel(value: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(value);
}

function moveMonth(value: Date, amount: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1, 12, 0, 0);
}

function calendarDates(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12, 0, 0);
  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() - first.getDay(), 12, 0, 0);
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index, 12, 0, 0));
}

function calendarDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function WorkbenchPage() {
  const { dataset, config, refresh } = useCompassState();
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [stageFilter, setStageFilter] = useState<StageFilter>("All");
  const [query, setQuery] = useState("");
  const [activeClientId, setActiveClientId] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("activity");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [dateWindow, setDateWindow] = useState<DateWindow>(30);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [calendarAnchor, setCalendarAnchor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12, 0, 0));
  const [calendarFocusId, setCalendarFocusId] = useState("");
  const [scheduleEditor, setScheduleEditor] = useState<ScheduleEditor | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [resolutionClientId, setResolutionClientId] = useState("");

  useEffect(() => {
    const sync = () => setManualIds(loadWorkbenchState().clientIds);
    sync();
    window.addEventListener(WORKBENCH_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(WORKBENCH_CHANGED_EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);

  const rows = useMemo<WorkbenchRow[]>(() => {
    if (!dataset) return [];
    const manual = new Set(manualIds);
    const summaryByClient = new Map(dataset.summaries.map((summary) => [summary.clientId, summary]));
    return dataset.clients
      .filter((client) => {
        const summary = summaryByClient.get(client.id);
        return manual.has(client.id)
          || Boolean(client.captainsLog?.openTasks?.length || client.captainsLog?.recentActivity?.length)
          || workbenchReviewSignal(client, summary);
      })
      .map((client) => {
        const summary = summaryByClient.get(client.id);
        return {
          client,
          stage: workbenchStage(client),
          manual: manual.has(client.id),
          activity: workbenchActivity(client),
          openTaskCount: workbenchActionableOpenTaskCount(client),
          reviewDate: client.lastAccountReview || client.reviewOutcome?.reviewedAt || "",
          estimatedValue: summary?.totalEstimatedValue ?? 0,
        };
      });
  }, [dataset, manualIds]);

  const dateScopedRows = useMemo(() => rows.filter((row) => matchesDateWindow(row, dateWindow)), [dateWindow, rows]);

  const calendarMonthRows = useMemo(() => rows.filter((row) => {
    const key = dateKey(row.activity.date);
    return key.startsWith(`${calendarAnchor.getFullYear()}-${String(calendarAnchor.getMonth() + 1).padStart(2, "0")}-`);
  }), [calendarAnchor, rows]);

  const stageCountRows = viewMode === "calendar" ? calendarMonthRows : dateScopedRows;
  const counts = useMemo(() => new Map(STAGES.map((stage) => [stage, stageCountRows.filter((row) => row.stage === stage).length])), [stageCountRows]);

  const queryAndStageRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => (stageFilter === "All" || row.stage === stageFilter) && (!needle || `${row.client.name} ${row.client.primaryContact} ${row.client.city} ${row.client.state} ${row.client.market}`.toLowerCase().includes(needle)));
  }, [query, rows, stageFilter]);

  const tableRows = useMemo(() => {
    const scopedIds = new Set(dateScopedRows.map((row) => row.client.id));
    const built = queryAndStageRows.filter((row) => scopedIds.has(row.client.id));
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...built].sort((left, right) => {
      if (sortKey === "client") return direction * left.client.name.localeCompare(right.client.name);
      if (sortKey === "stage") return direction * (STAGES.indexOf(left.stage) - STAGES.indexOf(right.stage) || left.client.name.localeCompare(right.client.name));
      if (sortKey === "tasks") return direction * (left.openTaskCount - right.openTaskCount || left.client.name.localeCompare(right.client.name));
      if (sortKey === "review") {
        const a = dateTime(left.reviewDate); const b = dateTime(right.reviewDate);
        if (!a && b) return 1; if (a && !b) return -1;
        return direction * (a - b || left.client.name.localeCompare(right.client.name));
      }
      if (sortKey === "value") return direction * (left.estimatedValue - right.estimatedValue || left.client.name.localeCompare(right.client.name));
      const a = dateTime(left.activity.date); const b = dateTime(right.activity.date);
      if (!a && b) return 1; if (a && !b) return -1;
      return direction * (a - b || left.client.name.localeCompare(right.client.name));
    });
  }, [dateScopedRows, queryAndStageRows, sortDirection, sortKey]);

  const calendarRowsByDate = useMemo(() => {
    const map = new Map<string, WorkbenchRow[]>();
    for (const row of queryAndStageRows) {
      const key = dateKey(row.activity.date);
      if (!key) continue;
      const bucket = map.get(key) ?? [];
      bucket.push(row);
      bucket.sort((left, right) => STAGES.indexOf(left.stage) - STAGES.indexOf(right.stage) || left.client.name.localeCompare(right.client.name));
      map.set(key, bucket);
    }
    return map;
  }, [queryAndStageRows]);

  const calendarCells = useMemo(() => calendarDates(calendarAnchor), [calendarAnchor]);
  const calendarFocus = useMemo(() => rows.find((row) => row.client.id === calendarFocusId) ?? null, [calendarFocusId, rows]);

  const remove = (clientId: string) => {
    removeClientFromWorkbench(clientId);
    setManualIds(loadWorkbenchState().clientIds);
  };

  const updateSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) { setSortDirection((current) => current === "asc" ? "desc" : "asc"); return; }
    setSortKey(nextKey);
    setSortDirection(nextKey === "client" ? "asc" : nextKey === "activity" ? "asc" : "desc");
  };

  const sortButton = (column: SortKey, label: string) => <button type="button" className={`workbench-sort${sortKey === column ? " is-active" : ""}`} onClick={() => updateSort(column)}>{label}<span aria-hidden="true">{sortIndicator(column, sortKey, sortDirection)}</span></button>;

  const beginSchedule = (row: WorkbenchRow) => {
    if (!row.activity.task) return;
    setScheduleEditor({ clientId: row.client.id, clientName: row.client.name, task: row.activity.task });
    setScheduleDate(dateKey(row.activity.task.scheduledAt) || localDate());
    setScheduleError("");
  };

  const saveSchedule = async () => {
    if (!scheduleEditor || !scheduleDate || !dataset || scheduleSaving) return;
    setScheduleSaving(true); setScheduleError("");
    try {
      const now = new Date().toISOString();
      const requestId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${scheduleEditor.task.id}-${Date.now()}`;
      if (scheduleEditor.task.source === "call_mode") {
        const salesTask: Record<string, unknown> = { id: scheduleEditor.task.id, company: scheduleEditor.clientName, due_date: scheduleDate, updated_at: now };
        if (scheduleEditor.task.type) salesTask.action_type = scheduleEditor.task.type;
        if (scheduleEditor.task.tag) salesTask.task_tag = scheduleEditor.task.tag;
        await captainsLogCloudRest<null>("POST", "app_events", [{
          event_id: `client_compass_reschedule:${requestId}`,
          event_type: "call_mode_event",
          payload: { schema: "call_mode_v1", call_event_type: "task_updated", occurred_at: now, sales_task: salesTask },
        }], { on_conflict: "event_id" }, "resolution=ignore-duplicates,return=minimal");
      } else {
        const source = scheduleEditor.task.source || "client_compass";
        await captainsLogCloudRest<null>("POST", "task_events", [{
          event_id: `client_compass_reschedule:${requestId}`,
          event_type: "task_scheduled",
          local_task_id: scheduleEditor.task.id,
          task_title: scheduleEditor.task.title,
          tag: scheduleEditor.task.tag,
          parking_lot: false,
          done: false,
          occurred_at: now,
          device_name: "Client Compass",
          metadata: {
            updated_at: now,
            scheduled_at: scheduleDate,
            company: scheduleEditor.clientName,
            source,
            client_compass_client_id: scheduleEditor.clientId,
            patch: { scheduled_at: scheduleDate, company: scheduleEditor.clientName, source },
          },
        }], { on_conflict: "event_id" }, "resolution=ignore-duplicates,return=minimal");
      }

      const nextDataset = {
        ...dataset,
        clients: dataset.clients.map((client) => {
          if (client.id !== scheduleEditor.clientId || !client.captainsLog) return client;
          const openTasks = client.captainsLog.openTasks.map((task) => task.id === scheduleEditor.task.id ? { ...task, scheduledAt: scheduleDate, status: "scheduled" } : task)
            .sort((left, right) => (left.scheduledAt || "9999").localeCompare(right.scheduledAt || "9999") || right.createdAt.localeCompare(left.createdAt));
          const recentActivity = client.captainsLog.recentActivity.map((item) => item.id === scheduleEditor.task.id && item.status !== "completed" ? { ...item, scheduledAt: scheduleDate, status: "scheduled" } : item)
            .sort((left, right) => (right.completedAt || right.scheduledAt || right.createdAt).localeCompare(left.completedAt || left.scheduledAt || left.createdAt));
          return { ...client, captainsLog: { ...client.captainsLog, openTasks, recentActivity, syncedAt: now } };
        }),
      };
      await saveCompassDataset(nextDataset);
      await refresh();
      setScheduleEditor(null);
    } catch (cause) {
      setScheduleError(cause instanceof Error ? cause.message : "The task schedule could not be updated.");
    } finally { setScheduleSaving(false); }
  };

  if (activeClientId && dataset) return <CompassClientWorkspace clientId={activeClientId} dataset={dataset} config={config} onBack={() => setActiveClientId("")} onCloseAll={() => setActiveClientId("")} onDatasetSaved={refresh} />;

  const stageAllCount = stageCountRows.length;
  const todayKey = localDate();

  return <div className="workbench-page">
    <header className="workbench-hero">
      <div><span className="compass-kicker">Active client work</span><h1>Account Review Workbench</h1><p>Your active account review book — organize outreach, scheduling, review-cycle decisions, and completed reviews in one place.</p></div>
      <div className="workbench-total"><strong>{rows.length}</strong><span>in workbench</span></div>
    </header>

    <section className="workbench-stage-strip" aria-label="Workbench stages">
      <button className={stageFilter === "All" ? "is-active" : ""} type="button" onClick={() => setStageFilter("All")}><strong>{stageAllCount}</strong><span>All</span></button>
      {STAGES.map((stage) => <button key={stage} className={stageFilter === stage ? "is-active" : ""} type="button" onClick={() => setStageFilter(stage)}><strong>{counts.get(stage) ?? 0}</strong><span>{stage}</span></button>)}
    </section>

    <section className="workbench-panel">
      <div className="workbench-toolbar">
        <div><span className="compass-kicker">Current focus</span><h2>{viewMode === "calendar" ? monthLabel(calendarAnchor) : stageFilter === "All" ? "Workbench clients" : stageFilter}</h2></div>
        <div className="workbench-toolbar-controls">
          <div className="workbench-view-toggle" role="group" aria-label="Workbench view"><button className={viewMode === "table" ? "is-active" : ""} type="button" onClick={() => setViewMode("table")}>List</button><button className={viewMode === "calendar" ? "is-active" : ""} type="button" onClick={() => setViewMode("calendar")}>Calendar</button></div>
          {viewMode === "table" && <label className="workbench-date-window"><span>Date window</span><select value={String(dateWindow)} onChange={(event) => setDateWindow(event.target.value === "all" ? "all" : Number(event.target.value) as DateWindow)}><option value="14">14 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="all">All dates</option></select></label>}
          <label className="workbench-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workbench" /></label>
        </div>
      </div>

      {viewMode === "table" ? tableRows.length ? <div className="workbench-table-wrap"><table className="workbench-table"><thead><tr><th>{sortButton("client", "Client")}</th><th>{sortButton("stage", "Stage")}</th><th>{sortButton("activity", "Latest activity")}</th><th>{sortButton("tasks", "Open tasks")}</th><th>{sortButton("review", "Last review")}</th><th>{sortButton("value", "Est. need")}</th><th>Actions</th></tr></thead><tbody>
        {tableRows.map((row) => <tr key={row.client.id}>
          <td><strong>{row.client.name}</strong><small>{row.client.city}{row.client.state ? `${row.client.city ? ", " : ""}${row.client.state}` : ""}</small></td>
          <td><span className={`workbench-stage stage-${row.stage.toLowerCase().replace(/\s+/g, "-")}`}>{row.stage}</span></td>
          <td className="workbench-activity-cell"><div className="workbench-activity-main"><span className={`workbench-activity-kind kind-${row.activity.kind}`}>{row.activity.kind === "open" ? "Open" : row.activity.kind === "review" ? "Review" : row.activity.kind === "last" ? "Last" : "—"}</span><span className="workbench-activity-copy"><strong title={row.activity.title}>{row.activity.title}</strong><small>{formatDate(row.activity.date)}</small></span>{row.activity.task && <button className="workbench-reschedule" type="button" onClick={() => beginSchedule(row)} title="Adjust task schedule" aria-label={`Adjust schedule for ${row.client.name}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16"/><path d="m14.5 14.5 1.5 1.5 3-3"/></svg></button>}</div></td>
          <td>{row.openTaskCount}</td>
          <td>{formatDate(row.reviewDate)}</td>
          <td><strong>{formatMoney(row.estimatedValue)}</strong></td>
          <td><div className="workbench-row-actions">{row.stage === "Needs Action" && <button className="is-resolve" type="button" onClick={() => setResolutionClientId(row.client.id)}>Resolve</button>}<button type="button" onClick={() => setActiveClientId(row.client.id)}>Open</button><Link href={reportUrl(row.client.id, row.client.name)}>Report</Link>{row.manual && <button className="is-quiet" type="button" onClick={() => remove(row.client.id)}>Remove</button>}</div></td>
        </tr>)}
      </tbody></table></div> : <div className="workbench-empty"><strong>No clients in this view.</strong><span>Broaden the date window, change the stage, or add clients from another Compass list.</span></div> : <div className="workbench-calendar-shell">
        <div className="workbench-calendar-controls"><button type="button" onClick={() => setCalendarAnchor((current) => moveMonth(current, -1))} aria-label="Previous month">‹</button><strong>{monthLabel(calendarAnchor)}</strong><button type="button" onClick={() => setCalendarAnchor(new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12, 0, 0))}>Today</button><button type="button" onClick={() => setCalendarAnchor((current) => moveMonth(current, 1))} aria-label="Next month">›</button></div>
        <div className="workbench-calendar-wrap"><div className="workbench-calendar-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div className="workbench-calendar-grid">{calendarCells.map((date) => {
          const key = calendarDateKey(date); const dayRows = calendarRowsByDate.get(key) ?? []; const outside = date.getMonth() !== calendarAnchor.getMonth();
          return <div key={key} className={`workbench-calendar-day${outside ? " is-outside" : ""}${key === todayKey ? " is-today" : ""}`}><div className="workbench-calendar-day-head"><span>{date.getDate()}</span>{dayRows.length > 0 && <b>{dayRows.length}</b>}</div><div className="workbench-calendar-events">{dayRows.slice(0, 4).map((row) => <button key={row.client.id} type="button" className={`workbench-calendar-event stage-${row.stage.toLowerCase().replace(/\s+/g, "-")}${calendarFocusId === row.client.id ? " is-active" : ""}`} onClick={() => setCalendarFocusId(row.client.id)} title={`${row.client.name}: ${row.activity.title}`}><strong>{row.client.name}</strong><small>{row.activity.kind === "open" ? "Open" : "Last"} · {row.activity.title}</small></button>)}{dayRows.length > 4 && <span className="workbench-calendar-more">+{dayRows.length - 4} more</span>}</div></div>;
        })}</div></div>
        {calendarFocus && <div className="workbench-calendar-focus"><div><span className={`workbench-stage stage-${calendarFocus.stage.toLowerCase().replace(/\s+/g, "-")}`}>{calendarFocus.stage}</span><strong>{calendarFocus.client.name}</strong><small>{calendarFocus.activity.title} · {formatDate(calendarFocus.activity.date)}</small></div><div>{calendarFocus.stage === "Needs Action" && <button className="is-resolve" type="button" onClick={() => setResolutionClientId(calendarFocus.client.id)}>Resolve</button>}{calendarFocus.activity.task && <button type="button" onClick={() => beginSchedule(calendarFocus)}>Adjust date</button>}<button type="button" onClick={() => setActiveClientId(calendarFocus.client.id)}>Open client</button></div></div>}
      </div>}
    </section>

    {scheduleEditor && <div className="workbench-schedule-backdrop" role="presentation" onMouseDown={() => { if (!scheduleSaving) setScheduleEditor(null); }}><section className="workbench-schedule-dialog" role="dialog" aria-modal="true" aria-labelledby="workbench-schedule-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="compass-kicker">Adjust schedule</span><h3 id="workbench-schedule-title">{scheduleEditor.clientName}</h3></div><button type="button" onClick={() => setScheduleEditor(null)} disabled={scheduleSaving} aria-label="Close schedule editor">×</button></header><div className="workbench-schedule-task"><span>Open activity</span><strong>{scheduleEditor.task.title || scheduleEditor.task.tag || "Task"}</strong></div><label><span>Scheduled date</span><input type="date" value={scheduleDate} onChange={(event) => { setScheduleDate(event.target.value); setScheduleError(""); }} /></label>{scheduleError && <div className="workbench-schedule-error" role="alert">{scheduleError}</div>}<footer><button type="button" onClick={() => setScheduleEditor(null)} disabled={scheduleSaving}>Cancel</button><button className="is-primary" type="button" onClick={() => void saveSchedule()} disabled={scheduleSaving || !scheduleDate}>{scheduleSaving ? "Saving…" : "Save date"}</button></footer></section></div>}
    {resolutionClientId && <WorkbenchReviewResolutionDialog clientId={resolutionClientId} onClose={() => setResolutionClientId("")} />}
  </div>;
}
