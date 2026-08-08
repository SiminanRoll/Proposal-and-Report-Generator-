import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(new URL("../src/app/map/page.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../src/components/persistent-territory-map-page.tsx", import.meta.url), "utf8");
const drawer = fs.readFileSync(new URL("../src/components/map-segment-drawer-v10931.tsx", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../src/components/map-selection-group-bridge.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10931-polish.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

test("v1.0.9.31 keeps the service-area map visible with no data and zero-result filters", () => {
  assert.match(route, /PersistentTerritoryMapPage/);
  assert.match(shell, /SERVICE_STATE_ORDER\.map/);
  assert.match(shell, /SERVICE_STATE_GEOMETRIES/);
  assert.match(shell, /No client data loaded yet/);
  assert.match(shell, /No matches in the current map view/);
  assert.match(shell, /buildTerritoryMapSnapshot\(dataset\)\.territories\.length > 0/);
  assert.match(shell, /return <ServiceAreaShell/);
  for (const state of ["WI", "MI", "IL", "IN", "OH", "KY", "TN", "AL", "GA", "FL"]) assert.match(shell, new RegExp(`\\b${state}: \\"#`));
});

test("right-edge segment drawer consumes real Segment Manager cards and drags into existing slots", () => {
  assert.match(drawer, /useSegments\(\)/);
  assert.match(drawer, /buildSegmentSnapshot/);
  assert.match(drawer, /map-segment-drawer-tab/);
  assert.match(drawer, /map-segment-drawer-glass/);
  assert.match(drawer, /draggable/);
  assert.match(drawer, /setData\("text\/plain", segmentId\)/);
  assert.match(bridge, /onDrop=\{\(event\) => \{ event\.preventDefault\(\); placeSegment\(event\.dataTransfer\.getData\("text\/plain"\), slotIndex\); \}\}/);
  assert.match(bridge, /MAX_SEGMENT_SLOTS = 3/);
  assert.match(css, /\.map-lens-heading>button\{display:none!important\}/);
  assert.match(css, /\.map-lens-drawer\{display:none!important\}/);
  assert.match(css, /map-segment-slot-snap/);
  assert.match(css, /map-lens-slot\.is-empty/);
});

test("v1.0.9.31 map drawer and polish remain loaded after later releases", () => {
  assert.match(layout, /MapSegmentDrawerV10931/);
  assert.match(layout, /v10931-polish\.css/);
  assert.match(version, /APP_VERSION = "1\.0\.9\.\d+"/);
});