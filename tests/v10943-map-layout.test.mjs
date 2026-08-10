import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/v10943-map-layout.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const version = readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

function ruleBody(selector) {
  const start = css.indexOf(`${selector}{`);
  assert.notEqual(start, -1, `Missing ${selector} rule`);
  const end = css.indexOf("}", start);
  assert.notEqual(end, -1, `Unclosed ${selector} rule`);
  return css.slice(start, end + 1);
}

test("v1.0.9.43 visually relocates the donut into the map field on desktop", () => {
  const desktopStart = css.indexOf("@media(min-width:1081px){");
  const mobileStart = css.indexOf("@media(max-width:1080px){");
  assert.notEqual(desktopStart, -1);
  assert.notEqual(mobileStart, -1);
  const desktop = css.slice(desktopStart, mobileStart);
  assert.match(desktop, /\.territory-map-insight\{position:static!important\}/);
  assert.match(desktop, /\.territory-donut-wrap\{[\s\S]*?position:absolute!important;[\s\S]*?right:372px!important;[\s\S]*?width:184px!important;[\s\S]*?height:184px!important;/);
  assert.match(desktop, /\.territory-donut\{[\s\S]*?width:170px!important;[\s\S]*?height:170px!important;/);
});

test("right rail uses available height instead of clipping segment controls", () => {
  const insight = ruleBody(".territory-map-insight");
  const panel = ruleBody(".map-segment-lens-panel");
  const slots = ruleBody(".map-lens-slot-stack");
  const clear = ruleBody(".map-lens-clear");
  assert.match(insight, /display:flex!important/);
  assert.match(insight, /flex-direction:column!important/);
  assert.match(insight, /min-height:0!important/);
  assert.match(panel, /flex:1 1 auto!important/);
  assert.match(panel, /min-height:0!important/);
  assert.match(slots, /grid-template-rows:repeat\(3,minmax\(47px,1fr\)\)!important/);
  assert.match(clear, /margin-top:auto!important/);
  assert.match(clear, /min-height:28px!important/);
});

test("segment drawer tab is attached to the segment header area", () => {
  const drawer = ruleBody(".map-segment-drawer-v10931");
  assert.match(drawer, /right:-16px!important/);
  assert.match(drawer, /top:2px!important/);
  assert.match(drawer, /height:40px!important/);
});

test("portfolio totals read as one compact glass cluster", () => {
  const summary = ruleBody(".territory-map-summary");
  assert.match(summary, /padding:4px!important/);
  assert.match(summary, /border-radius:18px!important/);
  assert.match(summary, /backdrop-filter:blur\(20px\) saturate\(145%\)!important/);
});

test("v1.0.9.43 stylesheet remains before the current map polish override", () => {
  assert.match(layout, /v10942-map-hero\.css";\nimport "\.\/v10943-map-layout\.css";\nimport "\.\/v10945-map-polish\.css"/);
  assert.match(version, /APP_VERSION = "1\.1\.0"/);
});
