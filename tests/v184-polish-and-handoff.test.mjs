import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
const writer = fs.readFileSync(new URL("../src/lib/compass/captains-log-task-write.ts", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/compass-client-review-workspace-v10941.tsx", import.meta.url), "utf8");

test("v1.8.8 gives Project Coverage cards stronger premium metric hierarchy", () => {
  assert.match(css, /Client Compass v1\.8\.5 — card balance/);
  assert.match(css, /font-size:clamp\(88px,7\.2vw,112px\)!important/);
  assert.match(css, /\.project-coverage-card-front::before\{/);
});

test("hardware inventory is fixed-width to the presentation viewport", () => {
  assert.match(exportHtml, /device-table-wrap\{overflow-x:hidden;overflow-y:auto/);
  assert.match(exportHtml, /device-table\{width:100%;min-width:0;table-layout:fixed/);
});

test("Client Compass creation writes directly to canonical public.tasks", () => {
  const cloud = fs.readFileSync(new URL("../src/lib/compass/captains-log-cloud.ts", import.meta.url), "utf8");
  assert.match(bridge, /sendCoordinationCallToCaptainsLogReliable/);
  assert.match(writer, /"POST",\s*\n\s*"tasks"/);
  assert.match(writer, /lifecycle_state: "open"/);
  assert.doesNotMatch(writer, /task_events/);
  assert.match(cloud, /auth\/v1\/token/);
  assert.match(workspace, /syncClientFromCaptainsLog/);
  assert.doesNotMatch(workspace, /sendCoordinationCallToCaptainsLogReliable|Windows handoff/);
});
