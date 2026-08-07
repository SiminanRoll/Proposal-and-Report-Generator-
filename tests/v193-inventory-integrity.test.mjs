import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const outcome = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const diagnostics = fs.readFileSync(new URL("../src/lib/outcomes/inventory-diagnostics.ts", import.meta.url), "utf8");

test("v1.9.3 keeps inventory reconciliation internal and places diagnostics on the blocker", () => {
  assert.match(outcome, /inventory-integrity-panel/);
  assert.match(outcome, />Download diagnostics</);
  assert.match(outcome, /Resolve the inventory mismatch before presenting/);
  assert.match(outcome, /Resolve the inventory mismatch before downloading/);
  assert.match(outcome, /disabled=\{Boolean\(reportReconciliation && !reportReconciliation\.passed\)\}/);
  assert.doesNotMatch(outcome, /inventory-reconciliation-warning/);
});

test("v1.9.3 client-facing HTML does not render the internal reconciliation warning", () => {
  assert.doesNotMatch(html, /reconciliationWarningHtml/);
  assert.doesNotMatch(html, /Inventory needs review before sharing/);
});

test("v1.9.3 diagnostic CSV includes summary and category variances", () => {
  assert.match(diagnostics, /Source-reported asset total/);
  assert.match(diagnostics, /Source summary variance/);
  assert.match(diagnostics, /Category count variance/);
});
