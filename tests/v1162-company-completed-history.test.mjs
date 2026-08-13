import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const history = fs.readFileSync(new URL("../src/lib/compass/captains-log-company-history.ts", import.meta.url), "utf8");
const activityRuntime = fs.readFileSync(new URL("../src/components/client-activity-runtime.tsx", import.meta.url), "utf8");

test("Company Detail reads a bounded completion window for only the selected company", () => {
  assert.match(history, /"GET", "task_events"/);
  assert.match(history, /company_id: `eq\.\$\{companyId\}`/);
  assert.match(history, /COMPANY_EVENT_SCAN_LIMIT = 80/);
  assert.match(history, /COMPANY_TASK_ID_LIMIT = 24/);
  assert.match(history, /TASK_HISTORY_SCAN_LIMIT = 240/);
  assert.match(history, /limit: String\(COMPANY_EVENT_SCAN_LIMIT\)/);
  assert.match(history, /order: "inserted_at\.desc,event_id\.desc"/);
  assert.doesNotMatch(history, /setInterval|offset|PAGE_SIZE|MAX_ROWS/);
});

test("Company Detail reconstructs discovered company tasks by identity", () => {
  assert.match(history, /local_task_id: `in\.\(\$\{taskIds\.map/);
  assert.match(history, /limit: String\(TASK_HISTORY_SCAN_LIMIT\)/);
  assert.match(history, /order: "inserted_at\.asc,event_id\.asc"/);
  assert.match(history, /Some completion\/reopen events omit company_id/);
});

test("Company Detail merges ledger completion history into its visible Recent card", () => {
  assert.match(activityRuntime, /loadRecentCompletedCompanyActivity/);
  assert.match(activityRuntime, /sync\.company_id \|\| client\.companyId/);
  assert.match(activityRuntime, /recent_activity: uniqueById/);
  assert.match(activityRuntime, /void syncCompanyActivity\(client\)/);
});

test("reopened and deleted tasks do not remain in completed history", () => {
  assert.match(history, /eventType\.includes\("reopened"\)/);
  assert.match(history, /current\.done = false/);
  assert.match(history, /task\.done && !task\.deleted/);
});
