import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const questions = fs.readFileSync(new URL("../src/lib/hipaa/questions.ts", import.meta.url), "utf8");

test("PDF technology health panel uses a simple three-point recap", () => {
  assert.match(exportHtml, /class="pdf-technology-recap"/);
  assert.match(exportHtml, /Systems healthy/);
  assert.match(exportHtml, /Aging system/);
  assert.match(exportHtml, /OS item/);
  assert.match(exportHtml, /class="pdf-environment-line"/);
  assert.doesNotMatch(exportHtml, /<div class="pdf-health-summary"><article class="pdf-health-score"/);
  assert.doesNotMatch(exportHtml, /<div class="pdf-environment-grid"><article class="server-first"/);
  assert.doesNotMatch(exportHtml, /<aside class="pdf-os-support-summary/);
});

test("client-facing HIPAA explanations do not mention attaching forms or documents", () => {
  assert.doesNotMatch(questions, /do not need to attach/i);
  assert.doesNotMatch(questions, /attach the assessment/i);
  assert.doesNotMatch(questions, /attach a vendor list/i);
  assert.match(questions, /A current assessment and a clear plan for open risks are what matter here\./);
});
