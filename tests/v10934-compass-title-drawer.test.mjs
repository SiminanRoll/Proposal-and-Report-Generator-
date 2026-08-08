import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const runtime = fs.readFileSync(new URL("../src/components/map-compass-runtime-v10934.tsx", import.meta.url), "utf8");
const hub = fs.readFileSync(new URL("../src/components/territory-compass-hub.tsx", import.meta.url), "utf8");
const drawer = fs.readFileSync(new URL("../src/components/map-segment-drawer-v10931.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10934-polish.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

test("v1.0.9.34 donut center uses a directional Client Compass against grouped slices", () => {
  assert.match(runtime, /STATE_GROUPS/);
  assert.match(runtime, /TN.*KY.*AL/);
  assert.match(runtime, /IN.*OH/);
  assert.match(runtime, /targetFor/);
  assert.match(runtime, /<TerritoryCompassHub/);
  assert.match(runtime, /Compass points to largest geographic group/);
  assert.match(runtime, /span\.start \+ \(span\.end - span\.start\) \/ 2/);
  assert.match(hub, /territory-compass-needle/);
  assert.match(hub, /--compass-bearing/);
  assert.match(css, /territory-compass-drift/);
  assert.match(css, /transition:transform \.82s/);
});

test("v1.0.9.34 embeds top-level titles in the page background and preserves filter room", () => {
  assert.match(css, /\.compass-admin-hero/);
  assert.match(css, /\.segment-page-header/);
  assert.match(css, /\.territory-map-header/);
  assert.match(css, /background:transparent!important/);
  assert.match(css, /\.map-segment-lens-panel\{margin-top:auto!important;min-height:232px/);
  assert.match(css, /\.map-lens-where\{min-height:27px/);
});

test("v1.0.9.34 segment drawer is smart glass with click-away close and thin themed scrolling", () => {
  assert.match(drawer, /pointerdown/);
  assert.match(drawer, /rootRef/);
  assert.match(drawer, /setOpen\(false\)/);
  assert.match(drawer, /scheduleClose/);
  assert.match(css, /scrollbar-width:thin/);
  assert.match(css, /::-webkit-scrollbar\{width:4px\}/);
  assert.match(css, /border-radius:22px 22px 19px 22px/);
});

test("v1.0.9.34 polish remains loaded and visible version stays on the patch line", () => {
  assert.match(layout, /v10934-polish\.css/);
  assert.match(layout, /MapCompassRuntimeV10934/);
  assert.match(version, /APP_VERSION = "1\.0\.9\.\d+"/);
});
