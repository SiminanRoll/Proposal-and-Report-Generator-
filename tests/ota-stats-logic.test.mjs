import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

async function loadStatsLogic() {
  return transpileTestModule("../src/app/ota-stats/logic.ts", import.meta.url, { prefix: "ota-stats-logic" });
}

test("year performance groups by OTA date and excludes cleared rows", async () => {
  const { buildOtaPeriodStats } = await loadStatsLogic();
  const rows = [
    { appointment_date: "2026-01-10", tc_name: "Shawn", tracker_cleared: false },
    { appointment_date: "2026-02-10", tc_name: "Shawn Lamb", tracker_cleared: false },
    { appointment_date: "2026-03-10", tc_name: "Eric", tracker_cleared: true },
  ];
  const stats = buildOtaPeriodStats(rows, "year", "2026", "all", "2026-08-24");
  assert.equal(stats.total, 2);
  assert.equal(stats.bucketTotals[0], 1);
  assert.equal(stats.bucketTotals[1], 1);
  assert.deepEqual(stats.summaryTotals, [2, 0, 0, 0]);
});

test("My Sets requires explicit ownership while All Company retains unattributed history", async () => {
  const { buildOtaPeriodStats, rowsForPerformanceScope } = await loadStatsLogic();
  const rows = [
    { appointment_date: "2026-08-03", tc_name: "Chris Beadle", is_my_set: true },
    { appointment_date: "2026-08-10", tc_name: "Chris Beadle", is_my_set: false },
    { appointment_date: "2026-08-17", tc_name: "Chris Beadle" },
  ];
  const mine = buildOtaPeriodStats(rowsForPerformanceScope(rows, "mine"), "month", "2026-08", "all", "2026-08-24");
  const company = buildOtaPeriodStats(rowsForPerformanceScope(rows, "company"), "month", "2026-08", "all", "2026-08-24");
  assert.equal(mine.total, 1);
  assert.equal(company.total, 3);
});

test("Chris and Chris Beadle roll up to Chris Beadle", async () => {
  const { buildOtaPeriodStats } = await loadStatsLogic();
  const rows = [
    { appointment_date: "2026-08-03", tc_name: "Chris" },
    { appointment_date: "2026-08-10", tc_name: "Chris Beadle" },
  ];
  const stats = buildOtaPeriodStats(rows, "month", "2026-08", "all", "2026-08-24");
  assert.equal(stats.tcStats.length, 1);
  assert.equal(stats.tcStats[0].name, "Chris Beadle");
  assert.equal(stats.tcStats[0].total, 2);
});

test("week view breaks the selected week into seven days", async () => {
  const { buildOtaPeriodStats } = await loadStatsLogic();
  const rows = [
    { appointment_date: "2026-08-24", tc_name: "Craig Marten" },
    { appointment_date: "2026-08-30", tc_name: "Matt Minicozzi" },
  ];
  const stats = buildOtaPeriodStats(rows, "week", "2026-08-24", "all", "2026-08-24");
  assert.equal(stats.buckets.length, 7);
  assert.equal(stats.bucketTotals[0], 1);
  assert.equal(stats.bucketTotals[6], 1);
  assert.equal(stats.total, 2);
});

test("month view breaks the month into calendar-week buckets", async () => {
  const { buildOtaPeriodStats } = await loadStatsLogic();
  const rows = [
    { appointment_date: "2026-08-01", tc_name: "Eric" },
    { appointment_date: "2026-08-24", tc_name: "Eric Prywitowski" },
  ];
  const stats = buildOtaPeriodStats(rows, "month", "2026-08", "all", "2026-08-24");
  assert.ok(stats.buckets.length >= 5);
  assert.equal(stats.total, 2);
  assert.equal(stats.tcStats[0].name, "Eric Prywitowski");
});

test("quarter and year period options are derived from OTA dates", async () => {
  const { availablePeriodOptions } = await loadStatsLogic();
  const rows = [
    { appointment_date: "2026-02-01", tc_name: "Shawn Lamb" },
    { appointment_date: "2026-08-01", tc_name: "Shawn Lamb" },
  ];
  const quarterOptions = availablePeriodOptions(rows, "quarter", "2026-08-24");
  assert.ok(quarterOptions.some((item) => item.key === "2026-Q1"));
  assert.ok(quarterOptions.some((item) => item.key === "2026-Q3"));
  const yearOptions = availablePeriodOptions(rows, "year", "2026-08-24");
  assert.deepEqual(yearOptions.map((item) => item.key), ["2026"]);
});

test("performance screen is public, scope-aware, period-aware, and printable", () => {
  const dashboard = fs.readFileSync(new URL("../src/app/ota-stats/ota-stats-dashboard.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /ota_performance_public_snapshot/);
  assert.match(dashboard, /PUBLIC PERFORMANCE/);
  assert.match(dashboard, /useState<PerformanceScope>\("mine"\)/);
  assert.match(dashboard, /rowsForPerformanceScope\(rows, scope\)/);
  assert.match(dashboard, /My Sets/);
  assert.match(dashboard, /All Company/);
  assert.match(dashboard, /Assigned TC is separate from Set By/);
  assert.match(dashboard, /value="week"/);
  assert.match(dashboard, /value="month"/);
  assert.match(dashboard, /value="quarter"/);
  assert.match(dashboard, /value="year"/);
  assert.match(dashboard, /Export PDF/);
  assert.match(dashboard, /window\.print\(\)/);
  assert.doesNotMatch(dashboard, /getCaptainsLogCloudAuthSnapshot/);
  assert.doesNotMatch(dashboard, /OTA_TEAM_VIEW_STORAGE_KEY/);
  assert.doesNotMatch(dashboard, /Needs backfill/i);
  assert.doesNotMatch(dashboard, /No prior-year baseline/i);
});
