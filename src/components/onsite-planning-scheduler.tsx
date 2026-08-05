"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Project } from "@/lib/projects/types";
import {
  formatPlanningAppointment,
  planningConsultantSentence,
  scheduledPlanningAppointment,
} from "@/lib/outcomes/planning-appointment";
import { CheckIcon } from "./icons";
import { isRemoteConsultation, planningAppointmentNoun, planningScheduledLabel } from "@/lib/outcomes/planning-mode";

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

export function OnsitePlanningScheduler({
  project,
  onUpdate,
  title,
  copy,
  outcomes,
  variant = "default",
}: {
  project: Project;
  onUpdate: (project: Project) => void;
  title: string;
  copy: string;
  outcomes: string[];
  variant?: "default" | "compact";
}) {
  const appointment = scheduledPlanningAppointment(project);
  const remote = isRemoteConsultation(project);
  const appointmentNoun = planningAppointmentNoun(project);
  const scheduledLabel = planningScheduledLabel(project);
  const initialDate = appointment?.date || dateKey(nextBusinessDay());
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedTime, setSelectedTime] = useState(appointment?.time || "14:00");
  const [consultantName, setConsultantName] = useState(appointment?.consultantName || "");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = dateFromKey(initialDate);
    return new Date(date.getFullYear(), date.getMonth(), 1, 12);
  });
  const [showToast, setShowToast] = useState(false);
  const days = useMemo(() => calendarDays(calendarMonth), [calendarMonth]);
  const todayKey = dateKey(new Date());

  useEffect(() => {
    if (!showToast) return;
    const timer = window.setTimeout(() => setShowToast(false), 3200);
    return () => window.clearTimeout(timer);
  }, [showToast]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function openScheduler() {
    const current = scheduledPlanningAppointment(project);
    const date = current?.date || selectedDate || dateKey(nextBusinessDay());
    setSelectedDate(date);
    setSelectedTime(current?.time || selectedTime || "14:00");
    setConsultantName(current?.consultantName || consultantName);
    const selected = dateFromKey(date);
    setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1, 12));
    setOpen(true);
  }

  function confirmAppointment() {
    const cleanName = consultantName.trim();
    if (!selectedDate || !selectedTime || !cleanName) return;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time";
    onUpdate({
      ...project,
      planningAppointment: {
        status: "scheduled",
        date: selectedDate,
        time: selectedTime,
        timeZone,
        consultantName: cleanName,
        scheduledAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });
    setOpen(false);
    setShowToast(true);
  }

  const overlay = typeof document === "undefined" ? null : createPortal(<>
    {open && <div className="planning-scheduler-backdrop" data-planning-scheduler-open="true" data-presentation-interactive="true" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); } }}>
      <section className="planning-scheduler-modal" role="dialog" aria-modal="true" aria-labelledby="planning-scheduler-title">
        <header className="planning-scheduler-header">
          <div><span className="presentation-kicker">Choose the appointment</span><h2 id="planning-scheduler-title">{remote ? "Schedule a consultation call" : "Schedule onsite planning"}</h2><p>Select the date, time, and Technology Consultant while you have the client on the phone.</p></div>
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
              return <button
                type="button"
                key={key}
                className={`${inMonth ? "" : "outside"} ${key === todayKey ? "today" : ""} ${key === selectedDate ? "selected" : ""}`}
                disabled={disabled}
                onClick={() => setSelectedDate(key)}
                aria-pressed={key === selectedDate}
              ><span>{date.getDate()}</span></button>;
            })}</div>
          </div>

          <div className="planning-appointment-panel">
            <div className="planning-selected-date"><span>Selected date</span><strong>{shortDate(selectedDate)}</strong></div>
            <label className="planning-consultant-field"><span>Technology Consultant</span><input autoFocus value={consultantName} onChange={(event) => setConsultantName(event.target.value)} placeholder="Enter consultant name" /></label>
            <fieldset className="planning-time-field"><legend>Appointment time</legend><div>{TIME_OPTIONS.map((time) => <button type="button" className={selectedTime === time ? "selected" : ""} key={time} onClick={() => setSelectedTime(time)}>{displayTime(time)}</button>)}</div><label><span>Custom time</span><input type="time" value={selectedTime} onChange={(event) => setSelectedTime(event.target.value)} /></label></fieldset>
            <div className="planning-appointment-summary"><span className="summary-check"><CheckIcon /></span><div><strong>{selectedDate && selectedTime ? `${shortDate(selectedDate)} at ${displayTime(selectedTime)}` : "Choose a date and time"}</strong><small>{consultantName.trim() ? `${consultantName.trim()} will be shown in the client report and PDF.` : "Enter the consultant's name to complete the appointment."}</small></div></div>
            <div className="planning-scheduler-actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="confirm" disabled={!selectedDate || !selectedTime || !consultantName.trim()} onClick={confirmAppointment}>{remote ? "Confirm consultation call" : "Confirm onsite planning"}</button></div>
          </div>
        </div>
      </section>
    </div>}

    {showToast && <div className="onsite-planning-toast" role="status" aria-live="assertive"><span><CheckIcon /></span><div><strong>{remote ? "Consultation Call Scheduled" : "Onsite Planning Scheduled"}</strong><small>{consultantName.trim()} · {shortDate(selectedDate)} at {displayTime(selectedTime)}</small></div></div>}
  </>, document.body);

  return <>
    <button
      className={`planning-consultation-banner planning-schedule-trigger ${variant === "compact" ? "planning-schedule-compact" : ""} ${appointment ? "scheduled" : ""}`}
      type="button"
      onClick={openScheduler}
      aria-label={appointment ? `Edit scheduled ${appointmentNoun}` : `Schedule a ${appointmentNoun}`}
    >
      <span className="planning-schedule-copy">
        <span className="presentation-kicker">{appointment ? scheduledLabel : "Recommended next step"}</span>
        <strong className="planning-schedule-title">{appointment ? formatPlanningAppointment(appointment) : title}</strong>
        <span className="planning-schedule-description">{appointment ? planningConsultantSentence(project, appointment) : copy}</span>
      </span>
      <span className="planning-session-outcomes" aria-hidden="true">
        {appointment
          ? <><span className="scheduled-check"><CheckIcon /></span><span>Appointment confirmed</span><span>{appointment.consultantName}</span><span>Included in the PDF</span></>
          : outcomes.map((item) => <span key={item}>{item}</span>)}
      </span>
    </button>
    {overlay}
  </>;
}
