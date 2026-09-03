import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const budget = fs.readFileSync("src/lib/outcomes/technology-budget-outlook.ts", "utf8");
const component = fs.readFileSync("src/components/technology-budget-outlook.tsx", "utf8");

test("technology budget includes due-now and upcoming physical servers", () => {
  assert.match(budget, /const servers = devices\.filter\(isServer\)/);
  assert.match(budget, /replaceNowServers = servers\.filter\(\(device\) => device\.lifecycleStatus === "overdue"\)\.length/);
  assert.match(budget, /planSoonServers = servers\.filter\(\(device\) => device\.lifecycleStatus === "due-soon"\)\.length/);
  assert.match(budget, /planningServers = replaceNowServers \+ planSoonServers/);
});

test("server value uses the saved Compass server estimate before contingency", () => {
  assert.match(budget, /config\.value\.standardServerReplacement/);
  assert.match(budget, /config\.value\.multiServerAdditionalMultiplier/);
  assert.match(budget, /baseReplacementValue = serverReplacementBase \+ workstationReplacementBase/);
  assert.match(budget, /replacementBudgetHigh = roundBudgetValue\(baseReplacementValue \* \(1 \+ contingency\)\)/);
});

test("presentation makes server needs primary when a server is in the 12-month plan", () => {
  assert.match(component, /outlook\.planningServers \? <>/);
  assert.match(component, />server\{outlook\.planningServers === 1 \? "" : "s"\}<br \/>over the next 12 months/);
  assert.match(component, /server and workstation replacements we can currently see coming/);
  assert.match(component, /Current 12-month technology estimate/);
  assert.doesNotMatch(component, /Current 12-month workstation estimate/);
});

test("location summaries keep server and workstation needs distinct", () => {
  assert.match(budget, /replaceNowServersAtLocation/);
  assert.match(budget, /planSoonServersAtLocation/);
  assert.match(component, /server.*due now/);
  assert.match(component, /workstation.*due now/);
});

test("age completeness covers both server and workstation lifecycle data", () => {
  assert.match(budget, /incompleteServerAgeCount/);
  assert.match(budget, /incompleteWorkstationAgeCount/);
  assert.match(component, /Lifecycle age data is complete/);
});
