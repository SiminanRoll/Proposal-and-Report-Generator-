"use client";

import { useEffect } from "react";

const DATALIST_ID = "ota-quarter-hour-times";

function timeLabel(value: string): string {
  const [hourValue, minuteValue] = value.split(":").map(Number);
  const hour = Number.isFinite(hourValue) ? hourValue : 0;
  const minute = Number.isFinite(minuteValue) ? minuteValue : 0;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function quarterHourValues(startMinutes: number, endMinutes: number): string[] {
  const values: string[] = [];
  for (let minutes = startMinutes; minutes <= endMinutes; minutes += 15) {
    const hour = Math.floor(minutes / 60) % 24;
    const minute = minutes % 60;
    values.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }
  return values;
}

const STANDARD_HOURS = quarterHourValues(6 * 60, 18 * 60);
const EXTENDED_HOURS = [
  ...quarterHourValues(0, (6 * 60) - 15),
  ...quarterHourValues((18 * 60) + 15, (24 * 60) - 15),
];

export function OtaTimeInputEnhancer() {
  useEffect(() => {
    const enhance = () => {
      document.querySelectorAll<HTMLInputElement>('input[type="time"]').forEach((input) => {
        input.step = "900";
        input.setAttribute("list", DATALIST_ID);
        if (!input.title) input.title = "15-minute increments · standard hours 6:00 AM–6:00 PM shown first";
      });
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return <datalist id={DATALIST_ID}>
    {STANDARD_HOURS.map((value) => <option key={`standard-${value}`} value={value} label={timeLabel(value)} />)}
    {EXTENDED_HOURS.map((value) => <option key={`extended-${value}`} value={value} label={`${timeLabel(value)} · extended`} />)}
  </datalist>;
}
