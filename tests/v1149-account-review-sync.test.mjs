import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Account Review sync reconstructs canonical task scheduling by task identity", async () => {
  const source = await readFile("src/lib/compass/captains-log-account-review-sync.ts", "utf8");
  assert.match(source, /local_task_id: `in\.\(\$\{chunk\.map/);
  assert.match(source, /company_id: `in\.\(\$\{chunk\.join/);
  assert.match(source, /patch, "scheduled_at"/);
  assert.match(source, /eventType\.includes\("scheduled"\)/);
  assert.match(source, /eventType\.includes\("unscheduled"\)/);
  assert.match(source, /eventType\.includes\("completed"\)/);
  assert.match(source, /task_deleted/);
  assert.match(source, /status: task\.scheduledAt \? "scheduled" : "open"/);
});

test("Account Review repair piggybacks the existing Compass sync coordinator", async () => {
  const wrapper = await readFile("src/components/compass-sync-runtime-v1139.tsx", "utf8");
  assert.match(wrapper, /captains-log-full-hydration\.v4/);
  assert.match(wrapper, /COMPASS_SYNC_STATUS_EVENT/);
  assert.match(wrapper, /syncAccountReviewTasks\(dataset, \{ discover: true \}\)/);
  assert.match(wrapper, /syncAccountReviewTasks\(hydratedDataset, \{ discover: false \}\)/);
  assert.match(wrapper, /syncAccountReviewTasks\(dataset, \{ discover \}\)/);
  assert.match(wrapper, /ACCOUNT_REVIEW_REPAIR_INTERVAL_MS = 6 \* 60_000/);
  assert.doesNotMatch(wrapper, /setInterval/);
});

test("Account Review repair preserves completed-only review dates", async () => {
  const source = await readFile("src/lib/compass/captains-log-account-review-sync.ts", "utf8");
  assert.match(source, /filter\(\(task\) => task\.done && !task\.deleted\)/);
  assert.match(source, /lastAccountReview/);
  assert.doesNotMatch(source, /lastAccountReview:\s*task\.scheduledAt/);
});
