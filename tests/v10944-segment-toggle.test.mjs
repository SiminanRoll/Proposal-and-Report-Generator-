import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const controller = readFileSync(new URL("../src/components/map-mode-controller-v10945.tsx", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../src/components/client-compass-runtime.tsx", import.meta.url), "utf8");
const bridge = readFileSync(new URL("../src/components/map-selection-group-bridge.tsx", import.meta.url), "utf8");
const lens = readFileSync(new URL("../src/lib/segments/map-lens.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/app/v10930-polish.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const version = readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

test("slotted segment changes the middle map choice from Need to the active segment descriptor", () => {
  assert.match(controller, /const hasSegments = lens\.segmentIds\.length > 0/);
  assert.match(controller, /buttons\[1\]\.textContent = hasSegments \? descriptor : "Need"/);
  assert.match(controller, /return hasSegments \? "segments" : "need"/);
  assert.match(controller, /has-slotted-segments-v10944/);
});

test("segment click cannot execute the native Need React handler", () => {
  assert.match(controller, /if \(index === 1 && hasSegments\)/);
  assert.match(controller, /event\.preventDefault\(\)/);
  assert.match(controller, /event\.stopPropagation\(\)/);
  assert.match(controller, /segmentMode \? "clients" : storedMode/);
  assert.match(controller, /syncingNativeButton = true;[\s\S]*button\.click\(\);[\s\S]*syncingNativeButton = false;/);
});

test("segment population remains authoritative for Segment mode and segment-scoped Value", () => {
  assert.match(lens, /const segmentScoped = displayMode === "segments" \|\| \(displayMode === "value" && state\.segmentIds\.length > 0\)/);
  assert.match(lens, /const effectiveState = segmentScoped \? state : \{ \.\.\.state, segmentIds: \[\] \}/);
  assert.match(controller, /hasSegments && storedMode === "need"/);
  assert.match(controller, /!hasSegments && storedMode === "segments"/);
  assert.doesNotMatch(bridge, /territory-map-toggle button/);
});

test("segment mode locks native map criteria while the current controller owns the toggle", () => {
  assert.match(controller, /settings\.disabled = segmentMode/);
  assert.match(controller, /settings\.classList\.toggle\("is-segment-locked", segmentMode\)/);
  assert.match(css, /\.territory-map-settings-trigger\.is-segment-locked/);
});

test("current map controller is wired into Client Compass 1.1.0", () => {
  assert.match(runtime, /MapModeControllerV10945/);
  assert.match(runtime, /<MapModeControllerV10945 \/>/);
  assert.match(layout, /v10945-map-polish\.css/);
  assert.match(version, /APP_VERSION = "1\.1\.0"/);
});
