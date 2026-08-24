import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const enhancer = fs.readFileSync(new URL("../src/app/ota-tracker/ota-time-input-enhancer.tsx", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../src/app/ota-tracker/page.tsx", import.meta.url), "utf8");

test("OTA time inputs use quarter-hour increments and standard hours first", () => {
  assert.match(enhancer, /input\.step = "900"/);
  assert.match(enhancer, /quarterHourValues\(6 \* 60, 18 \* 60\)/);
  assert.match(enhancer, /STANDARD_HOURS\.map/);
  assert.match(enhancer, /EXTENDED_HOURS\.map/);
});

test("OTA Tracker mounts the shared time input enhancer", () => {
  assert.match(page, /import \{ OtaTimeInputEnhancer \}/);
  assert.match(page, /<OtaTimeInputEnhancer \/>/);
});
