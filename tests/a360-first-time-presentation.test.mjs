import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const presentation = fs.readFileSync(new URL("../src/components/prospect-a360-global.tsx", import.meta.url), "utf8");
const finish = fs.readFileSync(new URL("../src/components/prospect-a360-finish.tsx", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/a360-conversation-workspace.tsx", import.meta.url), "utf8");
const report = fs.readFileSync(new URL("../src/lib/prospects/a360-report-export.ts", import.meta.url), "utf8");
const conversation = fs.readFileSync(new URL("../src/lib/prospects/a360-conversation.ts", import.meta.url), "utf8");
const model = fs.readFileSync(new URL("../src/lib/prospects/a360.ts", import.meta.url), "utf8");
const quickPresent = fs.readFileSync(new URL("../src/components/quick-present-global.tsx", import.meta.url), "utf8");

test("top bar exposes a first-time A360 launcher next to Workbench", () => {
  assert.ok(shell.indexOf("<ProspectA360Global />") > shell.indexOf("Workbench</span>"));
  assert.match(presentation, /Contact name/);
  assert.match(presentation, /conversation workspace is created/);
  assert.match(presentation, /createPortal/);
  assert.match(presentation, /prospect-launcher-backdrop/);
  assert.match(presentation, /<ProspectPresentation[\s\S]*document\.body/);
  assert.match(presentation, /ADVANTAGE_360_PILLARS/);
  assert.match(presentation, /new-ownership-experience\.module\.css/);
  assert.match(presentation, /setFlippedPillar/);
  assert.match(presentation, /One partner\. One plan\. All handled\./);
  assert.match(quickPresent, /<span>Report Presentation<\/span>/);
  for (const value of ["practice", "firm", "business", "organization", "Dental", "Medical", "Legal", "Accounting", "Other"]) assert.match(presentation, new RegExp(value));
});

test("guided prospect presentation keeps unverified discovery language through the next step", () => {
  for (const section of ["Welcome", "Priorities", "Environment", "Software", "Your A360", "Summary", "Estimate", "Next step"]) assert.match(presentation, new RegExp(`"${section}"`));
  assert.match(presentation, /data\.priorities\.indexOf/);
  assert.match(presentation, /Client-provided preliminary information/);
  assert.match(presentation, /not verified technical findings/);
  assert.match(presentation, /The next step toward the right plan/);
  assert.match(presentation, /See your environment firsthand/);
  assert.match(presentation, /Validate the priorities we discussed/);
  assert.doesNotMatch(presentation, /Your environment, verified/);
  assert.doesNotMatch(presentation, /Security and backups reviewed/);
  assert.doesNotMatch(presentation, /Questions answered with your team/);
  assert.match(model, /Practice management software/);
  assert.match(presentation, /Imaging software/);
  assert.match(presentation, /2D \+ 3D/);
});

test("finishing A360 saves a workspace while keeping internal handoff copy off the presentation", () => {
  assert.match(finish, /buildA360ConversationRecord/);
  assert.match(finish, /createA360ConversationProject/);
  assert.match(finish, /saveProject\(workspace\)/);
  assert.match(finish, /writeA360OtaHandoffToCaptainsLog/);
  assert.match(finish, /Save the conversation/);
  assert.doesNotMatch(finish, /is saved as an OTA prospect/);
  assert.doesNotMatch(finish, /completed Sales meeting/);
  assert.doesNotMatch(finish, /Open follow-up email/);
});

test("A360 workspace supports tailored copy and a portrait prospect recap", () => {
  assert.match(workspace, /Tailored report prompt/);
  assert.match(workspace, /Copy tailored prompt/);
  assert.match(workspace, /Apply to report/);
  assert.match(workspace, /Open PDF report/);
  assert.match(conversation, /buildA360TailoredReportPrompt/);
  assert.match(conversation, /Return exactly these four labeled sections/);
  assert.match(conversation, /onsite assessment is already scheduled/);
  assert.match(conversation, /Do not ask whether they are ready to move forward/);
  assert.match(report, /size:letter portrait/);
  assert.match(report, /What matters most to your/);
  assert.match(report, /Information shared during our conversation/);
  assert.match(report, /This is not a technical assessment/);
  assert.match(report, /Preliminary Advantage 360 pricing/);
  assert.match(report, /Your onsite assessment is scheduled/);
  assert.match(report, /The next step is already on the calendar/);
  for (const forbidden of ["What we found", "Ready to move forward", "AUTHORIZATION", "Approve the plan", "NEEDS ATTENTION NOW", "IN GOOD SHAPE", "recommended work"]) {
    assert.doesNotMatch(report, new RegExp(forbidden, "i"));
  }
});

test("preliminary range still reuses real A360 pricing constants", () => {
  assert.match(model, /A360_MONTHLY_PRICING\.site/);
  assert.match(model, /A360_MONTHLY_PRICING\.workstation/);
  assert.match(model, /A360_MONTHLY_PRICING\.serverStandardBackup/);
  assert.match(presentation, /Calculated live from the current Advantage 360/);
});
