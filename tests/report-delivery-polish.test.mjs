import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const experience = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("tailored presentation panels use dark-context text and backgrounds", () => {
  assert.match(css, /\.presentation-overlay \.agreed-plan-banner/);
  assert.match(css, /\.presentation-overlay \.recap-next-step\.agreed/);
  assert.match(css, /background:linear-gradient\(135deg,rgba\(9,55,83/);
  assert.match(css, /\.presentation-overlay \.agreed-plan-banner p,[\s\S]*color:#c8dced!important/);
  assert.match(css, /\.presentation-overlay \.agreed-plan-banner \.planning-session-outcomes span[\s\S]*color:#edf8ff!important/);
});

test("report generator and presentation share one PDF download handler", () => {
  assert.match(experience, /onDownloadPdf: \(\) => Promise<void>/);
  assert.match(experience, /onClick=\{onDownloadPdf\}/);
  assert.match(experience, /onDownloadPdf=\{downloadFinishedPdf\}/);
  assert.equal((experience.match(/downloadOutcomePdf\(project\)/g) || []).length, 1);
});

test("client PDF omits generic locations and lifecycle-unknown display cards", () => {
  assert.doesNotMatch(exportHtml, /Location not specified/);
  assert.match(exportHtml, /devices\.map\(\(device\) => device\.location\.trim\(\)\)\.filter\(Boolean\)/);
  const start = exportHtml.indexOf("const printReport =");
  const end = exportHtml.indexOf("const screenReport", start);
  const printable = exportHtml.slice(start, end > start ? end : exportHtml.indexOf("return `<!doctype", start));
  assert.ok(start >= 0, "print report section should exist");
  assert.doesNotMatch(printable, /Lifecycle unknown/);
  assert.doesNotMatch(printable, /lifecycle\.unknown} need lifecycle data/);
  assert.match(printable, /pdfAssessedSegment\(lifecycle\.current\)/);
  assert.match(printable, /pdf-lifecycle-grid[\s\S]*Healthy now[\s\S]*Plan soon[\s\S]*Health priorities/);
});
