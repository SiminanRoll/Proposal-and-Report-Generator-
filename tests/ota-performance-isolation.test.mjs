import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard = fs.readFileSync(new URL("../src/app/ota-stats/ota-stats-dashboard.tsx", import.meta.url), "utf8");
const shared = fs.readFileSync(new URL("../src/app/ota-shared.ts", import.meta.url), "utf8");

test("public OTA Performance is isolated from protected Tracker parser logic", () => {
  assert.match(dashboard, /from "\.\.\/ota-shared"/);
  assert.doesNotMatch(dashboard, /from "\.\.\/ota-tracker\/logic"/);
  assert.match(dashboard, /ota_performance_public_snapshot/);
});

test("OTA public shared primitives stay lightweight", () => {
  assert.match(shared, /OTA_SHARED_SUPABASE_URL/);
  assert.match(shared, /OTA_SHARED_ANON_KEY/);
  assert.match(shared, /OTA_TRACKER_TIME_ZONE/);
  assert.match(shared, /chicagoDateKey/);
  assert.doesNotMatch(shared, /from "xlsx"|from 'xlsx'|XLSX/);
  assert.doesNotMatch(shared, /parseOutlookMsgEmail|parseOtaEmailFile|classifyOtaHealth|company_otas|companies/);
});
