import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/v10943-map-layout.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const version = readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

test("v1.0.9.43 visually relocates the donut into the map field on desktop", () => {
  assert.match(css, /@media\(min-width:1081px\)[\s\S]*\.territory-map-insight\{position:static!important\}/);
  assert.match(css, /\.territory-donut-wrap\{[\s\S]*position:absolute!important;[\s\S]*right:372px!important;[\s\S]*width:184px!important;/);
  assert.match(css, /\.territory-donut\{[\s\S]*width:170px!important;[\s\S]*height:170px!important;/);
});

test("right rail uses available height instead of clipping segment controls", () => {
  assert.match(css, /\.territory-map-insight\{[\s\S]*display:flex!important;[\s\S]*flex-direction:column!important;[\s\S]*min-height:0!important;/);
  assert.match(css, /\.map-segment-lens-panel\{[\s\S]*flex:1 1 auto!important;[\s\S]*min-height:0!important;/);
  assert.match(css, /\.map-lens-slot-stack\{[\s\S]*grid-template-rows:repeat\(3,minmax\(47px,1fr\)\)!important;/);
  assert.match(css, /\.map-lens-clear\{[\s\S]*margin-top:auto!important;[\s\S]*min-height:28px!important;/);
});

test("segment drawer tab is attached to the segment header area", () => {
  assert.match(css, /\.map-segment-drawer-v10931\{[\s\S]*right:-16px!important;[\s\S]*top:2px!important;[\s\S]*height:40px!important;/);
});

test("portfolio totals read as one compact glass cluster", () => {
  assert.match(css, /\.territory-map-summary\{[\s\S]*padding:4px!important;[\s\S]*border-radius:18px!important;[\s\S]*backdrop-filter:blur\(20px\) saturate\(145%\)!important;/);
});

test("v1.0.9.43 stylesheet loads last and version advances", () => {
  assert.match(layout, /v10942-map-hero\.css";\nimport "\.\/v10943-map-layout\.css"/);
  assert.match(version, /APP_VERSION = "1\.0\.9\.43"/);
});
