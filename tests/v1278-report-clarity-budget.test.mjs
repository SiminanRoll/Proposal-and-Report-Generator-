import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const outcome = fs.readFileSync("src/components/outcome-experience.tsx", "utf8");
const inventory = fs.readFileSync("src/lib/outcomes/pdf-inventory-sync.ts", "utf8");
const budget = fs.readFileSync("src/lib/outcomes/technology-budget-outlook.ts", "utf8");
const budgetUi = fs.readFileSync("src/components/technology-budget-outlook.tsx", "utf8");
const pdf = fs.readFileSync("src/lib/outcomes/export-html.ts", "utf8");

test("budget toggle defaults on and controls both Present and Download", () => {
  assert.match(outcome, /includeTechnologyBudgetOutlook, setIncludeTechnologyBudgetOutlook\] = useState\(true\)/);
  assert.match(outcome, /TechnologyBudgetOutlookToggle/);
  assert.match(outcome, /sectionsFor\(project, includeTechnologyBudgetOutlook\)/);
  assert.match(outcome, /section === "budget"/);
  assert.match(outcome, /downloadOutcomePdf\(project, \{ includeTechnologyBudgetOutlook \}\)/);
  assert.match(pdf, /injectTechnologyBudgetOutlookPdf/);
});

test("budget page remains immediately before Recap", () => {
  assert.match(outcome, /return \[\.\.\.beginning, \.\.\.hipaa, "plan", \.\.\.budget, "recap"\]/);
  assert.match(budget, /const index = html\.lastIndexOf\(marker\)/);
  assert.match(budget, /html\.slice\(0, index\).*page.*html\.slice\(index\)/s);
});

test("budget uses red Replace Now workstations only", () => {
  assert.match(budget, /replaceNowWorkstations = workstations\.filter\(\(device\) => device\.lifecycleStatus === "overdue"\)\.length/);
  assert.match(budget, /baseReplacementValue = replaceNowWorkstations \* workstationReplacementUnit/);
  assert.match(budget, /replacementBudgetLow = roundBudgetValue\(baseReplacementValue\)/);
  assert.match(budget, /replacementBudgetHigh = roundBudgetValue\(baseReplacementValue \* \(1 \+ contingency\)\)/);
  assert.doesNotMatch(budget, /planSoonWorkstations/);
  assert.doesNotMatch(budget, /quarterlyRange/);
  assert.doesNotMatch(budgetUi, /Plan Soon/);
  assert.doesNotMatch(budgetUi, /four-quarter/i);
});

test("OS concerns are red callouts but are not automatically priced as replacements", () => {
  assert.match(budget, /status === "unsupported" \|\| status === "ending-soon"/);
  assert.match(budget, /osConcernSystems/);
  assert.match(budgetUi, /OS concerns are visible here but are not automatically added as workstation replacements/);
  assert.match(budget, /OS concerns are shown separately because some can be resolved without replacing the computer/);
  assert.match(budgetUi, /Non-red items are not included in this budget/);
  assert.match(budget, /Non-red items are not included in this budget/);
});

test("budget page uses friendly red-only client language", () => {
  assert.match(budgetUi, /What needs attention now\?/);
  assert.match(budgetUi, /Rough workstation replacement budget/);
  assert.match(budgetUi, /Red replacement items only/);
  assert.match(budgetUi, /Where the red items are concentrated/);
  assert.match(budget, /What needs attention now\?/);
  assert.match(budget, /Rough workstation replacement budget/);
  assert.match(budget, /Red replacement items only/);
  assert.match(budget, /Where the red items are concentrated/);
  assert.doesNotMatch(budget, /Example four-quarter budget pace/);
  assert.doesNotMatch(budget, /Plan Soon workstations/);
});

test("unknown ages are excluded from the red-only dollar figure until verified", () => {
  assert.match(budget, /incompleteAgeCount/);
  assert.match(budgetUi, /not included in this red-only replacement budget until verified/);
  assert.match(budget, /not included in this red-only replacement budget until verified/);
});

test("inventory is a compact per-location list instead of workstation cards", () => {
  assert.match(inventory, /const pageSize = 24/);
  assert.match(inventory, /pdf-device-list-header/);
  assert.match(inventory, /pdf-device-list-row/);
  assert.match(inventory, /grid-template-columns:2\.15fr \.72fr 1\.45fr 1\.45fr/);
  assert.match(inventory, />What needs attention<\/span>/);
  assert.doesNotMatch(inventory, /Check-in and status/);
  assert.doesNotMatch(inventory, /Warranty details not listed/);
});

test("location summary is simplified to reviewed, five-plus, OS concerns, and age verification", () => {
  assert.match(inventory, /label: "Systems reviewed"/);
  assert.match(inventory, /label: "5\+ years"/);
  assert.match(inventory, /label: "OS concerns"/);
  assert.match(inventory, /label: "Age to verify"/);
  assert.doesNotMatch(inventory, /Lifecycle to verify/);
  assert.doesNotMatch(inventory, /Lifecycle priorities/);
  assert.doesNotMatch(inventory, /Approaching lifecycle/);
});

test("five-plus ages and OS concerns are explicit red attention items", () => {
  assert.match(inventory, /const FIVE_YEAR_ATTENTION_AGE = 5/);
  assert.match(inventory, /ageYears >= FIVE_YEAR_ATTENTION_AGE/);
  assert.match(inventory, /explicit === "unsupported" \|\| explicit === "ending-soon"/);
  assert.match(inventory, /needs\.push\("5\+ years old"\)/);
  assert.match(inventory, /needs\.push\("OS review needed"\)/);
  assert.match(inventory, /pdf-device-list-fact\.priority strong.*#c45036/s);
  assert.match(inventory, /pdf-device-list-action\.priority strong.*#c45036/s);
  assert.match(inventory, /pdf-focus-summary \.priority.*#fff4f1/s);
});

test("unknown age keeps factual ship-date wording while status says age to verify", () => {
  assert.match(inventory, /return "Original ship date not listed"/);
  assert.match(inventory, /text: "Age to verify"/);
  assert.match(inventory, /label: "Age to verify"/);
  assert.match(inventory, /Number\.isFinite\(value\) && value > 0 \? value : null/);
  assert.doesNotMatch(inventory, /0 years old/);
  assert.match(pdf, /value <= 0\) return "Original ship date not listed"/);
});

test("client report uses the simple healthy plan replace verify language", () => {
  assert.match(outcome, /if \(value === "lifecycle"\) return "Equipment age"/);
  assert.match(outcome, /Equipment age & replacement planning/);
  assert.match(outcome, /lifecycle\.overdue[^\n]*Replace now/);
  assert.match(outcome, /lifecycle\.unknown[^\n]*Age to verify/);
  assert.match(pdf, /<span><b>\$\{lifecycle\.overdue\}<\/b>Replace now<\/span>/);
  assert.match(pdf, /<span><b>\$\{lifecycle\.unknown\}<\/b>Age to verify<\/span>/);
});

test("replace-now and OS concern callouts are red in planning and recap", () => {
  assert.match(outcome, /className=\{lifecycle\.overdue \? "risk" : "healthy"\}[^\n]*<b>Replace now<\/b>/);
  assert.match(outcome, /className=\{osSupport\.attention \? "risk" : "healthy"\}[^\n]*<b>OS concerns<\/b>/);
  assert.match(outcome, /className=\{lifecycle\.overdue \? "risk" : "healthy"\}[^\n]*<span>Replace now<\/span>/);
  assert.match(outcome, /className=\{osSupport\.attention \? "risk" : "healthy"\}[^\n]*<span>OS concerns<\/span>/);
  assert.match(pdf, /class="\$\{lifecycle\.overdue \? "risk" : "healthy"\}"[^\n]*<span>Replace now<\/span>/);
  assert.match(pdf, /class="\$\{osSummary\.attention \? "risk" : "healthy"\}"[^\n]*<span>OS concerns<\/span>/);
});

test("location grouping remains intact", () => {
  assert.match(inventory, /function groupedInventoryCards/);
  assert.match(inventory, /if \(\/\^remote\$\/i\.test\(value\)\) return 1/);
  assert.match(inventory, /if \(value === UNASSIGNED_LOCATION\) return 2/);
  assert.match(inventory, /groupedInventoryCards\(cards\)\.flatMap/);
  assert.match(inventory, /data-inventory-location=/);
});

test("red-only budget release is version 1.2.80", () => {
  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\.2\.80"/);
  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\.2\.80/);
});
