import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const card = fs.readFileSync(new URL("../src/components/project-coverage-card.tsx", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../src/components/project-coverage-dashboard.tsx", import.meta.url), "utf8");
const list = fs.readFileSync(new URL("../src/components/project-coverage-client-list.tsx", import.meta.url), "utf8");
const filters = fs.readFileSync(new URL("../src/components/project-coverage-filters.tsx", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("Phase 8 adds animated dashboard values pointer sheen and expressive card motion", () => {
  assert.match(card, /AnimatedNumber/);
  assert.match(card, /onPointerMove=\{handlePointerMove\}/);
  assert.match(card, /--tilt-x/);
  assert.match(card, /project-coverage-card-sheen/);
  assert.match(dashboard, /motionIndex=\{index\}/);
  assert.match(css, /--motion-expressive:720ms/);
  assert.match(css, /@keyframes premiumCardSwish/);
  assert.match(css, /\.project-coverage-card-inner\{[^}]*760ms/s);
});

test("Phase 8 animates card-set changes filters and client rows without changing data behavior", () => {
  assert.match(home, /key=\{activeCardSet\}/);
  assert.match(home, /key=\{activeCoverageCard\.id\}/);
  assert.match(list, /project-coverage-list-motion/);
  assert.match(list, /--row-motion-index/);
  assert.match(filters, /project-coverage-filter-indicator/);
  assert.match(filters, /ResizeObserver/);
  assert.match(css, /@keyframes premiumListSwap/);
  assert.match(css, /@keyframes premiumRowIn/);
});

test("Phase 8 gives the corner menu drawers and buttons premium motion with a complete reduced-motion fallback", () => {
  assert.match(css, /@keyframes premiumCornerGlint/);
  assert.match(css, /@keyframes premiumNavItemIn/);
  assert.match(css, /clip-path:inset\(0 0 100% 0/);
  assert.match(css, /@keyframes premiumDrawerIn/);
  assert.match(css, /@keyframes premiumCheckPop/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /animation:none!important/);
  assert.match(css, /transition:none!important/);
});
