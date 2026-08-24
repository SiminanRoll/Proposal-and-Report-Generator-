import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("OTA Tracker exposes a dedicated cleared recovery screen", () => {
  const page = fs.readFileSync(new URL("../src/app/ota-tracker/page.tsx", import.meta.url), "utf8");
  const recovery = fs.readFileSync(new URL("../src/app/ota-tracker/cleared/cleared-ota-recovery.tsx", import.meta.url), "utf8");

  assert.match(page, /\/ota-tracker\/cleared\//);
  assert.match(recovery, /Cleared OTAs/);
  assert.match(recovery, /Edit/);
  assert.match(recovery, /Restore/);
  assert.match(recovery, /tracker_cleared: false/);
  assert.match(recovery, /remains cleared and excluded from all stats/);
});

test("OTA performance continues to exclude cleared rows before calculations", () => {
  const logic = fs.readFileSync(new URL("../src/app/ota-stats/logic.ts", import.meta.url), "utf8");
  assert.match(logic, /tracker_cleared/);
  assert.match(logic, /row\.tracker_cleared !== true/);
  assert.match(logic, /activeRows\(rows\)/);
});
