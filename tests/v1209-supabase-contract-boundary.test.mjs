import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const durableRuntime = fs.readFileSync(new URL("../src/components/durable-storage-runtime.tsx", import.meta.url), "utf8");
const backupSettings = fs.readFileSync(new URL("../src/components/compass-master-backup-settings.tsx", import.meta.url), "utf8");
const taskWrite = fs.readFileSync(new URL("../src/lib/compass/captains-log-task-write.ts", import.meta.url), "utf8");
const currentState = fs.readFileSync(new URL("../src/lib/compass/captains-log-current-state.ts", import.meta.url), "utf8");
const summaryRuntime = fs.readFileSync(new URL("../src/components/company-technology-summary-runtime.tsx", import.meta.url), "utf8");
const removedCloudSnapshot = new URL("../src/lib/compass/cloud-snapshot.ts", import.meta.url);

test("private Compass recovery no longer writes or restores a Supabase full database snapshot", () => {
  assert.equal(fs.existsSync(removedCloudSnapshot), false);
  assert.doesNotMatch(durableRuntime, /cloud-snapshot|recoverCloudDatabaseIfNeeded|saveCloudDatabaseSnapshotNow|client_compass_user_snapshots/);
  assert.doesNotMatch(backupSettings, /Supabase recovery snapshot|Save cloud now|client_compass_user_snapshots|cloud-snapshot/);
  assert.match(backupSettings, /Private recovery stays local; Supabase is reserved for shared operational records\./);
  assert.match(backupSettings, /Enable Documents protection/);
});

test("shared operational integration remains direct to Supabase", () => {
  assert.match(taskWrite, /rpc\/ensure_company_identity/);
  assert.match(taskWrite, /"POST",\s*"tasks"/);
  assert.match(currentState, /"GET", "tasks"/);
  assert.match(currentState, /company_id: `eq\.\$\{companyId\}`/);
  assert.doesNotMatch(taskWrite + currentState, /127\.0\.0\.1|captainslog:\/\/|client_compass_request|client_compass_response/);
});

test("technology sharing remains an aggregate-only Supabase publish", () => {
  assert.match(summaryRuntime, /rpc\/upsert_company_technology_summaries/);
  for (const key of ["healthy_count", "planning_count", "replace_count", "estimated_replacement_need", "last_quote_date", "snapshot_updated_at"]) {
    assert.match(summaryRuntime, new RegExp(key));
  }
  assert.doesNotMatch(summaryRuntime, /client_compass_user_snapshots/);
});
