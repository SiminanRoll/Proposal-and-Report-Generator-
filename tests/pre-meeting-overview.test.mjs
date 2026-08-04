import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/outcomes/pre-meeting.ts", "utf8");
const experience = readFileSync("src/components/outcome-experience.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

test("pre-meeting overview uses a portrait preparation document", () => {
  assert.match(source, /meta name="adv-pdf-layout" content="portrait"/);
  assert.match(source, /Technology Review — What to Expect/);
  assert.match(source, /Who should attend\?/);
  assert.match(source, /Helpful information to have available/);
  assert.match(source, /<main>[\s\S]*data-pdf-page="true"/);
});

test("HIPAA-disabled pre-meeting content removes HIPAA references", () => {
  assert.match(source, /if \(!project\.hipaa\.enabled\) return \[\]/);
  assert.match(source, /project\.hipaa\.enabled \? \[\["HIPAA technology practices"/);
  assert.match(source, /project\.hipaa\.enabled[\s\S]*technology-related HIPAA practices[\s\S]*security and backup protection, and upcoming technology needs/);
  assert.match(experience, /HIPAA questions are not mentioned when the HIPAA review is turned off/);
});

test("HIPAA-enabled pre-meeting packet includes only unanswered client-facing questions", () => {
  assert.match(source, /preMeetingHipaaQuestions/);
  assert.match(source, /question\.ownership !== "advantage-prefill"/);
  assert.match(source, /answer\.response === "not-yet-assessed" \|\| answer\.deferred/);
  assert.match(source, /These are the items that still need your input/);
  assert.match(source, /data-pdf-field="premeeting\.hipaa\./);
  assert.match(source, /Yes\|Somewhat\|No\|Not sure\|Not applicable/);
  assert.match(source, /Complete now or wait until the meeting/);
  assert.match(source, /Already confirmed by Advantage/);
  assert.match(source, /Endpoint protection and security monitoring/);
  assert.match(source, /Managed backup and recovery coverage/);
  assert.match(experience, /Download pre-meeting packet/);
});

test("pre-meeting packet does not expose findings, scores, pricing, or recommendations", () => {
  assert.doesNotMatch(source, /project\.findings|scoreHipaaAssessment|project\.pricing|replacementDevices/);
  assert.match(experience, /Scores, findings, pricing, and recommendations are not included/);
});

test("workspace can download the conditional packet and draft a matching email", () => {
  assert.match(experience, /Download pre-meeting overview/);
  assert.match(experience, /Download pre-meeting packet/);
  assert.match(experience, /Draft pre-meeting email/);
  assert.match(experience, /downloadPreMeetingOverviewPdf/);
  assert.match(experience, /openPreMeetingEmailDraft/);
  assert.match(source, /Preparing for your Technology Review/);
  assert.match(source, /You’re welcome to complete them in advance/);
  assert.match(source, /There is no need to research anything beforehand/);
  assert.match(source, /mailto:/);
  assert.match(css, /v1\.0\.3\.8 - pre-meeting client preparation tools/);
});
