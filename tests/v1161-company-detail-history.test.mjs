import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../src/components/client-activity-runtime.tsx", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/compass-client-review-workspace-v10941.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10941-client-review.css", import.meta.url), "utf8");

test("Company Detail preserves completed stored history when live history is empty", () => {
  assert.match(bridge, /const priorCompleted/);
  assert.match(bridge, /\[\.\.\.priorCompleted, \.\.\.incomingActivity\]/);
  assert.match(bridge, /\.slice\(0, 40\)/);
  assert.match(runtime, /uniqueById\(\[\.\.\.storedHistory, \.\.\.\(activitySync\?\.recent_activity \?\? \[\]\)\]\)\.filter\(completedActivity\)/);
  assert.match(workspace, /resolvedActivityHistory\(\[\.\.\.persistedActivity, \.\.\.\(activitySync\?\.recent_activity \?\? \[\]\)\]\)/);
});

test("live open-task state remains authoritative", () => {
  assert.match(runtime, /activitySync \? \(activitySync\.open_tasks \?\? \[\]\) : storedUpcoming/);
});

test("Company Detail health pill follows project value and physical-server age thresholds", () => {
  assert.match(workspace, /projectValue > 8_000 \|\| oldestServerAge > 6/);
  assert.match(workspace, /projectValue > 5_000 \|\| oldestServerAge > 5/);
  assert.match(workspace, /return "Healthy"/);
  assert.match(workspace, /companyHealthStatus\(summary\.totalEstimatedValue, physicalServers\)/);
  assert.match(css, /status-healthy/);
  assert.match(css, /status-monitor-needs/);
  assert.match(css, /status-unhealthy/);
});
