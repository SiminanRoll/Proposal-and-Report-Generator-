"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { A360ConversationRecord } from "@/lib/projects/types";
import type { A360ConversationUpdate } from "@/lib/prospects/a360-conversation";
import { formatPlanningAppointment } from "@/lib/outcomes/planning-appointment";
import { CheckIcon } from "./icons";

export function ProspectA360Finish({ record, onUpdate, onOpenReport }: {
  record: A360ConversationRecord;
  onUpdate: (update: A360ConversationUpdate) => boolean;
  onOpenReport: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function contactChanged(key: "contactEmail" | "contactPhone", value: string) {
    setSaved(false);
    setError(onUpdate({ [key]: value }) ? "" : "Your latest details could not be saved. Keep this presentation open and retry.");
  }

  function confirmFinish() {
    const email = record.contactEmail.trim();
    const phone = record.contactPhone.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address, or leave it blank to add later.");
      return;
    }
    if (phone && phone.replace(/\D/g, "").length < 7) {
      setError("Enter the preferred phone number, or leave it blank to add later.");
      return;
    }
    if (!onUpdate({ contactEmail: email, contactPhone: phone, completedAt: record.completedAt || new Date().toISOString() })) {
      setError("The latest changes could not be saved. Keep this presentation open and retry.");
      return;
    }
    setError("");
    setSaved(true);
  }

  const overlay = typeof document === "undefined" ? null : createPortal(open ? <div className="planning-scheduler-backdrop prospect-finish-backdrop" data-planning-scheduler-open="true" data-presentation-interactive="true" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
    <section className="prospect-finish-modal" role="dialog" aria-modal="true" aria-labelledby="prospect-finish-title" onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <div><span className="presentation-kicker">Save the conversation</span><h2 id="prospect-finish-title">Keep the conversation together.</h2><p>{record.appointment ? `${formatPlanningAppointment(record.appointment)} with ${record.appointment.consultantName}` : "The conversation is saved even before an onsite assessment is scheduled."}</p></div>
        <button type="button" aria-label="Close" onClick={() => setOpen(false)}>×</button>
      </header>
      <div className="prospect-finish-form">
        <label><span>Email address · optional</span><input autoFocus type="email" autoComplete="email" value={record.contactEmail} onChange={(event) => contactChanged("contactEmail", event.target.value)} placeholder="name@company.com" /></label>
        <label><span>Preferred phone number · optional</span><input type="tel" autoComplete="tel" value={record.contactPhone} onChange={(event) => contactChanged("contactPhone", event.target.value)} placeholder="(555) 555-0123" /></label>
        {error && <div className="prospect-finish-error" role="alert">{error}</div>}
        <div className="prospect-finish-modal-note"><span><CheckIcon /></span><p>Your conversation saves automatically as you go. Return to it from Recent Reports / Proposals to continue the presentation or download the recap.</p></div>
        {saved && <p role="status">Conversation saved. Your recap is ready to open.</p>}
        <div className="prospect-finish-actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>Back</button><button type="button" className="confirm" onClick={confirmFinish}>{saved ? "Saved" : "Save conversation"}</button><button type="button" className="confirm" onClick={onOpenReport}>Open report</button></div>
      </div>
    </section>
  </div> : null, document.body);

  return <>
    <div className="prospect-confirm-finish-row">
      <button className="prospect-confirm-finish" type="button" onClick={() => { setError(""); setOpen(true); }} aria-label="Save the A360 conversation locally"><strong>Contact details</strong><b aria-hidden="true">→</b></button>
      <button className="prospect-confirm-finish" type="button" onClick={onOpenReport}><strong>Open saved report</strong><b aria-hidden="true">→</b></button>
    </div>
    {overlay}
  </>;
}
