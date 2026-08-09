"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  coordinationCallTaskTitle,
  nextBusinessDate,
  sendCoordinationCallToCaptainsLogReliable,
} from "@/lib/compass/captains-log-bridge";
import { useCompassState } from "@/lib/compass/store";

function todayDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ClientActivityRuntime() {
  const { dataset } = useCompassState();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [nativeRefresh, setNativeRefresh] = useState<HTMLButtonElement | null>(null);
  const [clientName, setClientName] = useState("");
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskDue, setTaskDue] = useState("");
  const [taskStatus, setTaskStatus] = useState("");
  const [taskSending, setTaskSending] = useState(false);
  const [activitySyncing, setActivitySyncing] = useState(false);
  const syncWatcherRef = useRef<number | null>(null);

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
      const nextRefresh = nextTarget?.querySelector<HTMLButtonElement>(":scope > button") ?? null;
      const nextName = nextTarget
        ?.closest(".compass-client-review-workspace-v10941")
        ?.querySelector<HTMLElement>("#compass-client-workspace-title")
        ?.textContent?.trim() ?? "";
      setTarget((current) => current === nextTarget ? current : nextTarget);
      setNativeRefresh((current) => current === nextRefresh ? current : nextRefresh);
      setClientName((current) => current === nextName ? current : nextName);
      if (!nextTarget && taskOpen) setTaskOpen(false);
    };

    syncTarget();
    const timer = window.setInterval(syncTarget, 350);
    return () => window.clearInterval(timer);
  }, [taskOpen]);

  useEffect(() => () => {
    if (syncWatcherRef.current !== null) window.clearInterval(syncWatcherRef.current);
  }, []);

  useEffect(() => {
    if (!taskOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !taskSending) setTaskOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [taskOpen, taskSending]);

  const stopSyncWatcher = () => {
    if (syncWatcherRef.current !== null) {
      window.clearInterval(syncWatcherRef.current);
      syncWatcherRef.current = null;
    }
    setActivitySyncing(false);
  };

  const refreshActivity = () => {
    if (!nativeRefresh || nativeRefresh.disabled || activitySyncing) return;
    setActivitySyncing(true);
    nativeRefresh.click();
    const started = Date.now();
    if (syncWatcherRef.current !== null) window.clearInterval(syncWatcherRef.current);
    syncWatcherRef.current = window.setInterval(() => {
      if (!document.contains(nativeRefresh) || Date.now() - started > 14000) {
        stopSyncWatcher();
        return;
      }
      if (Date.now() - started > 250 && !nativeRefresh.disabled && !nativeRefresh.classList.contains("is-loading")) stopSyncWatcher();
    }, 100);
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
    setTaskStatus("Adding task…");
    try {
      const requestId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${client.id}-${taskDue}-${Date.now()}`;
      const result = await sendCoordinationCallToCaptainsLogReliable({
        clientId: client.id,
        company: client.name,
        dueDate: taskDue,
        priorityReason: "Added from Client Compass activity",
        requestId,
      }, 9000);
      if (!result.ok) throw new Error(result.error || "The task could not be added.");
      setTaskStatus("Task added. Syncing activity…");
      window.setTimeout(() => refreshActivity(), 40);
      window.setTimeout(() => setTaskOpen(false), 850);
    } catch (cause) {
      setTaskStatus(cause instanceof Error ? cause.message : "The task could not be added to Captain's Log.");
    } finally {
      setTaskSending(false);
    }
  };

  if (!target) return null;

  return <>
    {createPortal(<div className="client-review-activity-actions" aria-label="Activity actions">
      <button className="client-review-activity-action is-add" type="button" onClick={openTask} disabled={!client || taskSending} aria-label="Add upcoming task" title="Add upcoming task">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <button className={`client-review-activity-action is-refresh${activitySyncing ? " is-syncing" : ""}`} type="button" onClick={refreshActivity} disabled={!nativeRefresh || activitySyncing} aria-label="Refresh activity" title="Refresh activity">
        <svg className="client-review-activity-refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19.5 7.5V3.8M19.5 3.8h-3.7"/><path d="M19 9a7.5 7.5 0 1 0 .2 5.4"/></svg>
      </button>
    </div>, target)}

    {taskOpen && client && createPortal(<div className="client-review-task-backdrop" role="presentation" onMouseDown={() => { if (!taskSending) setTaskOpen(false); }}>
      <section className="client-review-task-modal" role="dialog" aria-modal="true" aria-labelledby="client-review-task-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span>Captain's Log</span><h3 id="client-review-task-title">Add upcoming task</h3></div>
          <button type="button" onClick={() => setTaskOpen(false)} disabled={taskSending} aria-label="Close task dialog">×</button>
        </header>
        <div className="client-review-task-preview"><span>Task</span><strong>{coordinationCallTaskTitle(client.name)}</strong></div>
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
