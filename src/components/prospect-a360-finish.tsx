"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { PlanningAppointment } from "@/lib/projects/types";
import type { A360ProspectDiscovery } from "@/lib/prospects/a360";
import { formatPlanningAppointment } from "@/lib/outcomes/planning-appointment";
import { consultantContactFor, PATRIC_CONTACT } from "@/lib/outcomes/consultant-contacts";
import { writeA360OtaHandoffToCaptainsLog, type A360OtaHandoffResult } from "@/lib/compass/captains-log-ota-handoff";
import { CheckIcon } from "./icons";

function firstName(value: string): string {
  return String(value || "").trim().split(/\s+/)[0] || "there";
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validPhone(value: string): boolean {
  return value.replace(/\D/g, "").length >= 7;
}

function environmentRecap(discovery: A360ProspectDiscovery): string {
  const details: string[] = [];
  if (discovery.workstations > 0) details.push(`about ${discovery.workstations} workstation${discovery.workstations === 1 ? "" : "s"}`);
  details.push(`${Math.max(1, discovery.locations)} location${Math.max(1, discovery.locations) === 1 ? "" : "s"}`);
  if (discovery.managementSoftware.trim()) details.push(discovery.managementSoftware.trim());
  if (!details.length) return "";
  return `We also captured a starting picture of the environment, including ${details.join(", ")}, which the onsite assessment will verify.`;
}

function priorityRecap(discovery: A360ProspectDiscovery): string {
  const priorities = discovery.priorities.slice(0, 3);
  if (!priorities.length) return "We discussed what you want the technology relationship to improve and where the onsite review should focus.";
  if (priorities.length === 1) return `The main priority we discussed was ${priorities[0].toLowerCase()}.`;
  const last = priorities[priorities.length - 1];
  return `The priorities we discussed included ${priorities.slice(0, -1).map((item) => item.toLowerCase()).join(", ")} and ${last.toLowerCase()}.`;
}

function mailtoDraft(discovery: A360ProspectDiscovery, appointment: PlanningAppointment, email: string): { href: string; consultantEmail: string } {
  const company = discovery.organizationName.trim() || discovery.contactName.trim();
  const consultant = consultantContactFor(appointment.consultantName);
  const consultantEmail = consultant?.email?.trim() || consultant?.calendarEmail?.trim() || "";
  const subject = `Confirmed: Onsite Technology Assessment - ${company}`;
  const body = [
    `Hi ${firstName(discovery.contactName)},`,
    "",
    "Thanks for taking the time to talk through your technology with me today.",
    priorityRecap(discovery),
    environmentRecap(discovery),
    "",
    `Your onsite technology assessment is confirmed for ${formatPlanningAppointment(appointment)} with ${appointment.consultantName}. During the visit, we will verify the environment, answer any remaining questions, and use what we find to build an accurate recommendation and scope.`,
    "",
    "If anything changes before the appointment, just reply to this email and we can adjust.",
    "",
    "Thanks,",
    PATRIC_CONTACT.name,
    PATRIC_CONTACT.role,
    "Advantage Technologies",
    PATRIC_CONTACT.phone || "",
  ].filter((line, index, lines) => line !== "" || lines[index - 1] !== "").join("\r\n");
  const query = [
    `subject=${encodeURIComponent(subject)}`,
    ...(consultantEmail ? [`cc=${encodeURIComponent(consultantEmail)}`] : []),
    `body=${encodeURIComponent(body)}`,
  ].join("&");
  return { href: `mailto:${encodeURIComponent(email.trim())}?${query}`, consultantEmail };
}

export function ProspectA360Finish({
  discovery,
  appointment,
  handoffId,
  onClosePresentation,
}: {
  discovery: A360ProspectDiscovery;
  appointment: PlanningAppointment | null;
  handoffId: string;
  onClosePresentation: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<A360OtaHandoffResult | null>(null);
  const company = discovery.organizationName.trim() || discovery.contactName.trim();
  const draft = useMemo(() => appointment && email.trim() ? mailtoDraft(discovery, appointment, email) : null, [appointment, discovery, email]);

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
      const saved = await writeA360OtaHandoffToCaptainsLog({
        handoffId,
        companyName: company,
        contactName: discovery.contactName.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        appointmentDate: appointment.date,
        appointmentTime: appointment.time,
        timeZone: appointment.timeZone,
        consultantName: appointment.consultantName,
      });
      setResult(saved);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The OTA handoff could not be saved to Captain's Log.");
    } finally {
      setSubmitting(false);
    }
  }

  function openEmailDraft() {
    if (!draft) return;
    window.location.href = draft.href;
    window.setTimeout(onClosePresentation, 350);
  }

  if (result) {
    return <section className="prospect-finish-success" aria-live="polite">
      <span className="prospect-finish-check"><CheckIcon /></span>
      <div className="prospect-finish-success-copy">
        <span className="prospect-kicker">Appointment confirmed</span>
        <strong>{company} is saved as an OTA prospect.</strong>
        <p>The prospect and completed Sales meeting are safely recorded in Captain&apos;s Log. Stop sharing your screen, then open the prepared follow-up email.</p>
        {!draft?.consultantEmail && <small>The selected Technology Consultant does not have an email saved in the Compass roster, so the draft cannot automatically CC them.</small>}
      </div>
      <button className="prospect-open-email" type="button" onClick={openEmailDraft}>Open follow-up email →</button>
    </section>;
  }

  const overlay = typeof document === "undefined" ? null : createPortal(open ? <div className="planning-scheduler-backdrop prospect-finish-backdrop" data-planning-scheduler-open="true" data-presentation-interactive="true" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !submitting) setOpen(false); }}>
    <section className="prospect-finish-modal" role="dialog" aria-modal="true" aria-labelledby="prospect-finish-title" onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <div><span className="presentation-kicker">Confirm the prospect</span><h2 id="prospect-finish-title">One last detail before we finish.</h2><p>{appointment ? `${formatPlanningAppointment(appointment)} with ${appointment.consultantName}` : "Schedule the onsite assessment first."}</p></div>
        <button type="button" aria-label="Close" disabled={submitting} onClick={() => setOpen(false)}>×</button>
      </header>
      <div className="prospect-finish-form">
        <label><span>Email address</span><input autoFocus type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="name@company.com" /></label>
        <label><span>Preferred cell or practice phone number</span><input type="tel" autoComplete="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setError(""); }} placeholder="(555) 555-0123" /></label>
        {error && <div className="prospect-finish-error" role="alert">{error}</div>}
        <div className="prospect-finish-modal-note"><span><CheckIcon /></span><p>Confirming creates the canonical Captain&apos;s Log OTA prospect and completed <strong>Meeting · Sales</strong> activity before the presentation closes.</p></div>
        <div className="prospect-finish-actions"><button type="button" className="secondary" disabled={submitting} onClick={() => setOpen(false)}>Back</button><button type="button" className="confirm" disabled={submitting || !email.trim() || !phone.trim()} onClick={confirmFinish}>{submitting ? "Saving to Captain's Log…" : "Confirm & Finish"}</button></div>
      </div>
    </section>
  </div> : null, document.body);

  return <>
    <div className="prospect-confirm-finish-row">
      <button className="prospect-confirm-finish" type="button" disabled={!appointment} onClick={() => { setError(""); setOpen(true); }} aria-label="Confirm and finish the A360 presentation">
        <strong>{appointment ? "Confirm & Finish" : "Schedule first"}</strong>
        <b aria-hidden="true">→</b>
      </button>
    </div>
    {overlay}
  </>;
}
