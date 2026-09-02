import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const component = fs.readFileSync("src/components/technology-budget-outlook.tsx", "utf8");
const budget = fs.readFileSync("src/lib/outcomes/technology-budget-outlook.ts", "utf8");

test("budget planning includes due-now and upcoming workstations", () => {
  assert.match(budget, /planSoonWorkstations = workstations\.filter\(\(device\) => device\.lifecycleStatus === "due-soon"\)\.length/);
  assert.match(budget, /planningWorkstations = replaceNowWorkstations \+ planSoonWorkstations/);
  assert.match(budget, /baseReplacementValue = planningWorkstations \* workstationReplacementUnit/);
});

test("quarterly budget is derived from the same 12-month range divided by four", () => {
  assert.match(budget, /quarterlyBudgetLow = replacementBudgetLow \? Math\.round\(replacementBudgetLow \/ 4\) : 0/);
  assert.match(budget, /quarterlyBudgetHigh = replacementBudgetHigh \? Math\.round\(replacementBudgetHigh \/ 4\) : 0/);
});

test("presentation leads with friendly quarterly planning and flips to annual estimate", () => {
  assert.match(component, /Plan ahead for upcoming technology needs/);
  assert.match(component, /Suggested quarterly technology budget/);
  assert.match(component, /setShowTotal/);
  assert.match(component, /rotateY\(180deg\)/);
  assert.match(component, /Current 12-month workstation estimate/);
  assert.doesNotMatch(component, /red-only/i);
  assert.doesNotMatch(component, /Client Compass/);
});

test("portrait PDF mirrors the friendly planning hierarchy", () => {
  assert.match(budget, /Technology Planning/);
  assert.match(budget, /Suggested quarterly technology budget/);
  assert.match(budget, /Current 12-month workstation estimate/);
  assert.match(budget, /Where upcoming needs are concentrated/);
  assert.doesNotMatch(budget, /red-only/i);
  assert.doesNotMatch(budget, /Client Compass/);
});

test("friendly budget release is version 1.2.83", () => {
  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\.2\.83"/);
  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\.2\.83/);
});
