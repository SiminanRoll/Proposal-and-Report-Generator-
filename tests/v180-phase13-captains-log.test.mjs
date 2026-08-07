import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const workspace = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("Phase 14 creates the Captain's Log coordination-call handoff URL", async () => {
  const bridge = await transpileTestModule("../src/lib/compass/captains-log-bridge.ts", import.meta.url, { prefix: "phase13-captains-log" });
  assert.equal(bridge.coordinationCallTaskTitle("Example Dental"), "Coordination Call - Example Dental - Account Review Priority");
  const url = bridge.captainsLogCoordinationCallUrl({
    clientId: "client-42",
    company: "Example Dental",
    dueDate: "2026-08-12",
    priorityReason: "Priority server modernization",
    requestId: "req-123",
  });
  assert.match(url, /^captainslog:\/\/coordination-call\?/);
  assert.match(url, /company=Example\+Dental/);
  assert.match(url, /due=2026-08-12/);
  assert.match(url, /tag=Client\+Coordination/);
  assert.match(url, /source=client_compass/);
  assert.match(url, /request_id=req-123/);
});

test("Phase 13 puts a subtle Captain's Log scheduler in the existing client workspace", () => {
  assert.match(workspace, /compass-captains-log-button/);
  assert.match(workspace, /Sync or schedule a Coordination Call in Captain's Log|Schedule coordination call/);
  assert.match(workspace, /className="compass-captains-log-modal"/);
  assert.match(workspace, /Client Coordination · Call · Captain's Log client match \+ sync/);
  assert.match(workspace, /Open Captain's Log V837/);
  assert.match(workspace, /crypto\.randomUUID/);
  assert.match(workspace, /sendCoordinationCallToCaptainsLogInteractive/);
  assert.match(workspace, /syncClientFromCaptainsLogInteractive/);
  assert.match(workspace, /checkCaptainsLogLocalBridge/);
  assert.match(css, /Phase 13 — Captain's Log account-review handoff/);
  assert.match(css, /\.compass-captains-log-button\{/);
  assert.match(css, /\.compass-captains-log-modal\{/);
});

test("Phase 13 closes only the Captain's Log scheduler on the first Escape press", () => {
  assert.match(workspace, /if \(captainsLogOpen\) \{ setCaptainsLogOpen\(false\); return; \}/);
  assert.match(workspace, /\[captainsLogOpen, onBack, saving\]/);
});
