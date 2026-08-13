import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const selector = fs.readFileSync(new URL("../src/lib/compass/captains-log-recent.ts", import.meta.url), "utf8");
const detail = fs.readFileSync(new URL("../src/components/client-activity-runtime.tsx", import.meta.url), "utf8");
const workbench = fs.readFileSync(new URL("../src/components/workbench-page.tsx", import.meta.url), "utf8");

test("Workbench and Company Detail share one newest Captain's Log activity rule", () => {
  assert.match(selector, /completedAt[\s\S]*completed_at[\s\S]*scheduledAt[\s\S]*scheduled_at[\s\S]*createdAt[\s\S]*created_at/);
  assert.match(detail, /newestCaptainsLogActivity\(history\)/);
  assert.match(workbench, /newestCaptainsLogActivity\(client\.captainsLog\?\.recentActivity \?\? \[\]\)/);
});

test("Company Detail presents the latest completed activity without an age cutoff", () => {
  assert.match(detail, /\.filter\(completedActivity\)/);
  assert.match(detail, /Last completed/);
  assert.match(detail, /No completed activity/);
  assert.match(detail, /activityDate\(captainsLogRecentStamp\(latestHistory\)\)/);
});
