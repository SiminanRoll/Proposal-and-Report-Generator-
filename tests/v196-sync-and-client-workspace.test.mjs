import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("v1.9.6 requires the repaired V843 desktop listener", () => {
  assert.match(bridge, /desktopVersion < 843/);
  assert.match(bridge, /Open V843 or newer/);
});

test("v1.9.6 client detail remains vertically scrollable", () => {
  assert.match(css, /\.compass-client-workspace-crm\{[^}]*overflow-y:auto/);
  assert.match(css, /\.compass-client-workspace-crm \.compass-crm-header\{[^}]*position:sticky/);
});

test("v1.9.6 client header exposes Quick Present for the active client", () => {
  assert.match(workspace, /requestQuickPresent\(client\.id\)/);
  assert.match(workspace, /Present report/);
  assert.match(workspace, /compass-client-present-button/);
});
