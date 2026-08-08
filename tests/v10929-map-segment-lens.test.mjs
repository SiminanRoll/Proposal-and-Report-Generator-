import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync(new URL("../src/components/map-selection-group-bridge.tsx", import.meta.url), "utf8");
const lens = fs.readFileSync(new URL("../src/lib/segments/map-lens.ts", import.meta.url), "utf8");
const territory = fs.readFileSync(new URL("../src/lib/compass/territory-map.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10929-polish.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

test("v1.0.9.29 map lenses consume saved Segment Manager definitions", () => {
  assert.match(bridge, /useSegments\(\)/);
  assert.match(bridge, /From Segment Manager/);
  assert.match(bridge, /SegmentIcon/);
  assert.match(lens, /client-compass\.segments\.v1/);
  assert.match(lens, /segmentIncludesClient/);
  assert.match(territory, /filterCompassDatasetForMapLens/);
});

test("map lenses support ALL ANY and additive state scope", () => {
  assert.match(lens, /matchMode === "any" \? matches\.some\(Boolean\) : matches\.every\(Boolean\)/);
  assert.match(bridge, />ALL<\/button>/);
  assert.match(bridge, />ANY<\/button>/);
  assert.match(bridge, /states: current\.states\.includes\(state\)/);
  assert.match(bridge, /pointerdown/);
  assert.match(bridge, /Math\.hypot/);
  assert.match(bridge, /toggleState\(press\.state\)/);
});

test("main page-title sections share the Report Generator stamped treatment", () => {
  assert.match(css, /\.compass-admin-hero/);
  assert.match(css, /\.territory-map-header/);
  assert.match(css, /\.segment-page-header/);
  assert.match(css, /\.segment-detail-header/);
  assert.match(css, /color:rgba\(68,88,111,\.27\)/);
  assert.match(css, /text-shadow:0 1px 0 rgba\(255,255,255,\.96\),0 -1px 0 rgba\(42,61,83,\.13\)/);
  assert.match(layout, /v10929-polish\.css/);
});
