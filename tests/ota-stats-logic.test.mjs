import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

async function loadStatsLogic() {
  return transpileTestModule("../src/app/ota-stats/logic.ts", import.meta.url, { prefix: "ota-stats-logic" });
}

test("OTA performance counts strictly by set date, not appointment date", async () => {
  const { buildOtaYearStats } = await loadStatsLogic();
  const rows = [
    { id: "a", set_date: "2026-01-31", appointment_date: "2026-02-10", tc_name: "Shawn" },
    { id: "b", set_date: "2025-12-30", appointment_date: "2026-01-08", tc_name: "Shawn Lamb" },
    { id: "c", set_date: null, appointment_date: "2026-03-12", tc_name: "Eric" },
  ];
  const stats = buildOtaYearStats(rows, 2026, "all", "2026-08-24");
  assert.equal(stats.total, 1);
  assert.equal(stats.monthly[0], 1);
  assert.equal(stats.monthly[1], 0);
  assert.equal(stats.missingSetDate, 1);
});

test("TC aliases roll up into one leaderboard identity", async () => {
  const { buildOtaYearStats } = await loadStatsLogic();
  const rows = [
    { id: "a", set_date: "2026-01-05", appointment_date: "2026-01-10", tc_name: "Shawn" },
    { id: "b", set_date: "2026-02-05", appointment_date: "2026-02-10", tc_name: "Shawn Lamb" },
    { id: "c", set_date: "2026-02-08", appointment_date: "2026-02-12", tc_name: "Eric Prywitowski" },
  ];
  const stats = buildOtaYearStats(rows, 2026, "all", "2026-08-24");
  assert.equal(stats.tcStats[0].name, "Shawn Lamb");
  assert.equal(stats.tcStats[0].total, 2);
  assert.equal(stats.topTc.name, "Shawn Lamb");
});

test("TC filter and quarterly totals preserve set-date production", async () => {
  const { buildOtaYearStats } = await loadStatsLogic();
  const rows = [
    { id: "a", set_date: "2026-01-05", appointment_date: null, tc_name: "Eric" },
    { id: "b", set_date: "2026-04-05", appointment_date: null, tc_name: "Eric Prywitowski" },
    { id: "c", set_date: "2026-07-05", appointment_date: null, tc_name: "Shawn Lamb" },
  ];
  const stats = buildOtaYearStats(rows, 2026, "Eric Prywitowski", "2026-08-24");
  assert.equal(stats.total, 2);
  assert.deepEqual(stats.quarterly, [1, 1, 0, 0]);
  assert.equal(stats.tcStats.length, 1);
});

test("year-over-year percent handles growth and no baseline", async () => {
  const { yearOverYearPercent } = await loadStatsLogic();
  assert.equal(Math.round(yearOverYearPercent(120, 100)), 20);
  assert.equal(yearOverYearPercent(10, 0), null);
});

test("OTA performance screen exposes year review and printable PDF export", () => {
  const dashboard = fs.readFileSync(new URL("../src/app/ota-stats/ota-stats-dashboard.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /OTA Performance/);
  assert.match(dashboard, /Export PDF/);
  assert.match(dashboard, /window\.print\(\)/);
  assert.match(dashboard, /buildOtaYearStats/);
});
