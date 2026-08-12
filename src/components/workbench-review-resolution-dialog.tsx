"use client";

import { useMemo, useState } from "react";
import { recalculateDataset } from "@/lib/compass/engine";
import { saveCloudReviewState } from "@/lib/compass/review-state-cloud";
import { saveCompassDataset, useCompassState } from "@/lib/compass/store";
import type { CompassClient } from "@/lib/compass/types";
import { saveCloudWorkbenchMembership } from "@/lib/compass/workbench-cloud";
import {
  removeClientFromWorkbench,
  setWorkbenchResolution,
  type WorkbenchResolutionDisposition,
  type WorkbenchReviewResolution,
} from "@/lib/compass/workbench";

interface WorkbenchReviewResolutionDialogProps {
  clientId: string;
  onClose: () => void;
}

function todayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function WorkbenchReviewResolutionDialog({ clientId, onClose }: WorkbenchReviewResolutionDialogProps) {
  const { dataset, config, refresh } = useCompassState();
  const client = useMemo(() => dataset?.clients.find((item) => item.id === clientId) ?? null, [clientId, dataset]);
  const [disposition, setDisposition] = useState<Extract<WorkbenchResolutionDisposition, "review-completed" | "record-corrected">>("review-completed");
  const [date, setDate] = useState(client?.lastAccountReview || todayDate());
  const [note, setNote] = useState(client?.accountReviewStateNote || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!client || !dataset) return null;

  const save = async () => {
    if (!date || saving) return;
    setSaving(true);
    setError("");
    try {
      const now = new Date().toISOString();
      const resolution: WorkbenchReviewResolution = {
        disposition,
        date,
        activityThrough: date,
        nextReviewDate: "",
        note: note.trim(),
        resolvedAt: now,
      };

      const updatedClient: CompassClient = {
        ...client,
        lastAccountReview: date,
        workflowStatus: "Review Completed",
        accountReviewStatus: "completed",
        accountReviewCycleResolvedDate: date,
        accountReviewActivityThrough: date,
        accountReviewNextDate: "",
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
      removeClientFromWorkbench(client.id);
      await saveCloudReviewState(updatedClient, resolution);
      if (client.companyId) {
        void saveCloudWorkbenchMembership(client.companyId, false).catch((cause) => {
          if (typeof console !== "undefined") console.debug("Workbench completion membership cleanup deferred", cause);
        });
      }
      await refresh();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The account review could not be completed.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="workbench-resolution-backdrop" role="presentation" onMouseDown={() => { if (!saving) onClose(); }}>
    <section className="workbench-resolution-dialog" role="dialog" aria-modal="true" aria-labelledby="workbench-resolution-title" onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <div><span className="compass-kicker">Complete account review</span><h3 id="workbench-resolution-title">{client.name}</h3><p>Completed means Compass has a real Account Review date. Captain&apos;s Log activity alone never completes the review.</p></div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Close account review completion">×</button>
      </header>

      <div className="workbench-resolution-options" role="radiogroup" aria-label="Account review completion type">
        <button type="button" role="radio" aria-checked={disposition === "review-completed"} className={disposition === "review-completed" ? "is-selected" : ""} onClick={() => setDisposition("review-completed")}>
          <span className="workbench-resolution-radio" aria-hidden="true" />
          <span><strong>Review completed</strong><small>Record the date the Account Review was actually completed.</small></span>
        </button>
        <button type="button" role="radio" aria-checked={disposition === "record-corrected"} className={disposition === "record-corrected" ? "is-selected" : ""} onClick={() => setDisposition("record-corrected")}>
          <span className="workbench-resolution-radio" aria-hidden="true" />
          <span><strong>Correct the review date</strong><small>Use this when the review already happened and Compass simply has the wrong or missing date.</small></span>
        </button>
      </div>

      <div className="workbench-resolution-fields">
        <label><span>Account review date</span><input type="date" value={date} onChange={(event) => { setDate(event.target.value); setError(""); }} /></label>
        <label><span>Note <em>optional</em></span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add context if it will help later." /></label>
        <div className="workbench-resolution-explainer"><strong>What happens next</strong><span>The client moves to Completed, its manual Workbench membership is cleared, and the completed item remains visible briefly before leaving the active pipeline.</span></div>
        {error && <div className="workbench-resolution-error" role="alert">{error}</div>}
      </div>

      <footer><button type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="is-primary" type="button" onClick={() => void save()} disabled={saving || !date}>{saving ? "Saving…" : "Complete review"}</button></footer>
    </section>
  </div>;
}
