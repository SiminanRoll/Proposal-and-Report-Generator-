import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

async function loadStatsLogic() {
  return transpileTestModule("../src/app/ota-stats/logic.ts", import.meta.url, { prefix: "ota-stats-logic" });
}

test("OTA performance counts strictly by appointment date", async () => {
  const { buildOtaYearStats } = await loadStatsLogic();
  const rows = [
    { id: "a", appointment_date: "2026-02-10", tc_name: "Shawn" },
    { id: "b", appointment_date: "2026-01-08", tc_name: "Shawn Lamb" },
    { id: "c", appointment_date: "2026-03-12", tc_name: "Eric" },
  ];
  const stats = buildOtaYearStats(rows, 2026, "all", "2026-08-24");
  assert.equal(stats.total, 3);
  assert.equal(stats.monthly[0], 1);
  assert.equal(stats.monthly[1], 1);
  assert.equal(stats.monthly[2], 1);
  assert.equal(stats.missingAppointmentDate, 0);
});

test("cleared OTAs are excluded from every performance calculation", async () => {
  const { availableStatsYears, availableTcNames, buildOtaYearStats } = await loadStatsLogic();
  const rows = [
    { id: "active", appointment_date: "2026-03-10", tc_name: "Matt Minicozzi", tracker_cleared: false },
    { id: "cleared", appointment_date: "2026-04-10", tc_name: "Shawn Lamb", tracker_cleared: true },
    { id: "cleared-old", appointment_date: "2025-11-10", tc_name: "Eric Prywitowski", tracker_cleared: true },
    { id: "cleared-backfill", appointment_date: null, tc_name: "Jason Keller", tracker_cleared: true },
  ];
  const stats = buildOtaYearStats(rows, 2026, "all", "2026-08-24");
  assert.equal(stats.total, 1);
  assert.deepEqual(stats.quarterly, [1, 0, 0, 0]);
  assert.equal(stats.missingAppointmentDate, 0);
  assert.deepEqual(availableStatsYears(rows, 2026), [2026]);
  assert.deepEqual(availableTcNames(rows), ["Matt Minicozzi"]);
});

test("TC aliases roll up into one leaderboard identity", async () => {
  const { buildOtaYearStats } = await loadStatsLogic();
  const rows = [
    { id: "a", appointment_date: "2026-01-10", tc_name: "Shawn" },
    { id: "b", appointment_date: "2026-02-10", tc_name: "Shawn Lamb" },
    { id: "c", appointment_date: "2026-02-12", tc_name: "Eric Prywitowski" },
  ];
  const stats = buildOtaYearStats(rows, 2026, "all", "2026-08-24");
  assert.equal(stats.tcStats[0].name, "Shawn Lamb");
  assert.equal(stats.tcStats[0].total, 2);
  assert.equal(stats.topTc.name, "Shawn Lamb");
});

test("Matt and Matthew Minicozzi aliases roll up as Matt Minicozzi", async () => {
  const { buildOtaYearStats } = await loadStatsLogic();
  const rows = [
    { id: "a", appointment_date: "2026-01-05", tc_name: "Matt Minicozzi" },
    { id: "b", appointment_date: "2026-02-05", tc_name: "Matthew Minicozzi" },
  ];
  const stats = buildOtaYearStats(rows, 2026, "all", "2026-08-24");
  assert.equal(stats.tcStats.length, 1);
  assert.equal(stats.tcStats[0].name, "Matt Minicozzi");
  assert.equal(stats.tcStats[0].total, 2);
});

test("TC filter and quarterly totals preserve OTA-date production", async () => {
  const { buildOtaYearStats } = await loadStatsLogic();
  const rows = [
    { id: "a", appointment_date: "2026-01-05", tc_name: "Eric" },
    { id: "b", appointment_date: "2026-04-05", tc_name: "Eric Prywitowski" },
    { id: "c", appointment_date: "2026-07-05", tc_name: "Shawn Lamb" },
  ];
  const stats = buildOtaYearStats(rows, 2026, "Eric Prywitowski", "2026-08-24");
  assert.equal(stats.total, 2);
  assert.deepEqual(stats.quarterly, [1, 1, 0, 0]);
  assert.equal(stats.tcStats.length, 1);
});

test("missing OTA dates are surfaced without entering totals", async () => {
  const { buildOtaYearStats } = await loadStatsLogic();
  const rows = [
    { id: "dated", appointment_date: "2026-05-05", tc_name: "Craig Marten" },
    { id: "undated", appointment_date: null, tc_name: "Craig Marten" },
  ];
  const stats = buildOtaYearStats(rows, 2026, "all", "2026-08-24");
  assert.equal(stats.total, 1);
  assert.equal(stats.missingAppointmentDate, 1);
});

test("year-over-year percent handles growth and no baseline", async () => {
  const { yearOverYearPercent } = await loadStatsLogic();
  assert.equal(Math.round(yearOverYearPercent(120, 100)), 20);
  assert.equal(yearOverYearPercent(10, 0), null);
});

test("OTA performance screen exposes OTA-date reporting, clear-state, and printable PDF export", () => {
  const dashboard = fs.readFileSync(new URL("../src/app/ota-stats/ota-stats-dashboard.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /OTA Performance/);
  assert.match(dashboard, /Export PDF/);
  assert.match(dashboard, /window\.print\(\)/);
  assert.match(dashboard, /buildOtaYearStats/);
  assert.match(dashboard, /tracker_cleared/);
  assert.match(dashboard, /Counted by OTA date/);
  assert.match(dashboard, /Based on OTA date/);
  assert.doesNotMatch(dashboard, /Based only on set date/);
});
