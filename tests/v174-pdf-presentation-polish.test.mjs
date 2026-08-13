import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const experience = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const hipaaPresentation = fs.readFileSync(new URL("../src/components/hipaa-presentation.tsx", import.meta.url), "utf8");
const messaging = fs.readFileSync(new URL("../src/lib/outcomes/client-report-messaging.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("overview presentation labels the lifecycle card from the actual system health", () => {
  assert.match(experience, /function AgingSystemsCard/);
  assert.match(experience, /tone === "healthy" \? "Healthy Systems" : "Aging Systems"/);
  assert.match(experience, /agingSystemsStatus\(project\)/);
  assert.doesNotMatch(experience, /PlanningStatusCard|>Planning status</);
  assert.match(messaging, /export function agingSystemsStatus/);
  assert.match(messaging, /Advantage can help review suitable replacement options when the timing is right/);
  assert.match(css, /\.aging-systems-card/);
});

test("print cover uses larger branding, subtle footer treatment, and cohesive decoration", () => {
  assert.match(exportHtml, /v1\.7\.4 - cohesive client-facing PDF design system/);
  assert.match(exportHtml, /\.pdf-brand-mark\{width:\.43in/);
  assert.match(exportHtml, /\.pdf-brand-wordmark\{width:1\.55in/);
  assert.match(exportHtml, /filter:grayscale\(1\);opacity:\.28/);
  assert.match(exportHtml, /\.pdf-page::before/);
  assert.match(exportHtml, /\.pdf-page::after/);
  assert.match(exportHtml, /agingSystems\.count === 0 \? "Healthy Systems" : "Aging Systems"/);
  assert.match(exportHtml, /<strong>\$\{escapeHtml\(agingSystemsLabel\)\}<\/strong>/);
  assert.doesNotMatch(exportHtml.slice(exportHtml.indexOf('const printReport =')), /<span>Planning status<\/span>|Computer replacements to plan/);
});

test("HIPAA report and presentation provide one simple recap without category score grids", () => {
  assert.match(exportHtml, /HIPAA readiness recap/);
  assert.match(exportHtml, /pdf-hipaa-recap-hero/);
  assert.match(exportHtml, /pdf-hipaa-meaning/);
  assert.doesNotMatch(exportHtml, /pdf-hipaa-review-categories|pdfHipaaReviewCategories/);
  assert.match(hipaaPresentation, /hipaa-results-metrics \${score\.notYetAssessedCount > 0 \? "three-up" : "two-up"}/);
  assert.match(hipaaPresentation, /hipaa-readiness-meaning/);
  assert.doesNotMatch(hipaaPresentation, /hipaa-results-categories/);
  assert.match(hipaaPresentation, /hipaaTopGaps\(project, 3\)/);
});
