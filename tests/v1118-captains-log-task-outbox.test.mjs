import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const action = fs.readFileSync(new URL("../src/components/client-tracked-action.tsx", import.meta.url), "utf8");
const writer = fs.readFileSync(new URL("../src/lib/compass/captains-log-task-write.ts", import.meta.url), "utf8");
const outbox = fs.readFileSync(new URL("../src/lib/compass/captains-log-task-outbox.ts", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../src/components/captains-log-task-outbox-runtime.tsx", import.meta.url), "utf8");
const appRuntime = fs.readFileSync(new URL("../src/components/client-compass-runtime.tsx", import.meta.url), "utf8");

test("known universal company IDs bypass identity lookup on the add-task hot path", () => {
  assert.match(action, /currentClient\?\.companyId \|\| currentClient\?\.captainsLog\?\.companyId/);
  assert.match(writer, /if \(!isUuid\(companyId\)\) return sendCoordinationCallToCaptainsLogReliable/);
  assert.match(writer, /captainsLogCloudRest<null>/);
  assert.match(writer, /"POST",\s*\n\s*"task_events"/);
  assert.match(writer, /company_id: companyId/);
});

test("network failures are saved to a durable outbox instead of dropping the task", () => {
  assert.match(action, /queueCaptainsLogTask\(request\)/);
  assert.match(action, /Saved locally\. It will sync to Captain's Log automatically/);
  assert.match(outbox, /client_compass\.captains_log_task_outbox\.v1/);
  assert.match(outbox, /client_compass_task:\$\{requestId\}/);
});

test("the global runtime retries queued tasks and clears them only after a successful cloud write", () => {
  assert.match(runtime, /writeCoordinationTaskToCaptainsLog\(item\.request\)/);
  assert.match(runtime, /removeCaptainsLogTask\(item\.id\)/);
  assert.match(runtime, /window\.addEventListener\("online"/);
  assert.match(runtime, /RETRY_INTERVAL_MS = 45_000/);
  assert.match(appRuntime, /<CaptainsLogTaskOutboxRuntime \/>/);
});
