import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(fs.readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");
const currentState = fs.readFileSync(new URL("../src/lib/compass/captains-log-current-state.ts", import.meta.url), "utf8");
const syncRuntime = fs.readFileSync(new URL("../src/components/compass-sync-runtime.tsx", import.meta.url), "utf8");
const hydrationRuntime = fs.readFileSync(new URL("../src/components/compass-sync-runtime-v1139.tsx", import.meta.url), "utf8");
const workbench = fs.readFileSync(new URL("../src/lib/compass/workbench.ts", import.meta.url), "utf8");

test("current release is consistent across application and package metadata", () => {
  assert.equal(pkg.version, "1.1.61");
  assert.equal(lock.version, "1.1.61");
  assert.equal(lock.packages[""].version, "1.1.61");
  assert.match(version, /APP_VERSION = "1\.1\.61"/);
});

test("canonical history recognizes all supported completed task shapes", () => {
  assert.match(currentState, /\["completed", "done", "closed", "resolved"\]\.includes\(state\)/);
  assert.match(currentState, /boolish\(payload\.done\)/);
  assert.match(currentState, /boolish\(payload\.completed\)/);
  assert.match(currentState, /payload\.completed_at \|\| payload\.done_at/);
  assert.match(currentState, /RECENT_COMPLETION_FILTER/);
  assert.match(currentState, /or: RECENT_COMPLETION_FILTER/);
  assert.match(currentState, /limit: String\(RECENT_COMPLETED_LIMIT\)/);
  assert.doesNotMatch(currentState, /lifecycle_state: "eq\.completed"/);
});

test("background reconciliation follows canonical task updates and rehydrates existing workspaces", () => {
  assert.match(syncRuntime, /fetchDelta<DeltaRow>\("tasks", cursor, "updated_at"/);
  assert.match(syncRuntime, /select: "task_id,updated_at,company_id"/);
  assert.doesNotMatch(syncRuntime, /fetchDelta<DeltaRow>\("task_events"|fetchDelta<DeltaRow>\("app_events"/);
  assert.match(hydrationRuntime, /captains-log-full-hydration\.v4/);
});

test("recently completed review steps remain in progress until the annual review is closed", () => {
  const stage = workbench.slice(workbench.indexOf("export function workbenchStage"));
  assert.ok(stage.indexOf("workbenchReviewCurrent(client)") < stage.indexOf("workbenchHasRecentReviewActivity(client)"));
  assert.match(stage, /if \(workbenchHasRecentReviewActivity\(client\)\) return "In Progress"/);
});
