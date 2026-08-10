import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync(new URL("../src/components/map-selection-group-bridge.tsx", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../src/components/map-compass-runtime-v10934.tsx", import.meta.url), "utf8");
const hub = fs.readFileSync(new URL("../src/components/territory-compass-hub.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10938-map-selection.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

test("v1.0.9.38 keeps hover separate while click promotes exact region to geographic group", () => {
  assert.match(bridge, /lastExactRegionRef/);
  assert.match(bridge, /dispatchRegionClick/);
  assert.match(bridge, /new MouseEvent\("click"/);
  assert.match(bridge, /geographicGroupForState/);
  assert.match(bridge, /lastExactRegionRef\.current === key/);
  assert.match(bridge, /geographicGroupForState\(state\)/);
  assert.match(bridge, /states: \[state\]/);
  assert.match(bridge, /mouse\.ctrlKey \|\| mouse\.metaKey/);
  assert.doesNotMatch(bridge, /pointermove/);
});

test("segment-loaded states with no matches are dimmed but remain present", () => {
  assert.match(bridge, /segmentMatchStates/);
  assert.match(bridge, /is-segment-empty/);
  assert.match(bridge, /has-segment-distribution/);
  assert.match(css, /\.territory-map-state\.is-segment-empty/);
  assert.match(css, /opacity:\.30!important/);
});

test("compass targets combined group total and points to the center of the whole group", () => {
  assert.match(runtime, /renderedSweep/);
  assert.match(runtime, /renderedSpans/);
  assert.match(runtime, /current\.sweep \+= span\.sweep/);
  assert.match(runtime, /right\[1\]\.sweep - left\[1\]\.sweep/);
  assert.match(runtime, /span\.start \+ span\.sweep \/ 2/);
  assert.match(runtime, /centerSlice/);
  assert.match(runtime, /brightenHex/);
  assert.match(runtime, /getAttribute\("d"/);
  assert.doesNotMatch(runtime, /pointerover|pointerout|focusin|focusout/);
  assert.match(hub, /accentColor/);
  assert.match(hub, /--compass-accent/);
  assert.match(css, /var\(--compass-accent/);
});

test("only the visible Segment Manager card face receives clicks and controls animate", () => {
  assert.match(css, /segment-flip-card \.segment-card-back\{pointer-events:none\}/);
  assert.match(css, /segment-flip-card\.is-flipped \.segment-card-front\{pointer-events:none\}/);
  assert.match(css, /segment-flip-card\.is-flipped \.segment-card-back\{pointer-events:auto\}/);
  assert.match(css, /button\.is-danger:hover/);
  assert.match(css, /translateY\(-1px\)/);
});

test("v1.0.9.38 style remains loaded under Client Compass 1.1.0", () => {
  assert.match(layout, /v10938-map-selection\.css/);
  assert.match(version, /APP_VERSION = "1\.1\.0"/);
});
