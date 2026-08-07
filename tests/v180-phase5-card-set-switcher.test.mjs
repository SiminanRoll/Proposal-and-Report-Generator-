import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const home = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
const coverage = fs.readFileSync(new URL("../src/lib/compass/project-coverage.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("Phase 5 simplifies card-set controls to subtle chevrons around the main masthead title", () => {
  assert.match(home, /useState<ProjectCoverageCardSetId>\("client-project-coverage"\)/);
  assert.match(home, /PROJECT_COVERAGE_CARD_SETS/);
  assert.match(home, /projectCoverageCardsForSet\(coverageSnapshot, activeCardSet\)/);
  assert.match(home, /id="compass-title">\{activeCardSetDefinition.title\}/);
  assert.match(home, /className="compass-intro-chevron"/);
  assert.doesNotMatch(home, /compass-card-set-switcher/);
  assert.match(css, /\.compass-intro-chevron\{/);
  assert.match(css, /\.compass-intro-title-row\{[^}]*grid-template-columns:40px minmax\(0,1fr\) 40px/s);
});

test("card set definitions include the approved Priority Lens cards", () => {
  assert.match(coverage, /export const PROJECT_COVERAGE_CARD_SETS/);
  assert.match(coverage, /id: "client-project-coverage"/);
  assert.match(coverage, /id: "priority-lens"/);
  assert.match(coverage, /function priorityLensCards/);
  assert.match(coverage, /"Highest Technical Risk"/);
  assert.match(coverage, /"Oldest Open Quotes"/);
  assert.match(coverage, /"Largest Estimated Need"/);
  assert.match(coverage, /export function projectCoverageCardsForSet/);
});

test("the selected card set persists in browser-local storage", () => {
  assert.match(home, /client-compass:project-coverage-card-set/);
  assert.match(home, /window\.localStorage\.getItem/);
  assert.match(home, /window\.localStorage\.setItem/);
});
