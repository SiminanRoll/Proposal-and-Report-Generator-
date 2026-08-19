"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { PlanningAppointment } from "@/lib/projects/types";
import { preliminaryA360Estimate, type A360ProspectDiscovery } from "@/lib/prospects/a360";
import { buildA360ConversationRecord, createA360ConversationProject } from "@/lib/prospects/a360-conversation";
import { formatPlanningAppointment } from "@/lib/outcomes/planning-appointment";
import { listProjects, saveProject } from "@/lib/projects/store";
import { writeA360OtaHandoffToCaptainsLog } from "@/lib/compass/captains-log-ota-handoff";
import { CheckIcon } from "./icons";

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validPhone(value: string): boolean {
  return value.replace(/\D/g, "").length >= 7;
}

export function ProspectA360Finish({
  discovery,
  appointment,
  handoffId,
}: {
  discovery: A360ProspectDiscovery;
  appointment: PlanningAppointment | null;
  handoffId: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const company = discovery.organizationName.trim() || discovery.contactName.trim();
  const estimate = useMemo(() => preliminaryA360Estimate(discovery), [discovery]);

  async function confirmFinish() {
    if (!appointment || submitting) return;
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    if (!validEmail(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!validPhone(cleanPhone)) {
      setError("Enter the preferred cell or practice phone number.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const record = buildA360ConversationRecord({
        handoffId,
        discovery,
        estimate,
        appointment,
        contactEmail: cleanEmail,
        contactPhone: cleanPhone,
      });
      const existing = listProjects().find((project) => project.a360Conversation?.handoffId === handoffId);
      const workspace = existing
        ? {
            ...existing,
            client: { ...existing.client, name: company, industry: discovery.industry, organizationTerm: discovery.organizationLanguage },
            painPoints: [...discovery.priorities],
            planningAppointment: appointment,
            a360Conversation: record,
            presentation: { ...existing.presentation, title: record.report.title, executiveSummary: record.report.executiveSummary, publishedAt: record.capturedAt },
          }
        : createA360ConversationProject(record);
      saveProject(workspace);

      await writeA360OtaHandoffToCaptainsLog({
        handoffId,
        companyName: company,
        contactName: discovery.contactName.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        appointmentDate: appointment.date,
        appointmentTime: appointment.time,
        timeZone: appointment.timeZone,
        consultantName: appointment.consultantName,
        computerCount: discovery.workstations,
        a360MonthlyLow: estimate.low,
        a360MonthlyHigh: estimate.high,
      });
      setSaved(true);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replace(/Captain's Log/gi, "the follow-up record") : "The conversation could not be fully saved. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (saved) return null;

  const overlay = typeof document === "undefined" ? null : createPortal(open ? <div className="planning-scheduler-backdrop prospect-finish-backdrop" data-planning-scheduler-open="true" data-presentation-interactive="true" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !submitting) setOpen(false); }}>
    <section className="prospect-finish-modal" role="dialog" aria-modal="true" aria-labelledby="prospect-finish-title" onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <div><span className="presentation-kicker">Save the conversation</span><h2 id="prospect-finish-title">One last detail before we finish.</h2><p>{appointment ? `${formatPlanningAppointment(appointment)} with ${appointment.consultantName}` : "Schedule the onsite assessment first."}</p></div>
        <button type="button" aria-label="Close" disabled={submitting} onClick={() => setOpen(false)}>×</button>
      </header>
      <div className="prospect-finish-form">
        <label><span>Email address</span><input autoFocus type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="name@company.com" /></label>
        <label><span>Preferred cell or practice phone number</span><input type="tel" autoComplete="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setError(""); }} placeholder="(555) 555-0123" /></label>
        {error && <div className="prospect-finish-error" role="alert">{error}</div>}
        <div className="prospect-finish-modal-note"><span><CheckIcon /></span><p>This saves what we discussed today so we can prepare your conversation recap and keep the onsite assessment tied to the right details.</p></div>
        <div className="prospect-finish-actions"><button type="button" className="secondary" disabled={submitting} onClick={() => setOpen(false)}>Back</button><button type="button" className="confirm" disabled={submitting || !email.trim() || !phone.trim()} onClick={confirmFinish}>{submitting ? "Saving…" : "Save conversation"}</button></div>
      </div>
    </section>
  </div> : null, document.body);

  return <>
    <div className="prospect-confirm-finish-row">
      <button className="prospect-confirm-finish" type="button" disabled={!appointment} onClick={() => { setError(""); setOpen(true); }} aria-label="Save and finish the A360 presentation">
        <strong>{appointment ? "Save conversation" : "Schedule first"}</strong>
        <b aria-hidden="true">→</b>
      </button>
    </div>
    {overlay}
  </>;
}
