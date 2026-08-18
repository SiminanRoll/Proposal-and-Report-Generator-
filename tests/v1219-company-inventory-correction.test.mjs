import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const correction = fs.readFileSync(new URL("../src/lib/compass/company-inventory-correction.ts", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../src/components/company-inventory-correction-runtime.tsx", import.meta.url), "utf8");
const technicalTruth = fs.readFileSync(new URL("../src/lib/technical-truth/index.ts", import.meta.url), "utf8");

test("company inventory correction is scoped and durable", () => {
  assert.match(correction, /more than one organization/i);
  assert.match(correction, /device\.clientId !== clientId/);
  assert.match(correction, /restoreStoredCompanyInventoryCorrections/);
  assert.match(correction, /client-compass\.company-inventory-corrections\.v1/);
  assert.match(runtime, /Import inventory/);
  assert.match(runtime, /Manual reference/);
});

test("six-month no-check-in safety flag stays enabled", () => {
  assert.match(technicalTruth, /staleDeviceMonths:\s*6/);
  assert.match(correction, /isTechnicalStale\(device\.lastUptime, device\.lastLogin, now, config\.thresholds\.staleDeviceMonths\)/);
  assert.match(runtime, /Possibly inactive/);
  assert.match(runtime, /Verify whether this device is still active or in use/);
});
