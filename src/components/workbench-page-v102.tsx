"use client";

import { useEffect, useMemo, useState } from "react";
import { useCompassState } from "@/lib/compass/store";
import {
  loadWorkbenchState,
  snoozeClientInWorkbench,
  WORKBENCH_CHANGED_EVENT,
  WORKBENCH_SNOOZE_DAYS,
  workbenchActionableOpenTaskCount,
  workbenchShouldInclude,
  workbenchStage,
  type WorkbenchSnooze,
} from "@/lib/compass/workbench";
import { CompassClientWorkspace } from "./compass-client-workspace";
import { GhlTaskPreflightDialog } from "./ghl-task-preflight-dialog";
import { WorkbenchReviewResolutionDialog } from "./workbench-review-resolution-dialog";
import { WorkbenchV102Calendar } from "./workbench-v102-calendar";
import { WorkbenchV102List } from "./workbench-v102-list";
import { WorkbenchV102ScheduleDialog } from "./workbench-v102-schedule";
import {
  STAGES,
  calendarDateKey,
  formatWorkbenchDate,
  matchesWorkbenchDateWindow,
  monthLabel,
  moveMonth,
  workbenchDateKey,
  workbenchDateTime,
  workbenchLocalDate,
  workbenchRowActivity,
  type DateWindow,
  type ScheduleEditor,
  type SortDirection,
  type SortKey,
  type StageFilter,
  type ViewMode,
  type WorkbenchRow,
} from "./workbench-v102-model";

function textCompare(left: string | undefined, right: string | undefined, direction: SortDirection): number {
  const a = String(left || "").trim(); const b = String(right || "").trim();
  if (!a && b) return 1; if (a && !b) return -1;
  const dir = direction === "asc" ? 1 : -1;
  return dir * a.localeCompare(b, undefined, { sensitivity: "base" });
}

export function WorkbenchPageV102() {
  const { dataset, config, refresh } = useCompassState();
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [snoozes, setSnoozes] = useState<Record<string, WorkbenchSnooze>>({});
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
  const [snoozeNotice, setSnoozeNotice] = useState("");
  const [ghlPreviewOpen, setGhlPreviewOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const state = loadWorkbenchState();
      setManualIds(state.clientIds);
      setSnoozes(state.snoozes ?? {});
    };
    sync();
    window.addEventListener(WORKBENCH_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(WORKBENCH_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);


  const rows = useMemo<WorkbenchRow[]>(() => {
    if (!dataset) return [];
    const manual = new Set(manualIds);
    const summaryByClient = new Map(dataset.summaries.map((summary) => [summary.clientId, summary]));
    return dataset.clients
      .filter((client) => workbenchShouldInclude(client, manual.has(client.id), snoozes[client.id]))
      .map((client) => {
        const isManual = manual.has(client.id);
        const summary = summaryByClient.get(client.id);
        return {
          client,
          stage: workbenchStage(client, isManual),
          manual: isManual,
          activity: workbenchRowActivity(client),
          openTaskCount: workbenchActionableOpenTaskCount(client),
          reviewDate: client.lastAccountReview || client.reviewOutcome?.reviewedAt || "",
          estimatedValue: summary?.totalEstimatedValue ?? 0,
        };
      });
  }, [dataset, manualIds, snoozes]);

  const dateScopedRows = useMemo(() => rows.filter((row) => matchesWorkbenchDateWindow(row, dateWindow)), [dateWindow, rows]);
  const calendarMonthRows = useMemo(() => rows.filter((row) => workbenchDateKey(row.activity.date).startsWith(`${calendarAnchor.getFullYear()}-${String(calendarAnchor.getMonth() + 1).padStart(2, "0")}-`)), [calendarAnchor, rows]);
  const stageCountRows = viewMode === "calendar" ? calendarMonthRows : dateScopedRows;
  const counts = useMemo(() => new Map(STAGES.map((stage) => [stage, stageCountRows.filter((row) => row.stage === stage).length])), [stageCountRows]);

  const queryAndStageRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => (stageFilter === "All" || row.stage === stageFilter) && (!needle || `${row.client.name} ${row.client.primaryContact} ${row.client.city} ${row.client.state} ${row.client.market} ${row.client.technicalConsultant || ""} ${row.client.lastSalesInteraction}`.toLowerCase().includes(needle)));
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
        const a = workbenchDateTime(left.reviewDate); const b = workbenchDateTime(right.reviewDate);
        if (!a && b) return sortDirection === "asc" ? -1 : 1; if (a && !b) return sortDirection === "asc" ? 1 : -1;
        return direction * (a - b || left.client.name.localeCompare(right.client.name));
      }
      if (sortKey === "salesActivity") {
        const a = workbenchDateTime(left.client.lastSalesInteraction); const b = workbenchDateTime(right.client.lastSalesInteraction);
        if (!a && b) return sortDirection === "asc" ? -1 : 1; if (a && !b) return sortDirection === "asc" ? 1 : -1;
        return direction * (a - b || left.client.name.localeCompare(right.client.name));
      }
      if (sortKey === "technicalConsultant") return textCompare(left.client.technicalConsultant, right.client.technicalConsultant, sortDirection) || left.client.name.localeCompare(right.client.name);
      if (sortKey === "value") return direction * (left.estimatedValue - right.estimatedValue || left.client.name.localeCompare(right.client.name));
      const a = workbenchDateTime(left.activity.date); const b = workbenchDateTime(right.activity.date);
      if (!a && b) return 1; if (a && !b) return -1;
      return direction * (a - b || left.client.name.localeCompare(right.client.name));
    });
  }, [dateScopedRows, queryAndStageRows, sortDirection, sortKey]);

  const calendarRowsByDate = useMemo(() => {
    const map = new Map<string, WorkbenchRow[]>();
    for (const row of queryAndStageRows) {
      const key = workbenchDateKey(row.activity.date);
      if (!key) continue;
      const bucket = map.get(key) ?? [];
      bucket.push(row);
      bucket.sort((left, right) => STAGES.indexOf(left.stage) - STAGES.indexOf(right.stage) || left.client.name.localeCompare(right.client.name));
      map.set(key, bucket);
    }
    return map;
  }, [queryAndStageRows]);

  const calendarFocus = useMemo(() => rows.find((row) => row.client.id === calendarFocusId) ?? null, [calendarFocusId, rows]);

  const updateSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "client" || nextKey === "activity" || nextKey === "salesActivity" || nextKey === "technicalConsultant" ? "asc" : "desc");
  };

  const snooze = (row: WorkbenchRow) => {
    const state = snoozeClientInWorkbench(row.client.id, WORKBENCH_SNOOZE_DAYS);
    const until = state.snoozes?.[row.client.id]?.until || "";
    setManualIds(state.clientIds);
    setSnoozes(state.snoozes ?? {});
    setCalendarFocusId((current) => current === row.client.id ? "" : current);
    setSnoozeNotice(`${row.client.name} snoozed until ${formatWorkbenchDate(until)}.`);
    window.setTimeout(() => setSnoozeNotice(""), 3200);
  };

  const beginSchedule = (row: WorkbenchRow) => {
    if (!row.activity.task) return;
    setScheduleEditor({ clientId: row.client.id, clientName: row.client.name, task: row.activity.task });
    setScheduleDate(workbenchDateKey(row.activity.task.scheduledAt) || workbenchLocalDate());
    setScheduleError("");
  };

  // The previous handler wrote Captain's Log/Supabase task_events.
  // GHL task rescheduling requires its own verified workflow/API contract;
  // never pretend a local-only schedule edit changed an actual GHL task.
  const saveSchedule = async () => {
    setScheduleError("This task can only be rescheduled in GHL until the GHL update path is verified. Nothing was changed.");
  };

  if (activeClientId && dataset) return <CompassClientWorkspace clientId={activeClientId} dataset={dataset} config={config} onBack={() => setActiveClientId("")} onCloseAll={() => setActiveClientId("")} onDatasetSaved={refresh} />;

  const stageAllCount = stageCountRows.length;
  const todayKey = workbenchLocalDate();

  return <div className="workbench-page">
    <header className="workbench-hero">
      <div><span className="compass-kicker">Active client work</span><h1>Account Review Workbench</h1><p>Your active annual review cycles — due accounts, review outreach in motion, scheduled reviews, and recently resolved work.</p></div>
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
          <button className="workbench-bulk-action" type="button" disabled={!tableRows.length} onClick={() => setGhlPreviewOpen(true)}>Review existing GHL tasks</button>
          <div className="workbench-view-toggle" role="group" aria-label="Workbench view"><button className={viewMode === "table" ? "is-active" : ""} type="button" onClick={() => setViewMode("table")}>List</button><button className={viewMode === "calendar" ? "is-active" : ""} type="button" onClick={() => setViewMode("calendar")}>Calendar</button></div>
          {viewMode === "table" && <label className="workbench-date-window"><span>Date window</span><select value={String(dateWindow)} onChange={(event) => setDateWindow(event.target.value === "all" ? "all" : Number(event.target.value) as DateWindow)}><option value="14">14 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="all">All dates</option></select></label>}
          <label className="workbench-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workbench" /></label>
        </div>
      </div>

      {viewMode === "table" ? <WorkbenchV102List rows={tableRows} sortKey={sortKey} sortDirection={sortDirection} onSort={updateSort} onSchedule={beginSchedule} onResolve={setResolutionClientId} onOpen={setActiveClientId} onSnooze={snooze} /> : <WorkbenchV102Calendar anchor={calendarAnchor} rowsByDate={calendarRowsByDate} focus={calendarFocus} focusId={calendarFocusId} todayKey={todayKey} onFocus={setCalendarFocusId} onPreviousMonth={() => setCalendarAnchor((current) => moveMonth(current, -1))} onToday={() => setCalendarAnchor(new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12, 0, 0))} onNextMonth={() => setCalendarAnchor((current) => moveMonth(current, 1))} onSchedule={beginSchedule} onResolve={setResolutionClientId} onOpen={setActiveClientId} onSnooze={snooze} />}
    </section>

    {snoozeNotice && <div className="workbench-toast" role="status">{snoozeNotice}</div>}
    {scheduleEditor && <WorkbenchV102ScheduleDialog editor={scheduleEditor} date={scheduleDate} error={scheduleError} saving={scheduleSaving} onDate={(value) => { setScheduleDate(value); setScheduleError(""); }} onClose={() => setScheduleEditor(null)} onSave={() => void saveSchedule()} />}
    {resolutionClientId && <WorkbenchReviewResolutionDialog clientId={resolutionClientId} onClose={() => setResolutionClientId("")} />}
    {ghlPreviewOpen && <GhlTaskPreflightDialog clients={tableRows.map((row) => ({ clientId: row.client.id, companyName: row.client.name }))} onClose={() => setGhlPreviewOpen(false)} />}
  </div>;
}
