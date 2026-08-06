import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const compass = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const generator = fs.readFileSync(new URL("../src/app/generator/page.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const navigationRail = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const cardConfig = fs.readFileSync(new URL("../src/lib/compass/config.ts", import.meta.url), "utf8");

test("Client Compass is the card-first home route", () => {
  assert.match(home, /CompassHome/);
  assert.match(compass, /Client Compass/);
  assert.match(compass, /Project opportunity cards/);
  assert.doesNotMatch(compass, /Recent workspaces|project-list/);
});

test("phase 1 cards flip between client counts and estimated values", () => {
  assert.match(cardConfig, /Clients Needing Projects/);
  assert.match(cardConfig, /Critical Server Projects/);
  assert.match(cardConfig, /Server Planning/);
  assert.match(cardConfig, /Windows 10 Refresh/);
  assert.match(cardConfig, /Workstation Lifecycle/);
  assert.match(cardConfig, /Storage Attention/);
  assert.match(compass, /flippedCards/);
  assert.match(compass, /Flip for estimated value/);
  assert.match(compass, /View clients/);
  assert.match(compass, /Internal opportunity estimate/);
  assert.match(css, /rotateY\(180deg\)/);
  assert.match(css, /compass-card-inner/);
});

test("the existing report generator remains available as a module", () => {
  assert.match(generator, /HomeDashboard/);
  assert.match(shell, /CompassNavigationRail/);
  assert.match(navigationRail, /href="\/generator\/"/);
  assert.match(navigationRail, /Report Generator/);
});
