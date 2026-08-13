import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const runtime = fs.readFileSync(new URL("../src/components/client-workspace-layout-runtime.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/company-details-layout.css", import.meta.url), "utf8");

test("Company Detail exposes one order across every configurable page item", () => {
  assert.match(runtime, /type LayoutKey = "last-review"[\s\S]*"technical-details"/);
  assert.match(runtime, /const ALL_ITEMS: LayoutKey\[\]/);
  assert.match(runtime, /preference\.order\.map/);
  assert.doesNotMatch(runtime, /draggedSummary|draggedContext|draggedSection/);
});

test("every item supports quarter, half, and full width", () => {
  assert.match(runtime, /type LayoutSize = "quarter" \| "half" \| "full"/);
  assert.match(runtime, /node\.dataset\.companyLayoutSize = preference\.sizes\[key\]/);
  assert.match(runtime, /<option value="quarter">Quarter<\/option><option value="half">Half<\/option><option value="full">Full<\/option>/);
  assert.match(css, /data-company-layout-size="quarter"[\s\S]*grid-column:span 3/);
  assert.match(css, /data-company-layout-size="half"[\s\S]*grid-column:span 6/);
  assert.match(css, /data-company-layout-size="full"[\s\S]*grid-column:1\/-1/);
});

test("selected size changes information density as well as dimensions", () => {
  assert.match(css, /data-company-layout-item="captains-log"[\s\S]*client-review-activity-summary-v1123 small/);
  assert.match(css, /data-company-layout-item="company-notes"[\s\S]*textarea/);
  assert.match(css, /data-company-layout-item="technology"[\s\S]*client-review-needs-v10941/);
  assert.match(css, /data-company-layout-item="technical-details"[\s\S]*client-review-technical-body-v10941/);
});

test("legacy grouped layout choices migrate into the unified preference", () => {
  assert.match(runtime, /LEGACY_STORAGE_KEY/);
  assert.match(runtime, /raw\.summaryOrder/);
  assert.match(runtime, /raw\.contextOrder/);
  assert.match(runtime, /raw\.sectionOrder/);
});
