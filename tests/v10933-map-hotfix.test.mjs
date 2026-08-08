import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/app/v10933-map-hotfix.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const interaction = fs.readFileSync(new URL("../src/components/map-interaction-polish-v10932.tsx", import.meta.url), "utf8");
const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

test("v1.0.9.33 hardens the map canvas and SVG against runaway sizing and default black fills", () => {
  assert.match(css, /\.territory-map-page \.territory-map-layout\{display:grid!important/);
  assert.match(css, /\.territory-map-page \.territory-regional-map\{display:block!important;width:100%!important;height:100%!important;max-width:770px!important;max-height:700px!important/);
  assert.match(css, /\.territory-map-page \.territory-map-region-fill\{fill:var\(--territory-color\)!important/);
  assert.match(css, /\.territory-map-page \.territory-map-insight\{/);
  assert.match(css, /\.territory-map-page \.territory-map-summary span\{/);
});

test("All is visibly labeled without mutating React-owned button text", () => {
  assert.match(css, /\.territory-map-toggle button:first-child::after\{content:"All"/);
  assert.doesNotMatch(interaction, /textContent !== "All"/);
  assert.doesNotMatch(interaction, /new MutationObserver/);
});

test("v1.0.9.33 keeps fixed View clients space and loads last in the global style stack", () => {
  assert.match(css, /\.territory-active-detail\{position:relative!important;min-height:176px!important;padding-bottom:42px!important\}/);
  assert.match(css, /\.territory-review-clients\{position:absolute!important/);
  assert.match(layout, /v10932-map-interactions\.css";\nimport "\.\/v10933-map-hotfix\.css";/);
  assert.match(version, /APP_VERSION = "1\.0\.9\.\d+"/);
});
