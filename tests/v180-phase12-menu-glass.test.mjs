import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const rail = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");

test("Phase 12 is layered on the viewport-level Phase 11 rail", () => {
  assert.match(rail, /createPortal/);
  assert.match(rail, /document\.body/);
  assert.match(css, /Phase 12 — glass rail and energized A mark/);
});

test("Phase 12 removes the background halo and energizes the A image itself", () => {
  assert.match(css, /\.compass-corner-trigger::before,[\s\S]*content:none!important/);
  assert.match(css, /\.compass-corner-mark::before[\s\S]*display:none!important/);
  assert.match(css, /\.compass-corner-trigger:hover \.compass-corner-mark img[\s\S]*brightness\(1\.42\) saturate\(1\.38\)/);
  assert.match(css, /drop-shadow\(0 0 32px rgba\(21,108,239,.68\)\)/);
});

test("Phase 12 rounds the rail top-right and uses transparent glass styling", () => {
  assert.match(css, /\.compass-navigation-rail,[\s\S]*border-radius:0 22px 22px 0!important/);
  assert.match(css, /rgba\(5,40,84,.72\)/);
  assert.match(css, /backdrop-filter:blur\(20px\) saturate\(1\.18\)/);
});
