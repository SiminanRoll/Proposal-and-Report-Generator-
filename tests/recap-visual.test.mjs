import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const recap = readFileSync(new URL("../src/components/recap-visual.tsx", import.meta.url), "utf8");
const presentation = readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const hipaa = readFileSync(new URL("../src/components/hipaa-presentation.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/components/recap-visual.module.css", import.meta.url), "utf8");

test("recap replaces competing numeric tiles with visual health and security summaries", () => {
  assert.match(presentation, /<RecapVisual project=\{project\} \/>/);
  assert.doesNotMatch(presentation, /className="recap-score-grid"/);
  assert.doesNotMatch(presentation, /className=\{\`recap-hipaa-status/);
  assert.match(recap, /lifecycleSummary\(project\)/);
  assert.match(recap, /clientReportScores\(project\)/);
  assert.match(recap, /scoreHipaaAssessment\(project\.hipaa\)/);
  assert.match(styles, /conic-gradient\(/);
});

test("FAR priorities use saved decisions without modifying technology-health scores", () => {
  assert.match(recap, /farTopPriorities\(project\)/);
  assert.match(recap, /farPriorityStatus\(item\)/);
  assert.match(recap, /priorityActionSummary\(item\)/);
  assert.doesNotMatch(recap, /updateFarReviewItem|onUpdate\(/);
  assert.match(presentation, /farActions\.length === 0/);
  assert.match(presentation, /recap-next-step/);
});

test("question progress remains accessible and distinguishes missing from verified incident data", () => {
  assert.match(recap, /role="progressbar"/);
  assert.match(recap, /aria-valuenow=\{answered\}/);
  assert.match(recap, /hasIncidentEvidence/);
  assert.match(recap, /not a compliance certification/);
});

test("reviewer name field is blank by default and labeled Reviewed by", () => {
  assert.match(hipaa, /<span>Reviewed by<\/span><input aria-label="Reviewed by"/);
  assert.doesNotMatch(hipaa, /placeholder="Client representative"/);
  assert.match(hipaa, /confirmHipaaAssessment\(prepared, confirmer\)/);
});
