import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const workspace = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");

test("v1.8.1 exposes both the local Captain's Log receiver and protocol fallback", async () => {
  const bridge = await transpileTestModule("../src/lib/compass/captains-log-bridge.ts", import.meta.url, { prefix: "v181-captains-log" });
  assert.equal(bridge.CAPTAINS_LOG_LOCAL_BRIDGE_URL, "http://127.0.0.1:8769/v1/coordination-call");
  assert.equal(bridge.CAPTAINS_LOG_LOCAL_HEALTH_URL, "http://127.0.0.1:8769/v1/health");
  const payload = bridge.captainsLogCoordinationCallPayload({
    clientId: "client-42",
    company: "Example Dental",
    dueDate: "2026-08-12",
    priorityReason: "Server modernization",
    requestId: "req-42",
  });
  assert.equal(payload.tag, "Client Coordination");
  assert.equal(payload.task_type, "Call");
  assert.equal(payload.request_id, "req-42");
  assert.equal(payload.company, "Example Dental");
});

test("v1.8.1 reports confirmed client association back in the scheduler", () => {
  assert.match(workspace, /linked_company \|\| result\.company|sync\?\.linked_company/);
  assert.match(workspace, /Added to Captain's Log · linked to/);
  assert.match(workspace, /client match \+ sync|checks Captain's Log first/);
  assert.match(workspace, /sendCoordinationCallToCaptainsLogReliable/);
  assert.match(workspace, /syncClientFromCaptainsLog/);
  assert.match(workspace, /Captain's Log V839/);
});
