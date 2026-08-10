import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const workspace = fs.readFileSync(new URL("../src/components/compass-client-review-workspace-v10941.tsx", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
const dataTools = fs.readFileSync(new URL("../src/components/compass-data-tools-page.tsx", import.meta.url), "utf8");
const coverage = fs.readFileSync(new URL("../src/components/project-coverage-client-list.tsx", import.meta.url), "utf8");
const coverageModel = fs.readFileSync(new URL("../src/lib/compass/project-coverage.ts", import.meta.url), "utf8");

test("shared Supabase bridge keeps the complete matched activity history", () => {
  assert.equal(pkg.version, "1.1.0");
  assert.match(bridge, /const activityHistory = \[\.\.\.new Map\(activities\.map/);
  assert.doesNotMatch(bridge, /activities\.slice\(0,\s*12\)/);
  assert.match(bridge, /LEDGER_MAX_ROWS_PER_TABLE = 250_000/);
  assert.match(workspace, /storedActivitySync\(client\)/);
  assert.doesNotMatch(workspace, /recent_activity\?\.slice\(/);
});

test("bulk sync refreshes the entire client book in one pass", () => {
  assert.match(dataTools, /Sync all client history/);
  assert.match(dataTools, /Sync all history/);
  assert.match(dataTools, /every matched Captain's Log task and activity record/);
  assert.match(dataTools, /activityCount = appliedResults\.reduce/);
  assert.doesNotMatch(dataTools, /replaceCaptainsLogQueue/);
});

test("v1.0.9.41 client review reduces history to one latest activity with a simple fresh refresh", () => {
  assert.match(workspace, /Latest activity/);
  assert.match(workspace, /const latestActivity = activityHistory\[0\]/);
  assert.match(workspace, /aria-label="Refresh activity"/);
  assert.match(workspace, /syncClientsFromCaptainsLog/);
  assert.doesNotMatch(workspace, /Client history|Add task|Refresh from Supabase|Schedule Coordination Call|Coordination tracked/);
});

test("coordination task backend does not use open-work gates", () => {
  assert.doesNotMatch(bridge, /blocked-open-task/);
  assert.doesNotMatch(workspace, /open or planned task|Rechecking Supabase before scheduling/);
  assert.match(bridge, /await captainsLogCloudRest<null>\("POST", "task_events"/);
});

test("Project Coverage tracked history remains independent of the streamlined client review", () => {
  assert.match(coverageModel, /captainsLogActivityCount: number/);
  assert.match(coverageModel, /recentActivity\?\.length/);
  assert.match(coverage, /ClientTrackedAction/);
  assert.match(coverage, /tracked=\{Boolean\(meta\?\.tracked\)\}/);
  assert.doesNotMatch(coverage, /Check Supabase first|Existing work found|Scheduling stays locked|Open work <span/);
});
