import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const controller = fs.readFileSync(new URL("../src/components/map-mode-controller-v10945.tsx", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../src/components/client-compass-runtime.tsx", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../src/components/map-selection-group-bridge.tsx", import.meta.url), "utf8");
const interaction = fs.readFileSync(new URL("../src/components/map-interaction-polish-v10932.tsx", import.meta.url), "utf8");
const compass = fs.readFileSync(new URL("../src/components/map-compass-runtime-v10934.tsx", import.meta.url), "utf8");
const lens = fs.readFileSync(new URL("../src/lib/segments/map-lens.ts", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10942-map-hero.css", import.meta.url), "utf8");
const segmentCss = fs.readFileSync(new URL("../src/app/v10930-polish.css", import.meta.url), "utf8");
const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

test("authoritative map controller exposes All Need Value until a segment descriptor replaces Need", () => {
  assert.match(lens, /MapLensDisplayMode = "clients" \| "need" \| "value" \| "segments"/);
  assert.match(controller, /buttons\[0\]\.textContent = "All"/);
  assert.match(controller, /buttons\[1\]\.textContent = hasSegments \? descriptor : "Need"/);
  assert.match(controller, /setValueButtonLabel\(buttons\[2\], descriptor, hasSegments\)/);
  assert.match(controller, /Show clients in need/);
  assert.match(controller, /Show estimated value/);
  assert.match(controller, /buttonMode\(index, hasSegments\)/);
  assert.match(controller, /MutationObserver/);
  assert.match(runtime, /MapModeControllerV10945/);
  assert.doesNotMatch(runtime, /MapModeControllerV10944|MapModeControllerV10940/);
});

test("slotted segments own Segment mode and Value remains scoped to the slotted segment population", () => {
  assert.match(lens, /const segmentScoped = displayMode === "segments" \|\| \(displayMode === "value" && state\.segmentIds\.length > 0\)/);
  assert.match(lens, /const effectiveState = segmentScoped \? state : \{ \.\.\.state, segmentIds: \[\] \}/);
  assert.match(controller, /hasSegments && storedMode === "need"/);
  assert.match(controller, /saveMapLensDisplayMode\("segments"\)/);
  assert.match(controller, /index === 1 && hasSegments/);
  assert.match(controller, /event\.stopPropagation\(\)/);
  assert.match(controller, /const metricMode: MapLensDisplayMode = segmentMode \? "clients" : storedMode/);
  assert.match(controller, /settings\.disabled = segmentMode/);
  assert.match(segmentCss, /\.territory-map-settings-trigger\.is-segment-locked/);
});

test("bridge and interaction polish do not own map metric buttons", () => {
  assert.doesNotMatch(bridge, /territory-map-toggle button/);
  assert.doesNotMatch(bridge, /metricProxyRef/);
  assert.doesNotMatch(interaction, /activateMiddleMode|activateAllMode|onToggleClick|onMapClick/);
  assert.match(runtime, /<MapModeControllerV10945 \/>/);
});

test("compass waits for authoritative mode render before reading donut arcs", () => {
  assert.match(lens, /MAP_MODE_RENDERED_EVENT/);
  assert.match(controller, /MAP_MODE_RENDERED_EVENT/);
  assert.match(controller, /dispatchRendered/);
  assert.match(compass, /MAP_MODE_RENDERED_EVENT/);
  assert.match(compass, /window\.requestAnimationFrame\(\(\) => \{/);
  assert.match(compass, /const groups = new Map<string, \{ start: number; end: number; sweep: number \}>/);
});

test("native toggle remains visible and current Client Compass 1.1.0 map layers stay loaded", () => {
  assert.match(css, /\.territory-map-toggle>button/);
  assert.match(css, /visibility:visible!important/);
  assert.match(css, /pointer-events:auto!important/);
  assert.match(css, /\.map-mode-toggle-v10940\{display:none!important\}/);
  assert.match(layout, /v10943-map-layout\.css";\nimport "\.\/v10945-map-polish\.css";/);
  assert.match(version, /APP_VERSION = "1\.1\.0"/);
});
