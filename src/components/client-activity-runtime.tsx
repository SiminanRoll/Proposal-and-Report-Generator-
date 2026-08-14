"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { recalculateDataset } from "@/lib/compass/engine";
import {
  mergeCaptainsLogSyncIntoClient,
  nextBusinessDate,
  syncClientFromCaptainsLog,
  type CaptainsLogActivityItem,
  type CaptainsLogClientSyncResult,
  type CaptainsLogOpenTask,
} from "@/lib/compass/captains-log-bridge";
import { loadRecentCompletedCompanyActivity } from "@/lib/compass/captains-log-company-history";
import { loadSelectedCompanyActivityByIdentity, loadSelectedCompanyActivityByName } from "@/lib/compass/captains-log-current-state";
import { captainsLogRecentStamp, newestCaptainsLogActivity } from "@/lib/compass/captains-log-recent";
import { verifyCaptainsLogTaskConnection, writeCoordinationTaskToCaptainsLog } from "@/lib/compass/captains-log-task-write";
import { loadCompassDataset, saveCompassDataset, useCompassState } from "@/lib/compass/store";
import { tcSalesActivityDate } from "@/lib/compass/tc-sales-activity";
import type { CompassClient, CompassConfig } from "@/lib/compass/types";

function todayDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function activityDate(value: string): string {
  if (!value) return "";
  const raw = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const includeTime = /T\d{2}:\d{2}/.test(value) && !/T00:00(?::00)?(?:\.000)?Z?$/.test(value);
  return new Intl.DateTimeFormat("en-US", includeTime
    ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function activityTitle(item: { title?: string; type?: string; tag?: string }): string {
  return String(item.title || item.tag || item.type || "Activity").trim() || "Activity";
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function completedActivity(item: CaptainsLogActivityItem): boolean {
  const status = String(item.status || "").toLowerCase();
  return Boolean(item.completed_at || ["completed", "done", "closed", "resolved"].includes(status));
}

async function syncCompanyActivity(client: CompassClient): Promise<CaptainsLogClientSyncResult> {
  const storedCompanyId = [...(client.captainsLog?.recentActivity ?? []), ...(client.captainsLog?.openTasks ?? [])]
    .map((item) => item.companyId).find(Boolean) || client.captainsLog?.companyId || client.companyId;
  let sync = await syncClientFromCaptainsLog(client.id, client.name, 9000, client.aliases, storedCompanyId);
  if (!(sync.open_tasks?.length || sync.recent_activity?.length)) {
    const fallback = await loadSelectedCompanyActivityByIdentity(client.name, sync.company_id || storedCompanyId).catch(() => null)
      || await loadSelectedCompanyActivityByName(client.name).catch(() => null);
    if (fallback?.openTasks.length || fallback?.recentActivity.length) {
      sync = {
        ...sync,
        ok: true,
        matched: true,
        company_id: fallback.companyId || sync.company_id || storedCompanyId,
        linked_company: fallback.linkedCompany || client.name,
        match_method: "exact-company-name-fallback",
        match_score: 1,
        open_tasks: fallback.openTasks,
        open_task_count: fallback.openTasks.length,
        has_open_tasks: fallback.openTasks.length > 0,
        recent_activity: fallback.recentActivity,
      };
    }
  }
  // Current-state sync resolves a missing/stale Compass company identity first.
  // Use that canonical UUID for the compatibility ledger read instead of
  // requiring Company Detail to have already persisted it locally.
  const knownTaskIds = [...(client.captainsLog?.openTasks ?? []), ...(client.captainsLog?.recentActivity ?? [])].map((item) => item.id);
  const completedHistory = await loadRecentCompletedCompanyActivity(sync.company_id || client.companyId || "", knownTaskIds, client.name);
  if (!completedHistory.length) return sync;
  return {
    ...sync,
    ok: true,
    matched: true,
    recent_activity: uniqueById([...(sync.recent_activity ?? []), ...completedHistory]),
  };
}

async function persistCompanyActivitySync(clientId: string, sync: CaptainsLogClientSyncResult, config: CompassConfig): Promise<void> {
  if (!sync.matched) return;
  const currentDataset = await loadCompassDataset();
  const currentClient = currentDataset?.clients.find((item) => item.id === clientId);
  if (!currentDataset || !currentClient) return;
  const merged = mergeCaptainsLogSyncIntoClient(currentClient, sync);
  const safeMerged = {
    ...merged,
    lastSalesInteraction: currentClient.lastSalesInteraction,
    technicalConsultant: currentClient.technicalConsultant,
  };
  if (JSON.stringify(safeMerged) === JSON.stringify(currentClient)) return;
  await saveCompassDataset(recalculateDataset({
    ...currentDataset,
    clients: currentDataset.clients.map((item) => item.id === clientId ? safeMerged : item),
  }, config));
}

export function ClientActivityRuntime() {
  const { dataset, config } = useCompassState();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [glanceTarget, setGlanceTarget] = useState<HTMLElement | null>(null);
  const [clientName, setClientName] = useState("");
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskDue, setTaskDue] = useState("");
  const [taskStatus, setTaskStatus] = useState("");
  const [taskSending, setTaskSending] = useState(false);
  const [activitySyncing, setActivitySyncing] = useState(false);
  const [activitySync, setActivitySync] = useState<CaptainsLogClientSyncResult | null>(null);
  const [activityLoadState, setActivityLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [activityDiagnostic, setActivityDiagnostic] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteStatus, setNoteStatus] = useState("");

  const client = useMemo(() => {
    if (!dataset || !clientName) return null;
    const exact = dataset.clients.find((item) => item.name === clientName);
    if (exact) return exact;
    const normalized = clientName.trim().toLowerCase();
    return dataset.clients.find((item) => item.name.trim().toLowerCase() === normalized) ?? null;
  }, [clientName, dataset]);

  useEffect(() => {
    const syncTarget = () => {
      const nextTarget = document.querySelector<HTMLElement>(".client-review-latest-activity-v10941");
      const nextGlance = nextTarget?.closest<HTMLElement>(".client-review-glance-v10941") ?? null;
      const nextName = nextTarget
        ?.closest(".compass-client-review-workspace-v10941")
        ?.querySelector<HTMLElement>("#compass-client-workspace-title")
        ?.textContent?.trim() ?? "";
      setTarget((current) => current === nextTarget ? current : nextTarget);
      setGlanceTarget((current) => current === nextGlance ? current : nextGlance);
      setClientName((current) => current === nextName ? current : nextName);
      if (!nextTarget && taskOpen) setTaskOpen(false);
    };

    syncTarget();
    const timer = window.setInterval(syncTarget, 350);
    return () => window.clearInterval(timer);
  }, [taskOpen]);

  useEffect(() => {
    if (!target) return;
    target.classList.add("is-activity-hub-v1123");
    return () => target.classList.remove("is-activity-hub-v1123");
  }, [target]);

  useEffect(() => {
    setActivitySync(null);
    setActivityLoadState(client ? "loading" : "idle");
    setActivityDiagnostic("");
    setNoteStatus("");
    setNoteDraft(client?.internalNote ?? "");
    if (!client) return;

    let active = true;
    void syncCompanyActivity(client)
      .then((sync) => {
        if (!active) return;
        if (!sync.ok) {
          setActivityLoadState("error");
          setActivityDiagnostic(sync.error || "Captain's Log returned an unsuccessful response.");
          return;
        }
        setActivitySync(sync);
        setActivityLoadState("loaded");
        const shortId = String(sync.company_id || client.companyId || "").slice(-8);
        const completedCount = (sync.recent_activity ?? []).filter(completedActivity).length;
        setActivityDiagnostic(sync.matched
          ? `${sync.linked_company || client.name}${shortId ? ` · …${shortId}` : ""} · ${completedCount} completed row${completedCount === 1 ? "" : "s"}`
          : `No Supabase company link was resolved for ${client.name}.`);
        if (sync.matched) void persistCompanyActivitySync(client.id, sync, config).catch(() => undefined);
      })
      .catch((cause) => {
        if (!active) return;
        setActivityLoadState("error");
        setActivityDiagnostic(cause instanceof Error ? cause.message.slice(0, 180) : "Captain's Log history request failed.");
      });
    return () => { active = false; };
  }, [client?.companyId, client?.id]);

  useEffect(() => {
    if (!taskOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !taskSending) setTaskOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [taskOpen, taskSending]);

  const storedUpcoming: CaptainsLogOpenTask[] = useMemo(() => (client?.captainsLog?.openTasks ?? []).map((item) => ({
    id: item.id,
    type: item.type,
    tag: item.tag,
    title: item.title,
    status: item.status,
    scheduled_at: item.scheduledAt,
    created_at: item.createdAt,
    source: item.source,
    company_id: item.companyId,
  })), [client?.captainsLog?.openTasks]);

  const upcoming = useMemo(() => uniqueById(activitySync ? (activitySync.open_tasks ?? []) : storedUpcoming)
    .sort((a, b) => (a.scheduled_at || "9999-12-31").localeCompare(b.scheduled_at || "9999-12-31") || (b.created_at || "").localeCompare(a.created_at || "")), [activitySync, storedUpcoming]);

  const storedHistory: CaptainsLogActivityItem[] = useMemo(() => (client?.captainsLog?.recentActivity ?? []).map((item) => ({
    id: item.id,
    type: item.type,
    tag: item.tag,
    title: item.title,
    status: item.status,
    scheduled_at: item.scheduledAt,
    completed_at: item.completedAt,
    created_at: item.createdAt,
    source: item.source,
    company_id: item.companyId,
  })), [client?.captainsLog?.recentActivity]);

  const history = useMemo(() => uniqueById([...storedHistory, ...(activitySync?.recent_activity ?? [])]).filter(completedActivity)
    .sort((a, b) => captainsLogRecentStamp(b).localeCompare(captainsLogRecentStamp(a))), [activitySync, storedHistory]);

  const nextActivity = upcoming[0] ?? null;
  const latestHistory = newestCaptainsLogActivity(history);

  const persistActivitySync = async (sync: CaptainsLogClientSyncResult) => {
    if (!client) return;
    await persistCompanyActivitySync(client.id, sync, config);
  };

  const refreshActivity = async () => {
    if (!client || activitySyncing) return;
    setActivitySyncing(true);
    setActivityLoadState("loading");
    try {
      const sync = await syncCompanyActivity(client);
      if (!sync.ok) throw new Error(sync.error || "Activity could not be refreshed.");
      setActivitySync(sync);
      setActivityLoadState("loaded");
      const shortId = String(sync.company_id || client.companyId || "").slice(-8);
      const completedCount = (sync.recent_activity ?? []).filter(completedActivity).length;
      setActivityDiagnostic(sync.matched
        ? `${sync.linked_company || client.name}${shortId ? ` · …${shortId}` : ""} · ${completedCount} completed row${completedCount === 1 ? "" : "s"}`
        : `No Supabase company link was resolved for ${client.name}.`);
      if (sync.matched) await persistActivitySync(sync);
    } catch (cause) {
      setActivityLoadState("error");
      setActivityDiagnostic(cause instanceof Error ? cause.message.slice(0, 180) : "Captain's Log history request failed.");
    } finally {
      setActivitySyncing(false);
    }
  };

  const openTask = () => {
    if (!client) return;
    setTaskDue(client.nextFollowUp?.slice(0, 10) || nextBusinessDate());
    setTaskStatus("");
    setTaskOpen(true);
  };

  const addTask = async () => {
    if (!client || taskSending) return;
    if (!taskDue) {
      setTaskStatus("Choose a due date first.");
      return;
    }

    setTaskSending(true);
    setTaskStatus("Checking connection…");
    try {
      await verifyCaptainsLogTaskConnection();
      const requestId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${client.id}-${taskDue}-${Date.now()}`;
      setTaskStatus("Adding task…");
      const result = await writeCoordinationTaskToCaptainsLog({
        clientId: client.id,
        company: client.name,
        companyId: client.companyId,
        dueDate: taskDue,
        priorityReason: "Added from Client Compass activity",
        requestId,
      });
      if (!result.ok) throw new Error(result.error || "The task could not be added.");
      setTaskStatus("Task added.");
      await refreshActivity();
      window.setTimeout(() => setTaskOpen(false), 650);
    } catch (cause) {
      setTaskStatus(cause instanceof Error ? cause.message : "The task could not be added to Captain's Log.");
    } finally {
      setTaskSending(false);
    }
  };

  const saveCompanyNote = async () => {
    if (!dataset || !client || noteSaving) return;
    const nextNote = noteDraft.trimEnd();
    if (nextNote === client.internalNote) {
      setNoteStatus("Saved");
      return;
    }
    setNoteSaving(true);
    setNoteStatus("Saving…");
    try {
      const nextDataset = {
        ...dataset,
        clients: dataset.clients.map((item) => item.id === client.id ? { ...item, internalNote: nextNote } : item),
      };
      await saveCompassDataset(recalculateDataset(nextDataset, config));
      setNoteStatus("Saved");
    } catch {
      setNoteStatus("Could not save");
    } finally {
      setNoteSaving(false);
    }
  };

  if (!target || !glanceTarget || !client) return null;

  const tcSalesDate = tcSalesActivityDate(client);

  return <>
    {createPortal(<article className="client-review-sales-activity-v1127" aria-label="Last TC sales activity">
      <span>Last sales activity</span>
      <strong>{activityDate(tcSalesDate) || "Not recorded"}</strong>
      <small><b>TC</b>{tcSalesDate ? (client.technicalConsultant || "Not assigned") : "Not assigned"}</small>
    </article>, glanceTarget)}

    {createPortal(<>
      <div className="client-review-activity-summary-v1123">
        <div className="is-next">
          <span>Captain&apos;s Log · Next</span>
          <strong>{nextActivity ? activityTitle(nextActivity) : "Nothing scheduled"}</strong>
          <small>{nextActivity ? (activityDate(nextActivity.scheduled_at) || "Open — no date set") : "No upcoming task on the calendar."}</small>
        </div>
        <div className="is-recent">
          <span>Last completed</span>
          <strong>{latestHistory ? activityTitle(latestHistory) : activityLoadState === "loading" ? "Loading historyâ€¦" : activityLoadState === "error" ? "History unavailable" : "No completed activity"}</strong>
          <small>{latestHistory ? activityDate(captainsLogRecentStamp(latestHistory)) : activityLoadState === "loading" ? "Checking all completed Captain's Log history." : activityLoadState === "error" ? "Refresh to retry the history connection." : "No completed Captain's Log activity found."}</small>
          {!latestHistory && activityLoadState !== "loading" && activityDiagnostic && <small className="client-review-activity-diagnostic-v1168" title={activityDiagnostic}>{activityDiagnostic}</small>}
        </div>
      </div>
      <div className="client-review-activity-actions" aria-label="Captain's Log actions">
        <button className="client-review-activity-action is-add" type="button" onClick={openTask} disabled={taskSending} aria-label="Add upcoming task" title="Add upcoming task">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <button className={`client-review-activity-action is-refresh${activitySyncing ? " is-syncing" : ""}`} type="button" onClick={() => void refreshActivity()} disabled={activitySyncing} aria-label="Refresh Captain's Log" title="Refresh Captain's Log">
          <svg className="client-review-activity-refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19.5 7.5V3.8M19.5 3.8h-3.7"/><path d="M19 9a7.5 7.5 0 1 0 .2 5.4"/></svg>
        </button>
      </div>
    </>, target)}

    {createPortal(<section className="client-review-activity-center-v1123 client-review-notes-only-v1127" aria-label="Company notes">
      <div className="client-review-company-note-v1123">
        <header><div><span>Company notes</span><strong>Quick context</strong></div><small className={noteStatus === "Could not save" ? "is-error" : ""}>{noteStatus}</small></header>
        <textarea value={noteDraft} onChange={(event) => { setNoteDraft(event.target.value); setNoteStatus(""); }} onBlur={() => void saveCompanyNote()} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void saveCompanyNote(); } }} placeholder="Add relationship, planning, or company context…" aria-label={`Company notes for ${client.name}`} />
        <footer><span>Saved with the client record</span><button type="button" disabled={noteSaving || noteDraft.trimEnd() === client.internalNote} onClick={() => void saveCompanyNote()}>{noteSaving ? "Saving…" : "Save"}</button></footer>
      </div>
    </section>, glanceTarget)}

    {taskOpen && createPortal(<div className="client-review-task-backdrop" role="presentation" onMouseDown={() => { if (!taskSending) setTaskOpen(false); }}>
      <section className="client-review-task-modal" role="dialog" aria-modal="true" aria-labelledby="client-review-task-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span>Captain's Log</span><h3 id="client-review-task-title">Add upcoming task</h3></div>
          <button type="button" onClick={() => setTaskOpen(false)} disabled={taskSending} aria-label="Close task dialog">×</button>
        </header>
        <div className="client-review-task-preview"><span>Task</span><strong>{`Coordination Call - ${client.name} - Account Review Priority`}</strong></div>
        <label className="client-review-task-date"><span>Due date</span><div><input type="date" value={taskDue} min={todayDate()} onChange={(event) => { setTaskDue(event.target.value); setTaskStatus(""); }} /></div></label>
        {taskStatus && <div className="client-review-task-status" role="status">{taskStatus}</div>}
        <footer>
          <button className="button secondary" type="button" onClick={() => setTaskOpen(false)} disabled={taskSending}>Cancel</button>
          <button className="button primary" type="button" onClick={() => void addTask()} disabled={taskSending || !taskDue}>{taskSending ? "Adding…" : "Add task"}</button>
        </footer>
      </section>
    </div>, document.body)}
  </>;
}
