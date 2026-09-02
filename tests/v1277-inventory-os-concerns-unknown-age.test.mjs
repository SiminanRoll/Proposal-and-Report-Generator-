import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("PDF inventory surfaces OS concerns when a zero-value lifecycle stat can be replaced", () => {
  const inventory = source("src/lib/outcomes/pdf-inventory-sync.ts");
  assert.match(inventory, /osConcern: boolean/);
  assert.match(inventory, /function operatingSystemConcern\(/);
  assert.match(inventory, /data-os=/);
  assert.ok(inventory.includes("windows\\s*10"));
  assert.match(inventory, /label: "OS concerns"/);
  assert.ok(inventory.includes('const zeroValuePriority: InventoryStatus[] = ["overdue", "due-soon", "unknown", "current"]'));
  assert.match(inventory, /counts\[key\] === 0/);
});

test("unknown lifecycle age copy never presents missing ship-date data as zero years old", () => {
  const inventory = source("src/lib/outcomes/pdf-inventory-sync.ts");
  assert.match(inventory, /function lifecycleDetail\(/);
  assert.match(inventory, /Original ship date not listed/);
  assert.ok(inventory.includes("^0(?:\\.0+)?\\s+years?\\s+old$"));
  assert.match(inventory, /Warranty details not listed/);
});
