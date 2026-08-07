import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const rail = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
const actions = fs.readFileSync(new URL("../src/lib/compass/shell-actions.ts", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
const settings = fs.readFileSync(new URL("../src/components/compass-settings-dialog.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("v1.8.0 shell uses the corner-trigger drop-down navigation", () => {
  assert.match(shell, /CompassNavigationRail/);
  assert.doesNotMatch(shell, /topbar-nav/);
  assert.match(rail, /compass-corner-trigger/);
  assert.match(rail, /compass-header-wordmark/);
  assert.match(rail, /onMouseEnter=\{openFromHover\}/);
  assert.match(rail, /onMouseLeave=\{scheduleHoverClose\}/);
  assert.match(rail, /setTimeout\(\(\) => \{/);
  assert.match(rail, /onMouseLeave/);
  assert.match(rail, /onFocusCapture/);
  assert.match(rail, /mousedown/);
  assert.match(rail, /event\.key !== "Escape"/);
});

test("rail preserves approved destinations and existing workflow actions without a redundant home icon", () => {
  for (const label of ["Find a client", "Report Generator", "Data Tools", "Settings", "Update Ninja data", "Import review & quote dates", "Refresh calculations", "Estimate assumptions", "Project qualification thresholds", "Technical-card configuration", "Dashboard preferences"]) {
    assert.match(rail, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(rail, />\s*Home\s*</);
  assert.match(actions, /COMPASS_SHELL_ACTION_EVENT/);
  assert.match(actions, /compassShellActionHref/);
  assert.match(home, /setImportOpen\(true\)/);
  assert.match(home, /setReviewHistoryOpen\(true\)/);
  assert.match(home, /refreshCalculations\("manual"\)/);
  assert.match(home, /setSettingsOpen\(true\)/);
  assert.match(home, /setCardsOpen\(true\)/);
  assert.match(home, /clientSearchInputRef\.current\?\.focus/);
});

test("settings rail actions still land in the existing estimate and threshold sections", () => {
  assert.match(home, /action === "estimate-assumptions" \? "value" : "thresholds"/);
  assert.match(settings, /initialSection\?: NumericGroup/);
  assert.match(settings, /compass-settings-value/);
  assert.match(settings, /compass-settings-thresholds/);
});

test("navigation opens from the top-left corner and drops the menu down the full viewport height", () => {
  assert.match(css, /\.compass-corner-trigger\{[^}]*grid-template-rows:1fr auto/s);
  assert.match(css, /\.compass-navigation-rail\{[^}]*position:fixed[^}]*top:76px[^}]*bottom:0[^}]*width:0/s);
  assert.match(css, /\.compass-navigation-rail\.is-expanded\{[^}]*width:236px/s);
  assert.match(css, /\.compass-header-wordmark span\{[^}]*text-align:center/s);
  assert.match(css, /\.compass-rail-mobile-backdrop\.is-visible/);
  assert.match(css, /@media\(max-width:820px\)/);
});
