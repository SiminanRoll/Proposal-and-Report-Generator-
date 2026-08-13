import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const runtime = fs.readFileSync(new URL("../src/components/compass-sync-runtime-v1139.tsx", import.meta.url), "utf8");
const detail = fs.readFileSync(new URL("../src/components/client-activity-runtime.tsx", import.meta.url), "utf8");

test("Account Review repair runs no more than once every six minutes", () => {
  assert.match(runtime, /ACCOUNT_REVIEW_REPAIR_INTERVAL_MS = 6 \* 60_000/);
  assert.match(runtime, /Date\.now\(\) - lastReviewRepairAt < ACCOUNT_REVIEW_REPAIR_INTERVAL_MS/);
  assert.doesNotMatch(runtime, /!foreground && Date\.now\(\) - lastReviewRepairAt/);
});

test("Company Detail history uses the UUID resolved by current-state sync", () => {
  const syncStart = detail.indexOf("let sync = await syncClientFromCaptainsLog");
  const historyStart = detail.indexOf("const completedHistory = await loadRecentCompletedCompanyActivity");
  assert.ok(syncStart >= 0 && historyStart > syncStart);
  assert.match(detail, /loadRecentCompletedCompanyActivity\(sync\.company_id \|\| client\.companyId \|\| "", knownTaskIds\)/);
  assert.match(detail, /client\.aliases, storedCompanyId/);
  assert.match(detail, /const sync = await syncCompanyActivity\(client\)/);
});

test("Company Detail follows company discovery with bounded task-history reconstruction", () => {
  const history = fs.readFileSync(new URL("../src/lib/compass/captains-log-company-history.ts", import.meta.url), "utf8");
  assert.match(history, /company_id: `eq\.\$\{companyId\}`/);
  assert.match(history, /const taskIds = \[\.\.\.new Set/);
  assert.match(history, /local_task_id: `in\.\(\$\{taskIds\.map/);
  assert.match(history, /TASK_HISTORY_SCAN_LIMIT = 240/);
});
