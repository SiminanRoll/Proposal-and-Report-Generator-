import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const compass = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
const coverageDashboard = fs.readFileSync(new URL("../src/components/project-coverage-dashboard.tsx", import.meta.url), "utf8");
const coverageCard = fs.readFileSync(new URL("../src/components/project-coverage-card.tsx", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const generator = fs.readFileSync(new URL("../src/app/generator/page.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const navigationRail = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const cardConfig = fs.readFileSync(new URL("../src/lib/compass/config.ts", import.meta.url), "utf8");

test("Client Compass is the card-first home route", () => {
  assert.match(home, /CompassHome/);
  assert.match(compass, /activeCardSetDefinition\.title/);
  assert.match(compass, /client-project-coverage/);
  assert.match(coverageDashboard, /Project opportunity cards/);
  assert.doesNotMatch(compass, /Recent workspaces|project-list/);
});

test("legacy technical cards remain configured while the primary coverage cards own the homepage", () => {
  assert.match(cardConfig, /Clients Needing Projects/);
  assert.match(cardConfig, /Critical Server Projects/);
  assert.match(cardConfig, /Server Planning/);
  assert.match(cardConfig, /Windows 10 Refresh/);
  assert.match(cardConfig, /Workstation Lifecycle/);
  assert.match(cardConfig, /Storage Attention/);
  assert.match(coverageDashboard, /flippedCard/);
  assert.match(coverageCard, /Flip for details/);
  assert.match(coverageCard, /View clients/);
  assert.match(coverageCard, /estimated project need|valueLabel/);
  assert.match(css, /project-coverage-card-inner/);
  assert.match(css, /rotateY\(180deg\)/);
});

test("the existing report generator remains available as a module", () => {
  assert.match(generator, /HomeDashboard/);
  assert.match(shell, /CompassNavigationRail/);
  assert.match(navigationRail, /href="\/generator\/"/);
  assert.match(navigationRail, /Report Generator/);
});
