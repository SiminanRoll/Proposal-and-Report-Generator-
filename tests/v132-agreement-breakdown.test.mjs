import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const model = await transpileTestModule("../src/lib/outcomes/agreement-breakdown.ts", import.meta.url);
function line(id, name, category, quantity, price, period) {
  return { id, name, category, quantity, unitPrice: price,
    description: "Client-reviewed coverage for " + name, billingPeriod: period };
}
function agreement() {
  return {
    ...model.newAgreementBreakdown(), includeInReport: true,
    verifiedAt: "2026-11-09T12:00:00.000Z", asOfDate: "2026-11-09",
    items: [
      line("ws1", "A360 Workstation Management", "support", 12, 50, "monthly"),
      line("firewall", "Managed Firewall", "security", 1, 28, "monthly"),
      line("backup", "Server Backup", "backup", 1, 120, "annually"),
    ],
  };
}
test("agreement is opt-in, verified, client-specific and never inferred from catalog", () => {
  const project = { type: "client-report", agreementBreakdown: model.newAgreementBreakdown() };
  assert.equal(model.includedAgreement(project), null);
  const draft = agreement();
  draft.verifiedAt = "";
  assert.equal(model.includedAgreement({ type:"client-report", agreementBreakdown:draft }), null);
  draft.verifiedAt = "2026-11-09T12:00:00.000Z";
  assert.equal(model.includedAgreement({ type:"client-report", agreementBreakdown:draft }), draft);
  assert.equal(model.includedAgreement({ type:"prospect-proposal", agreementBreakdown:draft }), null);
  assert.equal(model.A360_SERVICE_DESCRIPTIONS.length > 8, true);
  assert.equal(model.newAgreementBreakdown().items.length, 0, "no automatic entitlement from A360 public webpage");
});
test("monthly and annual agreement totals stay separate and use quantities", () => {
  const totals = model.agreementPeriodTotals(agreement());
  assert.deepEqual(totals.map((t) => [t.period,t.amount]), [["monthly",628],["annually",120]]);
  assert.equal(model.agreementLineAmount(line("a","Office", "support",3,19.99,"monthly")),59.97);
});
test("incomplete rates are never rendered as zero or a misleading partial total", () => {
  const draft = agreement();
  draft.items[0].unitPrice = null;
  const monthly = model.agreementPeriodTotals(draft).find((v) => v.period === "monthly");
  assert.equal(monthly.amount, null);
  assert.equal(monthly.pricedItems, 1);
  assert.equal(model.agreementValidationErrors(draft).length,0,"blank rate is allowed but total is incomplete");
});
test("editing rows does not conflate duplicate SKU names or practice records", () => {
  const draft = agreement();
  draft.items.push(line("ws2","A360 Workstation Management","support",2,50,"monthly"));
  const project = {id:"practice-a",type:"client-report",agreementBreakdown:draft};
  const other = {id:"practice-b",type:"client-report",agreementBreakdown:model.newAgreementBreakdown()};
  const reopened = JSON.parse(JSON.stringify(project));
  assert.equal(model.includedAgreement(reopened).items.length,4);
  assert.equal(model.agreementPeriodTotals(reopened.agreementBreakdown)[0].amount,728);
  assert.equal(model.includedAgreement(other),null);
});
test("missing description, duplicate row ID and invalid price prevent inclusion", () => {
  const draft = agreement();
  draft.items[1].description = "";
  assert.equal(model.includedAgreement({type:"client-report", agreementBreakdown:draft}),null);
  assert.match(model.agreementValidationErrors(draft).join(" "),/description/);
  draft.items[1].description = "Verified firewall service";
  draft.items[1].id = draft.items[0].id;
  assert.match(model.agreementValidationErrors(draft).join(" "),/duplicate/);
  draft.items[1].id="firewall";draft.items[1].unitPrice=-1;
  assert.match(model.agreementValidationErrors(draft).join(" "),/rate must be zero/);
});
test("existing THR uses native services presentation and PDF opt-in, not a static slide", () => {
  const ui=fs.readFileSync(new URL("../src/components/outcome-experience.tsx",import.meta.url),"utf8");
  const exportHtml=fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts",import.meta.url),"utf8");
  const pdf=fs.readFileSync(new URL("../src/lib/outcomes/agreement-breakdown-pdf.ts",import.meta.url),"utf8");
  assert.match(ui,/agreement-toolbar-toggle/);
  assert.match(ui,/section === "agreement" && <AgreementBreakdownPresentation project=\{project\}/);
  assert.match(ui,/includedAgreement\(project\) \? \["agreement"\] : \[\]/);
  assert.match(exportHtml,/agreementBreakdownPdfPages\(project, pdfFooter\)/);
  assert.match(exportHtml,/\$\{printAgreement\}/);
  assert.match(pdf,/const agreement = includedAgreement\(project\)/);
  assert.match(pdf,/pdf-agreement-page/);
  assert.doesNotMatch(pdf,/upload|supabase|companyId/);
});

test("finished PDF agreement sheet is absent when off and escapes client-provided values when on", async () => {
  const ts = await import("typescript");
  const source = fs.readFileSync(new URL("../src/lib/outcomes/agreement-breakdown.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: true },
  }).outputText;
  const url = "data:text/javascript," + encodeURIComponent(compiled);
  const pdf = await transpileTestModule("../src/lib/outcomes/agreement-breakdown-pdf.ts", import.meta.url, {
    prefix: "agreement-pdf-regression",
    replacements: { 'from "./agreement-breakdown"': 'from "' + url + '"' },
  });
  const footer = () => "<footer>Advantage</footer>";
  assert.equal(pdf.agreementBreakdownPdfPages({type:"client-report"}, footer), "");
  const draft = agreement();
  draft.items[0].description = "Workstations <not approved> & managed";
  const html = pdf.agreementBreakdownPdfPages({ type:"client-report", client:{name:"Dental & More"}, agreementBreakdown:draft }, footer);
  assert.match(html, /What your agreement includes/);
  assert.match(html, /Dental &amp; More/);
  assert.match(html, /&lt;not approved&gt; &amp; managed/);
  assert.match(html, /\$628\.00/);
  assert.match(html, /\$120\.00/);
  assert.match(html, /Monthly/);
  assert.match(html, /Annually/);
  draft.showPricing = false;
  const noPrices = pdf.agreementBreakdownPdfPages({ type:"client-report", client:{name:"Dental"}, agreementBreakdown:draft }, footer);
  assert.doesNotMatch(noPrices, /\$628\.00|\$120\.00/);
  draft.includeInReport=false;
  assert.equal(pdf.agreementBreakdownPdfPages({type:"client-report",client:{name:"Dental"},agreementBreakdown:draft},footer),"");
});
test("combined practices may include distinct agreement sections but never mix their charges", () => {
  const modelSrc = fs.readFileSync(new URL("../src/lib/outcomes/multi-practice-review.ts", import.meta.url), "utf8");
  const presenter = fs.readFileSync(new URL("../src/components/multi-practice-presentation.tsx", import.meta.url), "utf8");
  const combinedPdf = fs.readFileSync(new URL("../src/lib/outcomes/multi-practice-html.ts", import.meta.url), "utf8");
  assert.match(modelSrc, /agreement: includedAgreement\(project\)/);
  assert.match(presenter, /p\.agreement/);
  assert.match(presenter, /AgreementBreakdownPresentation project=\{project\}/);
  assert.match(combinedPdf, /for \(const p of data\.practices\)/);
  assert.match(combinedPdf, /const agreement = p\.agreement/);
  assert.match(combinedPdf, /Services agreement/);
});
