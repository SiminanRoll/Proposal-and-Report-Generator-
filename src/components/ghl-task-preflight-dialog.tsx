"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { prepareGhlTaskIntakeBatch } from "@/lib/compass/ghl-task-intake-preflight.mjs";
import { assessGhlTaskOverlap } from "@/lib/compass/ghl-task-awareness.mjs";
import { createGhlBrowserApi, localGhlDueToIso } from "@/lib/compass/ghl-browser-api.mjs";
import { GhlLocalConnectionPanel, type LocalGhlConfig } from "./ghl-local-connection-panel";
import type { GhlTaskReadbackSnapshot, GhlTaskOverlap } from "@/lib/compass/ghl-task-awareness.mjs";
import type {
  GhlIntakePreflightResult,
  GhlTaskIdentityCandidate,
  GhlTaskIntakeEntry,
} from "@/lib/compass/ghl-task-intake-preflight.mjs";

export type GhlTaskPreviewClient = {
  clientId: string;
  companyName: string;
};

type Props = {
  clients: GhlTaskPreviewClient[];
  onClose: () => void;
  /**
   * Pass only associations independently verified through authenticated GHL
   * readback. A Compass companyId or name is NOT a verified GHL business ID.
   * The static PWA does not verify identities against the private GHL API.
   */
  verifiedIdentityByClientId?: Record<string, GhlTaskIdentityCandidate>;
  /**
   * Only data from the trusted authenticated read adapter may be passed.
   * Missing/stale snapshots must be treated as NOT CHECKED, never zero tasks.
   */
  taskReadbackByClientId?: Record<string, GhlTaskReadbackSnapshot>;
};

const UNVERIFIED_IDENTITY: GhlTaskIdentityCandidate = {
  verified: false,
  businessId: "",
  associatedContacts: [],
};

function describeTaskCounts(overlap: GhlTaskOverlap | undefined): string {
  const c = overlap?.counts;
  return c ? c.scheduled + " scheduled · " + c.overdue + " overdue · " +
    c.unscheduled + " undated · " + c.completed + " completed" : "Not checked";
}

function createPreviewRequestId(): string {
  // Preview IDs never leave the browser. This is not a durable retry ledger.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return "cc-preview-" + crypto.randomUUID();
  }
  return "cc-preview-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

/**
 * Static-only task preparation. This component does not fetch GHL records,
 * submit a webhook, or expose any GHL private API credential. Task requests
 * are submitted through a separate GHL-hosted form when configured.
 */
export function GhlTaskPreflightDialog({ clients, onClose, verifiedIdentityByClientId, taskReadbackByClientId }: Props) {
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [timeZone, setTimeZone] = useState("");
  const [taskTitle, setTaskTitle] = useState("Coordination Call");
  const [taskDetails, setTaskDetails] = useState("");
  const [results, setResults] = useState<GhlIntakePreflightResult[] | null>(null);
  const [localConfig, setLocalConfig] = useState<LocalGhlConfig | null>(null);
  const [verifiedLocally, setVerifiedLocally] = useState<Record<string, GhlTaskIdentityCandidate>>({});
  const [readbacksLocally, setReadbacksLocally] = useState<Record<string, GhlTaskReadbackSnapshot>>({});
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [taskResults, setTaskResults] = useState<Record<string, string>>({});
  const [sendError, setSendError] = useState("");
  const requestIds = useRef(new Map<string, string>());

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const preview = () => {
    const entries: GhlTaskIntakeEntry[] = clients.map((client) => {
      let requestId = requestIds.current.get(client.clientId);
      if (!requestId) {
        requestId = createPreviewRequestId();
        requestIds.current.set(client.clientId, requestId);
      }
      return {
        clientId: client.clientId,
        companyName: client.companyName,
        taskTitle,
        taskDetails,
        dueDate,
        dueTime,
        timeZone,
        ownerName: "Patric Beckman",
        requestId,
        identity: verifiedLocally[client.clientId] ?? verifiedIdentityByClientId?.[client.clientId] ?? UNVERIFIED_IDENTITY,
      };
    });
    setResults(prepareGhlTaskIntakeBatch(entries));
  };
  const preparedCount = results?.filter((result) => result.status === "prepared_not_sent").length ?? 0;
  const checkedCount = clients.filter((client) => assessGhlTaskOverlap(
    readbacksLocally[client.clientId] ?? taskReadbackByClientId?.[client.clientId],
    { clientId: client.clientId, companyName: client.companyName, taskTitle },
  ).status !== "not_checked").length;
  const overlaps = results?.map((result, index) => assessGhlTaskOverlap(
    readbacksLocally[result.clientId] ?? taskReadbackByClientId?.[result.clientId],
    {
      clientId: result.clientId,
      companyName: clients[index]?.companyName ?? "",
      taskTitle,
      requestId: requestIds.current.get(result.clientId) ?? "",
    },
  ));


  async function createVerifiedTasks() {
    if (!localConfig || !localConfig.assigneeId || !confirmCreate || submitting ||
        !results || !results.length || results.some((r) => r.status !== "prepared_not_sent")) return;
    setSubmitting(true);
    setSendError("");
    const ledgerKey = "client-compass.ghl-submission-ledger.v1";
    let ledger: Record<string, string> = {};
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(ledgerKey) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ledger = parsed as Record<string, string>;
    } catch {}
    try {
      const api = createGhlBrowserApi(localConfig);
      for (const result of results) {
        if (result.status !== "prepared_not_sent") continue;
        const client = clients.find((x) => x.clientId === result.clientId);
        if (!client) continue;
        const requestId = result.payload.requestId;
        if (ledger[requestId]) {
          setTaskResults((current) => ({ ...current, [result.clientId]:
            "Already submitted or uncertain locally. Check GHL before creating again." }));
          continue;
        }
        // Read GHL *again* immediately before creating; never trust the old preview snapshot.
        const current = await api.verifyClient({
          clientId: result.clientId,
          companyName: client.companyName,
          businessId: result.businessId,
          selectedContactId: result.contactId,
        });
        if (current.status !== "verified_read" || !current.taskReadback ||
            current.identity?.selectedContactId !== result.contactId) {
          setTaskResults((previous) => ({ ...previous, [result.clientId]:
            "Blocked: company/contact/task readback could not be verified." }));
          setSendError("Stopped: recheck the GHL company/contact association before submitting.");
          break;
        }
        const overlap = assessGhlTaskOverlap(current.taskReadback, {
          clientId: result.clientId, companyName: client.companyName,
          taskTitle, requestId,
        });
        if (overlap.status !== "no_similar_open_tasks_found") {
          setTaskResults((previous) => ({ ...previous, [result.clientId]:
            "Blocked: " + overlap.status.replaceAll("_", " ") }));
          continue;
        }
        let iso: string;
        try { iso = localGhlDueToIso(dueDate, dueTime, timeZone); }
        catch (err) {
          setSendError(err instanceof Error ? err.message : "Invalid due date.");
          break;
        }
        const title = taskTitle.trim() + " - " + client.companyName;
        const body = [
          taskDetails.trim(),
          "Client Compass Request ID: " + requestId,
          "Client Compass Client ID: " + client.clientId,
          "GHL Business ID: " + result.businessId,
        ].filter(Boolean).join("\n");
        // Mark uncertain *before* POST. No automatic retry after a network timeout.
        ledger[requestId] = "pending";
        try { localStorage.setItem(ledgerKey, JSON.stringify(ledger)); }
        catch {
          setSendError("Cannot save local retry guard. Task not submitted.");
          break;
        }
        setTaskResults((previous) => ({ ...previous, [result.clientId]: "Submitting to GHL…" }));
        try {
          const createdTaskId = await api.createContactTask({
            contactId: result.contactId,
            title, body, dueDate: iso,
            assignedTo: localConfig.assigneeId,
          });
          ledger[requestId] = "created:" + createdTaskId;
          localStorage.setItem(ledgerKey, JSON.stringify(ledger));
          // Verify the returned ID on the persisted contact task record.
          try {
            const read = await api.readContactTasks(result.contactId);
            const created = Array.isArray(read?.tasks) ? read.tasks.find((t: {id?: string; title?: string; assignedTo?: string; dueDate?: string}) =>
              t.id === createdTaskId && t.title === title &&
              t.assignedTo === localConfig.assigneeId &&
              Date.parse(t.dueDate || "") === Date.parse(iso)) : null;
            setTaskResults((previous) => ({ ...previous, [result.clientId]: created ?
              "Created and verified in GHL: " + createdTaskId :
              "GHL returned task ID " + createdTaskId + " but readback was not verified. Check GHL." }));
          } catch {
            setTaskResults((previous) => ({ ...previous, [result.clientId]:
              "GHL returned task ID " + createdTaskId + ", but readback failed. Check GHL." }));
          }
        } catch (err) {
          setTaskResults((previous) => ({ ...previous, [result.clientId]:
            "Submission outcome unknown: " + (err instanceof Error ? err.message : "Request failed") }));
          setSendError("Stopped. Check GHL before retrying this request. No automatic retry occurred.");
          break;
        }
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "GHL unavailable. No further requests attempted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="presentation"
      style={{ position: "fixed", inset: 0, zIndex: 100000, background: "rgba(12,32,56,.58)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ghl-preview-title"
        style={{ width: "min(880px,100%)", maxHeight: "min(90vh,860px)", overflow: "auto", padding: 24, borderRadius: 16, background: "#fff", color: "#163752", boxShadow: "0 25px 80px rgba(0,0,0,.28)" }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <span style={{ fontSize: 11, color: "#2467b9", textTransform: "uppercase", fontWeight: 800, letterSpacing: ".08em" }}>GHL · Local API connection</span>
            <h2 id="ghl-preview-title" style={{ margin: "6px 0" }}>Coordination task preflight</h2>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#526b83" }}>{clients.length} client{clients.length === 1 ? "" : "s"} selected. Configure your token locally, verify each contact, and explicitly create tasks in GHL.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close GHL preview" style={{ border: "1px solid #d5e1ec", borderRadius: 8, background: "#f7fafd", padding: "6px 12px", cursor: "pointer" }}>Close</button>
        </header>
        <div role="status" style={{ padding: "12px 14px", border: "1px solid #dae5f0", borderRadius: 10, background: "#f5f9fc", fontSize: 13, lineHeight: 1.55 }}>
          Existing GHL tasks: <strong>{checkedCount ? checkedCount + " of " + clients.length + " clients have a supplied verified readback" : "not checked"}</strong>.
          {checkedCount ? " Task statuses below are contact-scoped, not proof of company-specific ownership." : " Company/contact associations require authenticated GHL verification."}
          Existing task reads come directly from GHL using your locally saved token. Access is limited by your token permissions and GHL browser CORS policy.
        </div>
        <GhlLocalConnectionPanel clients={clients}
          onConfig={(value) => { setLocalConfig(value); setResults(null); }}
          onVerified={(clientId, identity, taskReadback) => {
            setVerifiedLocally((current) => {
              const next = { ...current };
              if (identity) next[clientId] = identity;
              else delete next[clientId];
              return next;
            });
            setReadbacksLocally((current) => {
              const next = { ...current };
              if (taskReadback) next[clientId] = taskReadback;
              else delete next[clientId];
              return next;
            });
            setResults(null);
          }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginTop: 18 }}>
          <label style={{ display: "grid", gap: 5, fontSize: 13 }}>Due date
            <input type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); setResults(null); }} style={{ padding: 9, border: "1px solid #cddae6", borderRadius: 8 }} />
          </label>
          <label style={{ display: "grid", gap: 5, fontSize: 13 }}>Due time (required)
            <input type="time" value={dueTime} onChange={(e) => { setDueTime(e.target.value); setResults(null); }} style={{ padding: 9, border: "1px solid #cddae6", borderRadius: 8 }} />
          </label>
          <label style={{ display: "grid", gap: 5, fontSize: 13 }}>Task timezone
            <select value={timeZone} onChange={(e) => { setTimeZone(e.target.value); setResults(null); }} style={{ padding: 9, border: "1px solid #cddae6", borderRadius: 8 }}>
              <option value="">Select timezone</option>
              <option value="America/Chicago">Central</option>
              <option value="America/New_York">Eastern</option>
              <option value="America/Detroit">Eastern (Detroit)</option>
              <option value="America/Denver">Mountain</option>
              <option value="America/Los_Angeles">Pacific</option>
            </select>
          </label>
        </div>
        <label style={{ display: "grid", gap: 5, fontSize: 13, marginTop: 12 }}>Task title (company name added by GHL)
          <input value={taskTitle} onChange={(e) => { setTaskTitle(e.target.value); setResults(null); }} maxLength={120} style={{ padding: 9, border: "1px solid #cddae6", borderRadius: 8 }} />
        </label>
        <label style={{ display: "grid", gap: 5, fontSize: 13, marginTop: 12 }}>Task details
          <textarea value={taskDetails} onChange={(e) => { setTaskDetails(e.target.value); setResults(null); }} maxLength={2000} rows={3} style={{ padding: 9, border: "1px solid #cddae6", borderRadius: 8, resize: "vertical" }} />
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", margin: "16px 0" }}>
          <button type="button" onClick={preview} disabled={!clients.length} style={{ border: 0, borderRadius: 9, background: "#1966b6", color: "#fff", padding: "11px 18px", fontWeight: 700, cursor: "pointer" }}>Run offline preflight</button>
          <span style={{ fontSize: 12, color: "#657c91" }}>Validates your selected task. It does not create anything until you separately confirm.</span>
        </div>
        {results && (
          <section aria-label="GHL task preflight results">
            <div style={{ fontWeight: 700, margin: "8px 0" }}>{preparedCount} prepared, {results.length - preparedCount} blocked</div>
            <div style={{ overflowX: "auto", border: "1px solid #dbe5ee", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540, fontSize: 13, textAlign: "left" }}>
                <thead><tr style={{ background: "#f1f6fa" }}>
                  <th style={{ padding: 11 }}>Client</th><th style={{ padding: 11 }}>Preflight</th><th style={{ padding: 11 }}>Existing GHL tasks</th><th style={{ padding: 11 }}>Explanation</th>
                </tr></thead>
                <tbody>{results.map((result, index) => (
                  <tr key={result.clientId + "-" + index} style={{ borderTop: "1px solid #e7eef5" }}>
                    <td style={{ padding: 11, fontWeight: 700 }}>{clients[index]?.companyName ?? result.clientId}</td>
                    <td style={{ padding: 11 }}>{result.status === "prepared_not_sent" ? "Prepared, not sent" : "Blocked"}</td>
                    <td style={{ padding: 11, color: "#526b83" }}>{describeTaskCounts(overlaps?.[index])}</td>
                    <td style={{ padding: 11, color: "#526b83" }}>
                      {result.status === "blocked" ? result.detail : "JSON request validated offline; not submitted."}
                      {overlaps?.[index]?.status === "request_already_present" ? " Exact request ID found on an existing task; do not resubmit." :
                       overlaps?.[index]?.status === "possible_overlap" ? " Possible existing coordination task; review before creating another." :
                       overlaps?.[index]?.status === "no_similar_open_tasks_found" ? " No similar open task found in the last verified read; this is not duplicate prevention." :
                       " Existing tasks have not been verified."}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        )}
        {results && <section style={{ marginTop: 16, padding: 14, border: "1px solid #d8e4ee", borderRadius: 9, background: "#f5f9fc" }}>
          <strong>Create tasks directly in GHL</strong>
          <p style={{ margin: "6px 0 10px", fontSize: 12, color: "#526b83" }}>
            Uses your local token, never a published website key. Requires a verified GHL company/contact,
            a fresh task read, contacts.write permission, and Patric's assigned user ID.
            The existing GHL workflow is left untouched.
          </p>
          <label style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={confirmCreate} onChange={(e) => setConfirmCreate(e.target.checked)} />
            I confirm the selected contacts, task details, and due dates and authorize creating these tasks.
          </label>
          <button type="button" onClick={() => void createVerifiedTasks()}
            disabled={!confirmCreate || !localConfig?.assigneeId || submitting ||
              preparedCount === 0 || preparedCount !== results.length}
            style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, border: 0, background: "#1764a6", color: "#fff" }}>
            {submitting ? "Creating tasks…" : "Create " + preparedCount + " task" + (preparedCount === 1 ? "" : "s") + " in GHL"}
          </button>
          {sendError && <p role="alert" style={{ color: "#a13535", fontSize: 12 }}>{sendError}</p>}
          {Object.entries(taskResults).map(([id, value]) => <p role="status" key={id} style={{ fontSize: 12 }}>
            {clients.find((cl) => cl.clientId === id)?.companyName || id}: {value}
          </p>)}
        </section>}
        <footer style={{ borderTop: "1px solid #e2eaf1", paddingTop: 12, marginTop: 18, color: "#607990", fontSize: 12 }}>
          This static app makes browser-direct GHL API calls only after you enter a local token. It does not invoke or change the existing GHL workflow. Cross-device duplicate prevention is not guaranteed. Never repeat an unknown outcome without checking GHL.
        </footer>
      </section>
    </div>,
    document.body,
  );
}
