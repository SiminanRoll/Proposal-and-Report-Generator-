import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const experience = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const hipaa = fs.readFileSync(new URL("../src/components/hipaa-presentation.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("HIPAA questions and readiness review share one presentation section", () => {
  assert.match(experience, /project\.hipaa\.enabled \? \["hipaa"\] : \[\]/);
  assert.match(experience, /section === "hipaa"/);
  assert.doesNotMatch(experience, /section === "hipaa-review"|section === "hipaa-results"/);
  assert.match(hipaa, /HipaaReviewAndResultsPresentation/);
  assert.match(hipaa, /Questions/);
  assert.match(hipaa, /Readiness results/);
  assert.match(hipaa, /openQuestionCount === 0/);
});

test("presentation navigation is constrained so action buttons cannot overlap it", () => {
  assert.match(experience, /data-section-count=\{sections\.length\}/);
  assert.match(css, /unified HIPAA review and collision-safe presentation navigation/);
  assert.match(css, /grid-template-columns:minmax\(150px,.62fr\) minmax\(0,3.25fr\) max-content/);
  assert.match(css, /presentation-topbar-actions[\s\S]*min-width:max-content/);
  assert.match(css, /presentation-progress-nav[\s\S]*min-width:0/);
});
