import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const hipaa = fs.readFileSync(new URL("../src/components/hipaa-presentation.tsx", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("client-facing HIPAA recap hides zero Not sure metrics and rebalances remaining cards", () => {
  assert.match(hipaa, /score\.notYetAssessedCount > 0 \? "three-up" : "two-up"/);
  assert.match(hipaa, /score\.notYetAssessedCount > 0 && <article>/);
  assert.match(exportHtml, /const notSureMetric = score\.notYetAssessedCount > 0/);
  assert.match(exportHtml, /pdf-hipaa-review-metrics\$\{hipaa\.notYetAssessedCount > 0 \? "" : " without-not-sure"\}/);
  assert.match(exportHtml, /hipaa\.notYetAssessedCount > 0 \? `<article><strong>\$\{hipaa\.notYetAssessedCount\}/);
  assert.match(css, /\.hipaa-results-metrics\.two-up/);
  assert.match(exportHtml, /\.pdf-hipaa-review-metrics\.without-not-sure\{grid-template-columns:repeat\(2,1fr\)!important\}/);
});
