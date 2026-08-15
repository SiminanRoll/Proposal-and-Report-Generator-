import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const handoff = fs.readFileSync(new URL("../src/lib/compass/captains-log-ota-handoff.ts", import.meta.url), "utf8");
const finish = fs.readFileSync(new URL("../src/components/prospect-a360-finish.tsx", import.meta.url), "utf8");

test("OTA handoff publishes the preliminary A360 monthly estimate range", () => {
  assert.match(handoff, /a360MonthlyLow: number/);
  assert.match(handoff, /a360MonthlyHigh: number/);
  assert.match(handoff, /p_a360_monthly_low: a360MonthlyLow/);
  assert.match(handoff, /p_a360_monthly_high: a360MonthlyHigh/);
});

test("finish recalculates the same live estimator and sends it with the OTA", () => {
  assert.match(finish, /preliminaryA360Estimate\(discovery\)/);
  assert.match(finish, /a360MonthlyLow: estimate\.low/);
  assert.match(finish, /a360MonthlyHigh: estimate\.high/);
});
