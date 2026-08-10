import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cleanModeCss = fs.readFileSync(new URL("../src/app/presentation-clean-mode.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

test("presentation mode keeps one working vertical scroll surface", () => {
  assert.match(cleanModeCss, /\.presentation-stage\s*\{[\s\S]*?min-height:\s*0\s*!important;/);
  assert.match(cleanModeCss, /\.presentation-stage\s*\{[\s\S]*?overflow-y:\s*auto\s*!important;/);
  assert.match(cleanModeCss, /\.presentation-overlay\s*\{[\s\S]*?overflow:\s*hidden\s*!important;/);
  assert.match(cleanModeCss, /\.presentation-shell\s*\{[\s\S]*?overflow:\s*hidden\s*!important;/);
});

test("presentation scrollbar stays thin and styled", () => {
  assert.match(cleanModeCss, /scrollbar-width:\s*thin/);
  assert.match(cleanModeCss, /scrollbar-color:/);
  assert.match(cleanModeCss, /\.presentation-stage::-webkit-scrollbar\s*\{[\s\S]*?width:\s*7px/);
  assert.match(cleanModeCss, /\.presentation-stage::-webkit-scrollbar-thumb/);
});

test("presentation clean-mode overrides load after the other global css", () => {
  const cssImports = [...layout.matchAll(/import\s+"(\.\/[^\"]+\.css)";/g)].map((match) => match[1]);
  assert.equal(cssImports.at(-1), "./presentation-clean-mode.css");
});
