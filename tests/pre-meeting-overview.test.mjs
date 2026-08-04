import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/outcomes/pre-meeting.ts", "utf8");
const experience = readFileSync("src/components/outcome-experience.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

test("pre-meeting overview is a one-page portrait preparation document", () => {
  assert.match(source, /meta name="adv-pdf-layout" content="portrait"/);
  assert.match(source, /Technology Review — What to Expect/);
  assert.match(source, /No advance research is required/);
  assert.match(source, /Who should attend\?/);
  assert.match(source, /Helpful information to have available/);
  assert.match(source, /<main>[\s\S]*data-pdf-page="true"/);
});

test("pre-meeting overview does not expose findings, scores, or pricing", () => {
  assert.doesNotMatch(source, /project\.findings|scoreHipaaAssessment|project\.pricing|replacementDevices/);
  assert.match(experience, /It does not include scores, findings, pricing, or recommendations/);
});

test("workspace can download overview and draft an email", () => {
  assert.match(experience, /Download pre-meeting overview/);
  assert.match(experience, /Draft pre-meeting email/);
  assert.match(experience, /downloadPreMeetingOverviewPdf/);
  assert.match(experience, /openPreMeetingEmailDraft/);
  assert.match(source, /Preparing for your Technology Review/);
  assert.match(source, /I’ve attached a short overview of what we’ll cover/);
  assert.match(source, /mailto:/);
  assert.match(css, /v1\.0\.3\.8 - pre-meeting client preparation tools/);
});
