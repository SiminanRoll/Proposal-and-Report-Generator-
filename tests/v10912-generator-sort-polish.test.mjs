import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const home = fs.readFileSync(new URL("../src/components/home-dashboard.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/generator-home-v199.css", import.meta.url), "utf8");

test("recent report health can sort red counts both directions", () => {
  assert.match(home, /healthSort/);
  assert.match(home, /rightRed - leftRed/);
  assert.match(home, /leftRed - rightRed/);
  assert.match(home, /generator-health-sort/);
});

test("recent search wording is compact", () => {
  assert.match(home, /placeholder="Search recent"/);
});

test("Ninja import source title is muted and embossed", () => {
  assert.match(css, /compass-file-drop strong\{color:rgba\(83,101,122,\.42\)/);
  assert.match(css, /text-shadow:0 1px 0 rgba\(255,255,255,\.98\),0 -1px 0 rgba\(47,67,91,\.13\)/);
  assert.match(css, /generator-health-sort\.is-active i\{color:#d85d52\}/);
});
