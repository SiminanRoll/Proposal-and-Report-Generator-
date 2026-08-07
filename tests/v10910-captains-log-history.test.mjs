import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const bridge = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");
const dataTools = fs.readFileSync(new URL("../src/components/compass-data-tools-page.tsx", import.meta.url), "utf8");
const coverage = fs.readFileSync(new URL("../src/components/project-coverage-client-list.tsx", import.meta.url), "utf8");
const coverageModel = fs.readFileSync(new URL("../src/lib/compass/project-coverage.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("Client Compass 1.0.9.16 keeps the complete matched Captain's Log history", () => {
  assert.equal(pkg.version, "1.0.9.16");
  assert.match(bridge, /const activityHistory = \[\.\.\.new Map\(activities\.map/);
  assert.doesNotMatch(bridge, /activities\.slice\(0,\s*12\)/);
  assert.match(bridge, /LEDGER_MAX_ROWS_PER_TABLE = 250_000/);
  assert.match(workspace, /client\.captainsLog\?\.recentActivity/);
  assert.doesNotMatch(workspace, /activityHistory\.slice\(0,\s*6\)/);
  assert.match(css, /\.compass-captains-log-activity-list\{max-height:340px;overflow-y:auto/);
});

test("1.0.9.16 bulk sync refreshes the entire client book in one pass", () => {
  assert.match(dataTools, /Sync all client history/);
  assert.match(dataTools, /Sync all history/);
  assert.match(dataTools, /every matched Captain's Log task and activity record/);
  assert.match(dataTools, /syncClientsFromCaptainsLog/);
  assert.doesNotMatch(dataTools, /replaceCaptainsLogQueue/);
});

test("1.0.9.16 turns the client history area into history plus simple refresh and add actions", () => {
  assert.match(workspace, /<h3>Client history<\/h3>/);
  assert.match(workspace, /compass-history-icon-button/);
  assert.match(workspace, /aria-label="Refresh Captain's Log history"/);
  assert.match(workspace, /aria-label="Add coordination task"/);
  assert.match(workspace, /Add task/);
  assert.doesNotMatch(workspace, /Client activity & open work|Refresh from Supabase|Schedule Coordination Call|Coordination tracked/);
});

test("1.0.9.16 creates coordination tasks without open-work gates", () => {
  assert.doesNotMatch(bridge, /blocked-open-task/);
  assert.doesNotMatch(workspace, /open or planned task|Rechecking Supabase before scheduling/);
  assert.match(bridge, /await captainsLogCloudRest<null>\("POST", "task_events"/);
});

test("1.0.9.16 uses Captain's Log compasses as history indicators instead of task gates", () => {
  assert.match(coverageModel, /captainsLogActivityCount: number/);
  assert.match(coverageModel, /recentActivity\?\.length/);
  assert.match(coverage, /Captain's Log/);
  assert.doesNotMatch(coverage, /Open coordination work|Task already open|Schedule Coordination Call/);
});
