import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const rail = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
const shellPolish = fs.readFileSync(new URL("../src/app/shell-final-polish.css", import.meta.url), "utf8");

test("the Advantage wordmark remains a home link without a Home hover pill", () => {
  assert.match(rail, /<Link className="compass-header-wordmark" href="\/"/);
  assert.match(shellPolish, /\.compass-header-wordmark::after\{[^}]*content:none!important;[^}]*display:none!important;/s);
});
