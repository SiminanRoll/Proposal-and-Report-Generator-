import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const outcome = fs.readFileSync("src/components/outcome-experience.tsx", "utf8");
const inventory = fs.readFileSync("src/lib/outcomes/pdf-inventory-sync.ts", "utf8");
const budget = fs.readFileSync("src/lib/outcomes/technology-budget-outlook.ts", "utf8");
const budgetUi = fs.readFileSync("src/components/technology-budget-outlook.tsx", "utf8");
const pdf = fs.readFileSync("src/lib/outcomes/export-html.ts", "utf8");

test("budget outlook is actually wired to both Present and Download", () => {
  assert.match(outcome, /TechnologyBudgetOutlookToggle/);
  assert.match(outcome, /includeTechnologyBudgetOutlook/);
  assert.match(outcome, /section === "budget"/);
  assert.match(outcome, /downloadOutcomePdf\(project, \{ includeTechnologyBudgetOutlook \}\)/);
  assert.match(pdf, /injectTechnologyBudgetOutlookPdf/);
  assert.match(pdf, /includeTechnologyBudgetOutlook/);
  assert.match(budgetUi, /Example four-quarter budget pace/);
  assert.match(budgetUi, /not financing or a payment plan/i);
});

test("inventory summary prioritizes useful Windows 10 information", () => {
  assert.match(inventory, /windows10Systems/);
  assert.match(inventory, /label: "Windows 10 systems"/);
  assert.match(inventory, /tone: "priority"/);
  assert.match(inventory, /zeroValuePriority/);
  assert.doesNotMatch(inventory, /label: "OS concerns"/);
});

test("inventory uses client-friendly age wording", () => {
  assert.match(inventory, /Plan soon by age/);
  assert.match(inventory, /Replace now by age/);
  assert.match(inventory, /Age to verify/);
  assert.match(inventory, /Original ship date not listed/);
  assert.doesNotMatch(inventory, /label: "Approaching lifecycle"/);
  assert.doesNotMatch(inventory, /label: "Lifecycle priorities"/);
  assert.doesNotMatch(inventory, /label: "Lifecycle to verify"/);
});

test("Windows 10 is red and Windows 11 is green in inventory visuals", () => {
  assert.match(inventory, /if \(isWindows10\(os\)\) return "priority"/);
  assert.match(inventory, /if \(isWindows11\(os\)\) return "healthy"/);
  assert.match(outcome, /Windows\\s\*10/);
  assert.match(outcome, /Windows\\s\*11/);
});

test("budget outlook uses age language in client copy", () => {
  assert.match(budget, /Locations with the most OS & age concerns/);
  assert.match(budgetUi, /Locations with the most OS & age concerns/);
  assert.doesNotMatch(budgetUi, /OS & lifecycle concerns/);
  assert.match(budget, /incomplete age data/);
});

test("release is v1.2.78", () => {
  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\.2\.78"/);
  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\.2\.78/);
});
