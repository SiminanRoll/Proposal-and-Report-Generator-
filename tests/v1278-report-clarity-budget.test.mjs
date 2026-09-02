import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const outcome = fs.readFileSync("src/components/outcome-experience.tsx", "utf8");
const inventory = fs.readFileSync("src/lib/outcomes/pdf-inventory-sync.ts", "utf8");
const budget = fs.readFileSync("src/lib/outcomes/technology-budget-outlook.ts", "utf8");
const budgetUi = fs.readFileSync("src/components/technology-budget-outlook.tsx", "utf8");
const pdf = fs.readFileSync("src/lib/outcomes/export-html.ts", "utf8");

test("budget outlook toggle controls both Present and Download", () => {
  assert.match(outcome, /includeTechnologyBudgetOutlook, setIncludeTechnologyBudgetOutlook\] = useState\(false\)/);
  assert.match(outcome, /TechnologyBudgetOutlookToggle/);
  assert.match(outcome, /sectionsFor\(project, includeTechnologyBudgetOutlook\)/);
  assert.match(outcome, /section === "budget"/);
  assert.match(outcome, /downloadOutcomePdf\(project, \{ includeTechnologyBudgetOutlook \}\)/);
  assert.match(pdf, /injectTechnologyBudgetOutlookPdf/);
});

test("budget outlook is immediately before Recap", () => {
  assert.match(outcome, /return \[\.\.\.beginning, \.\.\.hipaa, "plan", \.\.\.budget, "recap"\]/);
  assert.match(budget, /const index = html\.lastIndexOf\(marker\)/);
  assert.match(budget, /html\.slice\(0, index\).*page.*html\.slice\(index\)/s);
});

test("quarterly example uses the same total range divided by four and full disclaimer", () => {
  assert.match(budget, /quarterlyRangeLow = roundPlanningValue\(planningRangeLow \/ 4\)/);
  assert.match(budget, /quarterlyRangeHigh = roundPlanningValue\(planningRangeHigh \/ 4\)/);
  assert.match(budgetUi, /not financing, a payment plan, or a formal quote/i);
  assert.match(budget, /not financing, a payment plan, or a formal quote/i);
});

test("budget outlook surfaces Windows 10 and broader location OS concerns", () => {
  assert.match(budget, /windows10Systems/);
  assert.match(budget, /osConcerns/);
  assert.match(budget, /status === "unsupported" \|\| status === "ending-soon"/);
  assert.match(budgetUi, /OS concerns/);
  assert.match(budgetUi, /Windows 10 systems to review/);
  assert.match(budget, /incomplete age data/);
});

test("inventory prioritizes useful OS concerns over zero-value filler", () => {
  assert.match(inventory, /data-os=/);
  assert.match(inventory, /explicit === "unsupported" \|\| explicit === "ending-soon"/);
  assert.match(inventory, /const osConcerns = cards\.filter\(\(card\) => card\.osConcern\)\.length/);
  assert.match(inventory, /label: "OS concerns"/);
  assert.match(inventory, /const usefulItems/);
  assert.match(inventory, /const zeroFillers/);
  assert.match(inventory, /\.slice\(0, 4\)/);
});

test("unknown age never presents zero years and warranty wording is clean", () => {
  assert.match(inventory, /Original ship date not listed/);
  assert.match(inventory, /Warranty details not listed/);
  assert.match(inventory, /\^0\(\?:\\\.0\+\)\?\\s\+years\?/);
  assert.match(pdf, /value <= 0\) return "Original ship date not listed"/);
});

test("location grouping remains intact", () => {
  assert.match(inventory, /function groupedInventoryCards/);
  assert.match(inventory, /if \(\/\^remote\$\/i\.test\(value\)\) return 1/);
  assert.match(inventory, /if \(value === UNASSIGNED_LOCATION\) return 2/);
  assert.match(inventory, /groupedInventoryCards\(cards\)\.flatMap/);
  assert.match(inventory, /data-inventory-location=/);
});

test("release is v1.2.78", () => {
  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\.2\.78"/);
  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\.2\.78/);
});
