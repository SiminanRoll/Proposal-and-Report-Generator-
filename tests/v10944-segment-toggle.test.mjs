import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const controller = readFileSync(new URL("../src/components/map-mode-controller-v10944.tsx", import.meta.url), "utf8");
const bridge = readFileSync(new URL("../src/components/map-selection-group-bridge.tsx", import.meta.url), "utf8");
const lens = readFileSync(new URL("../src/lib/segments/map-lens.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/app/v10944-segment-toggle.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const version = readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

test("slotted segment changes the middle map choice from Need to Segments", () => {
  assert.match(controller, /const hasSegments = lens\.segmentIds\.length > 0/);
  assert.match(controller, /buttons\[1\]\.textContent = hasSegments \? "Segments" : "Need"/);
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

test("segment population remains authoritative only in Segment mode", () => {
  assert.match(lens, /displayMode === "segments" \? state : \{ \.\.\.state, segmentIds: \[\] \}/);
  assert.match(controller, /hasSegments && storedMode === "need"/);
  assert.match(controller, /!hasSegments && storedMode === "segments"/);
  assert.match(bridge, /previous === 0 && activeSegments\.length > 0[\s\S]*saveMapLensDisplayMode\("segments"\)/);
  assert.match(bridge, /previous > 0 && activeSegments\.length === 0[\s\S]*saveMapLensDisplayMode\("clients"\)/);
});

test("segment mode visually activates Segments while native renderer stays on Clients", () => {
  assert.match(css, /\.territory-map-toggle\.is-segment-mode-v10944>button:first-child\.is-active/);
  assert.match(css, /\.territory-map-toggle\.is-segment-mode-v10944>button:nth-child\(2\)/);
});

test("v1.0.9.44 controller is wired into the app", () => {
  assert.match(layout, /MapModeControllerV10944/);
  assert.match(layout, /v10944-segment-toggle\.css/);
  assert.match(version, /APP_VERSION = "1\.0\.9\.44"/);
});
