import test from "node:test";
import assert from "node:assert/strict";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const uri = (source) => "data:text/javascript," + encodeURIComponent(source);
const builder = uri("export const outcomeReady = (p) => p.ready !== false;");
const data = uri([
  "export const factNumber = (p,k) => p.fakeFacts?.[k] ?? 0;",
  "export const inventoryReportDevices = (p) => p.fakeDevices ?? [];",
  "export const inventoryReconciliation = (p) => ({passed: p.reconciled !== false});",
  "export const lifecycleSummary = (p) => p.fakeLifecycle;",
  "export const osSupportSummary = (p) => p.fakeOS;",
  "export const storageAttentionSummary = (p) => p.fakeStorage;",
].join("\n"));
const plan = uri("export const clientReportPlanActions = p => p.fakeActions ?? [];");
const budget = uri("export const technologyBudgetOutlook = p => p.fakeBudget;");
const hipaa = uri([
  "export const hipaaTopGaps = p => [];",
  "export const scoreHipaaAssessment = p => ({label:'Partially reviewed',notYetAssessedCount:2});",
].join("\n"));
const replacements = {
  'from "@/lib/outcomes/builder"': "from " + JSON.stringify(builder),
  'from "@/lib/outcomes/client-report-data"': "from " + JSON.stringify(data),
  'from "@/lib/outcomes/client-report-plan"': "from " + JSON.stringify(plan),
  'from "@/lib/outcomes/technology-budget-outlook"': "from " + JSON.stringify(budget),
  'from "@/lib/hipaa/engine"': "from " + JSON.stringify(hipaa),
};
const fake = (id, name, companyId, current, planned, urgent, budgetLow, serial = "") => ({
  id, type: "client-report", ready: true, updatedAt: "2026-10-28T12:00:00Z",
  client: { name, companyId },
  intelligence: { facts: [{key:"huntress.eventsAnalyzed", value:50}], sourceSummaries:[] },
  reviewOutcome: {status:"confirmed"},
  hipaa: {enabled:true},
  fakeFacts: {"huntress.eventsAnalyzed":50,"huntress.signalsInvestigated":2,"huntress.incidentsReported":0},
  fakeDevices: [{name:name+"-PC", serial, type:"workstation", age:5, make:"Lenovo", model:"M90", os:"Windows 11", lifecycleStatus: urgent ? "overdue":"current", location:name}],
  fakeLifecycle: {total:current+planned+urgent, inventoryTotal:1,current,dueSoon:planned,overdue:urgent,unknown:0,assessed:1},
  fakeOS: {attention:0,endOfSupport:0,planning:0,reported:1},
  fakeStorage: {attention:0,reported:1},
  fakeActions: [{id:"replace",title:"Review workstation plan",detail:"Confirm price and timing.",timing:"Next quarter",owner:"Client + Advantage",tone:"attention"}],
  fakeBudget: {replacementBudgetLow:budgetLow,replacementBudgetHigh:budgetLow*1.2,planningServers:0,planningWorkstations:urgent+planned,incompleteAgeCount:0},
});
async function loadModel() {
  return transpileTestModule("../src/lib/outcomes/multi-practice-review.ts", import.meta.url, { replacements });
}
async function loadHtml() {
  return transpileTestModule("../src/lib/outcomes/multi-practice-html.ts", import.meta.url, {
    replacements:{'from "./fillable-pdf-core"': "from " + JSON.stringify(uri("export async function downloadFillableClientPdf(){return;}"))},
  });
}
test("independent reports retain own priorities and independently calculated budgets", async () => {
  const { newMultiPracticeReview, buildMultiPracticeData } = await loadModel();
  const a = fake("id-delray", "Delray Beach", "uuid-one", 1, 0, 5, 18000);
  const b = fake("id-palm", "Palm Beach", "uuid-two", 2, 4, 0, 7500);
  const source = [a, b];
  const before = JSON.stringify(source);
  const result = buildMultiPracticeData(newMultiPracticeReview(source, "Practice owner", "Ownership review", true), source);
  assert.deepEqual(result.errors, []);
  assert.equal(result.practices.length, 2);
  assert.equal(result.practices[0].lifecycle.overdue, 5);
  assert.equal(result.practices[1].lifecycle.overdue, 0);
  assert.equal(result.combinedBudgetLow, 25500);
  assert.equal(result.combinedBudgetHigh, 30600);
  assert.equal(JSON.stringify(source), before);
});
test("same canonical company and duplicate project IDs cannot be conflated", async () => {
  const { newMultiPracticeReview, buildMultiPracticeData } = await loadModel();
  const a=fake("one","Office A","same-company",1,0,0,1000), b=fake("two","Office B","same-company",0,1,0,3000);
  assert.match(buildMultiPracticeData(newMultiPracticeReview([a,b],"Owner","Review",true),[a,b]).errors.join(" "),/shares a company identity/);
  assert.match(buildMultiPracticeData(newMultiPracticeReview([a,a],"Owner","Review",true),[a]).errors.join(" "),/same source report/);
});
test("missing, revised or unreconciled source blocks combined export", async () => {
  const { newMultiPracticeReview, buildMultiPracticeData } = await loadModel();
  const a=fake("one","Office A","one",1,0,0,1000), b=fake("two","Office B","two",0,1,0,3000);
  const spec=newMultiPracticeReview([a,b],"Owner","Review",true);
  assert.match(buildMultiPracticeData(spec,[a]).errors.join(" "),/missing/);
  assert.match(buildMultiPracticeData(spec,[{...a,updatedAt:"2026-10-29T12:00:00Z"},b]).errors.join(" "),/has changed/);
  assert.match(buildMultiPracticeData(spec,[a,{...b,reconciled:false}]).errors.join(" "),/reconciliation/);
});
test("cross-practice serial overlap is disclosed instead of silently deduplicated", async () => {
  const { newMultiPracticeReview, buildMultiPracticeData } = await loadModel();
  const a=fake("one","Office A","one",1,0,0,1000,"SERIAL123"), b=fake("two","Office B","two",0,1,0,3000,"SERIAL123");
  const result=buildMultiPracticeData(newMultiPracticeReview([a,b],"Owner","Review",true),[a,b]);
  assert.match(result.warnings.join(" "),/serial appears in both/);
  assert.equal(result.totalReportedAssetEntries,2);
});
test("screen and PDF reuse one practice-labeled section set", async () => {
  const { newMultiPracticeReview, buildMultiPracticeData } = await loadModel();
  const { multiPracticeHtml, multiPracticePages } = await loadHtml();
  const a=fake("one","Office A","one",1,0,0,1000), b=fake("two","Office B","two",0,1,0,3000);
  b.intelligence.facts=[]; b.intelligence.sourceSummaries=[];
  const report=buildMultiPracticeData(newMultiPracticeReview([a,b],"Owner","Review",true),[a,b]);
  const html=multiPracticeHtml(report);
  for(const phrase of ["Office A","Office B","Security","Backup &amp; recovery","Hardware inventory","HIPAA readiness","Technology roadmap","Ownership budget","Final recap"]) {
    assert.ok(html.includes(phrase),phrase);
  }
  assert.ok(html.includes("Security reporting not assessed"),"missing evidence is not zero incidents");
  assert.ok(html.includes("4,000"));
  assert.equal((html.match(/<section class="multi-page/g)||[]).length,multiPracticePages(report).length);
  assert.ok(multiPracticeHtml(report,2).includes("nth-child(3)"));
});
