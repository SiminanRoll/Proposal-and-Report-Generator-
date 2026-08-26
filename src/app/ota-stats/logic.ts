export type PerformanceGrain = "week" | "month" | "quarter" | "year";
export type PerformanceScope = "mine" | "company";

export type OtaStatsSourceRow = {
  id?: string;
  appointment_date: string | null;
  tc_name: string | null;
  is_my_set?: boolean | null;
  tracker_cleared?: boolean | null;
};

export type PeriodOption = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
};

export type StatsBucket = {
  key: string;
  label: string;
  shortLabel: string;
  startDate: string;
  endDate: string;
};

export type OtaTcPeriodStats = {
  name: string;
  total: number;
  buckets: number[];
  summary: number[];
  share: number;
  bestBucketIndex: number;
  bestBucketCount: number;
};

export type OtaPeriodStats = {
  grain: PerformanceGrain;
  periodKey: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  total: number;
  buckets: StatsBucket[];
  bucketTotals: number[];
  summaryBuckets: StatsBucket[];
  summaryTotals: number[];
  tcStats: OtaTcPeriodStats[];
  topTc: OtaTcPeriodStats | null;
  average: number;
  averageLabel: string;
  maxBucketTotal: number;
  maxHeatValue: number;
};

const DAY_MS = 86_400_000;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

export function rowsForPerformanceScope(rows: OtaStatsSourceRow[], scope: PerformanceScope): OtaStatsSourceRow[] {
  return scope === "mine" ? rows.filter((row) => row.is_my_set === true) : rows;
}

function dateFromKey(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(key: string, days: number): string {
  return dateKey(new Date(dateFromKey(key).getTime() + days * DAY_MS));
}

function compareKeys(left: string, right: string): number {
  return left.localeCompare(right);
}

function minKey(left: string, right: string): string {
  return compareKeys(left, right) <= 0 ? left : right;
}

function maxKey(left: string, right: string): string {
  return compareKeys(left, right) >= 0 ? left : right;
}

function monthEndKey(year: number, monthIndex: number): string {
  return dateKey(new Date(Date.UTC(year, monthIndex + 1, 0)));
}

function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function startOfWeekKey(key: string): string {
  const date = dateFromKey(key);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return addDays(key, -mondayOffset);
}

function formatCompactRange(startKey: string, endKey: string): string {
  const start = dateFromKey(startKey);
  const end = dateFromKey(endKey);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth) return `${MONTH_SHORT[start.getUTCMonth()]} ${start.getUTCDate()}–${end.getUTCDate()}, ${start.getUTCFullYear()}`;
  if (sameYear) return `${MONTH_SHORT[start.getUTCMonth()]} ${start.getUTCDate()}–${MONTH_SHORT[end.getUTCMonth()]} ${end.getUTCDate()}, ${start.getUTCFullYear()}`;
  return `${MONTH_SHORT[start.getUTCMonth()]} ${start.getUTCDate()}, ${start.getUTCFullYear()}–${MONTH_SHORT[end.getUTCMonth()]} ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
}

export function canonicalTcName(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "Unassigned";
  return TC_ALIASES[normalizedName(raw)] || raw;
}

export function validStatsDate(value: unknown): value is string {
  return /^\d{4}-\d{2}-\d{2}$/.test(clean(value));
}

export function availableTcNames(rows: OtaStatsSourceRow[]): string[] {
  return [...new Set(
    activeRows(rows)
      .filter((row) => validStatsDate(row.appointment_date))
      .map((row) => canonicalTcName(row.tc_name))
      .filter((name) => name !== "Unassigned"),
  )].sort((left, right) => left.localeCompare(right));
}

export function periodKeyForDate(grain: PerformanceGrain, appointmentDate: string): string {
  if (!validStatsDate(appointmentDate)) return "";
  const date = dateFromKey(appointmentDate);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  if (grain === "year") return String(year);
  if (grain === "quarter") return `${year}-Q${Math.floor(month / 3) + 1}`;
  if (grain === "month") return monthKey(year, month);
  return startOfWeekKey(appointmentDate);
}

export function periodBounds(grain: PerformanceGrain, key: string): PeriodOption {
  if (grain === "year") {
    const year = Number(key);
    return { key, label: String(year), startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  }
  if (grain === "quarter") {
    const match = key.match(/^(\d{4})-Q([1-4])$/);
    const year = Number(match?.[1]);
    const quarter = Number(match?.[2]);
    const startMonth = (quarter - 1) * 3;
    return {
      key,
      label: `Q${quarter} ${year}`,
      startDate: `${monthKey(year, startMonth)}-01`,
      endDate: monthEndKey(year, startMonth + 2),
    };
  }
  if (grain === "month") {
    const [yearValue, monthValue] = key.split("-").map(Number);
    const monthIndex = monthValue - 1;
    return {
      key,
      label: `${MONTH_NAMES[monthIndex]} ${yearValue}`,
      startDate: `${key}-01`,
      endDate: monthEndKey(yearValue, monthIndex),
    };
  }
  const startDate = key;
  const endDate = addDays(startDate, 6);
  return { key, label: formatCompactRange(startDate, endDate), startDate, endDate };
}

export function availablePeriodOptions(rows: OtaStatsSourceRow[], grain: PerformanceGrain, todayKey: string): PeriodOption[] {
  const keys = new Set<string>();
  const currentKey = periodKeyForDate(grain, todayKey);
  if (currentKey) keys.add(currentKey);
  for (const row of activeRows(rows)) {
    if (!validStatsDate(row.appointment_date)) continue;
    const key = periodKeyForDate(grain, row.appointment_date);
    if (key) keys.add(key);
  }
  return [...keys]
    .map((key) => periodBounds(grain, key))
    .sort((left, right) => right.startDate.localeCompare(left.startDate));
}

function timelineBuckets(grain: PerformanceGrain, period: PeriodOption): StatsBucket[] {
  const start = dateFromKey(period.startDate);
  const end = dateFromKey(period.endDate);

  if (grain === "week") {
    return Array.from({ length: 7 }, (_, index) => {
      const key = addDays(period.startDate, index);
      const date = dateFromKey(key);
      return {
        key,
        label: `${WEEKDAY_SHORT[date.getUTCDay()]} ${MONTH_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}`,
        shortLabel: `${WEEKDAY_SHORT[date.getUTCDay()]} ${date.getUTCDate()}`,
        startDate: key,
        endDate: key,
      };
    });
  }

  if (grain === "month") {
    const buckets: StatsBucket[] = [];
    let cursor = period.startDate;
    let index = 1;
    while (compareKeys(cursor, period.endDate) <= 0) {
      const cursorDate = dateFromKey(cursor);
      const daysToSunday = (7 - cursorDate.getUTCDay()) % 7;
      const bucketEnd = minKey(addDays(cursor, daysToSunday), period.endDate);
      buckets.push({
        key: `${period.key}-W${index}`,
        label: formatCompactRange(cursor, bucketEnd),
        shortLabel: `${MONTH_SHORT[cursorDate.getUTCMonth()]} ${cursorDate.getUTCDate()}–${dateFromKey(bucketEnd).getUTCDate()}`,
        startDate: cursor,
        endDate: bucketEnd,
      });
      cursor = addDays(bucketEnd, 1);
      index += 1;
    }
    return buckets;
  }

  const monthCount = grain === "quarter" ? 3 : 12;
  const startMonth = start.getUTCMonth();
  const year = start.getUTCFullYear();
  return Array.from({ length: monthCount }, (_, index) => {
    const absoluteMonth = startMonth + index;
    const bucketDate = new Date(Date.UTC(year, absoluteMonth, 1));
    const bucketYear = bucketDate.getUTCFullYear();
    const bucketMonth = bucketDate.getUTCMonth();
    const key = monthKey(bucketYear, bucketMonth);
    return {
      key,
      label: `${MONTH_NAMES[bucketMonth]} ${bucketYear}`,
      shortLabel: MONTH_SHORT[bucketMonth],
      startDate: `${key}-01`,
      endDate: monthEndKey(bucketYear, bucketMonth),
    };
  }).filter((bucket) => compareKeys(bucket.startDate, dateKey(end)) <= 0);
}

function summaryBuckets(grain: PerformanceGrain, period: PeriodOption, buckets: StatsBucket[]): StatsBucket[] {
  if (grain !== "year") return buckets;
  const year = Number(period.key);
  return [0, 1, 2, 3].map((quarterIndex) => {
    const startMonth = quarterIndex * 3;
    const startDate = `${monthKey(year, startMonth)}-01`;
    const endDate = monthEndKey(year, startMonth + 2);
    return {
      key: `${year}-Q${quarterIndex + 1}`,
      label: `Q${quarterIndex + 1} ${year}`,
      shortLabel: `Q${quarterIndex + 1}`,
      startDate,
      endDate,
    };
  });
}

function bucketIndexForDate(buckets: StatsBucket[], appointmentDate: string): number {
  return buckets.findIndex((bucket) => compareKeys(appointmentDate, bucket.startDate) >= 0 && compareKeys(appointmentDate, bucket.endDate) <= 0);
}

function averageLabel(grain: PerformanceGrain): string {
  if (grain === "week") return "Avg / day";
  if (grain === "month") return "Avg / week";
  return "Avg / month";
}

function elapsedBuckets(buckets: StatsBucket[], period: PeriodOption, todayKey: string): number {
  if (compareKeys(todayKey, period.startDate) < 0) return buckets.length;
  if (compareKeys(todayKey, period.endDate) > 0) return buckets.length;
  return Math.max(1, buckets.filter((bucket) => compareKeys(bucket.startDate, todayKey) <= 0).length);
}

export function buildOtaPeriodStats(
  rows: OtaStatsSourceRow[],
  grain: PerformanceGrain,
  periodKey: string,
  selectedTc = "all",
  todayKey = periodBounds(grain, periodKey).endDate,
): OtaPeriodStats {
  const period = periodBounds(grain, periodKey);
  const buckets = timelineBuckets(grain, period);
  const summaries = summaryBuckets(grain, period, buckets);
  const selectedName = selectedTc === "all" ? "all" : canonicalTcName(selectedTc);
  const bucketTotals = Array.from({ length: buckets.length }, () => 0);
  const summaryTotals = Array.from({ length: summaries.length }, () => 0);
  const byTc = new Map<string, { buckets: number[]; summary: number[] }>();

  for (const row of activeRows(rows)) {
    if (!validStatsDate(row.appointment_date)) continue;
    if (compareKeys(row.appointment_date, period.startDate) < 0 || compareKeys(row.appointment_date, period.endDate) > 0) continue;
    const tcName = canonicalTcName(row.tc_name);
    if (selectedName !== "all" && tcName !== selectedName) continue;
    const bucketIndex = bucketIndexForDate(buckets, row.appointment_date);
    const summaryIndex = bucketIndexForDate(summaries, row.appointment_date);
    if (bucketIndex < 0 || summaryIndex < 0) continue;
    bucketTotals[bucketIndex] += 1;
    summaryTotals[summaryIndex] += 1;
    const tc = byTc.get(tcName) || {
      buckets: Array.from({ length: buckets.length }, () => 0),
      summary: Array.from({ length: summaries.length }, () => 0),
    };
    tc.buckets[bucketIndex] += 1;
    tc.summary[summaryIndex] += 1;
    byTc.set(tcName, tc);
  }

  const total = bucketTotals.reduce((sum, value) => sum + value, 0);
  const tcStats: OtaTcPeriodStats[] = [...byTc.entries()].map(([name, counts]) => {
    const tcTotal = counts.buckets.reduce((sum, value) => sum + value, 0);
    const bestBucketCount = Math.max(0, ...counts.buckets);
    const bestBucketIndex = bestBucketCount > 0 ? counts.buckets.indexOf(bestBucketCount) : 0;
    return {
      name,
      total: tcTotal,
      buckets: counts.buckets,
      summary: counts.summary,
      share: total > 0 ? tcTotal / total : 0,
      bestBucketIndex,
      bestBucketCount,
    };
  }).sort((left, right) => right.total - left.total || left.name.localeCompare(right.name));

  return {
    grain,
    periodKey,
    periodLabel: period.label,
    startDate: period.startDate,
    endDate: period.endDate,
    total,
    buckets,
    bucketTotals,
    summaryBuckets: summaries,
    summaryTotals,
    tcStats,
    topTc: tcStats.find((tc) => tc.name !== "Unassigned") || tcStats[0] || null,
    average: total / elapsedBuckets(buckets, period, todayKey),
    averageLabel: averageLabel(grain),
    maxBucketTotal: Math.max(1, ...bucketTotals),
    maxHeatValue: Math.max(1, ...tcStats.flatMap((tc) => tc.buckets)),
  };
}

export function currentPeriodKey(grain: PerformanceGrain, todayKey: string): string {
  return periodKeyForDate(grain, todayKey);
}

export function grainTimelineLabel(grain: PerformanceGrain): string {
  if (grain === "week") return "OTAs by day";
  if (grain === "month") return "OTAs by week";
  return "OTAs by month";
}

export function grainBreakdownLabel(grain: PerformanceGrain): string {
  if (grain === "week") return "Daily breakdown";
  if (grain === "month") return "Weekly breakdown";
  if (grain === "quarter") return "Monthly breakdown";
  return "Quarterly breakdown";
}
