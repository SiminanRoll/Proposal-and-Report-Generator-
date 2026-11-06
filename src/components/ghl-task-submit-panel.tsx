"use client";

import { useState } from "react";
import { assessGhlTaskOverlap } from "@/lib/compass/ghl-task-awareness.mjs";
import type { GhlTaskReadbackSnapshot } from "@/lib/compass/ghl-task-awareness.mjs";
import type { GhlIntakePreflightResult } from "@/lib/compass/ghl-task-intake-preflight.mjs";

type Client = { clientId: string; companyName: string };
type Props = {
  clients: Client[];
  results: GhlIntakePreflightResult[];
  readbacks: Record<string, GhlTaskReadbackSnapshot>;
  taskTitle: string;
  taskDetails: string;
  dueDate: string;
  dueTime: string;
  timeZone: string;
};

/**
 * This is an explicit operator-initiated workflow submission, NOT a GHL API
 * task write. The GHL private token and workflow webhook URL stay on DO.
 * Writer credential is separate from the reader credential, in memory only.
 */
export function GhlTaskSubmitPanel({
  clients, results, readbacks, taskTitle, taskDetails,
  dueDate, dueTime, timeZone,
}: Props) {
  const [writerSecret, setWriterSecret] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});

  const ready = results.length > 0 && results.every((r) => r.status === "prepared_not_sent") &&
    results.every((r) => {
      if (r.status !== "prepared_not_sent") return false;
      const client = clients.find((c) => c.clientId === r.clientId);
      if (!client) return false;
      return assessGhlTaskOverlap(readbacks[r.clientId], {
        clientId: r.clientId, companyName: client.companyName,
        requestId: r.payload.requestId, taskTitle,
      }).status === "no_similar_open_tasks_found";
    });

  async function submit() {
    if (!ready || sending || !confirmed || writerSecret.trim().length < 32) return;
    setSending(true);
    setMessage("");
    for (const result of results) {
      if (result.status !== "prepared_not_sent") continue;
      if (outcomes[result.clientId]) continue;
      const client = clients.find((c) => c.clientId === result.clientId);
      if (!client) continue;
      setOutcomes((current) => ({ ...current, [result.clientId]: "Submitting…" }));
      try {
        const response = await fetch("/api/ghl/tasks/submit", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + writerSecret.trim(),
          },
          body: JSON.stringify({
            clientId: result.clientId,
            businessId: result.businessId,
            contactId: result.contactId,
            companyName: client.companyName,
            requestId: result.payload.requestId,
            taskTitle, taskDetails, dueDate, dueTime, timeZone,
            confirmTaskCreation: true,
          }),
        });
        const body = await response.json().catch(() => null) as {
          status?: string; reason?: string; error?: string;
        } | null;
        if (response.status === 202 && body?.status === "accepted_unverified") {
          setOutcomes((current) => ({ ...current, [result.clientId]: "Webhook accepted; GHL task not yet verified" }));
          continue;
        }
        if (response.status === 409 && body?.status === "blocked") {
          setOutcomes((current) => ({ ...current, [result.clientId]: "Blocked: " + (body.reason || "existing or unverified GHL task") }));
          continue;
        }
        const reason = response.status === 503 ? "DigitalOcean workflow writer is not yet configured" :
          response.status === 401 || response.status === 403 ? "Invalid workflow writer access" :
          "Unknown submission outcome. Inspect the GHL workflow log before retrying";
        setOutcomes((current) => ({ ...current, [result.clientId]: reason }));
        setMessage("Stopped. " + reason);
        break;
      } catch {
        const reason = "Network outcome unknown. Inspect GHL before retrying";
        setOutcomes((current) => ({ ...current, [result.clientId]: reason }));
        setMessage("Stopped. " + reason);
        break;
      }
    }
    setSending(false);
  }

  return <section aria-label="GHL coordination task submission" style={{
    border: "1px solid #cbddec", background: "#f4f9fd", padding: 14,
    borderRadius: 9, marginTop: 16,
  }}>
    <strong>Send through the published GHL Coordination Task Intake workflow</strong>
    <p style={{ fontSize: 12, color: "#526b83" }}>
      Submission is disabled until every client and contact is verified against
      GHL, each task passes preflight, and no duplicate or similar open task is
      found. The server checks again before each webhook request.
    </p>
    <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
      Separate DigitalOcean workflow writer access secret
      <input type="password" autoComplete="off" value={writerSecret}
        onChange={(event) => setWriterSecret(event.target.value)}
        placeholder="Do not enter your GHL API key"
        style={{ padding: 9, border: "1px solid #cbddec", borderRadius: 7 }} />
    </label>
    <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, fontSize: 12 }}>
      <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
      I reviewed these clients, contacts, and due dates and authorize creating tasks in GHL.
    </label>
    <button type="button" disabled={!ready || !confirmed || sending || writerSecret.trim().length < 32}
      onClick={() => void submit()}
      style={{ marginTop: 12, border: 0, padding: "10px 15px", borderRadius: 8,
        background: "#195e9f", color: "white", fontWeight: 700 }}>
      {sending ? "Submitting…" : "Submit " + results.length + " task" + (results.length === 1 ? "" : "s") + " to GHL"}
    </button>
    {!ready && <p style={{ color: "#536c81", fontSize: 12 }}>
      GHL task readback or preflight is incomplete. Nothing can be submitted yet.
    </p>}
    {message && <p role="alert" style={{ fontSize: 12, color: "#a13535" }}>{message}</p>}
    {Object.entries(outcomes).map(([clientId, outcome]) => <p key={clientId}
      role="status" style={{ fontSize: 12 }}>
      {clients.find((c) => c.clientId === clientId)?.companyName ?? clientId}: {outcome}
    </p>)}
    <p style={{ fontSize: 11, color: "#526b83" }}>
      A webhook acceptance is not proof that a GHL task exists. Verify the task
      ID and saved due date in GHL before considering it complete. Do not
      resubmit unknown outcomes.
    </p>
  </section>;
}
