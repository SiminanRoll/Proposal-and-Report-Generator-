import type { CompassClient } from "./types";

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function localDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function captainLogActivityValues(client: CompassClient): Set<string> {
  const values = new Set<string>();
  const activity = client.captainsLog?.recentActivity ?? [];
  for (const item of activity) {
    for (const value of [item.completedAt, item.scheduledAt, item.createdAt]) {
      const clean = text(value);
      if (clean) values.add(clean);
    }
  }
  return values;
}

/**
 * Returns the trusted TC sales-activity date for a Compass client.
 *
 * TC activity is imported as a date-only value (YYYY-MM-DD) together with a TC.
 * Captain's Log is a separate activity lane and must never qualify as sales activity.
 * Older Compass builds could copy Captain's Log timestamps into lastSalesInteraction;
 * this guard rejects those contaminated values while preserving valid imported TC dates.
 */
export function tcSalesActivityDate(client: CompassClient, now = new Date()): string {
  const value = text(client.lastSalesInteraction);
  const tc = text(client.technicalConsultant);
  if (!value || !tc) return "";

  // Client Record Enrichment normalizes TC activity to date-only values. Timestamps
  // are Captain's Log-shaped data and are not accepted into the TC sales lane.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";

  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  if (value > localDateKey(now)) return "";

  // Protect against the historical bridge bug when a Captain's Log event happened
  // to be stored as a date-only value.
  if (captainLogActivityValues(client).has(value)) return "";

  return value;
}

export function tcSalesActivityAgeDays(client: CompassClient, now = new Date()): number | null {
  const value = tcSalesActivityDate(client, now);
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86_400_000));
}
