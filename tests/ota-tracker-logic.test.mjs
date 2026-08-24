import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

async function loadLogic() {
  const xlsxStub = `data:text/javascript,${encodeURIComponent("export const CFB = {};\n")}`;
  return transpileTestModule("../src/app/ota-tracker/logic.ts", import.meta.url, {
    prefix: "ota-tracker-logic",
    replacements: { 'from "xlsx"': `from ${JSON.stringify(xlsxStub)}` },
  });
}

test("OTA quote aging pauses on weekends and advances on Chicago business dates", async () => {
  const { classifyOtaHealth } = await loadLogic();
  const monday = "2026-08-24";

  assert.deepEqual(classifyOtaHealth("2026-08-21", false, "", monday), { key: "grace", label: "Grace window", daysPast: 1, rank: 5 });
  assert.deepEqual(classifyOtaHealth("2026-08-20", false, "", monday), { key: "due", label: "Quote due", daysPast: 2, rank: 6 });
  assert.deepEqual(classifyOtaHealth("2026-08-19", false, "", monday), { key: "overdue", label: "Overdue", daysPast: 3, rank: 7 });

  assert.equal(classifyOtaHealth("2026-08-21", false, "", "2026-08-22").daysPast, 0);
  assert.equal(classifyOtaHealth("2026-08-21", false, "", "2026-08-23").daysPast, 0);
  assert.equal(classifyOtaHealth("2026-08-22", false, "", monday).daysPast, 1);
  assert.equal(classifyOtaHealth("2026-08-23", false, "", monday).daysPast, 1);
});

test("OTA health thresholds remain green through business day 1, yellow on 2, and red on 3+", async () => {
  const { classifyOtaHealth } = await loadLogic();
  const today = "2026-08-26";

  assert.equal(classifyOtaHealth("2026-08-25", false, "", today).key, "grace");
  assert.equal(classifyOtaHealth("2026-08-24", false, "", today).key, "due");
  assert.equal(classifyOtaHealth("2026-08-21", false, "", today).key, "overdue");
  assert.equal(classifyOtaHealth("2026-08-21", true, "", today).key, "quoted");
});

test("Latest OTAs includes all future dates and the previous 60 calendar days", async () => {
  const { compareLatestOtaDates, isOtaInLatestWindow } = await loadLogic();
  const today = "2026-08-24";

  assert.equal(isOtaInLatestWindow("2027-01-15", today), true);
  assert.equal(isOtaInLatestWindow("2026-06-25", today), true);
  assert.equal(isOtaInLatestWindow("2026-06-24", today), false);
  assert.equal(isOtaInLatestWindow(null, today), false);

  const dates = ["2026-08-01", "2026-09-01", "2026-08-24", "2026-08-23", "2026-08-25"];
  assert.deepEqual(dates.toSorted((left, right) => compareLatestOtaDates(left, right, today)), [
    "2026-08-25",
    "2026-09-01",
    "2026-08-24",
    "2026-08-23",
    "2026-08-01",
  ]);
});

test("OTA dashboard uses Latest OTAs as the primary view", () => {
  const dashboard = fs.readFileSync(new URL("../src/app/ota-tracker/ota-tracker-dashboard.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /useState<FilterKey>\("latest"\)/);
  assert.match(dashboard, /isOtaInLatestWindow\(row\.appointment_date, today\)/);
  assert.match(dashboard, /compareLatestOtaDates\(left\.appointment_date, right\.appointment_date, today\)/);
});
