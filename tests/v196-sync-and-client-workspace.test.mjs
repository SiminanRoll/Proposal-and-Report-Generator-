import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("v1.9.7 has no dedicated desktop acknowledgement path", () => {
  assert.match(bridge, /fetchAllRows<SupabaseTaskEventRow>\("task_events"/);
  assert.match(bridge, /fetchAllRows<SupabaseCallModeEventRow>\("app_events"/);
  assert.doesNotMatch(bridge, /desktopVersion|Open V843|probeCaptainsLogCloudDesktop|client_compass_response|127\.0\.0\.1|captainslog:\/\//);
});

test("v1.9.7 client detail uses a dedicated visible vertical scroll region", () => {
  assert.match(workspace, /className="compass-client-workspace-scroll"/);
  assert.match(css, /\.compass-client-workspace-crm\{[\s\S]*?overflow:hidden;[\s\S]*?\}/);
  assert.match(css, /\.compass-client-workspace-scroll\{[\s\S]*?flex:1 1 auto;[\s\S]*?overflow-y:scroll;[\s\S]*?scrollbar-gutter:stable/);
  assert.match(css, /\.compass-client-workspace-scroll::-webkit-scrollbar\{width:11px\}/);
  assert.match(workspace, /compass-client-workspace-eyebrow/);
  assert.match(css, /\.compass-client-workspace-eyebrow\{[^}]*gap:14px/);
});

test("v1.9.7 client header exposes Quick Present for the active client", () => {
  assert.match(workspace, /requestQuickPresent\(client\.id\)/);
  assert.match(workspace, /Present report/);
  assert.match(workspace, /compass-client-present-button/);
});
