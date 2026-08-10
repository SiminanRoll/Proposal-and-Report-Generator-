import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const runtime = fs.readFileSync(new URL("../src/components/map-compass-runtime-v10934.tsx", import.meta.url), "utf8");
const mapPage = fs.readFileSync(new URL("../src/components/territory-map-page.tsx", import.meta.url), "utf8");
const drawer = fs.readFileSync(new URL("../src/components/map-segment-drawer-v10931.tsx", import.meta.url), "utf8");
const interaction = fs.readFileSync(new URL("../src/components/map-interaction-polish-v10932.tsx", import.meta.url), "utf8");
const controller = fs.readFileSync(new URL("../src/components/map-mode-controller-v10945.tsx", import.meta.url), "utf8");
const editor = fs.readFileSync(new URL("../src/components/segment-editor-dialog.tsx", import.meta.url), "utf8");
const manager = fs.readFileSync(new URL("../src/components/segment-manager-page.tsx", import.meta.url), "utf8");
const store = fs.readFileSync(new URL("../src/lib/segments/store.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10936-map-geography.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

test("donut keeps the requested geographic clockwise order and compass remains independent", () => {
  assert.match(mapPage, /DONUT_STATE_ORDER = \["MI", "OH", "IN", "GA", "FL", "AL", "TN", "KY", "IL", "WI"\]/);
  assert.match(runtime, /STATE_GROUPS/);
  assert.match(runtime, /targetFor/);
  assert.match(runtime, /territory-compass-overlay-v10936/);
  assert.match(runtime, /setInterval\(syncTarget, \d+\)/);
  assert.match(css, /territory-compass-overlay-v10936/);
});

test("v1.0.9.36 segment tray click-add and close behavior remains intact", () => {
  assert.match(drawer, /dropSegmentIntoFirstOpenSlot/);
  assert.match(drawer, /onClick=\{\(\) => addSegment\(segment\.id\)\}/);
  assert.match(drawer, /onMouseLeave=\{scheduleClose\}/);
  assert.match(drawer, /onPointerLeave=\{scheduleClose\}/);
  assert.match(drawer, /finishDrag/);
  assert.match(drawer, /setOpen\(false\)/);
  assert.match(css, /bottom:50px!important/);
});

test("All clears geography without synthetic map-settle timing", () => {
  assert.match(controller, /if \(nextMode === "clients" && lens\.states\.length\)/);
  assert.match(controller, /saveMapLensState\(\{ \.\.\.lens, states: \[\] \}\)/);
  assert.doesNotMatch(interaction, /beginCalculating|stableFrames|is-map-calculating/);
});

test("v1.0.9.36 segment deletion works from edit and cleans active map state", () => {
  assert.match(editor, /onDelete\?: \(segmentId: string\) => void/);
  assert.match(editor, /segment-delete-button/);
  assert.match(manager, /removeSegment/);
  assert.match(manager, /onDelete=\{editingIsSaved/);
  assert.match(store, /MAP_LENS_STORAGE_KEY/);
  assert.match(store, /segmentIds = parsed\.segmentIds\.map\(String\)\.filter/);
  assert.match(store, /MAP_LENS_DISPLAY_MODE_KEY, "clients"/);
  assert.match(css, /segment-card-actions button\.is-danger:hover/);
});

test("geography polish stays in the style stack under Client Compass 1.1.0", () => {
  assert.match(layout, /v10936-map-geography\.css/);
  assert.match(version, /APP_VERSION = "1\.1\.0"/);
});
