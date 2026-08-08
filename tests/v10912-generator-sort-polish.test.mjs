import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const home = fs.readFileSync(new URL("../src/components/home-dashboard.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/generator-home-v199.css", import.meta.url), "utf8");
const polish = fs.readFileSync(new URL("../src/app/v10918-polish.css", import.meta.url), "utf8");

test("recent report health sorts red counts both directions through shared column sorting", () => {
  assert.match(home, /type HomeSortKey/);
  assert.match(home, /sortKey === "health"/);
  assert.match(home, /leftHealth\.overdue - rightHealth\.overdue/);
  assert.match(home, /setSortDirection\(\(current\) => current === "asc" \? "desc" : "asc"\)/);
  assert.match(home, /sortButton\("health", "Health"\)/);
  assert.match(polish, /\.compass-column-sort/);
});

test("recent search wording is compact", () => {
  assert.match(home, /placeholder="Search recent"/);
});

test("Ninja import source title is muted and embossed", () => {
  assert.match(css, /compass-file-drop strong\{color:rgba\(83,101,122,\.42\)/);
  assert.match(css, /text-shadow:0 1px 0 rgba\(255,255,255,\.98\),0 -1px 0 rgba\(47,67,91,\.13\)/);
});
