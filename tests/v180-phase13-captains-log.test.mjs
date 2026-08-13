import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const workspace = fs.readFileSync(new URL("../src/components/compass-client-review-workspace-v10941.tsx", import.meta.url), "utf8");
const bridgeSource = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
const writer = fs.readFileSync(new URL("../src/lib/compass/captains-log-task-write.ts", import.meta.url), "utf8");

test("shared task contract remains available while retiring protocol handoff", async () => {
  const bridge = await transpileTestModule("../src/lib/compass/captains-log-bridge.ts", import.meta.url, { prefix: "phase13-captains-log" });
  assert.equal(bridge.coordinationCallTaskTitle("Example Dental"), "Coordination Call - Example Dental - Account Review Priority");
  assert.equal(typeof bridge.captainsLogCoordinationCallUrl, "undefined");
  assert.equal(typeof bridge.checkCaptainsLogLocalBridge, "undefined");
});

test("shared task support uses canonical public.tasks while the streamlined client UI stays read-only", () => {
  assert.match(bridgeSource, /sendCoordinationCallToCaptainsLogReliable/);
  assert.match(writer, /"POST",\s*\n\s*"tasks"/);
  assert.match(writer, /record_kind: "focus"/);
  assert.doesNotMatch(writer, /task_events/);
  assert.doesNotMatch(workspace, /compass-captains-log-button|compass-captains-log-modal|captains-log-coordination-call-title/);
  assert.doesNotMatch(workspace, /Add task|Captain's Log/);
  assert.match(workspace, /Latest activity/);
  assert.match(workspace, /syncClientFromCaptainsLog/);
});

test("Escape closes client details before leaving the client review", () => {
  assert.match(workspace, /if \(contactOpen\) \{ setContactOpen\(false\); return; \}/);
  assert.match(workspace, /\[contactOpen, onBack, saving\]/);
});
