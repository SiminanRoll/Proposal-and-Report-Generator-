"use client";

import { useEffect, useMemo, useState } from "react";
import { recalculateDataset } from "@/lib/compass/engine";
import { saveCloudReviewState } from "@/lib/compass/review-state-cloud";
import { saveCompassDataset, useCompassState } from "@/lib/compass/store";
import type { CompassClient } from "@/lib/compass/types";
import {
  setWorkbenchResolution,
  workbenchResolution,
  type WorkbenchResolutionDisposition,
  type WorkbenchReviewResolution,
} from "@/lib/compass/workbench";

interface WorkbenchReviewResolutionDialogProps {
  clientId: string;
  onClose: () => void;
}

const OPTIONS: Array<{ value: WorkbenchResolutionDisposition; label: string; description: string }> = [
  {
    value: "activity-reviewed",
    label: "Reviewed — no new review needed",
    description: "Use this when a call or other activity happened after the review, but the account review itself was already handled.",
  },
  {
    value: "review-completed",
    label: "Review completed",
    description: "Record the actual date the account review was completed and close the current review cycle.",
  },
  {
    value: "client-declined",
    label: "Client declined / would not connect",
    description: "Counts the review cycle as handled while clearly recording that the client did not complete a formal review meeting.",
  },
  {
    value: "rescheduled",
    label: "Rescheduled / follow-up pending",
    description: "Clear the current attention flag and place the account back into Scheduled for the date you choose.",
  },
  {
    value: "record-corrected",
    label: "Correct the review date",
    description: "Use the actual historical review date when the record is simply wrong or incomplete.",
  },
];

function dateKey(value: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentQueueTriggerThrough(client: CompassClient): string {
  const today = todayDate();
  const activityDates = (client.captainsLog?.recentActivity ?? [])
    .map((item) => dateKey(item.completedAt || item.scheduledAt || item.createdAt))
    .filter(Boolean);
  const taskDates = (client.captainsLog?.openTasks ?? [])
    .map((task) => ({ scheduled: dateKey(task.scheduledAt), created: dateKey(task.createdAt) }))
    .filter((item) => !item.scheduled || item.scheduled <= today)
    .map((item) => item.scheduled || item.created)
    .filter(Boolean);
  return [...activityDates, ...taskDates].sort().at(-1) ?? "";
}

function dateLabel(disposition: WorkbenchResolutionDisposition): string {
  if (disposition === "activity-reviewed") return "Reviewed through";
  if (disposition === "client-declined") return "Declined / attempted date";
  if (disposition === "rescheduled") return "New review / follow-up date";
  return "Account review date";
}

function sharedStatus(disposition: WorkbenchResolutionDisposition): string {
  if (disposition === "review-completed" || disposition === "record-corrected") return "completed";
  if (disposition === "client-declined") return "declined";
  if (disposition === "rescheduled") return "scheduled";
  return "acknowledged";
}

export function WorkbenchReviewResolutionDialog({ clientId, onClose }: WorkbenchReviewResolutionDialogProps) {
  const { dataset, config, refresh } = useCompassState();
  const client = useMemo(() => dataset?.clients.find((item) => item.id === clientId) ?? null, [clientId, dataset]);
  const existing = client ? workbenchResolution(client.id) : null;
  const [disposition, setDisposition] = useState<WorkbenchResolutionDisposition>(existing?.disposition ?? (client?.lastAccountReview ? "activity-reviewed" : "review-completed"));
  const [date, setDate] = useState(existing?.nextReviewDate || existing?.date || todayDate());
  const [note, setNote] = useState(existing?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!client) return;
    const current = workbenchResolution(client.id);
    setDisposition(current?.disposition ?? (client.lastAccountReview ? "activity-reviewed" : "review-completed"));
    setDate(current?.nextReviewDate || current?.date || todayDate());
    setNote(current?.note ?? "");
    setError("");
  }, [client?.id]);

  if (!client || !dataset) return null;

  const selectedOption = OPTIONS.find((option) => option.value === disposition) ?? OPTIONS[0];

  const save = async () => {
    if (!date || saving) return;
    setSaving(true);
    setError("");
    try {
      const now = new Date().toISOString();
      const queueTrigger = currentQueueTriggerThrough(client);
      let activityThrough = "";
      let nextReviewDate = "";

      if (disposition === "activity-reviewed") activityThrough = [queueTrigger, date].filter(Boolean).sort().at(-1) ?? date;
      else if (disposition === "rescheduled") {
        activityThrough = queueTrigger;
        nextReviewDate = date;
      } else activityThrough = date;

      const resolution: WorkbenchReviewResolution = {
        disposition,
        date,
        activityThrough,
        nextReviewDate,
        note: note.trim(),
        resolvedAt: now,
      };

      const completesFormalReview = disposition === "review-completed" || disposition === "record-corrected";
      const resolvesCycle = completesFormalReview || disposition === "client-declined";
      const workflowStatus = disposition === "client-declined"
        ? "Review Declined"
        : completesFormalReview
          ? "Review Completed"
          : client.workflowStatus;
      const updatedClient: CompassClient = {
        ...client,
        lastAccountReview: completesFormalReview ? date : client.lastAccountReview,
        workflowStatus,
        accountReviewStatus: sharedStatus(disposition),
        accountReviewCycleResolvedDate: resolvesCycle ? date : "",
        accountReviewActivityThrough: activityThrough,
        accountReviewNextDate: nextReviewDate,
        accountReviewDisposition: disposition,
        accountReviewStateNote: note.trim(),
        accountReviewStateUpdatedAt: now,
      };

      const nextDataset = recalculateDataset({
        ...dataset,
        clients: dataset.clients.map((item) => item.id === client.id ? updatedClient : item),
      }, config);
      await saveCompassDataset(nextDataset);
      setWorkbenchResolution(client.id, resolution);
      await saveCloudReviewState(updatedClient, resolution);
      await refresh();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The review status could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="workbench-resolution-backdrop" role="presentation" onMouseDown={() => { if (!saving) onClose(); }}>
    <section className="workbench-resolution-dialog" role="dialog" aria-modal="true" aria-labelledby="workbench-resolution-title" onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <div><span className="compass-kicker">Resolve review cycle</span><h3 id="workbench-resolution-title">{client.name}</h3><p>Tell Compass what actually happened so this account lands in the right queue.</p></div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Close review resolution">×</button>
      </header>

      <div className="workbench-resolution-options" role="radiogroup" aria-label="Review outcome">
        {OPTIONS.map((option) => <button key={option.value} type="button" role="radio" aria-checked={disposition === option.value} className={disposition === option.value ? "is-selected" : ""} onClick={() => { setDisposition(option.value); setError(""); }}>
          <span className="workbench-resolution-radio" aria-hidden="true" />
          <span><strong>{option.label}</strong><small>{option.description}</small></span>
        </button>)}
      </div>

      <div className="workbench-resolution-fields">
        <label><span>{dateLabel(disposition)}</span><input type="date" value={date} onChange={(event) => { setDate(event.target.value); setError(""); }} /></label>
        <label><span>Note <em>optional</em></span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={disposition === "client-declined" ? "Example: Office declined review after multiple outreach attempts." : "Add a short note if it will help later."} /></label>
        <div className="workbench-resolution-explainer"><strong>{selectedOption.label}</strong><span>{disposition === "client-declined" ? "This date satisfies the review cycle without changing the last completed review date." : disposition === "activity-reviewed" ? "Your formal account review date stays unchanged. Only the current attention trigger is acknowledged." : disposition === "rescheduled" ? "The current trigger is acknowledged and the account moves to Scheduled until the selected date." : "The selected date becomes the recorded account review date."}</span></div>
        {error && <div className="workbench-resolution-error" role="alert">{error}</div>}
      </div>

      <footer><button type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="is-primary" type="button" onClick={() => void save()} disabled={saving || !date}>{saving ? "Saving…" : "Resolve review"}</button></footer>
    </section>
  </div>;
}
