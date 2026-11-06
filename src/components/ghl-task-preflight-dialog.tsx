"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { createGhlBrowserApi, GhlApiHttpError, localGhlDueToIso } from "@/lib/compass/ghl-browser-api.mjs";
import { GHL_LOCAL_RECOVERY_EVENT } from "@/lib/compass/durable-storage";
import {
  DEFAULT_GHL_TASK_TEMPLATE, GHL_TASK_TEMPLATE_KEY, dueDateForTaskTemplate,
  validateGhlTaskTemplate,
} from "@/lib/compass/ghl-task-template.mjs";
import { saveDurableDatabaseMirrorNow } from "@/lib/compass/durable-storage";
import { GhlLocalConnectionPanel, type LocalGhlConfig } from "./ghl-local-connection-panel";

export type GhlTaskPreviewClient = { clientId: string; companyName: string };
type Props = {
  clients: GhlTaskPreviewClient[];
  onClose: () => void;
};

const LEDGER_KEY = "client-compass.ghl-submission-ledger.v1";


function newRequestId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return "cc-" + crypto.randomUUID();
  return "cc-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}
function readLedger(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(LEDGER_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, string> : {};
  } catch { return {}; }
}
function sameTask(task: { title: string; dueDate?: string | null }, title: string, dueDate: string): boolean {
  const taskMs = Date.parse(task.dueDate || "");
  const wantedMs = Date.parse(dueDate);
  return task.title.trim().toLocaleLowerCase() === title.trim().toLocaleLowerCase() &&
    Number.isFinite(taskMs) && Number.isFinite(wantedMs) &&
    Math.abs(taskMs - wantedMs) <= 60_000;
}
function loadTaskTemplate() {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(GHL_TASK_TEMPLATE_KEY) || "null");
    return validateGhlTaskTemplate(saved) ?? { ...DEFAULT_GHL_TASK_TEMPLATE };
  } catch { return { ...DEFAULT_GHL_TASK_TEMPLATE }; }
}
function taskFailure(error: unknown): string {
  return error instanceof Error ? error.message : "GHL could not complete this request.";
}

/**
 * A single task action. Identity verification, duplicate screening, and GHL
 * readback are kept internal; no manual preflight or confirmation checkbox.
 * No work is sent before the user clicks Add Task.
 */
export function GhlTaskPreflightDialog({ clients, onClose }: Props) {
  const [template, setTemplate] = useState({ ...DEFAULT_GHL_TASK_TEMPLATE });
  const [config, setConfig] = useState<LocalGhlConfig | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [finished, setFinished] = useState(false);
  const requestIds = useRef(new Map<string, string>());
  const locked = useRef(false);

  useEffect(() => {
    const load = () => setTemplate(loadTaskTemplate());
    load();
    window.addEventListener(GHL_LOCAL_RECOVERY_EVENT, load);
    return () => window.removeEventListener(GHL_LOCAL_RECOVERY_EVENT, load);
  }, []);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [busy, onClose]);

  const readyCount = clients.filter((client) => !!links[client.clientId]).length;
  const canSubmit = !busy && !!config?.assigneeId && readyCount === clients.length &&
    clients.length > 0 && !!template.title.trim();

  async function addTasks() {
    if (!canSubmit || !config || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setFinished(false);
    const api = createGhlBrowserApi(config);
    const ledger = readLedger();
    let failure = false;
    let made = 0;

    let dueIso: string;
    // Resolve the reusable due-date rule against the current clock at click time.
    const selected = loadTaskTemplate();
    try {
      const due = dueDateForTaskTemplate(selected);
      dueIso = localGhlDueToIso(due.date, due.time, due.timeZone);
    } catch (cause) {
      setError(taskFailure(cause));
      setBusy(false);
      locked.current = false;
      return;
    }

    try {
      for (const client of clients) {
        const contactId = links[client.clientId];
        if (!contactId) {
          setError("A GHL contact needs to be selected for " + client.companyName + ".");
          failure = true;
          break;
        }
        const title = selected.title.trim() + " - " + client.companyName;
        let requestId = requestIds.current.get(client.clientId);
        if (!requestId) {
          requestId = newRequestId();
          requestIds.current.set(client.clientId, requestId);
        }
        if (ledger[requestId]) {
          setOutcomes((current) => ({ ...current, [client.clientId]: "Already submitted. Check GHL before retrying." }));
          failure = true;
          break;
        }
        // A saved contact ID is only a hint: verify the live GHL record and
        // its current tasks on every submission, immediately before POST.
        let tasks;
        try {
          const verified = await api.verifyCompanyContact(contactId, client.companyName);
          tasks = verified.tasks;
        } catch (cause) {
          setError("Cannot verify " + client.companyName + " in GHL: " + taskFailure(cause));
          failure = true;
          break;
        }
        const exact = tasks.find((task) => !task.completed && sameTask(task, title, dueIso));
        if (exact) {
          setOutcomes((current) => ({ ...current, [client.clientId]: "Already scheduled in GHL." }));
          continue;
        }
        if (tasks.some((task) => (task.body || "").split(/\r?\n/).includes("Client Compass Request ID: " + requestId))) {
          setOutcomes((current) => ({ ...current, [client.clientId]: "Already recorded in GHL." }));
          continue;
        }
        const body = [
          selected.description.trim(),
          "Client Compass Request ID: " + requestId,
          "Client Compass Client ID: " + client.clientId,
          "Client Compass Company: " + client.companyName,
        ].filter(Boolean).join("\n");
        // Persist a no-retry marker before POST. Network timeouts can occur
        // after GHL creates a task, so an unknown response must not resubmit.
        ledger[requestId] = "pending";
        try { localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger)); }
        catch {
          setError("The browser could not save the duplicate-prevention marker. Nothing was sent.");
          failure = true;
          break;
        }
        try {
          const createdId = await api.createContactTask({
            contactId, title, body, dueDate: dueIso, assignedTo: config.assigneeId,
          });
          ledger[requestId] = "created:" + createdId;
          localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
          made++;
          try {
            const read = await api.readContactTasks(contactId);
            const persisted = read.tasks?.some((task) => task.id === createdId &&
              task.title === title &&
              task.assignedTo === config.assigneeId &&
              Date.parse(task.dueDate || "") === Date.parse(dueIso));
            setOutcomes((current) => ({
              ...current, [client.clientId]: persisted ?
                "Added to GHL" : "GHL returned a task ID; open GHL to confirm the details.",
            }));
          } catch {
            setOutcomes((current) => ({
              ...current, [client.clientId]: "GHL returned a task ID; readback is pending.",
            }));
          }
        } catch (cause) {
          if (cause instanceof GhlApiHttpError && cause.isTaskCreate &&
              cause.definitelyRejected) {
            // An explicit 401/403/422 is a failed request, not an uncertain
            // timeout. Permit a new click after the permission is corrected.
            delete ledger[requestId];
            try { localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger)); } catch {}
            setError("GHL did not create this task. " + taskFailure(cause) +
              " Open Settings → Backup & Recovery to update your GHL connection.");
          } else {
            // Unknown network outcome: retain the no-retry marker.
            setError("Task outcome unknown for " + client.companyName +
              ". Check GHL before retrying. " + taskFailure(cause));
          }
          failure = true;
          break;
        }
      }
      try { await saveDurableDatabaseMirrorNow(); } catch { /* Browser ledger remains saved. */ }
    } catch (cause) {
      setError(taskFailure(cause));
      failure = true;
    } finally {
      if (!failure && (made || clients.length)) setFinished(true);
      setBusy(false);
      locked.current = false;
    }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div role="presentation" style={{
      position: "fixed", inset: 0, zIndex: 100000,
      background: "rgba(12,32,56,.58)", display: "flex", justifyContent: "center",
      alignItems: "center", padding: 16,
    }} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="ghl-task-title"
        style={{
          width: "min(600px,100%)", maxHeight: "min(90vh,820px)", overflowY: "auto",
          background: "#fff", color: "#163752", borderRadius: 16, padding: 24,
          boxShadow: "0 24px 70px rgba(0,0,0,.25)",
        }}>
        <header style={{ display: "flex", gap: 14, justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span style={{ color: "#4276ae", fontSize: 12 }}>GoHighLevel task</span>
            <h2 id="ghl-task-title" style={{ margin: "5px 0" }}>Add Task</h2>
            <p style={{ margin: 0, color: "#567087", fontSize: 13 }}>
              {clients.length === 1 ? clients[0].companyName :
                clients.length + " selected clients"}
            </p>
          </div>
          <button type="button" disabled={busy} onClick={onClose} aria-label="Close"
            style={{ background: "#f4f7fb", border: "1px solid #d3e0ec", borderRadius: 8, padding: "6px 12px" }}>
            Close
          </button>
        </header>

        <GhlLocalConnectionPanel clients={clients} onConfig={(next) => {
          setConfig(next);
          setFinished(false);
        }} onLinked={(clientId, contactId) => {
          setLinks((current) => {
            const next = { ...current };
            if (contactId) next[clientId] = contactId;
            else delete next[clientId];
            return next;
          });
        }} />

        {finished ? (
          <div role="status" style={{ marginTop: 18, background: "#ecf8f1", border: "1px solid #bfe2cd", padding: 16, borderRadius: 10 }}>
            <strong>Task request completed</strong>
            <p style={{ margin: "5px 0 0" }}>GHL is the task record of truth.</p>
          </div>
        ) : (
          <div style={{ marginTop: 18, padding: "12px 14px", background: "#f5f9fd", border: "1px solid #d4e2ee", borderRadius: 9 }}>
            <strong style={{ display: "block", fontSize: 14 }}>{template.title}</strong>
            <div style={{ marginTop: 5, color: "#526b83", fontSize: 12 }}>
              Due {template.dueBusinessDays === 0 ? "today" :
                template.dueBusinessDays === 1 ? "next business day" :
                  "in " + template.dueBusinessDays + " business days"} at {template.dueTime} ({template.timeZone.split("/").pop()?.replaceAll("_", " ")})
            </div>
            {template.description && <div style={{ fontSize: 12, color: "#60758a", marginTop: 5 }}>{template.description}</div>}
            <a href="/settings/recovery/" style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: "#1766a6" }}>
              Change task defaults in Settings
            </a>
          </div>
        )}
        {error && <div role="alert" style={{
          marginTop: 14, color: "#9a3f34", background: "#fff2f0",
          padding: 10, borderRadius: 8, fontSize: 13,
        }}>{error}</div>}
        {Object.keys(outcomes).length > 0 && <div style={{ display: "grid", gap: 5, marginTop: 14, fontSize: 13 }}>
          {clients.filter((client) => !!outcomes[client.clientId]).map((client) => (
            <div key={client.clientId}>
              <strong>{client.companyName}:</strong> {outcomes[client.clientId]}
            </div>
          ))}
        </div>}
        <footer style={{ display: "flex", justifyContent: "flex-end", marginTop: 20, gap: 10 }}>
          {finished ? (
            <button type="button" onClick={onClose} style={{
              color: "white", background: "#1766a6", border: 0,
              padding: "10px 19px", borderRadius: 8,
            }}>Done</button>
          ) : (
            <button type="button" onClick={() => void addTasks()} disabled={!canSubmit}
              style={{
                color: "white", background: canSubmit ? "#1766a6" : "#95b4d0",
                border: 0, padding: "11px 22px", borderRadius: 8, fontWeight: 700,
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}>
              {busy ? "Adding…" : clients.length === 1 ? "Add Task" : "Add " + clients.length + " Tasks"}
            </button>
          )}
        </footer>
      </section>
    </div>,
    document.body,
  );
}
