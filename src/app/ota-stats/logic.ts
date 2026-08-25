export const OTA_STATS_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export type OtaStatsSourceRow = {
  id: string;
  appointment_date: string | null;
  tc_name: string | null;
  tracker_cleared?: boolean | null;
};

export type OtaTcStats = {
  name: string;
  total: number;
  monthly: number[];
  quarterly: number[];
  share: number;
  bestMonthIndex: number;
  bestMonthCount: number;
};

export type OtaYearStats = {
  year: number;
  total: number;
  monthly: number[];
  quarterly: number[];
  tcStats: OtaTcStats[];
  topTc: OtaTcStats | null;
  avgPerMonth: number;
  missingAppointmentDate: number;
  missingTc: number;
  maxMonthlyTotal: number;
  maxHeatValue: number;
};

const TC_ALIASES: Record<string, string> = {
  "bryan": "Bryan Currier",
  "bryan currier": "Bryan Currier",
  "craig": "Craig Marten",
  "craig marten": "Craig Marten",
  "eric": "Eric Prywitowski",
  "eric prywitowski": "Eric Prywitowski",
  "jason": "Jason Keller",
  "jason keller": "Jason Keller",
  "josh": "Joshua Bruckmoser",
  "josh bruckmoser": "Joshua Bruckmoser",
  "joshua": "Joshua Bruckmoser",
  "joshua bruckmoser": "Joshua Bruckmoser",
  "marty": "Marty Goldmintz",
  "marty goldmintz": "Marty Goldmintz",
  "shawn": "Shawn Lamb",
  "shawn lamb": "Shawn Lamb",
  "chris": "Chris Beadle",
  "chris beadle": "Chris Beadle",
  "chris kennedy": "Chris Kennedy",
  "sean killam": "Sean Killam",
  "nathan miramonti": "Nathan Miramonti",
  "josh pearl": "Josh Pearl",
  "matthew minicozzi": "Matt Minicozzi",
  "matt minicozzi": "Matt Minicozzi",
};

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizedName(value: unknown): string {
  return clean(value).toLowerCase().replace(/[.,]+$/g, "");
}

function activeRows(rows: OtaStatsSourceRow[]): OtaStatsSourceRow[] {
  return rows.filter((row) => row.tracker_cleared !== true);
}

export function canonicalTcName(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "Unassigned";
  return TC_ALIASES[normalizedName(raw)] || raw;
}

export function validStatsDate(value: unknown): value is string {
  return /^\d{4}-\d{2}-\d{2}$/.test(clean(value));
}

export function statsDateYear(value: unknown): number | null {
  if (!validStatsDate(value)) return null;
  const year = Number(String(value).slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function statsDateMonth(value: string): number {
  return Math.max(0, Math.min(11, Number(value.slice(5, 7)) - 1));
}

export function availableStatsYears(rows: OtaStatsSourceRow[], fallbackYear: number): number[] {
  const years = new Set<number>([fallbackYear]);
  for (const row of activeRows(rows)) {
    const appointmentYear = statsDateYear(row.appointment_date);
    if (appointmentYear) years.add(appointmentYear);
  }
  return [...years].sort((left, right) => right - left);
}

export function availableTcNames(rows: OtaStatsSourceRow[]): string[] {
  return [...new Set(
    activeRows(rows)
      .filter((row) => validStatsDate(row.appointment_date))
      .map((row) => canonicalTcName(row.tc_name))
      .filter((name) => name !== "Unassigned"),
  )].sort((left, right) => left.localeCompare(right));
}

function monthsElapsed(year: number, todayKey: string): number {
  const todayYear = Number(todayKey.slice(0, 4));
  const todayMonth = Number(todayKey.slice(5, 7));
  if (!Number.isFinite(todayYear) || !Number.isFinite(todayMonth)) return 12;
  if (year < todayYear) return 12;
  if (year > todayYear) return 12;
  return Math.max(1, Math.min(12, todayMonth));
}

export function buildOtaYearStats(
  rows: OtaStatsSourceRow[],
  year: number,
  selectedTc = "all",
  todayKey = `${year}-12-31`,
): OtaYearStats {
  const eligibleRows = activeRows(rows);
  const selectedName = selectedTc === "all" ? "all" : canonicalTcName(selectedTc);
  const monthly = Array.from({ length: 12 }, () => 0);
  const byTc = new Map<string, number[]>();

  let missingTc = 0;

  for (const row of eligibleRows) {
    if (statsDateYear(row.appointment_date) !== year || !row.appointment_date) continue;
    const tcName = canonicalTcName(row.tc_name);
    if (selectedName !== "all" && tcName !== selectedName) continue;
    const month = statsDateMonth(row.appointment_date);
    monthly[month] += 1;
    if (tcName === "Unassigned") missingTc += 1;
    const tcMonthly = byTc.get(tcName) || Array.from({ length: 12 }, () => 0);
    tcMonthly[month] += 1;
    byTc.set(tcName, tcMonthly);
  }

  const total = monthly.reduce((sum, count) => sum + count, 0);
  const quarterly = [0, 1, 2, 3].map((quarter) => monthly.slice(quarter * 3, quarter * 3 + 3).reduce((sum, count) => sum + count, 0));

  const tcStats: OtaTcStats[] = [...byTc.entries()].map(([name, tcMonthly]) => {
    const tcTotal = tcMonthly.reduce((sum, count) => sum + count, 0);
    const bestMonthCount = Math.max(0, ...tcMonthly);
    const bestMonthIndex = bestMonthCount > 0 ? tcMonthly.indexOf(bestMonthCount) : 0;
    return {
      name,
      total: tcTotal,
      monthly: tcMonthly,
      quarterly: [0, 1, 2, 3].map((quarter) => tcMonthly.slice(quarter * 3, quarter * 3 + 3).reduce((sum, count) => sum + count, 0)),
      share: total > 0 ? tcTotal / total : 0,
      bestMonthIndex,
      bestMonthCount,
    };
  }).sort((left, right) => right.total - left.total || left.name.localeCompare(right.name));

  const missingAppointmentDate = eligibleRows.filter((row) => !validStatsDate(row.appointment_date)).length;

  return {
    year,
    total,
    monthly,
    quarterly,
    tcStats,
    topTc: tcStats.find((tc) => tc.name !== "Unassigned") || tcStats[0] || null,
    avgPerMonth: total / monthsElapsed(year, todayKey),
    missingAppointmentDate,
    missingTc,
    maxMonthlyTotal: Math.max(1, ...monthly),
    maxHeatValue: Math.max(1, ...tcStats.flatMap((tc) => tc.monthly)),
  };
}

export function yearOverYearPercent(currentTotal: number, priorTotal: number): number | null {
  if (priorTotal <= 0) return null;
  return ((currentTotal - priorTotal) / priorTotal) * 100;
}
