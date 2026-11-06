/**
 * Reusable one-click GHL coordination-task template. Saved by Client Compass's
 * existing browser-local storage and included in its Protected Workspace mirror.
 * Not a fixed calendar date: every click resolves a fresh local due date.
 */
export const GHL_TASK_TEMPLATE_KEY = "client-compass.ghl-task-template.v1";

export const DEFAULT_GHL_TASK_TEMPLATE = Object.freeze({
  title: "Coordination Call",
  description: "",
  dueBusinessDays: 1,
  dueTime: "10:00",
  timeZone: "America/Chicago",
});

export function validateGhlTaskTemplate(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (typeof value.title !== "string" || !value.title.trim() || value.title.trim().length > 120 ||
      typeof value.description !== "string" || value.description.length > 2000 ||
      !Number.isInteger(value.dueBusinessDays) || value.dueBusinessDays < 0 ||
      value.dueBusinessDays > 14 ||
      typeof value.dueTime !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.dueTime) ||
      typeof value.timeZone !== "string") return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value.timeZone });
  } catch {
    return null;
  }
  return {
    title: value.title.trim(),
    description: value.description,
    dueBusinessDays: value.dueBusinessDays,
    dueTime: value.dueTime,
    timeZone: value.timeZone,
  };
}

/** 0 = today. A positive offset counts the next N weekdays in the chosen
 * timezone, skipping Saturday and Sunday without changing the saved rule. */
export function dueDateForTaskTemplate(template, now = new Date()) {
  const valid = validateGhlTaskTemplate(template);
  if (!valid) throw new Error("Save a valid GHL task template in Settings.");
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error("Invalid local current time.");
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: valid.timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value]),
  );
  const calendar = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  let remaining = valid.dueBusinessDays;
  while (remaining > 0) {
    calendar.setUTCDate(calendar.getUTCDate() + 1);
    const weekday = calendar.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining--;
  }
  const date = calendar.toISOString().slice(0, 10);
  return { date, time: valid.dueTime, timeZone: valid.timeZone };
}
