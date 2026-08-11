import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const action = fs.readFileSync(new URL("../src/components/client-tracked-action.tsx", import.meta.url), "utf8");
const writer = fs.readFileSync(new URL("../src/lib/compass/captains-log-task-write.ts", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../src/components/client-compass-runtime.tsx", import.meta.url), "utf8");

test("Client Compass proves the Captain's Log connection before beginning task creation", () => {
  const preflight = action.indexOf("await verifyCaptainsLogTaskConnection();");
  const request = action.indexOf("const requestId =");
  const write = action.indexOf("await writeCoordinationTaskToCaptainsLog(request);");
  assert.ok(preflight >= 0, "connection preflight should be present");
  assert.ok(request > preflight, "task identity should not be created until the connection passes");
  assert.ok(write > request, "task write should happen only after preflight and request construction");
  assert.match(action, /Checking Captain's Log connection/);
  assert.match(action, /Reconnect in Settings → Cloud & recovery/);
});

test("the preflight tests the authenticated Captain's Log task REST endpoint", () => {
  assert.match(writer, /export async function verifyCaptainsLogTaskConnection/);
  assert.match(writer, /"GET",\s*\n\s*"task_events"/);
  assert.match(writer, /select: "event_id", limit: "1"/);
});

test("task creation no longer uses a local outbox fallback", () => {
  assert.doesNotMatch(action, /queueCaptainsLogTask|Saved locally|client_compass_pending/);
  assert.doesNotMatch(runtime, /CaptainsLogTaskOutboxRuntime/);
});
