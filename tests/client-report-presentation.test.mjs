import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard = fs.readFileSync(new URL("../src/components/home-dashboard.tsx", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/project-workspace.tsx", import.meta.url), "utf8");
const experience = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const hipaa = fs.readFileSync(new URL("../src/components/hipaa-presentation.tsx", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("redundant generation prompt and homepage helper copy are removed", () => {
  assert.doesNotMatch(workspace, /Generate now|Generate the package|next-action-card/);
  assert.doesNotMatch(dashboard, /Three focused paths\. One shared report and proposal engine\./);
});

test("client report presentation follows the full guided story", () => {
  const intro = experience.indexOf('["overview", "security", "lifecycle", "details"]');
  const hipaaReview = experience.indexOf('["hipaa-review", "hipaa-results"]');
  const completeFlow = experience.indexOf('return [...beginning, ...hipaa, "plan", "recap"]');
  assert.ok(intro >= 0);
  assert.ok(hipaaReview > intro);
  assert.ok(completeFlow > hipaaReview);
  for (const phrase of ["Technology overview", "Security protection", "Network health & lifecycle", "Hardware inventory", "Planning", "Final recap"]) {
    assert.match(experience, new RegExp(phrase));
  }
});

test("presentation includes infographic treatments for security lifecycle HIPAA and recap", () => {
  for (const className of ["security-funnel-visual", "lifecycle-segmented-bar", "lifecycle-metric-grid", "recap-score-grid"]) {
    assert.match(experience, new RegExp(className));
    assert.match(css, new RegExp(`\\.${className}`));
  }
  assert.match(hipaa, /hipaa-answer-bar/);
  assert.match(hipaa, /hipaa-results-categories/);
  assert.match(hipaa, /Skipped \/ unanswered/);
});

test("hardware inventory cannot silently render as an empty area", () => {
  assert.match(experience, /presentation-device-table/);
  assert.match(experience, /hardware-empty-state/);
  assert.match(exportHtml, /Detailed device rows were not available/);
  assert.match(exportHtml, /text-searchable ScalePad export/);
});

test("downloaded client package preserves intro-to-recap ordering", () => {
  const clientPackageStart = exportHtml.indexOf("Technology, security & compliance review");
  const security = exportHtml.indexOf('<span class="kicker">Security protection', clientPackageStart);
  const network = exportHtml.indexOf('<span class="kicker">Network health & lifecycle', security);
  const hardware = exportHtml.indexOf('<span class="kicker">Hardware inventory', network);
  const hipaaResults = exportHtml.indexOf("${hipaaSummaryHtml(project)}", hardware);
  const planning = exportHtml.indexOf('<span class="kicker">Planning', hipaaResults);
  const recap = exportHtml.indexOf('<span class="kicker">Final recap', planning);
  assert.ok(clientPackageStart >= 0);
  assert.ok(security > clientPackageStart);
  assert.ok(network > security);
  assert.ok(hardware > network);
  assert.ok(hipaaResults > hardware);
  assert.ok(planning > hipaaResults);
  assert.ok(recap > planning);
});

test("existing browser-cached reports can be reprocessed after parser upgrades", () => {
  assert.match(workspace, /getLocalSourceFile/);
  assert.match(workspace, /reprocessCachedSources/);
  assert.match(workspace, /Reprocess cached sources/);
  assert.match(workspace, /projectWithRebuiltIntelligence/);
});
