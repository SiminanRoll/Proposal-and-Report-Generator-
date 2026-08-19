import type { PlanningAppointment, Project } from "@/lib/projects/types";
import { isRemoteConsultation } from "./planning-mode";

export const PLANNING_TIME_ZONES = [
  { value: "America/New_York", label: "Eastern Time", shortLabel: "ET" },
  { value: "America/Chicago", label: "Central Time", shortLabel: "CT" },
  { value: "America/Denver", label: "Mountain Time", shortLabel: "MT" },
  { value: "America/Phoenix", label: "Arizona Time", shortLabel: "MST" },
  { value: "America/Los_Angeles", label: "Pacific Time", shortLabel: "PT" },
  { value: "America/Anchorage", label: "Alaska Time", shortLabel: "AKT" },
  { value: "Pacific/Honolulu", label: "Hawaii Time", shortLabel: "HT" },
  { value: "UTC", label: "Coordinated Universal Time", shortLabel: "UTC" },
] as const;

const TIME_ZONE_ALIASES: Record<string, string> = {
  "America/Detroit": "ET",
  "America/Indiana/Indianapolis": "ET",
  "America/Indianapolis": "ET",
  "America/Kentucky/Louisville": "ET",
  "America/Boise": "MT",
  "US/Eastern": "ET",
  "US/Central": "CT",
  "US/Mountain": "MT",
  "US/Pacific": "PT",
  "US/Alaska": "AKT",
  "US/Hawaii": "HT",
};

function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function defaultPlanningTimeZone(): string {
  if (typeof Intl !== "undefined") {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();
    if (detected) return detected;
  }
  return "UTC";
}

export function planningTimeZoneShortLabel(value: string): string {
  const clean = value.trim();
  if (!clean || clean === "Local time") return "Time zone not specified";
  const option = PLANNING_TIME_ZONES.find((item) => item.value === clean);
  return option?.shortLabel || TIME_ZONE_ALIASES[clean] || clean;
}

export function planningTimeZoneOptionLabel(value: string): string {
  const clean = value.trim();
  const option = PLANNING_TIME_ZONES.find((item) => item.value === clean);
  if (option) return `${option.label} (${option.shortLabel})`;
  if (!clean || clean === "Local time") return "Time zone not specified";
  const short = TIME_ZONE_ALIASES[clean];
  return short ? `${clean} (${short})` : clean;
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
  const zone = planningTimeZoneShortLabel(appointment.timeZone);
  const match = /^(\d{2}):(\d{2})$/.exec(appointment.time);
  if (!match) return `${appointment.time} ${zone}`.trim();
  const hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes} ${suffix} ${zone}`;
}

export function formatPlanningAppointment(appointment: PlanningAppointment): string {
  return `${formatPlanningDate(appointment)} at ${formatPlanningTime(appointment)}`;
}

export function planningConsultantSentence(project: Project, appointment: PlanningAppointment): string {
  return isRemoteConsultation(project)
    ? `Your Technology Consultant, ${appointment.consultantName.trim()}, will meet with your team by consultation call to review the priorities, confirm the project scope, and prepare the next-step plan.`
    : `Your Technology Consultant, ${appointment.consultantName.trim()}, will meet with your team onsite to review the project scope and prepare the replacement plan.`;
}
