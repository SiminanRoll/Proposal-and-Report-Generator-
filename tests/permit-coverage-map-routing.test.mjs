import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dashboard = readFileSync(path.join(root, "public", "captains-log-dashboard", "dashboard-permit-map.js"), "utf8");
const mapPage = readFileSync(path.join(root, "src", "app", "permit-coverage-map", "page.tsx"), "utf8");

test("permit source state inference uses whole state tokens instead of arbitrary letter pairs", () => {
  assert.match(dashboard, /\\b\(WI\|MI\|IL\|IN\|OH\|KY\|TN\|AL\|GA\|FL\)\\b/);
  assert.doesNotMatch(dashboard, /match\(\/\[A-Z\]\{2\}\//);
});

test("permit coverage totals are explicitly labeled as all-state totals", () => {
  assert.match(dashboard, /ALL STATES TOTAL:/);
  assert.match(mapPage, /all states total · permit leads/);
});
