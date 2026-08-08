import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const compass = fs.readFileSync(new URL("../src/components/map-compass-runtime-v10934.tsx", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../src/components/map-selection-group-bridge.tsx", import.meta.url), "utf8");
const captain = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../src/components/interface-polish-runtime-v10939.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10939-client-map.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

test("v1.0.9.39 compass uses rendered donut arcs instead of rounded labels", () => {
  assert.match(compass, /function renderedSweep/);
  assert.match(compass, /function renderedSpans/);
  assert.match(compass, /const groups = new Map<string, \{ start: number; end: number; sweep: number \}>/);
  assert.doesNotMatch(compass, /slice\.value \/ total \* 360/);
  assert.match(compass, /highestValueSelectedSection/);
  assert.match(compass, /selectedSection\.start \+ selectedSection\.sweep \/ 2/);
});

test("v1.0.9.39 normal click replaces geography and ctrl click is additive", () => {
  assert.match(bridge, /mouse\.ctrlKey \|\| mouse\.metaKey/);
  assert.match(bridge, /states: \[state\]/);
  assert.match(bridge, /states: current\.states\.includes\(state\) \? current\.states\.filter/);
  assert.match(bridge, /lastExactRegionRef\.current === key/);
  assert.match(bridge, /geographicGroupForState\(state\)/);
});

test("v1.0.9.39 completed Captain's Log tasks cannot be reopened by stale create or upsert rows", () => {
  assert.match(captain, /current\.done = current\.done \|\| boolish\(patch\.done\)/);
  assert.match(captain, /if \(!current\.done\) current\.done = Boolean\(row\.done\)/);
  assert.match(captain, /current\.completed = current\.completed \|\| boolish\(salesTask\.completed\)/);
  assert.match(captain, /task_reopened/);
});

test("v1.0.9.39 client view is simplified and presentation kicker is shortened", () => {
  assert.match(runtime, /is-collapsed-v10939/);
  assert.match(runtime, /Prepared for /);
  assert.match(css, /Account Review Outcome/);
  assert.match(css, /Client details/);
  assert.match(css, /Activity history/);
  assert.match(css, /article:nth-child\(n\+2\)/);
  assert.match(layout, /InterfacePolishRuntimeV10939/);
  assert.match(layout, /v10939-client-map\.css/);
  assert.match(version, /APP_VERSION = "1\.0\.9\.\d+"/);
});
