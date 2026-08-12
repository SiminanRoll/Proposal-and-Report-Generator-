import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("TC sales activity rejects Captain's Log-shaped and unattributed dates", () => {
  const helper = readFileSync("src/lib/compass/tc-sales-activity.ts", "utf8");
  assert.match(helper, /if \(!value \|\| !tc\) return ""/);
  assert.match(helper, /\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$/);
  assert.match(helper, /captainLogActivityValues\(client\)\.has\(value\)/);
  assert.match(helper, /value > localDateKey\(now\)/);
});

test("Captain's Log refresh preserves TC sales activity and TC attribution", () => {
  const runtime = readFileSync("src/components/client-activity-runtime.tsx", "utf8");
  const coordinator = readFileSync("src/components/compass-sync-runtime.tsx", "utf8");
  assert.match(runtime, /lastSalesInteraction: client\.lastSalesInteraction/);
  assert.match(runtime, /technicalConsultant: client\.technicalConsultant/);
  assert.match(coordinator, /lastSalesInteraction: client\.lastSalesInteraction/);
  assert.match(coordinator, /technicalConsultant: client\.technicalConsultant/);
});

test("all loaded Compass clients expose only trusted TC sales dates", () => {
  const store = readFileSync("src/lib/compass/store.ts", "utf8");
  assert.match(store, /tcSalesActivityDate/);
  assert.match(store, /lastSalesInteraction: tcSalesActivityDate\(client\)/);
});

test("segment sales age is TC-only and never-touched clients count as stale", () => {
  const engine = readFileSync("src/lib/segments/engine.ts", "utf8");
  assert.match(engine, /Time since TC sales activity/);
  assert.match(engine, /tcSalesActivityAgeDays\(client, now\)/);
  assert.match(engine, /lastSalesInteraction: salesActivity/);
  assert.match(engine, /rule\.field === "sales-activity-age-days" && actual === null/);
  assert.match(engine, /rule\.operator === "gt" \|\| rule\.operator === "gte"/);
});
