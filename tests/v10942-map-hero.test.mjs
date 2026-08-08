import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../src/components/map-mode-controller-v10942.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/app/v10942-map-hero.css", import.meta.url), "utf8");
const version = readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

test("v1.0.9.42 uses the stable native map mode controller", () => {
  assert.match(layout, /MapModeControllerV10942/);
  assert.match(layout, /v10942-map-hero\.css/);
  assert.doesNotMatch(runtime, /createPortal/);
  assert.match(runtime, /MutationObserver/);
  assert.match(runtime, /buttons\[0\]\.textContent = "All"/);
  assert.match(runtime, /saveMapLensDisplayMode\(nextMode\)/);
});

test("All Need Value controls remain visible after hydration", () => {
  assert.match(css, /\.territory-map-toggle>button\{[\s\S]*visibility:visible!important;[\s\S]*pointer-events:auto!important;/);
  assert.match(css, /\.map-mode-toggle-v10940\{display:none!important\}/);
});

test("map hero removes redundant title and floats glass totals over the map", () => {
  assert.match(css, /\.territory-map-header>div:first-child\{display:none!important\}/);
  assert.match(css, /\.territory-map-header\{[\s\S]*position:absolute!important;/);
  assert.match(css, /\.territory-map-summary span\{[\s\S]*backdrop-filter:blur\(18px\) saturate\(140%\)!important;/);
  assert.match(css, /max-width:1180px!important/);
  assert.match(css, /min-height:625px!important/);
  assert.match(css, /\.territory-map-state-base\{[\s\S]*transform:translateY\(2\.2px\)/);
});

test("v1.0.9.42 map hero remains loaded before the current map layout override", () => {
  assert.match(layout, /v10942-map-hero\.css";\nimport "\.\/v10943-map-layout\.css"/);
  assert.match(version, /APP_VERSION = "1\.0\.9\.43"/);
});
