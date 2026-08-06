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
  assert.match(printable, /class="pdf-technology-recap"/);
  assert.match(printable, /Systems healthy/);
  assert.match(printable, /class="pdf-environment-line"/);
  assert.match(printable, /pdf-review-story[\s\S]*Protection is active[\s\S]*system\$\{lifecycle\.current === 1 \? " is" : "s are"\} healthy[\s\S]*aging computer\$\{healthPriorities === 1 \? "" : "s"\}/);
  assert.doesNotMatch(printable, /pdf-lifecycle-grid/);
});

test("client PDF cover and recap remove repeated agreed-plan copy", () => {
  const printStart = exportHtml.indexOf("const printReport =");
  const coverStart = exportHtml.indexOf('<section class="pdf-page pdf-cover"', printStart);
  const coverEnd = exportHtml.indexOf('<section class="pdf-page pdf-overview-page"', coverStart);
  const cover = exportHtml.slice(coverStart, coverEnd);
  assert.ok(coverStart >= 0 && coverEnd > coverStart, "cover page markup should be isolated");
  assert.doesNotMatch(cover, /pdf-cover-next/);
  assert.doesNotMatch(cover, /Agreed next step/);
  assert.match(cover, /Aging systems/i);
  assert.doesNotMatch(cover, /Planning status|Computer replacements to plan/);
  assert.match(exportHtml, /const recapNextPanel = agreedPlan \? ""/);
  assert.match(exportHtml, /const consultationOutcomesPanel = agreedPlan \|\| approach\.mode === "purchase-planning" \? ""/);
  assert.match(exportHtml, /The decisions below reflect the client conversation/);
  assert.doesNotMatch(exportHtml, /No pressure - just a clear plan/);
  assert.match(exportHtml, /const printRecap = ""/);
});

test("client PDF capture uses high-resolution smoothing and high-resolution brand assets", () => {
  const renderer = fs.readFileSync(new URL("../src/lib/outcomes/fillable-pdf.ts", import.meta.url), "utf8");
  const assets = fs.readFileSync(new URL("../src/lib/outcomes/pdf-assets.ts", import.meta.url), "utf8");
  assert.match(renderer, /outputWidth: 2448/);
  assert.match(renderer, /outputHeight: 3168/);
  assert.match(renderer, /imageSmoothingQuality = "high"/);
  assert.match(renderer, /"image\/jpeg", 0\.95/);
  assert.match(exportHtml, /ADVANTAGE_MARK_DATA_URI/);
  assert.match(exportHtml, /ADVANTAGE_WORDMARK_DATA_URI/);
  assert.match(assets, /export const ADVANTAGE_MARK_DATA_URI/);
  assert.match(assets, /export const ADVANTAGE_WORDMARK_DATA_URI/);
});

test("client PDF cover uses a concise title because the client is already identified in Prepared for", () => {
  assert.match(exportHtml, /const reportTitle = "Technology Review"/);
  const printStart = exportHtml.indexOf("const printReport =");
  const coverStart = exportHtml.indexOf('<section class="pdf-page pdf-cover"', printStart);
  const coverEnd = exportHtml.indexOf('<section class="pdf-page pdf-overview-page"', coverStart);
  const cover = exportHtml.slice(coverStart, coverEnd);
  assert.match(cover, /Prepared for/);
  assert.match(cover, /escapeHtml\(reportTitle\)/);
  assert.doesNotMatch(cover, /project\.client\.name} Technology Review/);
});

test("homepage client search results render in a fixed portal above the dashboard cards", () => {
  const home = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
  assert.match(home, /createPortal/);
  assert.match(home, /positionClientSearchMenu/);
  assert.match(css, /\.compass-client-search-results\{position:fixed;z-index:300/);
});


test("client PDF uses a simplified HIPAA recap without category score tiles", () => {
  assert.match(exportHtml, /const printHipaaReview = project\.hipaa\.enabled/);
  assert.match(exportHtml, /HIPAA readiness recap/);
  assert.match(exportHtml, /Questions answered/);
  assert.match(exportHtml, /Follow-up items/);
  assert.match(exportHtml, /Not sure/);
  for (const label of ["Yes", "Somewhat", "No", "Does not apply"]) assert.match(exportHtml, new RegExp(label));
  assert.match(exportHtml, /What this means/);
  assert.match(exportHtml, /Showing the top 3/);
  assert.doesNotMatch(exportHtml, /pdf-hipaa-review-categories|pdfHipaaReviewCategories|hipaaContinuationChunks/);
  assert.match(exportHtml, /project\.hipaa\.clientConfirmation/);
  assert.match(exportHtml, /answer\?\.clientVisibleObservation/);
  assert.match(exportHtml, /answer\?\.recommendedAction/);
  const printStart = exportHtml.indexOf("const printReport =");
  const actionStart = exportHtml.indexOf('<section class="pdf-page pdf-action-page"', printStart);
  const beforeAction = exportHtml.slice(printStart, actionStart);
  assert.match(beforeAction, /\$\{printHipaaReview\}/);
});
