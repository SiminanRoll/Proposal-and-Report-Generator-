import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const home = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("Phase 5 adds a card-set switcher to the compact coverage masthead", () => {
  assert.match(home, /useState<ProjectCoverageCardSetId>\("client-project-coverage"\)/);
  assert.match(home, /PROJECT_COVERAGE_CARD_SETS/);
  assert.match(home, /projectCoverageCardsForSet\(coverageSnapshot, activeCardSet\)/);
  assert.match(home, /className="compass-card-set-switcher"/);
  assert.match(home, /Show previous card set/);
  assert.match(home, /Show next card set/);
  assert.match(css, /\.compass-card-set-switcher\{/);
  assert.match(css, /\.compass-card-set-controls\{[^}]*grid-template-columns:34px minmax\(0,1fr\) 34px/s);
});

test("card set definitions and relabeling helpers are encoded in the coverage engine", () => {
  const coverage = fs.readFileSync(new URL("../src/lib/compass/project-coverage.ts", import.meta.url), "utf8");
  assert.match(coverage, /export const PROJECT_COVERAGE_CARD_SETS/);
  assert.match(coverage, /id: "client-project-coverage"/);
  assert.match(coverage, /id: "service-urgency"/);
  assert.match(coverage, /function relabelCardForSet/);
  assert.match(coverage, /title: "Immediate Review Needed"/);
  assert.match(coverage, /title: "Decision Follow-up"/);
  assert.match(coverage, /title: "Quote Follow-through"/);
  assert.match(coverage, /export function projectCoverageCardsForSet/);
});
