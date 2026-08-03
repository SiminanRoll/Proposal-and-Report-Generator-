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

test("cover uses the widescreen score-led layout and conditionally includes HIPAA", () => {
  assert.match(experience, /Technology<br \/>Health Review/);
  assert.match(experience, /Overall technology health|Provisional score/);
  for (const label of ["Security protection", "Network & lifecycle", "HIPAA readiness", "Resilience & planning"]) {
    assert.match(experience, new RegExp(label.replace(/[&]/g, "\\&")));
  }
  assert.match(experience, /health-cover-main/);
  assert.match(experience, /project\.hipaa\.enabled && <HealthScoreCard/);
  assert.match(experience, /health-evidence-strip/);
  assert.match(exportHtml, /class="health-cover"/);
  assert.match(exportHtml, /class="overall-score/);
});

test("replacement machines are grouped before inventory and inventory is priority sorted", () => {
  assert.match(experience, /replacement-overview/);
  assert.match(experience, /replacement-device-grid/);
  assert.match(experience, /sortLifecycleDevices\(reportableLifecycleDevices\(project\)\)/);
  assert.match(exportHtml, /replacement-grid/);
  assert.match(exportHtml, /Priority replacements|Health priority details/);
  assert.match(exportHtml, /sortLifecycleDevices\(reportableLifecycleDevices\(project\)\)/);
});

test("planning is generated from replacement HIPAA and security evidence", () => {
  assert.match(experience, /clientReportPlanActions\(project\)/);
  assert.match(experience, /Technology Consultant team/);
  assert.match(experience, /planning-context-strip/);
  assert.match(exportHtml, /clientReportPlanActions\(project\)/);
  assert.match(exportHtml, /Meet with your Technology Consultant/);
});


test("cover uses one prepared-date pill and lifecycle heading stays compact", () => {
  assert.match(experience, /preparedDate\(project\)/);
  assert.doesNotMatch(experience, /Lifecycle: \{lifecyclePeriod\}|Security: \{securityPeriod\}/);
  assert.match(experience, /Healthy now\. Plan what comes next\./);
  assert.match(css, /v1\.0\.0\.8 — prepared-date cover/);
});

test("hardware inventory uses a restrained glass treatment", () => {
  assert.match(css, /presentation-device-table-wrap\{border:1px solid rgba\(255,255,255,\.34\)/);
  assert.match(css, /backdrop-filter:blur\(18px\) saturate\(1\.08\)/);
  assert.match(exportHtml, /device-table-wrap\{overflow:auto;scrollbar-width:thin/);
});


test("cover keeps health priorities neutral and removes early replacement sales language", () => {
  assert.match(experience, /health priorities/);
  assert.doesNotMatch(experience, /> under review<|Under review<|under review<|under review\}/i);
  assert.doesNotMatch(experience, /health-cover-replacements/);
  assert.doesNotMatch(exportHtml, /replacements\.length \? `<div class="replacement-strip"/);
});

test("planning and recap use consultant-led client language", () => {
  assert.match(experience, /What should happen next/);
  assert.match(experience, /Meet with your Technology Consultant/);
  assert.match(experience, /Schedule a Technology Consultant session/);
  assert.match(experience, /Today&apos;s takeaways/);
  assert.match(css, /planning-consultation-banner/);
  assert.match(css, /recap-roadmap/);
  assert.match(exportHtml, /Today&#39;s takeaways/);
});

test("recap HIPAA language is conditional when the module is disabled", () => {
  assert.match(experience, /project\.hipaa\.enabled && <div className=\{`recap-hipaa-status/);
  assert.doesNotMatch(experience, /with skipped HIPAA questions revisited/);
  assert.match(exportHtml, /project\.hipaa\.enabled \? `<div class="recap-hipaa/);
});


test("planning language does not force a phased rollout", () => {
  const plan = fs.readFileSync(new URL("../src/lib/outcomes/client-report-plan.ts", import.meta.url), "utf8");
  assert.doesNotMatch(`${experience}\n${plan}\n${exportHtml}`, /phased/i);
  assert.match(`${experience}\n${plan}\n${exportHtml}`, /technology roadmap|replacement plan|action plan/i);
});


test("client-facing report excludes under-review assets and supports a clean-report path", () => {
  const plan = fs.readFileSync(new URL("../src/lib/outcomes/client-report-plan.ts", import.meta.url), "utf8");
  assert.match(experience, /reportableLifecycleDevices/);
  assert.doesNotMatch(experience, /<span><strong>\{lifecycle\.unknown\}<\/strong> under review<\/span>/i);
  assert.match(plan, /No immediate replacement or corrective action is recommended/);
  assert.match(experience, /Keep the healthy environment on track/);
  assert.match(experience, /Today&apos;s takeaways/);
});

test("presentation navigation includes a gradient progress rail and inventory uses slim scrollbars", () => {
  assert.match(experience, /presentation-progress-nav/);
  assert.match(experience, /--presentation-progress/);
  assert.match(css, /linear-gradient\(90deg,#37d3b1/);
  assert.match(css, /presentation-device-table-wrap::-webkit-scrollbar/);
});
