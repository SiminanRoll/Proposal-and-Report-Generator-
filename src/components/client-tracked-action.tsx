"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import {
  coordinationCallTaskTitle,
  mergeCaptainsLogSyncIntoClient,
  nextBusinessDate,
  type CaptainsLogBridgeResult,
  type CaptainsLogClientSyncResult,
} from "@/lib/compass/captains-log-bridge";
import { queueCaptainsLogTask } from "@/lib/compass/captains-log-task-outbox";
import {
  writeCoordinationTaskToCaptainsLog,
  type CaptainsLogTaskWriteRequest,
} from "@/lib/compass/captains-log-task-write";
import { loadCompassDataset, saveCompassDataset } from "@/lib/compass/store";

const NETWORK_RETRY_DELAYS_MS = [350, 900] as const;

function localDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause || "");
}

function isNetworkFetchFailure(cause: unknown): boolean {
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(errorMessage(cause));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function sendCoordinationCallWithRetry(request: CaptainsLogTaskWriteRequest): Promise<CaptainsLogBridgeResult> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= NETWORK_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      // Keep the same requestId across attempts. The Supabase event write is
      // idempotent on event_id, so a dropped response cannot create duplicate tasks.
      return await writeCoordinationTaskToCaptainsLog(request);
    } catch (cause) {
      lastError = cause;
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (!isNetworkFetchFailure(cause) || offline || attempt >= NETWORK_RETRY_DELAYS_MS.length) throw cause;
      await wait(NETWORK_RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("The outreach task could not be added.");
}

function fallbackSync(clientId: string, company: string, taskId: string, dueDate: string, companyId = "", pending = false): CaptainsLogClientSyncResult {
  const now = new Date().toISOString();
  return {
    ok: true,
    client_id: clientId,
    company_id: companyId || undefined,
    requested_company: company,
    matched: true,
    linked_company: company,
    has_open_tasks: true,
    open_task_count: 1,
    open_tasks: [{
      id: taskId,
      type: "Task",
      tag: "Client Coordination",
      title: coordinationCallTaskTitle(company),
      status: "scheduled",
      scheduled_at: dueDate,
      created_at: now,
      source: pending ? "client_compass_pending" : "client_compass",
      company_id: companyId || undefined,
    }],
    recent_activity: [],
    synced_at: now,
  };
}

export function ClientTrackedAction({
  clientId,
  clientName,
  tracked,
  nextFollowUp = "",
}: {
  clientId: string;
  clientName: string;
  tracked: boolean;
  nextFollowUp?: string;
}) {
  const [optimisticTracked, setOptimisticTracked] = useState(tracked);
  const [open, setOpen] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => { setOptimisticTracked(tracked); }, [tracked]);

  const openTask = () => {
    if (optimisticTracked) return;
    const today = localDate();
    const preferred = nextFollowUp.slice(0, 10);
    setDueDate(preferred && preferred >= today ? preferred : nextBusinessDate());
    setStatus("");
    setOpen(true);
  };

  const addTask = async () => {
    if (sending || !dueDate) return;
    setSending(true);
    setStatus("Adding to outreach…");
    const requestId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${clientId}-${dueDate}-${Date.now()}`;
    let dataset = await loadCompassDataset();
    const currentClient = dataset?.clients.find((item) => item.id === clientId);
    const companyId = currentClient?.companyId || currentClient?.captainsLog?.companyId || "";
    const request: CaptainsLogTaskWriteRequest = {
      clientId,
      company: clientName,
      companyId,
      dueDate,
      priorityReason: "Hot add from Client Compass client list",
      requestId,
    };

    try {
      const result = await sendCoordinationCallWithRetry(request);
      if (!result.ok) throw new Error(result.error || "The outreach task could not be added.");

      dataset = dataset ?? await loadCompassDataset();
      if (dataset) {
        const sync = result.sync ?? fallbackSync(clientId, clientName, result.task_id || requestId, dueDate, result.company_id || companyId);
        const nextDataset = {
          ...dataset,
          clients: dataset.clients.map((item) => item.id === clientId ? mergeCaptainsLogSyncIntoClient(item, sync) : item),
        };
        await saveCompassDataset(nextDataset);
      }
      setOptimisticTracked(true);
      setStatus("Added to Captain's Log.");
      window.setTimeout(() => setOpen(false), 520);
    } catch (cause) {
      if (isNetworkFetchFailure(cause)) {
        queueCaptainsLogTask(request);
        dataset = dataset ?? await loadCompassDataset();
        if (dataset) {
          const pendingSync = fallbackSync(clientId, clientName, `client-compass-${requestId}`, dueDate, companyId, true);
          await saveCompassDataset({
            ...dataset,
            clients: dataset.clients.map((item) => item.id === clientId ? mergeCaptainsLogSyncIntoClient(item, pendingSync) : item),
          });
        }
        setOptimisticTracked(true);
        setStatus("Saved locally. It will sync to Captain's Log automatically when the cloud connection is available.");
        window.setTimeout(() => setOpen(false), 1100);
      } else {
        setStatus(cause instanceof Error ? cause.message : "The outreach task could not be added to Captain's Log.");
      }
    } finally {
      setSending(false);
    }
  };

  return <>
    {optimisticTracked ? (
      <span className="client-tracked-action is-tracked" role="img" aria-label={`${clientName} is tracked in Captain's Log`} title="Tracked in Captain's Log">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6.5 12.5 3.2 3.2 7.8-8" /></svg>
      </span>
    ) : (
      <button className="client-tracked-action is-add" type="button" onClick={openTask} aria-label={`Add outreach task for ${clientName}`} title="Add outreach task">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    )}

    {open && createPortal(
      <div className="client-review-task-backdrop" role="presentation" onMouseDown={() => { if (!sending) setOpen(false); }}>
        <section className="client-review-task-modal" role="dialog" aria-modal="true" aria-labelledby={`tracked-task-${clientId}`} onMouseDown={(event) => event.stopPropagation()}>
          <header>
            <div><span>Captain's Log</span><h3 id={`tracked-task-${clientId}`}>Add outreach task</h3></div>
            <button type="button" onClick={() => setOpen(false)} disabled={sending} aria-label="Close task dialog">×</button>
          </header>
          <div className="client-review-task-preview"><span>Task</span><strong>{coordinationCallTaskTitle(clientName)}</strong></div>
          <label className="client-review-task-date"><span>Due date</span><div><input type="date" value={dueDate} min={localDate()} onChange={(event) => { setDueDate(event.target.value); setStatus(""); }} /></div></label>
          {status && <div className="client-review-task-status" role="status">{status}</div>}
          <footer>
            <button className="button secondary" type="button" onClick={() => setOpen(false)} disabled={sending}>Cancel</button>
            <button className="button primary" type="button" onClick={() => void addTask()} disabled={sending || !dueDate}>{sending ? "Adding…" : "Add task"}</button>
          </footer>
        </section>
      </div>,
      document.body,
    )}
  </>;
}
