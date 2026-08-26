import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard = fs.readFileSync(new URL("../src/app/ota-stats/ota-stats-dashboard.tsx", import.meta.url), "utf8");
const shared = fs.readFileSync(new URL("../src/app/ota-shared.ts", import.meta.url), "utf8");
const trackerLogic = fs.readFileSync(new URL("../src/app/ota-tracker/logic.ts", import.meta.url), "utf8");

function stringConstant(source, name) {
  const match = source.match(new RegExp(`export const ${name} = "([^"]+)";`));
  assert.ok(match, `${name} must remain an exported string constant`);
  return match[1];
}

function exportedFunctionSource(source, name) {
  const start = source.indexOf(`export function ${name}`);
  assert.notEqual(start, -1, `${name} must remain exported`);
  const tail = source.slice(start);
  const next = tail.indexOf("\nexport function ", 1);
  return (next >= 0 ? tail.slice(0, next) : tail).trim().replace(/\s+/g, " ");
}

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

test("public OTA primitives stay aligned with Tracker configuration and date semantics", () => {
  for (const name of ["OTA_SHARED_SUPABASE_URL", "OTA_SHARED_ANON_KEY", "OTA_TRACKER_TIME_ZONE"]) {
    assert.equal(stringConstant(shared, name), stringConstant(trackerLogic, name), `${name} drifted between public Performance and Tracker`);
  }
  assert.equal(exportedFunctionSource(shared, "chicagoDateKey"), exportedFunctionSource(trackerLogic, "chicagoDateKey"));
});

test("Tracker loads XLSX only when Outlook MSG parsing is requested", () => {
  assert.doesNotMatch(trackerLogic, /^import\s+.*from\s+["']xlsx["'];?$/m);
  assert.match(trackerLogic, /await import\(["']xlsx["']\)/);
  assert.match(trackerLogic, /const api = await getCfbApi\(\)/);
});
