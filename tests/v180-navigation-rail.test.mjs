import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const rail = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
const actions = fs.readFileSync(new URL("../src/lib/compass/shell-actions.ts", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
const settings = fs.readFileSync(new URL("../src/components/compass-settings-dialog.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("v1.8.0 shell uses the dedicated expandable navigation rail", () => {
  assert.match(shell, /CompassNavigationRail/);
  assert.doesNotMatch(shell, /topbar-nav/);
  assert.match(rail, /compass-navigation-rail/);
  assert.match(rail, /onMouseEnter/);
  assert.match(rail, /onFocusCapture/);
  assert.match(rail, /mousedown/);
  assert.match(rail, /event\.key !== "Escape"/);
});

test("rail preserves all approved destinations and existing workflow actions", () => {
  for (const label of ["Compass", "Find a client", "Report Generator", "Data Tools", "Settings", "Update Ninja data", "Import review & quote dates", "Refresh calculations", "Estimate assumptions", "Project qualification thresholds", "Technical-card configuration", "Dashboard preferences"]) {
    assert.match(rail, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(actions, /COMPASS_SHELL_ACTION_EVENT/);
  assert.match(actions, /compassShellActionHref/);
  assert.match(home, /setImportOpen\(true\)/);
  assert.match(home, /setReviewHistoryOpen\(true\)/);
  assert.match(home, /refreshCalculations\("manual"\)/);
  assert.match(home, /setSettingsOpen\(true\)/);
  assert.match(home, /setCardsOpen\(true\)/);
  assert.match(home, /clientSearchInputRef\.current\?\.focus/);
});

test("settings rail actions land in the existing estimate and threshold sections", () => {
  assert.match(home, /action === "estimate-assumptions" \? "value" : "thresholds"/);
  assert.match(settings, /initialSection\?: NumericGroup/);
  assert.match(settings, /compass-settings-value/);
  assert.match(settings, /compass-settings-thresholds/);
});

test("navigation rail overlays on smaller screens and respects reduced motion", () => {
  assert.match(css, /\.compass-navigation-rail\{[^}]*position:fixed/s);
  assert.match(css, /\.compass-navigation-rail\.is-expanded\{[^}]*width:248px/s);
  assert.match(css, /\.compass-rail-mobile-backdrop\.is-visible/);
  assert.match(css, /@media\(max-width:1100px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});
