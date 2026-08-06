import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const rail = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("Phase 3.5 combines the Advantage brand with the navigation trigger", () => {
  assert.match(shell, /<CompassNavigationRail \/>/);
  assert.doesNotMatch(shell, /<Brand \/>/);
  assert.match(rail, /compass-navigation-system/);
  assert.match(rail, /compass-brand-trigger/);
  assert.match(rail, /advantage-wordmark-no-a\.png/);
  assert.match(rail, /aria-controls="client-compass-navigation"/);
  assert.doesNotMatch(rail, /compass-rail-toggle-mark/);
  assert.match(css, /\.compass-brand-trigger\{[^}]*grid-template-columns:42px minmax\(0,1fr\) auto/s);
  assert.match(css, /\.compass-navigation-rail\{[^}]*top:72px/s);
});

test("Phase 3.5 replaces the oversized dark hero with a compact light masthead", () => {
  assert.match(home, /className="compass-intro"/);
  assert.match(home, /Client Project Coverage/);
  assert.match(home, /className="compass-client-search"/);
  assert.match(css, /v1\.8\.0 Phase 3\.5/);
  assert.match(css, /\.compass-intro\{[^}]*min-height:0[^}]*padding:20px 24px[^}]*grid-template-columns:minmax\(0,1fr\) auto[^}]*background:linear-gradient\(135deg,#fff/s);
  assert.match(css, /\.compass-intro h1\{[^}]*font-size:clamp\(30px,3vw,42px\)/s);
  assert.match(css, /\.compass-client-search\{[^}]*margin-top:13px[^}]*background:#fff/s);
});
