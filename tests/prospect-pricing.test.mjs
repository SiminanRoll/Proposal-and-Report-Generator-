import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pricing = fs.readFileSync(new URL("../src/lib/proposals/pricing.ts", import.meta.url), "utf8");
const experience = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const proposal = fs.readFileSync(new URL("../src/components/proposal-experience.tsx", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const analyzer = fs.readFileSync(new URL("../src/lib/intelligence/browser/analyze-file.ts", import.meta.url), "utf8");
const factory = fs.readFileSync(new URL("../src/lib/projects/factory.ts", import.meta.url), "utf8");
const store = fs.readFileSync(new URL("../src/lib/projects/store.ts", import.meta.url), "utf8");
const clientCopy = fs.readFileSync(new URL("../src/lib/proposals/client-copy.ts", import.meta.url), "utf8");


test("A360 monthly defaults match the supplied pricing worksheet", () => {
  for (const [key, value] of Object.entries({
    site: 125,
    serverStandardBackup: 180,
    multiServerDiscount: -100,
    workstation: 48,
    cloudPlusAdvancedBackup: 100,
    workstationBackup: 35,
    managedFirewall: 50,
    goToMyPc: 20,
    newClientDiscount: -200,
  })) {
    assert.match(pricing, new RegExp(`${key}: ${String(value).replace("-", "\\-")}`));
  }
  assert.match(pricing, /A360 Site/);
  assert.match(pricing, /A360 Server with Standard Backup/);
  assert.match(pricing, /A360 Workstation/);
});

test("prospect defaults use RFT server and workstation quantities and keep project costs editable", () => {
  assert.match(pricing, /environment\.servers/);
  assert.match(pricing, /environment\.workstations/);
  assert.match(pricing, /lifecycle\.serversNeedingReplacement/);
  assert.match(pricing, /lifecycle\.workstationsNeedingReplacement/);
  for (const item of ["Replacement workstation equipment", "Server and infrastructure equipment", "Equipment installation and configuration labor", "Practice-management application installation", "Imaging application installation", "New-client onboarding and documentation"]) {
    assert.match(pricing, new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(pricing, /requiresPrice: true/);
  assert.match(analyzer, /lifecycle\.workstationsNeedingReplacement/);
  assert.match(analyzer, /lifecycle\.serversNeedingReplacement/);
});

test("proposal pricing is normalized for new and saved prospect workspaces", () => {
  assert.match(factory, /normalizeProposalProject/);
  assert.match(store, /normalizeProposalProject/);
  assert.match(pricing, /projectWithCatalogItems/);
  assert.match(pricing, /proposalTotals/);
});

test("potential-client presentation follows the sales story through authorization", () => {
  const intro = experience.indexOf('["overview", "advantage", "findings"]');
  const hipaa = experience.indexOf('project.hipaa.enabled ? ["hipaa"] : []', intro);
  const close = experience.indexOf('"plan", "investment", "authorization"', hipaa);
  assert.ok(intro >= 0);
  assert.ok(hipaa > intro);
  assert.ok(close > hipaa);
  for (const label of ["Why Advantage", "Investment", "Authorize"]) assert.match(experience, new RegExp(label));
});

test("proposal editor and presentation include complete investment and close surfaces", () => {
  assert.match(proposal, /ProposalPricingEditor/);
  assert.match(proposal, /Monthly managed services/);
  assert.match(proposal, /Equipment, installation, and onboarding/);
  assert.match(proposal, /AdvantageStoryPresentation/);
  assert.match(proposal, /ProposalPlanPresentation/);
  assert.match(proposal, /ProposalInvestmentPresentation/);
  assert.match(proposal, /ProposalAuthorizationPresentation/);
  assert.match(proposal, /Authorize proposal/);
  assert.match(proposal, /Authorized name/);
});

test("downloaded prospect proposal preserves client-facing story, investment, and signature order", () => {
  const start = exportHtml.indexOf("function prospectProposalHtml");
  const who = exportHtml.indexOf("What you can expect", start);
  const findings = exportHtml.indexOf("What we found", who);
  const plan = exportHtml.indexOf("Your recommended plan", findings);
  const investment = exportHtml.indexOf("Your investment", plan);
  const authorization = exportHtml.indexOf("Client authorization", investment);
  assert.ok(start >= 0);
  assert.ok(who > start);
  assert.ok(findings > who);
  assert.ok(plan > findings);
  assert.ok(investment > plan);
  assert.ok(authorization > investment);
  assert.match(exportHtml, /prospectProposalHtml\(project\)/);
  assert.match(exportHtml, /Authorized signature/);
});

test("prospect presentation speaks directly to the client instead of describing the generator", () => {
  assert.match(proposal, /Prepared for \{project\.client\.name\}/);
  assert.match(clientCopy, /PROPOSAL_COVER_TITLE = "Advantage 360"/);
  assert.match(proposal, /Technology support built around your practice\./);
  assert.match(proposal, /The most important items to address now and plan for next\./);
  assert.match(proposal, /A clear path forward\./);
  assert.match(proposal, /Your technology investment\./);
  assert.match(proposal, /Ongoing monthly support/);
  assert.doesNotMatch(proposal, /One accountable technology partner for the entire practice/);
  assert.doesNotMatch(proposal, /Move from today&apos;s findings/);
});

test("hardware replacement and pricing language use plain client-facing names", () => {
  assert.match(clientCopy, /The server, Cloud Plus backup server, and \$\{computerLabel\(workstationCount\)\} should be replaced/);
  assert.match(clientCopy, /Replacement computers/);
  assert.match(clientCopy, /Server and related infrastructure/);
  assert.match(clientCopy, /Practice support coverage/);
  assert.match(clientCopy, /Computer support and security/);
  assert.doesNotMatch(clientCopy, /Detected applications include/);
});
