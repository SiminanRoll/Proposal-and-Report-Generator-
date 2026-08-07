import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const home = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
const rail = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
const coverage = fs.readFileSync(new URL("../src/lib/compass/project-coverage.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("Phase 7 protects browser-local card-set preference access", () => {
  assert.match(home, /try \{[\s\S]*localStorage\.getItem/);
  assert.match(home, /try \{[\s\S]*localStorage\.setItem/);
  assert.match(home, /cardSetPreferenceReady/);
});

test("Phase 7 keeps hover activation on the A trigger and expanded rail system", () => {
  assert.match(rail, /className=\{`compass-navigation-system\$\{expanded \? " is-expanded" : ""\}\$\{pinned \? " is-pinned" : ""\}`\}/);
  assert.match(rail, /onMouseEnter=\{\(\) => setHovered\(true\)\}/);
  assert.match(rail, /onMouseLeave=\{\(\) => setHovered\(false\)\}/);
  assert.doesNotMatch(rail, /setTimeout\(\(\) => \{/);
  assert.doesNotMatch(rail, />\s*Home\s*</);
});

test("Phase 7 includes touch targets overflow handling and reduced-motion protection", () => {
  assert.match(css, /@media\(hover:none\),\(pointer:coarse\)/);
  assert.match(css, /\.project-coverage-stat-grid span\{hyphens:auto\}/);
  assert.match(css, /\.compass-navigation-rail\{overflow-y:auto/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\.project-coverage-client-list\.list-highest-risk::before/);
});

test("Priority Lens uses real ranking criteria rather than relabeled coverage cards", () => {
  assert.match(coverage, /function compareHighestRisk/);
  assert.match(coverage, /function compareOldestOpenQuote/);
  assert.match(coverage, /function compareLargestNeed/);
  assert.match(coverage, /return setId === "priority-lens" \? priorityLensCards\(snapshot\) : snapshot\.cards/);
  assert.doesNotMatch(coverage, /relabelCardForSet/);
});
