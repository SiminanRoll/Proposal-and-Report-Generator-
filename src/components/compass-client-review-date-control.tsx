"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { recalculateDataset } from "@/lib/compass/engine";
import { saveCompassDataset } from "@/lib/compass/store";
import type { CompassConfig, CompassDataset } from "@/lib/compass/types";

interface CompassClientReviewDateControlProps {
  clientId: string;
  dataset: CompassDataset;
  config: CompassConfig;
  onDatasetSaved: () => void | Promise<void>;
}

function todayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string): string {
  if (!value) return "Not recorded";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function CompassClientReviewDateControl({ clientId, dataset, config, onDatasetSaved }: CompassClientReviewDateControlProps) {
  const client = dataset.clients.find((item) => item.id === clientId) ?? null;
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [date, setDate] = useState(client?.lastAccountReview?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const findTarget = () => setTarget(document.querySelector<HTMLElement>(".client-review-glance-v10941 > article:first-child"));
    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [clientId]);

  useEffect(() => {
    setDate(client?.lastAccountReview?.slice(0, 10) ?? "");
    setStatus("");
  }, [client?.lastAccountReview, clientId]);

  if (!client || !target) return null;

  const save = async (nextDate: string) => {
    if (!nextDate || saving) return;
    setSaving(true);
    setStatus("");
    try {
      const nextDataset = recalculateDataset({
        ...dataset,
        clients: dataset.clients.map((item) => item.id === clientId ? {
          ...item,
          lastAccountReview: nextDate,
          workflowStatus: "Review Completed",
        } : item),
      }, config);
      await saveCompassDataset(nextDataset);
      setDate(nextDate);
      setStatus("Saved");
      await onDatasetSaved();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Could not save the review date.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(<div className="client-review-date-editor-v10995">
    <strong>{formatDate(date)}</strong>
    <div><input type="date" value={date} onChange={(event) => { setDate(event.target.value); setStatus(""); }} aria-label="Last account review date" /><button type="button" onClick={() => void save(date)} disabled={!date || saving}>{saving ? "Saving…" : "Save"}</button><button className="is-today" type="button" onClick={() => { const today = todayDate(); setDate(today); void save(today); }} disabled={saving}>Today</button></div>
    {status && <small className={status === "Saved" ? "is-saved" : "is-error"}>{status}</small>}
  </div>, target);
}
