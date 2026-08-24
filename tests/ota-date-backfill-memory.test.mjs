import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("OTA backfill date picker remembers month without inventing a day", () => {
  const source = fs.readFileSync(new URL("../src/app/ota-tracker/ota-date-input-enhancer.tsx", import.meta.url), "utf8");
  assert.match(source, /ota_tracker_last_backfill_month_v1/);
  assert.match(source, /localStorage\.setItem\(STORAGE_KEY, monthSelect\.value\)/);
  assert.match(source, /blank\.textContent = "Day"/);
  assert.match(source, /presentation date/i);
  assert.match(source, /return \/ota date\/i\.test\(labelText\)/);
});
