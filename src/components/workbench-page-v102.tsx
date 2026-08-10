"use client";

import { useEffect, useMemo, useState } from "react";
import { captainsLogCloudRest } from "@/lib/compass/captains-log-cloud";
import { loadCloudWorkbenchSnoozes, loadCloudWorkbenchStates, saveCloudWorkbenchMembership, saveCloudWorkbenchMemberships, saveCloudWorkbenchSnooze } from "@/lib/compass/workbench-cloud";
import { saveCompassDataset, useCompassState } from "@/lib/compass/store";
import {
  loadWorkbenchState,
  mergeWorkbenchSnoozes,
  saveWorkbenchState,
  snoozeClientInWorkbench,
  WORKBENCH_CHANGED_EVENT,
  WORKBENCH_SNOOZE_DAYS,
  workbenchActionableOpenTaskCount,
  workbenchShouldInclude,
  workbenchStage,
  type WorkbenchSnooze,
} from "@/lib/compass/workbench";
import { CompassClientWorkspace } from "./compass-client-workspace";
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

function sameSnooze(left: WorkbenchSnooze | undefined, right: WorkbenchSnooze): boolean {
  return Boolean(left && left.until === right.until && left.snoozedAt === right.snoozedAt);
}

function cloudTableMissing(cause: unknown, table: string): boolean {
  const message = String(cause instanceof Error ? cause.message : cause || "").toLowerCase();
  return ["404", "42p01", "schema cache", table.toLowerCase()].some((token) => message.includes(token));
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

  useEffect(() => {
    if (!dataset?.clients.length) return;
    let cancelled = false;
    const byCompanyId = new Map(dataset.clients.filter((client) => client.companyId).map((client) => [client.companyId as string, client.id]));

    void Promise.allSettled([loadCloudWorkbenchStates(), loadCloudWorkbenchSnoozes()]).then((results) => {
      if (cancelled) return;
      const current = loadWorkbenchState();
      const membershipResult = results[0];
      const snoozeResult = results[1];

      if (membershipResult.status === "fulfilled") {
        const cloudByCompany = new Map(membershipResult.value.map((row) => [String(row.company_id || ""), row]));
        const nextManual = new Set(current.clientIds);
        const migrateCompanyIds: string[] = [];

        for (const client of dataset.clients) {
          const companyId = String(client.companyId || "");
          if (!companyId) continue;
          const cloud = cloudByCompany.get(companyId);
          if (cloud) {
            if (cloud.manual_included) nextManual.add(client.id);
            else nextManual.delete(client.id);
          } else if (nextManual.has(client.id)) {
            migrateCompanyIds.push(companyId);
          }
        }

        const nextIds = [...nextManual];
        const changed = nextIds.length !== current.clientIds.length || nextIds.some((id) => !current.clientIds.includes(id));
        if (changed) saveWorkbenchState({ ...current, clientIds: nextIds, updatedAt: current.updatedAt });
        setManualIds(nextIds);

        if (migrateCompanyIds.length) {
          void saveCloudWorkbenchMemberships(migrateCompanyIds, true).catch((cause) => {
            if (!cloudTableMissing(cause, "company_workbench_state") && typeof console !== "undefined") console.debug("Workbench membership migration deferred", cause);
          });
        }
      } else if (!cloudTableMissing(membershipResult.reason, "company_workbench_state") && typeof console !== "undefined") {
        console.debug("Workbench membership sync deferred", membershipResult.reason);
      }

      if (snoozeResult.status === "fulfilled") {
        const incoming: Record<string, WorkbenchSnooze> = {};
        for (const row of snoozeResult.value) {
          const clientId = byCompanyId.get(String(row.company_id || ""));
          const until = workbenchDateKey(String(row.snoozed_until || ""));
          if (!clientId || !until || until <= workbenchLocalDate()) continue;
          const next = { until, snoozedAt: String(row.snoozed_at || "") };
          const existing = current.snoozes?.[clientId];
          if (!sameSnooze(existing, next) && (!existing || Date.parse(next.snoozedAt || "0") >= Date.parse(existing.snoozedAt || "0"))) incoming[clientId] = next;
        }
        if (Object.keys(incoming).length) mergeWorkbenchSnoozes(incoming);
      } else if (!cloudTableMissing(snoozeResult.reason, "company_workbench_snoozes") && typeof console !== "undefined") {
        console.debug("Workbench snooze sync deferred", snoozeResult.reason);
      }
    });

    return () => { cancelled = true; };
  }, [dataset]);

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
        const a = workbenchDateTime(left.reviewDate); const b = workbenchDateTime(right.reviewDate);
        if (!a && b) return 1; if (a && !b) return -1;
        return direction * (a - b || left.client.name.localeCompare(right.client.name));
      }
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
    setSortDirection(nextKey === "client" ? "asc" : nextKey === "activity" ? "asc" : "desc");
  };

  const snooze = (row: WorkbenchRow) => {
    const state = snoozeClientInWorkbench(row.client.id, WORKBENCH_SNOOZE_DAYS);
    const until = state.snoozes?.[row.client.id]?.until || "";
    setManualIds(state.clientIds);
    setSnoozes(state.snoozes ?? {});
    setCalendarFocusId((current) => current === row.client.id ? "" : current);
    setSnoozeNotice(`${row.client.name} snoozed until ${formatWorkbenchDate(until)}.`);
    window.setTimeout(() => setSnoozeNotice(""), 3200);
    if (row.client.companyId && until) {
      void Promise.all([
        saveCloudWorkbenchSnooze(row.client.companyId, until),
        saveCloudWorkbenchMembership(row.client.companyId, false),
      ]).catch((cause) => {
        if (typeof console !== "undefined") console.debug("Workbench cloud snooze deferred", row.client.name, cause);
      });
    }
  };

  const beginSchedule = (row: WorkbenchRow) => {
    if (!row.activity.task) return;
    setScheduleEditor({ clientId: row.client.id, clientName: row.client.name, task: row.activity.task });
    setScheduleDate(workbenchDateKey(row.activity.task.scheduledAt) || workbenchLocalDate());
    setScheduleError("");
  };

  const saveSchedule = async () => {
    if (!scheduleEditor || !scheduleDate || !dataset || scheduleSaving) return;
    setScheduleSaving(true);
    setScheduleError("");
    try {
      const now = new Date().toISOString();
      const requestId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${scheduleEditor.task.id}-${Date.now()}`;
      const schedulingClient = dataset.clients.find((client) => client.id === scheduleEditor.clientId);
      const companyId = String(schedulingClient?.companyId || scheduleEditor.task.companyId || "");
      if (scheduleEditor.task.source === "call_mode") {
        const salesTask: Record<string, unknown> = { id: scheduleEditor.task.id, company: scheduleEditor.clientName, due_date: scheduleDate, updated_at: now };
        if (companyId) salesTask.company_id = companyId;
        if (scheduleEditor.task.type) salesTask.action_type = scheduleEditor.task.type;
        if (scheduleEditor.task.tag) salesTask.task_tag = scheduleEditor.task.tag;
        const appEvent: Record<string, unknown> = { event_id: `client_compass_reschedule:${requestId}`, event_type: "call_mode_event", payload: { schema: "call_mode_v1", call_event_type: "task_updated", occurred_at: now, company_id: companyId || undefined, sales_task: salesTask } };
        if (companyId) appEvent.company_id = companyId;
        await captainsLogCloudRest<null>("POST", "app_events", [appEvent], { on_conflict: "event_id" }, "resolution=ignore-duplicates,return=minimal");
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
          company_id: companyId || undefined,
          metadata: { updated_at: now, scheduled_at: scheduleDate, company: scheduleEditor.clientName, company_id: companyId || undefined, source, client_compass_client_id: scheduleEditor.clientId, patch: { scheduled_at: scheduleDate, company: scheduleEditor.clientName, company_id: companyId || undefined, source } },
        }], { on_conflict: "event_id" }, "resolution=ignore-duplicates,return=minimal");
      }

      const nextDataset = {
        ...dataset,
        clients: dataset.clients.map((client) => {
          if (client.id !== scheduleEditor.clientId || !client.captainsLog) return client;
          const openTasks = client.captainsLog.openTasks.map((task) => task.id === scheduleEditor.task.id ? { ...task, scheduledAt: scheduleDate, status: "scheduled", companyId: companyId || task.companyId } : task)
            .sort((left, right) => (left.scheduledAt || "9999").localeCompare(right.scheduledAt || "9999") || right.createdAt.localeCompare(left.createdAt));
          const recentActivity = client.captainsLog.recentActivity.map((item) => item.id === scheduleEditor.task.id && item.status !== "completed" ? { ...item, scheduledAt: scheduleDate, status: "scheduled", companyId: companyId || item.companyId } : item)
            .sort((left, right) => (right.completedAt || right.scheduledAt || right.createdAt).localeCompare(left.completedAt || left.scheduledAt || left.createdAt));
          return { ...client, captainsLog: { ...client.captainsLog, companyId: companyId || client.captainsLog.companyId, openTasks, recentActivity, syncedAt: now } };
        }),
      };
      await saveCompassDataset(nextDataset);
      await refresh();
      setScheduleEditor(null);
    } catch (cause) {
      setScheduleError(cause instanceof Error ? cause.message : "The task schedule could not be updated.");
    } finally {
      setScheduleSaving(false);
    }
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
  </div>;
}
