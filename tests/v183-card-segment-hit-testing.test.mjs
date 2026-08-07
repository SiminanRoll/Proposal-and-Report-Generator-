import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const card = fs.readFileSync(new URL("../src/components/project-coverage-card.tsx", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("v1.8.3 makes only the visible card face hit-testable", () => {
  assert.match(css, /\.project-coverage-card-front\{pointer-events:auto;z-index:2\}/);
  assert.match(css, /\.project-coverage-card-back\{pointer-events:none;z-index:1\}/);
  assert.match(css, /\.project-coverage-card\.is-flipped \.project-coverage-card-front\{pointer-events:none;z-index:1\}/);
  assert.match(css, /\.project-coverage-card\.is-flipped \.project-coverage-card-back\{pointer-events:auto;z-index:3\}/);
});

test("v1.8.3 shows an unmistakable selected segment state and filters below", () => {
  assert.match(card, /✓ Filtering below/);
  assert.match(card, /onClick=\{\(\) => onSelectStat\?\.\(stat\.id\)\}/);
  assert.match(card, /aria-pressed=\{selectedStatId === stat\.id\}/);
  assert.match(home, /setActiveCoverageStatId\(\(current\) => sameCard && current === statId \? null : statId\)/);
  assert.match(css, /\.project-coverage-stat-grid>\.project-coverage-stat\.is-active\{[^}]*rgba\(87,188,255,.52\)/s);
});
