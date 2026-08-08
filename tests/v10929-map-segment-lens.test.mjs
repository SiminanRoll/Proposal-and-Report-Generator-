import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync(new URL("../src/components/map-selection-group-bridge.tsx", import.meta.url), "utf8");
const lens = fs.readFileSync(new URL("../src/lib/segments/map-lens.ts", import.meta.url), "utf8");
const territory = fs.readFileSync(new URL("../src/lib/compass/territory-map.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10929-polish.css", import.meta.url), "utf8");
const slotCss = fs.readFileSync(new URL("../src/app/v10930-polish.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

test("map segment slots consume saved Segment Manager definitions without duplicate map criteria", () => {
  assert.match(bridge, /useSegments\(\)/);
  assert.match(bridge, /buildSegmentSnapshot/);
  assert.match(bridge, /MAX_SEGMENT_SLOTS = 3/);
  assert.match(bridge, /map-lens-slot-stack/);
  assert.match(bridge, /map-lens-drawer/);
  assert.match(bridge, /draggable/);
  assert.match(bridge, /SegmentIcon/);
  assert.doesNotMatch(bridge, /Map lens|From Segment Manager|Add a saved segment/);
  assert.match(lens, /client-compass\.segments\.v1/);
  assert.match(lens, /segmentIncludesClient/);
  assert.match(territory, /filterCompassDatasetForMapLens/);
});

test("active segments change the map modes to Clients Segment Criteria and Value automatically", () => {
  assert.match(lens, /MapLensDisplayMode = "clients" \| "segments" \| "value"/);
  assert.match(lens, /displayMode === "clients" \? \{ \.\.\.state, segmentIds: \[\] \} : state/);
  assert.match(bridge, /Segment Criteria/);
  assert.match(bridge, /setMapDisplayMode\("segments"\)/);
  assert.match(bridge, /settings\.disabled = hasSegments/);
  assert.match(bridge, /is-segment-locked/);
  assert.match(bridge, /const labels = \["clients", "matches", "value"\]/);
  assert.match(slotCss, /territory-map-settings-trigger\.is-segment-locked/);
});

test("map lenses support ALL ANY and additive state scope", () => {
  assert.match(lens, /matchMode === "any" \? matches\.some\(Boolean\) : matches\.every\(Boolean\)/);
  assert.match(bridge, />ALL<\/button>/);
  assert.match(bridge, />ANY<\/button>/);
  assert.match(bridge, /states: current\.states\.includes\(state\)/);
  assert.match(bridge, /lastExactRegionRef/);
  assert.match(bridge, /toggleWholeGroup/);
  assert.match(bridge, /dispatchRegionClick/);
});

test("main page-title sections share the Report Generator stamped treatment", () => {
  assert.match(css, /\.compass-admin-hero/);
  assert.match(css, /\.territory-map-header/);
  assert.match(css, /\.segment-page-header/);
  assert.match(css, /\.segment-detail-header/);
  assert.match(css, /color:rgba\(68,88,111,\.27\)/);
  assert.match(css, /text-shadow:0 1px 0 rgba\(255,255,255,\.96\),0 -1px 0 rgba\(42,61,83,\.13\)/);
  assert.match(layout, /v10929-polish\.css/);
  assert.match(layout, /v10930-polish\.css/);
});
