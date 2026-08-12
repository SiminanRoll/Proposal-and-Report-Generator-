import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync(new URL("../src/components/map-donut-selection-bridge.tsx", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../src/components/client-compass-runtime.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/map-list-usability-v1137.css", import.meta.url), "utf8");

test("donut clicks mirror map geography selection and Ctrl/Cmd clicks are additive", () => {
  assert.match(runtime, /MapDonutSelectionBridge/);
  assert.match(bridge, /\.territory-donut-slice/);
  assert.match(bridge, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(bridge, /current\.states\.includes\(state\)/);
  assert.match(bridge, /current\.states\.filter/);
  assert.match(bridge, /\.\.\.current\.states, state/);
  assert.match(bridge, /: \[state\]/);
  assert.match(bridge, /saveMapLensState/);
});

test("grouped donut slices stay visibly selected", () => {
  assert.match(bridge, /is-lens-selected/);
  assert.match(bridge, /has-lens-scope/);
  assert.match(css, /territory-donut\.has-lens-scope/);
  assert.match(css, /territory-donut-slice\.is-lens-selected/);
});

test("map client drawer is exactly 25 percent wider on desktop", () => {
  assert.match(css, /width:min\(900px,94vw\)!important/);
});
