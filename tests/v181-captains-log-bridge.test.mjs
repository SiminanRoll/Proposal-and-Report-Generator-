import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const workspace = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");
const bridgeSource = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");

test("Client Compass retires localhost and protocol delivery in favor of Supabase", async () => {
  const bridge = await transpileTestModule("../src/lib/compass/captains-log-bridge.ts", import.meta.url, { prefix: "v181-captains-log" });
  assert.equal(bridge.coordinationCallTaskTitle("Example Dental"), "Coordination Call - Example Dental - Account Review Priority");
  assert.equal(typeof bridge.CAPTAINS_LOG_LOCAL_BRIDGE_URL, "undefined");
  assert.equal(typeof bridge.captainsLogCoordinationCallUrl, "undefined");
  assert.doesNotMatch(bridgeSource, /127\.0\.0\.1|captainslog:\/\/|client_compass_response/);
  assert.match(bridgeSource, /captainsLogCloudRest<null>\("POST", "task_events"/);
});

test("Captain's Log task creation no longer gates on existing open work", () => {
  assert.match(workspace, /<h3 id="captains-log-coordination-call-title">Add task<\/h3>/);
  assert.match(workspace, /sendCoordinationCallToCaptainsLogReliable/);
  assert.match(workspace, /syncClientFromCaptainsLog/);
  assert.doesNotMatch(workspace, /open or planned task|Nothing was scheduled|Supabase history could not confirm/);
  assert.doesNotMatch(bridgeSource, /blocked-open-task/);
  assert.doesNotMatch(workspace, /V843|desktop acknowledgement/);
});
