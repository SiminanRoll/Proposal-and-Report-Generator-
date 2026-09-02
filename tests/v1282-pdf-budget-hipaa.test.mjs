import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const exportHtml = fs.readFileSync("src/lib/outcomes/export-html.ts", "utf8");
const budget = fs.readFileSync("src/lib/outcomes/technology-budget-outlook.ts", "utf8");

test("finished client PDF includes budget by default unless explicitly disabled", () => {
  assert.match(exportHtml, /options\.includeTechnologyBudgetOutlook !== false/);
});

test("budget page insertion targets the final page inside print report", () => {
  assert.match(budget, /'<section class="pdf-page pdf-client-success-page'/);
  assert.match(budget, /pdf-page pdf-budget-outlook/);
});

test("portrait HIPAA reviewed answers force visible red No treatment", () => {
  assert.match(exportHtml, /\.pdf-hipaa-answers \[data-hipaa-response="no"\]\{border:1px solid #e99b8b!important;border-left:4px solid #d95f43!important;background:#fff0ed!important/);
  assert.match(exportHtml, /\.pdf-hipaa-answers \[data-hipaa-response="no"\]>span\{border:1px solid #efab9c!important;background:#ffdcd4!important;color:#a83e29!important\}/);
});

test("portrait HIPAA reviewed answers force visible yellow Somewhat treatment", () => {
  assert.match(exportHtml, /\.pdf-hipaa-answers \[data-hipaa-response="partially"\]\{border:1px solid #e4c675!important;border-left:4px solid #c68a18!important;background:#fff7df!important/);
  assert.match(exportHtml, /\.pdf-hipaa-answers \[data-hipaa-response="partially"\]>span\{border:1px solid #e5c36f!important;background:#ffedbd!important;color:#805807!important\}/);
});

test("PDF correction release is version 1.2.82", () => {
  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\.2\.82"/);
  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\.2\.82/);
});
