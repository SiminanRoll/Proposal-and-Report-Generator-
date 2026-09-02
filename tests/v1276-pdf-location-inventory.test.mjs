import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/lib/outcomes/pdf-inventory-sync.ts", import.meta.url), "utf8");

test("PDF inventory groups devices by location before pagination", () => {
  assert.match(source, /function groupedInventoryCards\(/);
  assert.match(source, /groupedInventoryCards\(cards\)\.flatMap/);
  assert.match(source, /for \(let index = 0; index < locationCards\.length; index \+= pageSize\)/);
  assert.match(source, /data-inventory-location=/);
});

test("PDF inventory keeps Remote and Unassigned after physical offices", () => {
  assert.match(source, /if \(\/\^remote\$\/i\.test\(value\)\) return 1/);
  assert.match(source, /if \(value === UNASSIGNED_LOCATION\) return 2/);
  assert.match(source, /const UNASSIGNED_LOCATION = "Unassigned"/);
});

test("location headers and summaries are client-facing", () => {
  assert.match(source, /\$\{location\} device inventory/);
  assert.match(source, /system\$\{locationCards\.length === 1 \? "" : "s"\} assigned to \$\{location\}/);
  assert.match(source, /Current Device Inventory · \$\{location\}/);
});
