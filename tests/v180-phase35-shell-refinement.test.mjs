import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const rail = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("Phase 3.5 keeps a single Advantage mark on the blue corner with the wordmark on the white header", () => {
  assert.match(shell, /<CompassNavigationRail \/>/);
  assert.doesNotMatch(shell, /<Brand \/>/);
  assert.match(rail, /compass-header-branding/);
  assert.match(rail, /compass-corner-trigger/);
  assert.match(rail, /compass-header-wordmark/);
  assert.match(rail, /advantage-wordmark-no-a\.png/);
  assert.match(rail, /aria-controls="client-compass-navigation"/);
  assert.doesNotMatch(rail, />\s*Home\s*</);
  assert.match(css, /\.compass-header-branding\{[^}]*grid-template-columns:48px auto/s);
  assert.match(css, /\.compass-corner-trigger\{[^}]*width:48px/s);
});

test("Phase 3.5 keeps the masthead compact and centered", () => {
  assert.match(home, /className="compass-intro"/);
  assert.match(home, /className="compass-intro-title-row"/);
  assert.match(home, /Show previous card set/);
  assert.match(home, /Show next card set/);
  assert.match(css, /centered coverage header/);
  assert.match(css, /\.compass-intro\{[^}]*grid-template-columns:1fr[^}]*justify-items:center/s);
  assert.match(css, /\.compass-intro-title-row\{[^}]*grid-template-columns:1fr auto 1fr/s);
  assert.match(css, /\.compass-intro::before\{display:none/s);
  assert.match(css, /\.compass-intro-chevron\{[^}]*border:0[^}]*background:transparent/s);
});
