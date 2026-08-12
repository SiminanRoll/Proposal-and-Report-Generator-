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

function validDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime());
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

function isCaptainLogCollision(client: CompassClient, value: string): boolean {
  if (!value) return false;
  const activityValues = captainLogActivityValues(client);
  if (activityValues.has(value)) return true;
  return [...activityValues].some((activityValue) => activityValue.startsWith(`${value}T`));
}

/**
 * Returns a future-dated TC sales value that should be quarantined from age
 * segmentation. Future dates are not completed sales activity, but we preserve
 * the fact that one exists so "not worked in the last X days" does not
 * accidentally classify that client as untouched.
 */
export function tcFutureSalesActivityDate(client: CompassClient, now = new Date()): string {
  const tc = text(client.technicalConsultant);
  if (!tc) return "";
  const today = localDateKey(now);
  const candidates = [text(client.futureTechnicalConsultantActivity), text(client.lastSalesInteraction)];
  for (const value of candidates) {
    if (!validDateOnly(value) || value <= today) continue;
    if (isCaptainLogCollision(client, value)) continue;
    return value;
  }
  return "";
}

/**
 * Returns the trusted completed TC sales-activity date for a Compass client.
 *
 * TC activity is imported as a date-only value (YYYY-MM-DD) together with a TC.
 * Captain's Log is a separate activity lane and must never qualify as sales activity.
 * Today is a valid completed activity date. Future dates are deliberately excluded.
 */
export function tcSalesActivityDate(client: CompassClient, now = new Date()): string {
  const value = text(client.lastSalesInteraction);
  const tc = text(client.technicalConsultant);
  if (!value || !tc) return "";
  if (!validDateOnly(value)) return "";
  if (value > localDateKey(now)) return "";
  if (isCaptainLogCollision(client, value)) return "";
  return value;
}

/**
 * Normalizes the persisted sales lane without losing awareness of a future date.
 * The completed date remains in lastSalesInteraction; a future value is moved to
 * an internal quarantine field so it cannot masquerade as completed activity.
 */
export function normalizeTcSalesActivityForStorage(client: CompassClient, now = new Date()): Pick<CompassClient, "lastSalesInteraction" | "futureTechnicalConsultantActivity"> {
  return {
    lastSalesInteraction: tcSalesActivityDate(client, now),
    futureTechnicalConsultantActivity: tcFutureSalesActivityDate(client, now) || undefined,
  };
}

export function tcSalesActivityAgeDays(client: CompassClient, now = new Date()): number | null {
  // NaN is intentional here: it makes every numeric age comparison false.
  // A future date is neither "worked recently" nor "stale" until it becomes a
  // completed date or is corrected, which keeps future/scheduled data out of
  // both sides of TC activity age segments.
  if (tcFutureSalesActivityDate(client, now)) return Number.NaN;

  const value = tcSalesActivityDate(client, now);
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86_400_000));
}
