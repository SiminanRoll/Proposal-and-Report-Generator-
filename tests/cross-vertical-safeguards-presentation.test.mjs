import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const experience = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const hipaa = fs.readFileSync(new URL("../src/components/hipaa-presentation.tsx", import.meta.url), "utf8");

test("the explanatory safeguards demo slide is removed for every client and vertical", () => {
  assert.doesNotMatch(experience, /SecuritySafeguardsPresentation|section === "safeguards"|"safeguards",/);
  assert.match(experience, /\["overview", "security", \.\.\.backup, "lifecycle", "details"\]/);
  assert.match(experience, /technologyAssessmentAvailable\(project\) \? \["security", "lifecycle", "details"\] : \[\]/);
  assert.match(experience, /project\.hipaa\.enabled \? \["hipaa"\] : \[\]/);
  assert.match(experience, /section === "hipaa"/);
});

test("actual security questions remain available without the separate explanatory slide", () => {
  assert.match(hipaa, /HipaaReviewAndResultsPresentation/);
  assert.match(hipaa, /Advantage manages technology safeguards, not HIPAA compliance/);
  assert.match(hipaa, /practice owns its risk analysis/);
});
