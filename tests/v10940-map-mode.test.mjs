import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const controller = fs.readFileSync(new URL("../src/components/map-mode-controller-v10942.tsx", import.meta.url), "utf8");
const legacyController = fs.readFileSync(new URL("../src/components/map-mode-controller-v10940.tsx", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../src/components/map-selection-group-bridge.tsx", import.meta.url), "utf8");
const interaction = fs.readFileSync(new URL("../src/components/map-interaction-polish-v10932.tsx", import.meta.url), "utf8");
const compass = fs.readFileSync(new URL("../src/components/map-compass-runtime-v10934.tsx", import.meta.url), "utf8");
const lens = fs.readFileSync(new URL("../src/lib/segments/map-lens.ts", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10942-map-hero.css", import.meta.url), "utf8");
const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

test("v1.0.9.42 exposes one persistent All Need Value controller while preserving Segment Criteria mode", () => {
  assert.match(lens, /MapLensDisplayMode = "clients" \| "need" \| "value" \| "segments"/);
  assert.match(controller, /buttons\[0\]\.textContent = "All"/);
  assert.match(controller, /Show clients in need/);
  assert.match(controller, /Show estimated value/);
  assert.match(controller, /storedMode === "segments"/);
  assert.match(controller, /nativeMetricIndex/);
  assert.match(controller, /saveMapLensDisplayMode\(nextMode\)/);
  assert.match(controller, /MutationObserver/);
  assert.match(layout, /MapModeControllerV10942/);
  assert.doesNotMatch(layout, /import \{ MapModeControllerV10940 \}/);
});

test("only Segment Criteria applies saved segment population filtering", () => {
  assert.match(lens, /displayMode === "segments" \? state : \{ \.\.\.state, segmentIds: \[\] \}/);
  assert.match(controller, /storedMode === "segments"/);
  assert.match(controller, /settings\.disabled = segmentMode/);
});

test("legacy bridge and interaction polish no longer own map metric buttons", () => {
  assert.doesNotMatch(bridge, /territory-map-toggle button/);
  assert.doesNotMatch(bridge, /metricProxyRef/);
  assert.doesNotMatch(interaction, /activateMiddleMode|activateAllMode|onToggleClick|onMapClick/);
  assert.match(legacyController, /createPortal/);
});

test("compass waits for authoritative mode render before reading donut arcs", () => {
  assert.match(lens, /MAP_MODE_RENDERED_EVENT/);
  assert.match(controller, /MAP_MODE_RENDERED_EVENT/);
  assert.match(compass, /MAP_MODE_RENDERED_EVENT/);
  assert.match(compass, /window\.requestAnimationFrame\(\(\) => \{/);
  assert.match(compass, /largest complete geographic group/);
});

test("authoritative toggle keeps native renderer controls visible and retires the portal overlay", () => {
  assert.match(css, /\.territory-map-toggle>button/);
  assert.match(css, /visibility:visible!important/);
  assert.match(css, /pointer-events:auto!important/);
  assert.match(css, /\.map-mode-toggle-v10940\{display:none!important\}/);
  assert.match(layout, /v10940-map-mode\.css";[\s\S]*v10942-map-hero\.css";/);
  assert.match(version, /APP_VERSION = "1\.0\.9\.42"/);
});
