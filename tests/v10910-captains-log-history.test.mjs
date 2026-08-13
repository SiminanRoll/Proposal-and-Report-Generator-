import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const workspace = fs.readFileSync(new URL("../src/components/compass-client-review-workspace-v10941.tsx", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
const currentState = fs.readFileSync(new URL("../src/lib/compass/captains-log-current-state.ts", import.meta.url), "utf8");
const writer = fs.readFileSync(new URL("../src/lib/compass/captains-log-task-write.ts", import.meta.url), "utf8");
const dataTools = fs.readFileSync(new URL("../src/components/compass-data-tools-page.tsx", import.meta.url), "utf8");
const coverage = fs.readFileSync(new URL("../src/components/project-coverage-client-list.tsx", import.meta.url), "utf8");

test("shared Supabase bridge keeps a bounded company-scoped recent activity slice", () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.match(currentState, /RECENT_COMPLETED_LIMIT = 12/);
  assert.match(currentState, /company_id: `eq\.\$\{companyId\}`/);
  assert.match(workspace, /storedActivitySync\(client\)/);
});

test("bulk sync is an explicit bounded refresh rather than startup replication", () => {
  assert.match(dataTools, /Sync all client history/);
  assert.match(dataTools, /Sync all history/);
  assert.match(currentState, /BATCH_CONCURRENCY = 6/);
});

test("client review reduces activity to one latest item with a simple refresh", () => {
  assert.match(workspace, /Latest activity/);
  assert.match(workspace, /const latestActivity = activityHistory\[0\]/);
  assert.match(workspace, /aria-label="Refresh activity"/);
  assert.match(workspace, /syncClientsFromCaptainsLog/);
});

test("coordination task backend writes canonical task state without open-work gates", () => {
  assert.doesNotMatch(bridge, /blocked-open-task/);
  assert.match(writer, /"POST",\s*\n\s*"tasks"/);
  assert.match(writer, /record_kind: "focus"/);
  assert.doesNotMatch(writer, /task_events/);
});

test("Project Coverage tracked state remains independent of streamlined client review", () => {
  assert.match(coverage, /ClientTrackedAction/);
  assert.match(coverage, /tracked=\{Boolean\(meta\?\.tracked\)\}/);
});
