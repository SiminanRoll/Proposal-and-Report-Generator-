import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const home = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("footer only keeps the device-count summary and removes reconciliation copy", () => {
  assert.match(home, /<footer className="compass-footnote">[\s\S]*devices across/);
  assert.doesNotMatch(home, /Coverage reconciliation/);
  assert.doesNotMatch(home, /Qualified project packages are deduplicated/);
  assert.match(css, /\.project-coverage-reconciliation\{display:none!important\}/);
});

test("hover powers up the A mark itself with an electric-blue glow", () => {
  assert.match(css, /powered A glow/);
  assert.match(css, /\.compass-corner-mark::before\{[^}]*radial-gradient/s);
  assert.match(css, /\.compass-corner-trigger:hover \.compass-corner-mark[^}]*drop-shadow/s);
  assert.match(css, /\.compass-corner-trigger:hover \.compass-corner-mark img[^}]*brightness\(1\.12\) saturate\(1\.16\)/s);
});
