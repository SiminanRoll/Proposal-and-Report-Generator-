import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const rail = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
const actions = fs.readFileSync(new URL("../src/lib/compass/shell-actions.ts", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
const settings = fs.readFileSync(new URL("../src/components/compass-settings-page.tsx", import.meta.url), "utf8");
const dataTools = fs.readFileSync(new URL("../src/components/compass-data-tools-page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("v1.8.1 shell uses the corner-trigger drop-down navigation", () => {
  assert.match(shell, /CompassNavigationRail/);
  assert.doesNotMatch(shell, /topbar-nav/);
  assert.match(rail, /compass-corner-trigger/);
  assert.match(rail, /compass-header-wordmark/);
  assert.match(rail, /createPortal/);
  assert.match(rail, /onMouseEnter=\{openFromHover\}/);
  assert.match(rail, /onMouseLeave=\{scheduleHoverClose\}/);
  assert.match(rail, /setTimeout\(\(\) => \{/);
  assert.match(rail, /onFocusCapture/);
  assert.match(rail, /mousedown/);
  assert.match(rail, /event\.key !== "Escape"/);
});

test("rail keeps four direct destinations with standalone Data Tools and Settings pages", () => {
  for (const label of ["Find a client", "Report Generator", "Data Tools", "Settings"]) assert.match(rail, new RegExp(label));
  assert.match(rail, /href="\/data\/"/);
  assert.match(rail, /href="\/settings\/"/);
  assert.doesNotMatch(rail, /compass-rail-submenu|Technical-card configuration|Estimate assumptions|Dashboard preferences/);
  assert.doesNotMatch(rail, />\s*Home\s*</);
  assert.match(actions, /compassShellActionHref/);
  assert.match(home, /clientSearchInputRef\.current\?\.focus/);
  assert.match(dataTools, /Update Ninja data/);
  assert.match(dataTools, /Import review & quote dates/);
  assert.match(dataTools, /Refresh calculations/);
  assert.match(settings, /Project Coverage card setup/);
  assert.match(settings, /Estimated project values/);
});


test("navigation opens from the top-left corner and drops the menu down the full viewport height", () => {
  assert.match(css, /\.compass-corner-trigger\{[^}]*grid-template-rows:1fr auto/s);
  assert.match(css, /portal rail fix/);
  assert.match(css, /\.compass-navigation-rail\{[^}]*top:75px!important[^}]*bottom:0!important/s);
  assert.match(css, /\.compass-navigation-rail\.is-expanded\{[^}]*width:236px/s);
  assert.match(css, /\.compass-header-wordmark span\{[^}]*text-align:center!important/s);
  assert.match(css, /\.compass-rail-mobile-backdrop\.is-visible/);
  assert.match(css, /@media\(max-width:820px\)/);
});
