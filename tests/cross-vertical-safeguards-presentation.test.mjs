import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const experience = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const safeguards = fs.readFileSync(new URL("../src/components/security-safeguards-presentation.tsx", import.meta.url), "utf8");
const hipaa = fs.readFileSync(new URL("../src/components/hipaa-presentation.tsx", import.meta.url), "utf8");

test("security safeguard ownership appears across industries, independent of HIPAA", () => {
  assert.match(experience, /"overview", "security", "safeguards"/);
  assert.match(experience, /technologyAssessmentAvailable\(project\) \? \["security", "safeguards"/);
  assert.match(experience, /const withSafeguards: PresentationSection\[\]/);
  assert.match(experience, /section === "safeguards"/);
  assert.match(experience, /project\.hipaa\.enabled \? \["hipaa"\] : \[\]/);
});

test("safeguards slide distinguishes managed services from compliance ownership", () => {
  assert.match(safeguards, /Technical safeguards we manage or help implement/);
  assert.match(safeguards, /Actual coverage depends on the service agreement/);
  assert.match(safeguards, /SHARED RESPONSIBILITY/);
  assert.match(safeguards, /CLIENT \/ QUALIFIED ADVISER/);
  assert.match(safeguards, /not a certification or a determination/);
  assert.match(safeguards, /HIPAA, PCI DSS, legal confidentiality obligations/);
});

test("healthcare follow-up retains questionnaire while avoiding an Advantage consulting claim", () => {
  assert.match(hipaa, /HipaaReviewAndResultsPresentation/);
  assert.match(hipaa, /Advantage manages technology safeguards, not HIPAA compliance/);
  assert.match(hipaa, /practice owns its risk analysis/);
});
