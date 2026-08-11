import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspace = readFileSync("src/components/project-workspace.tsx", "utf8");
const outcome = readFileSync("src/components/outcome-experience.tsx", "utf8");
const proposal = readFileSync("src/components/proposal-experience.tsx", "utf8");
const exportHtml = readFileSync("src/lib/outcomes/export-html.ts", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

test("generator actions are consolidated into data, planning, and delivery groups", () => {
  assert.match(workspace, /generator-command-center/);
  assert.match(workspace, /1 · Data/);
  assert.match(workspace, /2 · Planned next step/);
  assert.match(outcome, /1 · Data/);
  assert.match(outcome, /2 · Planned next step/);
  assert.match(outcome, /3 · Review & deliver/);
  assert.match(outcome, /Sources & attachments/);
  assert.match(outcome, /Refresh source data/);
  assert.match(outcome, /Download PDF/);
  assert.match(css, /\.generator-command-center/);
});

test("planning format toggle updates reports, proposals, and PDFs", () => {
  assert.match(workspace, /Onsite review/);
  assert.match(workspace, /Remote consultation/);
  assert.match(proposal, /Consult with your Technology Consultant/);
  assert.match(proposal, /Review the environment onsite/);
  assert.match(proposal, /Recommended planning format/);
  assert.match(exportHtml, /proposalPlanningLabel/);
  assert.match(exportHtml, /consultation call with your Technology Consultant/);
  assert.match(exportHtml, /onsite project-planning review/);
});

test("security activity and incident response share one balanced row", () => {
  assert.match(outcome, /security-monitoring-row/);
  assert.match(outcome, /security-activity-strip/);
  assert.match(outcome, /security-incident-response/);
  assert.match(css, /Security monitoring: signal activity left, incident response right/);
  assert.match(css, /grid-template-columns:minmax\(360px,\.82fr\) minmax\(0,1\.18fr\)/);
  assert.match(exportHtml, /security-detail-row/);
});
