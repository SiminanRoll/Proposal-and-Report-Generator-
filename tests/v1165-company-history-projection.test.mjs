import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const history = fs.readFileSync(new URL("../src/lib/compass/captains-log-company-history.ts", import.meta.url), "utf8");
const activity = fs.readFileSync(new URL("../src/components/client-activity-runtime.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/company-details-layout.css", import.meta.url), "utf8");

test("Company Detail asks Supabase for compact Focus and Call Mode history first", () => {
  assert.match(history, /"POST", "rpc\/client_compass_current_state"/);
  assert.match(history, /p_company_ids: \[companyId\]/);
  assert.match(history, /focus_tasks/);
  assert.match(history, /sales_tasks/);
  assert.match(history, /sales_activities/);
  assert.ok(history.indexOf("loadProjectedCompletedActivity(companyId)") < history.indexOf('"GET", "task_events"'));
});

test("Company Detail does not label a pending or failed request as empty history", () => {
  assert.match(activity, /activityLoadState/);
  assert.match(activity, /Loading history/);
  assert.match(activity, /History unavailable/);
  assert.match(activity, /Refresh to retry the history connection/);
});

test("saved visibility has final cascade authority over the activity card", () => {
  const finalRule = css.lastIndexOf("is-company-layout-hidden-v1164");
  const forcedDisplay = css.lastIndexOf("client-review-latest-activity-v10941.is-activity-hub-v1123");
  assert.ok(finalRule >= forcedDisplay);
  assert.match(css.slice(finalRule - 180), /display:none!important/);
});
