import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
const currentState = fs.readFileSync(new URL("../src/lib/compass/captains-log-current-state.ts", import.meta.url), "utf8");
const writer = fs.readFileSync(new URL("../src/lib/compass/captains-log-task-write.ts", import.meta.url), "utf8");
const activityRuntime = fs.readFileSync(new URL("../src/components/client-activity-runtime.tsx", import.meta.url), "utf8");
const companyDetail = fs.readFileSync(new URL("../src/components/compass-client-review-workspace-v10941.tsx", import.meta.url), "utf8");

test("current Client Compass release metadata stays synchronized", () => {
  assert.equal(pkg.version, "1.1.71");
  assert.match(version, /APP_VERSION = "1\.1\.71"/);
});

test("Phase 9 reads current and recent client state directly from canonical public.tasks", () => {
  assert.match(bridge, /syncClientsFromCompassCurrentState/);
  assert.match(currentState, /"GET", "tasks"/);
  assert.match(currentState, /lifecycle_state: "eq\.open"/);
  assert.match(currentState, /RECENT_COMPLETION_FILTER/);
  assert.match(currentState, /company_id: `eq\.\$\{companyId\}`/);
  assert.match(currentState, /OPEN_LIMIT = 24/);
  assert.match(currentState, /RECENT_COMPLETED_LIMIT = 12/);
  assert.doesNotMatch(currentState, /task_events|app_events|client_compass_current_state/);
});

test("company detail uses the client's canonical company UUID and completion timestamp fallback", () => {
  assert.match(bridge, /companyId: text\(companyId\)/);
  assert.match(activityRuntime, /client\.aliases, storedCompanyId/);
  assert.match(companyDetail, /client\.aliases, client\.companyId/);
  assert.match(currentState, /completedStamp/);
  assert.match(currentState, /boolish\(payload\.done\)/);
});

test("Phase 9 writes Coordination Calls directly to canonical public.tasks", () => {
  assert.match(writer, /"POST",\s*\n\s*"tasks"/);
  assert.match(writer, /record_kind: "focus"/);
  assert.match(writer, /lifecycle_state: "open"/);
  assert.match(writer, /source: "client_compass"/);
  assert.match(writer, /on_conflict: "user_id,record_kind,task_id"/);
  assert.doesNotMatch(writer, /task_events|app_events/);
});
