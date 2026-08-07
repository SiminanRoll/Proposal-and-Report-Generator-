import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("Phase 12 removes the background halo and brightens the A mark itself", () => {
  assert.match(css, /Phase 12 — menu glass \+ brighter A mark/);
  assert.match(css, /\.compass-corner-trigger::before,[\s\S]*content:none !important/);
  assert.match(css, /\.compass-corner-mark::before\{?[\s\S]*display:none !important/);
  assert.match(css, /\.compass-corner-trigger:hover \.compass-corner-mark img[\s\S]*brightness\(1\.34\) saturate\(1\.34\)/);
  assert.match(css, /drop-shadow\(0 0 36px rgba\(18,105,235,.6\)\)/);
});

test("Phase 12 gives the dropdown a rounded upper-right corner and translucent glass background", () => {
  assert.match(css, /\.compass-navigation-rail,[\s\S]*border-radius:0 24px 24px 0/);
  assert.match(css, /background:linear-gradient\(180deg,rgba\(4,28,62,.72\),rgba\(3,20,46,.76\)\)/);
  assert.match(css, /backdrop-filter:blur\(18px\) saturate\(1.12\)/);
  assert.match(css, /\.compass-navigation-rail::before\{[\s\S]*rgba\(63,160,255,.18\)/);
});
