import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const action = fs.readFileSync(new URL("../src/components/client-tracked-action.tsx", import.meta.url), "utf8");
const writer = fs.readFileSync(new URL("../src/lib/compass/captains-log-task-write.ts", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../src/components/client-compass-runtime.tsx", import.meta.url), "utf8");

test("Client Compass writes one idempotent Captain's Log task without a redundant preflight", () => {
  const request = action.indexOf("const requestId =");
  const write = action.indexOf("await writeCoordinationTaskToCaptainsLog(request);");
  assert.ok(request >= 0);
  assert.ok(write > request);
  assert.doesNotMatch(action, /verifyCaptainsLogTaskConnection/);
  assert.match(action, /Adding to Captain's Log/);
  assert.match(action, /Task write failed:/);
});

test("the settings preflight tests the authenticated canonical tasks endpoint", () => {
  assert.match(writer, /export async function verifyCaptainsLogTaskConnection/);
  assert.match(writer, /"GET",\s*\n\s*"tasks"/);
  assert.match(writer, /select: "task_id", limit: "1"/);
});

test("task creation no longer uses a local outbox fallback", () => {
  assert.doesNotMatch(action, /queueCaptainsLogTask|Saved locally|client_compass_pending/);
  assert.doesNotMatch(runtime, /CaptainsLogTaskOutboxRuntime/);
});
