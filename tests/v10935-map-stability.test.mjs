import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const runtime = fs.readFileSync(new URL("../src/components/map-compass-runtime-v10934.tsx", import.meta.url), "utf8");
const drawer = fs.readFileSync(new URL("../src/components/map-segment-drawer-v10931.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10935-map-stability.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

test("v1.0.9.35 compass runtime avoids body-wide mutation observation", () => {
  assert.doesNotMatch(runtime, /new MutationObserver/);
  assert.match(runtime, /usePathname/);
  assert.match(runtime, /closest\("\.territory-map-page"\)/);
  assert.match(runtime, /client-compass-map-lens-changed/);
});

test("v1.0.9.35 map rail grows naturally without internal filter scrolling", () => {
  assert.match(css, /height:auto!important/);
  assert.match(css, /\.map-lens-where>div/);
  assert.match(css, /max-height:none!important/);
  assert.match(css, /overflow:visible!important/);
  assert.match(css, /territory-active-detail:not\(:has\(\.territory-review-clients\)\)::after/);
});

test("v1.0.9.35 drawer collapses after drop and visually joins the rail", () => {
  assert.match(drawer, /suppressHoverUntilRef/);
  assert.match(drawer, /performance\.now\(\) \+ 420/);
  assert.match(drawer, /setOpen\(false\)/);
  assert.match(css, /right:-1px!important/);
  assert.match(css, /border-right-color:transparent!important/);
  assert.match(css, /backdrop-filter:none!important/);
});

test("v1.0.9.35 stability CSS remains loaded and version stays on the patch line", () => {
  assert.match(layout, /v10934-polish\.css";\nimport "\.\/v10935-map-stability\.css"/);
  assert.match(version, /APP_VERSION = "1\.0\.9\.\d+"/);
});
