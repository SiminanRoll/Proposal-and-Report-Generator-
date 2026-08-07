import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const workspace = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("Phase 14 keeps the Coordination Call task contract while retiring the protocol handoff", async () => {
  const bridge = await transpileTestModule("../src/lib/compass/captains-log-bridge.ts", import.meta.url, { prefix: "phase13-captains-log" });
  assert.equal(bridge.coordinationCallTaskTitle("Example Dental"), "Coordination Call - Example Dental - Account Review Priority");
  assert.equal(typeof bridge.captainsLogCoordinationCallUrl, "undefined");
  assert.equal(typeof bridge.checkCaptainsLogLocalBridge, "undefined");
});

test("Captain's Log task action writes the shared Supabase ledger directly", () => {
  assert.match(workspace, /compass-captains-log-button/);
  assert.match(workspace, /className="compass-captains-log-modal"/);
  assert.match(workspace, /<h3 id="captains-log-coordination-call-title">Add task<\/h3>/);
  assert.match(workspace, /crypto\.randomUUID/);
  assert.match(workspace, /sendCoordinationCallToCaptainsLogReliable/);
  assert.match(workspace, /syncClientFromCaptainsLog/);
  assert.doesNotMatch(workspace, /open or planned task/);
  assert.match(css, /Phase 13 — Captain's Log account-review handoff/);
  assert.match(css, /\.compass-captains-log-button\{/);
  assert.match(css, /\.compass-captains-log-modal\{/);
});

test("Phase 13 closes only the Captain's Log scheduler on the first Escape press", () => {
  assert.match(workspace, /if \(captainsLogOpen\) \{ setCaptainsLogOpen\(false\); return; \}/);
  assert.match(workspace, /\[captainsLogOpen, onBack, saving\]/);
});
