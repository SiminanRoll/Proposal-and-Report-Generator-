"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { prepareGhlTaskIntakeBatch } from "@/lib/compass/ghl-task-intake-preflight.mjs";
import { assessGhlTaskOverlap } from "@/lib/compass/ghl-task-awareness.mjs";
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
        identity: verifiedIdentityByClientId?.[client.clientId] ?? UNVERIFIED_IDENTITY,
      };
    });
    setResults(prepareGhlTaskIntakeBatch(entries));
  };
  const preparedCount = results?.filter((result) => result.status === "prepared_not_sent").length ?? 0;
  const checkedCount = clients.filter((client) => assessGhlTaskOverlap(
    taskReadbackByClientId?.[client.clientId],
    { clientId: client.clientId, companyName: client.companyName, taskTitle },
  ).status !== "not_checked").length;
  const overlaps = results?.map((result, index) => assessGhlTaskOverlap(
    taskReadbackByClientId?.[result.clientId],
    {
      clientId: result.clientId,
      companyName: clients[index]?.companyName ?? "",
      taskTitle,
      requestId: requestIds.current.get(result.clientId) ?? "",
    },
  ));

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
            <span style={{ fontSize: 11, color: "#2467b9", textTransform: "uppercase", fontWeight: 800, letterSpacing: ".08em" }}>GHL · Static task preparation</span>
            <h2 id="ghl-preview-title" style={{ margin: "6px 0" }}>Coordination task preflight</h2>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#526b83" }}>{clients.length} client{clients.length === 1 ? "" : "s"} selected. This preview never changes GHL; a GHL-hosted form handles task requests.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close GHL preview" style={{ border: "1px solid #d5e1ec", borderRadius: 8, background: "#f7fafd", padding: "6px 12px", cursor: "pointer" }}>Close</button>
        </header>
        <div role="status" style={{ padding: "12px 14px", border: "1px solid #dae5f0", borderRadius: 10, background: "#f5f9fc", fontSize: 13, lineHeight: 1.55 }}>
          Existing GHL tasks: <strong>{checkedCount ? checkedCount + " of " + clients.length + " clients have a supplied verified readback" : "not checked"}</strong>.
          {checkedCount ? " Task statuses below are contact-scoped, not proof of company-specific ownership." : " Company/contact associations require authenticated GHL verification."}
          Check existing tasks in GHL before requesting another. This static site cannot securely read protected GHL tasks using a private API token.
        </div>
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
          <span style={{ fontSize: 12, color: "#657c91" }}>This button validates locally; it does not send a webhook.</span>
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
        <section style={{ marginTop: 16, padding: 14, border: "1px solid #d8e4ee", borderRadius: 9, background: "#f5f9fc" }}>
          <strong>Submit through GHL, not this static site</strong>
          <p style={{ margin: "6px 0 10px", fontSize: 12, color: "#526b83" }}>
            Copy the task details below and open the GHL-hosted coordination request form.
            Your existing published GHL workflow can create the task after GHL verifies the contact and duplicate rules.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => {
              const content = clients.map((client) => [
                "Client: " + client.companyName,
                "Task: " + taskTitle,
                "Details: " + taskDetails,
                "Due: " + dueDate + " " + dueTime + " " + timeZone,
              ].join("\n")).join("\n\n");
              if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(content);
            }} style={{ borderRadius: 8, padding: "9px 13px", border: "1px solid #abc5dc", background: "#fff" }}>
              Copy task details
            </button>
            {process.env.NEXT_PUBLIC_GHL_TASK_REQUEST_FORM_URL ? (
              <a href={process.env.NEXT_PUBLIC_GHL_TASK_REQUEST_FORM_URL} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-block", borderRadius: 8, padding: "9px 13px", background: "#1764a6", color: "white" }}>
                Open GHL task request form
              </a>
            ) : <span style={{ alignSelf: "center", color: "#8a4a24", fontSize: 12 }}>
              GHL form link not configured yet; no task has been sent.
            </span>}
          </div>
        </section>
        <footer style={{ borderTop: "1px solid #e2eaf1", paddingTop: 12, marginTop: 18, color: "#607990", fontSize: 12 }}>
          Static site only. The GHL-hosted form must be connected to the existing workflow and must validate existing contacts, assignment, due dates, and duplicates. No direct GHL API, webhook, Supabase, or Captain's Log calls.
        </footer>
      </section>
    </div>,
    document.body,
  );
}
