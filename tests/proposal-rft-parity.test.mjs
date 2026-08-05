import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const templates = fs.readFileSync(new URL("../src/lib/projects/templates.ts", import.meta.url), "utf8");
const analyzer = fs.readFileSync(new URL("../src/lib/intelligence/browser/analyze-file.ts", import.meta.url), "utf8");
const adapters = fs.readFileSync(new URL("../src/lib/intelligence/browser/report-adapters.ts", import.meta.url), "utf8");
const experience = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const proposal = fs.readFileSync(new URL("../src/components/proposal-experience.tsx", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const intelligence = fs.readFileSync(new URL("../src/lib/intelligence/client.ts", import.meta.url), "utf8");

test("RFT is required and primary for both proposal workflows", () => {
  const prospect = templates.slice(templates.indexOf('"prospect-proposal":'), templates.indexOf('"legacy-modernization":'));
  const modernization = templates.slice(templates.indexOf('"legacy-modernization":'));
  assert.match(prospect, /rft-spreadsheet[\s\S]*required: true/);
  assert.match(modernization, /rft-spreadsheet[\s\S]*required: true/);
  assert.match(modernization, /legacy-proposal[\s\S]*scope and pricing reference/);
});

test("RFT detailed sheets normalize into the shared client-report inventory model", () => {
  for (const sheet of ["Detailed Computer Analysis-Othe", "Drive Detail", "Login Sessions", "Hyper-V Servers-Other", "Security and Backup-Other", "Patches (Windows Updates)"]) {
    assert.match(analyzer, new RegExp(sheet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(analyzer, /parseDeviceInventoryExport\(rftDeviceExportRows\(workbook\)/);
  assert.match(analyzer, /security\.firewallDisabledDevices/);
  assert.match(analyzer, /patching\.affectedDeviceNames/);
  assert.match(analyzer, /backup\.endpointMissingDevices/);
  assert.match(adapters, /Age \(months\)/);
  assert.match(adapters, /explicitAgeMonths/);
});

test("both proposal modes receive client-report technical views and PDF assessment pages", () => {
  assert.match(experience, /project\.type !== "client-report"/);
  assert.match(experience, /ProposalSecurityAssessmentPresentation/);
  assert.match(experience, /LifecyclePresentation/);
  assert.match(experience, /DeviceDetailPresentation/);
  assert.match(proposal, /RFT security configuration/);
  assert.match(proposal, /This is an assessment snapshot—not a live threat report/);
  assert.match(exportHtml, /proposalAssessmentPagesHtml/);
  assert.match(exportHtml, /RFT hardware inventory/);
  assert.match(exportHtml, /project\.type !== "client-report"[\s\S]*prospectProposalHtml/);
});

test("the first attached RFT refreshes proposal starting quantities without changing client reports", () => {
  assert.match(intelligence, /previouslyHadRft/);
  assert.match(intelligence, /nowHasRft/);
  assert.match(intelligence, /replaceA360MonthlyDefaults/);
  assert.match(intelligence, /project\.type !== "client-report"/);
});
