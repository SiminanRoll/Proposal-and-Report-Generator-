"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { PlanningAppointment } from "@/lib/projects/types";
import { formatPlanningAppointment } from "@/lib/outcomes/planning-appointment";
import {
  CONSULTANT_CONTACTS_CHANGED_EVENT,
  loadConsultantContacts,
  type ConsultantContact,
} from "@/lib/outcomes/consultant-contacts";
import { CheckIcon } from "./icons";

const TIME_OPTIONS = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function nextBusinessDay(): Date {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
  return date;
}

function calendarDays(month: Date): Array<{ date: Date; inMonth: boolean }> {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date, inMonth: date.getMonth() === month.getMonth() };
  });
}

function shortDate(value: string): string {
  const date = dateFromKey(value);
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(date);
}

function displayTime(value: string): string {
  const [hourValue, minute] = value.split(":");
  const hour = Number(hourValue);
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}

export function ProspectA360Scheduler({
  appointment,
  onConfirm,
}: {
  appointment: PlanningAppointment | null;
  onConfirm: (appointment: PlanningAppointment) => void;
}) {
  const initialDate = appointment?.date || dateKey(nextBusinessDay());
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedTime, setSelectedTime] = useState(appointment?.time || "14:00");
  const [consultantName, setConsultantName] = useState(appointment?.consultantName || "");
  const [consultants, setConsultants] = useState<ConsultantContact[]>(() => loadConsultantContacts());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = dateFromKey(initialDate);
    return new Date(date.getFullYear(), date.getMonth(), 1, 12);
  });
  const [showToast, setShowToast] = useState(false);
  const days = useMemo(() => calendarDays(calendarMonth), [calendarMonth]);
  const todayKey = dateKey(new Date());

  const consultantOptions = useMemo(() => {
    if (!consultantName.trim() || consultants.some((contact) => contact.name === consultantName.trim())) return consultants;
    return [{ name: consultantName.trim(), role: "Previously scheduled consultant" }, ...consultants];
  }, [consultantName, consultants]);

  useEffect(() => {
    const refreshRoster = () => setConsultants(loadConsultantContacts());
    refreshRoster();
    window.addEventListener(CONSULTANT_CONTACTS_CHANGED_EVENT, refreshRoster);
    window.addEventListener("storage", refreshRoster);
    return () => {
      window.removeEventListener(CONSULTANT_CONTACTS_CHANGED_EVENT, refreshRoster);
      window.removeEventListener("storage", refreshRoster);
    };
  }, []);

  useEffect(() => {
    if (!showToast) return;
    const timer = window.setTimeout(() => setShowToast(false), 3200);
    return () => window.clearTimeout(timer);
  }, [showToast]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  function openScheduler() {
    const date = appointment?.date || selectedDate || dateKey(nextBusinessDay());
    setConsultants(loadConsultantContacts());
    setSelectedDate(date);
    setSelectedTime(appointment?.time || selectedTime || "14:00");
    setConsultantName(appointment?.consultantName || consultantName);
    const selected = dateFromKey(date);
    setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1, 12));
    setOpen(true);
  }

  function confirmAppointment() {
    const cleanName = consultantName.trim();
    if (!selectedDate || !selectedTime || !cleanName) return;
    const planningAppointment: PlanningAppointment = {
      status: "scheduled",
      date: selectedDate,
      time: selectedTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time",
      consultantName: cleanName,
      scheduledAt: new Date().toISOString(),
    };
    onConfirm(planningAppointment);
    setOpen(false);
    setShowToast(true);
  }

  const overlay = typeof document === "undefined" ? null : createPortal(<>
    {open && <div className="planning-scheduler-backdrop" data-planning-scheduler-open="true" data-presentation-interactive="true" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") setOpen(false); }}>
      <section className="planning-scheduler-modal" role="dialog" aria-modal="true" aria-labelledby="prospect-planning-scheduler-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="planning-scheduler-header">
          <div><span className="presentation-kicker">Choose the appointment</span><h2 id="prospect-planning-scheduler-title">Schedule the onsite assessment</h2><p>Select the Technology Consultant, date, and time while you have the client with you.</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close scheduling calendar">×</button>
        </header>
        <div className="planning-scheduler-body">
          <div className="planning-calendar-panel">
            <div className="planning-calendar-toolbar">
              <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1, 12))} aria-label="Previous month">‹</button>
              <strong>{new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(calendarMonth)}</strong>
              <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1, 12))} aria-label="Next month">›</button>
            </div>
            <div className="planning-calendar-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
            <div className="planning-calendar-grid">{days.map(({ date, inMonth }) => {
              const key = dateKey(date);
              const disabled = key < todayKey;
              return <button type="button" key={key} className={`${inMonth ? "" : "outside"} ${key === todayKey ? "today" : ""} ${key === selectedDate ? "selected" : ""}`} disabled={disabled} onClick={() => setSelectedDate(key)} aria-pressed={key === selectedDate}><span>{date.getDate()}</span></button>;
            })}</div>
          </div>
          <div className="planning-appointment-panel">
            <div className="planning-selected-date"><span>Selected date</span><strong>{shortDate(selectedDate)}</strong></div>
            <label className="planning-consultant-field"><span>Technology Consultant</span><select autoFocus value={consultantName} onChange={(event) => setConsultantName(event.target.value)}><option value="">Select a consultant…</option>{consultantOptions.map((contact) => <option key={`${contact.name}-${contact.role}`} value={contact.name}>{contact.name} — {contact.role}</option>)}</select><small>Choose the consultant who will visit the client and verify the environment.</small></label>
            <fieldset className="planning-time-field"><legend>Appointment time</legend><div>{TIME_OPTIONS.map((time) => <button type="button" className={selectedTime === time ? "selected" : ""} key={time} onClick={() => setSelectedTime(time)}>{displayTime(time)}</button>)}</div><label><span>Custom time</span><input type="time" value={selectedTime} onChange={(event) => setSelectedTime(event.target.value)} /></label></fieldset>
            <div className="planning-appointment-summary"><span className="summary-check"><CheckIcon /></span><div><strong>{selectedDate && selectedTime ? `${shortDate(selectedDate)} at ${displayTime(selectedTime)}` : "Choose a date and time"}</strong><small>{consultantName.trim() ? `${consultantName.trim()} will complete the onsite technology assessment.` : "Select the consultant to complete the appointment."}</small></div></div>
            <div className="planning-scheduler-actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="confirm" disabled={!selectedDate || !selectedTime || !consultantName.trim()} onClick={confirmAppointment}>Confirm onsite assessment</button></div>
          </div>
        </div>
      </section>
    </div>}
    {showToast && <div className="onsite-planning-toast" role="status" aria-live="assertive"><span><CheckIcon /></span><div><strong>Onsite Assessment Scheduled</strong><small>{consultantName.trim()} · {shortDate(selectedDate)} at {displayTime(selectedTime)}</small></div></div>}
  </>, document.body);

  return <>
    <button className={`planning-consultation-banner planning-schedule-trigger prospect-ota-schedule-trigger ${appointment ? "scheduled" : ""}`} type="button" onClick={openScheduler} aria-label={appointment ? "Edit scheduled onsite assessment" : "Schedule the onsite assessment"}>
      <span className="planning-schedule-copy">
        <span className="presentation-kicker">{appointment ? "Onsite assessment scheduled" : "Choose the next step"}</span>
        <strong className="planning-schedule-title">{appointment ? formatPlanningAppointment(appointment) : "Schedule the onsite technology assessment"}</strong>
        <span className="planning-schedule-description">{appointment ? `${appointment.consultantName} will meet with your team to verify the environment and turn this conversation into a clear plan.` : "Pick the Technology Consultant, date, and time now so the next step is clear before the meeting ends."}</span>
      </span>
      <span className="planning-session-outcomes" aria-hidden="true">
        {appointment ? <><span className="scheduled-check"><CheckIcon /></span><span>Appointment confirmed</span><span>{appointment.consultantName}</span><span>Ready for the onsite review</span></> : <><span>Confirm what you have</span><span>Find what needs attention</span><span>Build a verified plan</span></>}
      </span>
    </button>
    {overlay}
  </>;
}
