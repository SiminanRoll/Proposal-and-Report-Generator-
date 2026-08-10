import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const interaction = fs.readFileSync(new URL("../src/components/map-interaction-polish-v10932.tsx", import.meta.url), "utf8");
const controller = fs.readFileSync(new URL("../src/components/map-mode-controller-v10945.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10932-map-interactions.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const runtimeShell = fs.readFileSync(new URL("../src/components/client-compass-runtime.tsx", import.meta.url), "utf8");
const drawer = fs.readFileSync(new URL("../src/components/map-segment-drawer-v10931.tsx", import.meta.url), "utf8");

test("v1.0.9.32 interaction layer leaves All/reset and metric ownership to the authoritative controller", () => {
  assert.doesNotMatch(interaction, /activateMiddleMode|activateAllMode|territory-map-region,\.territory-map-state,\.territory-donut-slice/);
  assert.doesNotMatch(interaction, /saveMapLensDisplayMode\("clients"\)/);
  assert.doesNotMatch(interaction, /new MutationObserver/);
  assert.doesNotMatch(interaction, /is-map-calculating|beginCalculating/);
  assert.match(controller, /if \(nextMode === "clients" && lens\.states\.length\)/);
  assert.match(controller, /saveMapLensState\(\{ \.\.\.lens, states: \[\] \}\)/);
});

test("segment removal and Segment Manager criteria edits refresh the map automatically", () => {
  assert.match(interaction, /SEGMENTS_CHANGE_EVENT = "client-compass-segments-changed"/);
  assert.match(interaction, /if \(lens\.segmentIds\.length\) saveMapLensState\(lens\)/);
  assert.match(controller, /MAP_LENS_CHANGE_EVENT/);
});

test("dragging a saved segment previews the card in the target slot and confirms the drop", () => {
  assert.match(interaction, /map-slot-drag-ghost/);
  assert.match(interaction, /is-drop-preview/);
  assert.match(interaction, /is-drop-confirmed/);
  assert.match(css, /map-slot-preview-pulse/);
  assert.match(css, /map-slot-confirm/);
  assert.match(css, /\.map-lens-slot\.is-drop-preview/);
  assert.match(drawer, /map-lens-slot\.is-empty/);
});

test("drawer and right rail remain compact blue glass with stable View clients space", () => {
  assert.match(css, /\.map-segment-drawer-v10931\{right:-38px!important;top:-5px!important/);
  assert.match(css, /linear-gradient\(180deg,rgba\(35,113,176/);
  assert.match(css, /\.map-segment-drawer-glass\{/);
  assert.match(css, /width:calc\(100% - 28px\)!important/);
  assert.match(css, /\.territory-active-detail\{position:relative!important;padding-bottom:42px!important\}/);
  assert.match(css, /\.territory-review-clients\{position:absolute!important/);
});

test("v1.0.9.32 polish remains loaded globally", () => {
  assert.match(runtimeShell, /MapInteractionPolishV10932/);
  assert.match(layout, /v10932-map-interactions\.css/);
});
