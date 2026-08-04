import type { PlanningAppointment, Project } from "@/lib/projects/types";

function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function scheduledPlanningAppointment(project: Project): PlanningAppointment | null {
  const appointment = project.planningAppointment;
  if (!appointment || appointment.status !== "scheduled") return null;
  if (!parseDateKey(appointment.date) || !/^\d{2}:\d{2}$/.test(appointment.time) || !appointment.consultantName.trim()) return null;
  return appointment;
}

export function formatPlanningDate(appointment: PlanningAppointment): string {
  const date = parseDateKey(appointment.date);
  if (!date) return appointment.date;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatPlanningTime(appointment: PlanningAppointment): string {
  const match = /^(\d{2}):(\d{2})$/.exec(appointment.time);
  if (!match) return appointment.time;
  const hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes} ${suffix}`;
}

export function formatPlanningAppointment(appointment: PlanningAppointment): string {
  return `${formatPlanningDate(appointment)} at ${formatPlanningTime(appointment)}`;
}

export function planningConsultantSentence(appointment: PlanningAppointment): string {
  return `Your Technology Consultant, ${appointment.consultantName.trim()}, will meet with your team onsite to review the project scope and prepare the replacement plan.`;
}
