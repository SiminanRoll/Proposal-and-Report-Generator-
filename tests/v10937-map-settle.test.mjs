import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../src/components/territory-map-page.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../src/components/persistent-territory-map-page.tsx", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../src/components/map-compass-runtime-v10934.tsx", import.meta.url), "utf8");
const interaction = fs.readFileSync(new URL("../src/components/map-interaction-polish-v10932.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10937-map-settle.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");
const mapLens = fs.readFileSync(new URL("../src/lib/segments/map-lens.ts", import.meta.url), "utf8");

test("v1.0.9.37 donut center copy is concise and Segment-aware", () => {
  assert.match(page, /mapLensDisplayMode === "segments" \? "Segment" : metric === "clients" \? "All" : metric === "need" \? "Need" : "Value"/);
  assert.match(shell, /metric === "clients" \? "All" : metric === "need" \? "Need" : "Value"/);
});

test("map snapshot reacts directly to the real map lens instead of waiting on DOM settling", () => {
  assert.match(page, /MAP_LENS_CHANGE_EVENT/);
  assert.match(page, /setMapLensRevision/);
  assert.match(page, /\[criteria, dataset, mapLensRevision\]/);
  assert.match(shell, /MAP_LENS_CHANGE_EVENT/);
  assert.match(shell, /\[dataset, mapLensRevision\]/);
  assert.doesNotMatch(interaction, /beginCalculating|is-map-calculating|new MutationObserver/);
  assert.doesNotMatch(mapLens, /client-compass-data-changed/);
});

test("donut geometry remains React-owned and compass only reads rendered arcs through hover", () => {
  assert.match(page, /DONUT_STATE_ORDER = \["MI", "OH", "IN", "GA", "FL", "AL", "TN", "KY", "IL", "WI"\]/);
  assert.match(page, /sort\(\(left, right\) => stateRank\(left\.region\.state\) - stateRank\(right\.region\.state\)\)/);
  assert.doesNotMatch(runtime, /setAttribute\("d"/);
  assert.doesNotMatch(runtime, /territory-donut-state-divider/);
  assert.doesNotMatch(runtime, /pointerover|pointerout|focusin|focusout/);
  assert.match(runtime, /getAttribute\("d"/);
  assert.match(runtime, /right\[1\]\.sweep - left\[1\]\.sweep/);
});

test("segment drawer sits on the glass edge above the separator and old calculating chrome is neutralized", () => {
  assert.match(css, /right:-14px!important/);
  assert.match(css, /top:-44px!important/);
  assert.match(css, /opacity:1!important/);
  assert.match(css, /content:none!important/);
});

test("v1.0.9.37 polish stays in the stack under Client Compass 1.1.0", () => {
  assert.match(layout, /v10937-map-settle\.css/);
  assert.match(version, /APP_VERSION = "\d+\.\d+\.\d+"/);
});
