import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const presentation = fs.readFileSync(new URL("../src/components/prospect-a360-global.tsx", import.meta.url), "utf8");
const finish = fs.readFileSync(new URL("../src/components/prospect-a360-finish.tsx", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/a360-conversation-workspace.tsx", import.meta.url), "utf8");
const detailsEditor = fs.readFileSync(new URL("../src/components/a360-presentation-details-editor.tsx", import.meta.url), "utf8");
const report = fs.readFileSync(new URL("../src/lib/prospects/a360-report-export.ts", import.meta.url), "utf8");
const conversation = fs.readFileSync(new URL("../src/lib/prospects/a360-conversation.ts", import.meta.url), "utf8");
const draftStore = fs.readFileSync(new URL("../src/lib/prospects/a360-draft-store.ts", import.meta.url), "utf8");
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

test("guided prospect presentation speaks directly to the potential customer", () => {
  for (const section of ["Welcome", "Priorities", "Environment", "Software", "Your A360", "Summary", "Estimate", "Next step"]) assert.match(presentation, new RegExp(`"${section}"`));
  assert.match(presentation, /data\.priorities\.indexOf/);
  assert.match(presentation, /What you shared with us/);
  assert.match(presentation, /We’ll confirm the details together during the onsite visit/);
  assert.match(presentation, /The next step toward the right plan/);
  assert.match(presentation, /See your environment firsthand/);
  assert.match(presentation, /Confirm the starting picture/);
  assert.match(presentation, /Shape the right plan/);
  for (const forbidden of [
    "Client-provided preliminary information",
    "not verified technical findings",
    "Calculated live from the current Advantage 360",
    "Validate the priorities we discussed",
    "Build the right scope and recommendations",
    "maintenance",
  ]) assert.doesNotMatch(presentation, new RegExp(forbidden, "i"));
  assert.match(model, /Practice management software/);
  assert.match(presentation, /Imaging software/);
  assert.match(presentation, /2D \+ 3D/);
});

test("Your A360 reverse-side value content stays bound to the selected priority", () => {
  assert.match(presentation, /const primaryValue = priorityA360Value\(primary, data\.organizationLanguage\)/);
  assert.match(presentation, /backKicker=\{primaryValue\.kicker\} backTitle=\{primaryValue\.title\} points=\{primaryValue\.points\}/);
  assert.match(presentation, /const priorityValue = priorityA360Value\(priority, data\.organizationLanguage\)/);
  assert.match(presentation, /backKicker=\{priorityValue\.kicker\} backTitle=\{priorityValue\.title\} points=\{priorityValue\.points\}/);
  assert.doesNotMatch(presentation, /backKicker="What support feels like"/);
  for (const value of [
    "How Advantage keeps work moving",
    "How Advantage protects the environment",
    "How Advantage improves the daily experience",
    "What Advantage support feels like",
    "How Advantage makes IT easier to plan",
    "How Advantage supports readiness",
    "How Advantage supports growth",
    "How Advantage manages lifecycle risk",
    "How Advantage plans for recovery",
    "How Advantage replaces friction with ownership",
  ]) assert.match(presentation, new RegExp(value));
});

test("A360 saves before finishing and keeps optional contact details separate from external handoffs", () => {
  assert.match(presentation, /createA360Draft/);
  assert.match(draftStore, /buildA360ConversationRecord/);
  assert.match(draftStore, /createA360ConversationProject/);
  assert.match(draftStore, /saveProject\(next\)/);
  assert.match(finish, /onUpdate\(\{ contactEmail: email, contactPhone: phone, completedAt:/);
  assert.match(finish, /Email address · optional/);
  assert.match(finish, /Open saved report/);
  assert.doesNotMatch(finish, /disabled=\{!appointment\}|writeA360OtaHandoffToCaptainsLog/);
  assert.match(finish, /Save the conversation/);
  assert.doesNotMatch(finish, /is saved as an OTA prospect/);
  assert.doesNotMatch(finish, /completed Sales meeting/);
  assert.doesNotMatch(finish, /Open follow-up email/);
});

test("A360 workspace offers direct PDF download and preserves saved copy until explicit refresh", () => {
  assert.match(workspace, /Tailored report prompt/);
  assert.match(workspace, /Copy prompt/);
  assert.match(workspace, /Apply to report/);
  assert.match(workspace, /Download PDF/);
  assert.match(workspace, /Resume presentation/);
  assert.match(workspace, /downloadReadableA360ConversationReport\(activeRecord\)/);
  assert.match(workspace, /printReadableA360ConversationReport\(activeRecord\)/);
  assert.match(workspace, /Use latest A360 recap/);
  assert.match(workspace, /defaultA360ConversationReport/);
  assert.match(workspace, /hasLegacyDefaultA360Copy/);
  assert.match(workspace, /only if you want to replace the report copy/);
  const exportActions = workspace.slice(workspace.indexOf("function printReport()"), workspace.indexOf("return <main"));
  assert.doesNotMatch(exportActions, /projectWithLatestA360Copy|defaultA360ConversationReport|onUpdate/);
  assert.match(workspace, /Optional: tailor copy with ChatGPT/);
  assert.doesNotMatch(workspace, /Conversation snapshot/);
  assert.match(detailsEditor, /Conversation details/);
  assert.match(detailsEditor, /Edit details/);
  assert.match(detailsEditor, /finishEditing/);
  assert.match(detailsEditor, /Organization & contact/);
  assert.match(detailsEditor, /Environment & software/);
  assert.match(detailsEditor, /Priorities/);
  assert.match(detailsEditor, /Planning range/);
  assert.match(detailsEditor, /Onsite details saved/);
  assert.match(detailsEditor, /Not scheduled/);
  assert.match(detailsEditor, /formatPlanningAppointment/);
  assert.match(detailsEditor, /PLANNING_TIME_ZONES/);
  assert.doesNotMatch(detailsEditor, /Edit presentation details/);
  assert.match(conversation, /buildA360TailoredReportPrompt/);
  assert.match(conversation, /Return exactly these four labeled sections/);
  assert.match(conversation, /onsite assessment is already scheduled/);
  assert.match(conversation, /has not been scheduled yet/);
  assert.match(conversation, /Do not ask whether they are ready to move forward/);
  assert.match(conversation, /Do not use audit, evidence, or internal-reporting language/);
  assert.match(report, /size:letter portrait/);
  assert.match(report, /What matters most to your/);
  assert.match(report, /What you shared with us/);
  assert.match(report, /What still needs to be verified/);
  assert.match(report, /What’s included in your monthly service/);
  assert.match(report, /coverage\.onsite\.reviewNote/);
  assert.match(report, /isA360AppointmentScheduled/);
  assert.match(report, /Onsite assessment not scheduled/);
  assert.match(report, /What you can expect after the assessment/);
  assert.doesNotMatch(report, /The next step is already on the calendar/);
  for (const forbidden of [
    "What we found",
    "Ready to move forward",
    "AUTHORIZATION",
    "Approve the plan",
    "NEEDS ATTENTION NOW",
    "IN GOOD SHAPE",
    "recommended work",
    "This is not a technical assessment",
    "reported workstations",
    "reported location",
    "reported starting point",
    "No project work has been prescribed",
    "verified onsite information",
    "Build the right scope",
    "maintenance",
  ]) assert.doesNotMatch(report, new RegExp(forbidden, "i"));
});

test("preliminary range still reuses real A360 pricing settings", () => {
  assert.match(model, /DEFAULT_A360_PRESENTATION_PRICING/);
  assert.match(model, /currentPricing\.site/);
  assert.match(model, /currentPricing\.workstation/);
  assert.match(model, /currentPricing\.serverStandardBackup/);
  assert.match(presentation, /coverage\.environmentSummary/);
  assert.match(presentation, /a360ServiceCoverage\(data/);
});
