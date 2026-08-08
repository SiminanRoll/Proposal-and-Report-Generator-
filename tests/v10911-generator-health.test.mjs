import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const home = readFileSync(new URL("../src/components/home-dashboard.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/app/generator-home-v199.css", import.meta.url), "utf8");

test("1.0.9.23 keeps red yellow green lifecycle counts in recent reports", () => {
  assert.equal(pkg.version, "1.0.9.23");
  assert.match(home, /lifecycleSummary\(project\)/);
  assert.match(home, /sortButton\("health", "Health"\)/);
  assert.match(home, /generator-health-count risk/);
  assert.match(home, /generator-health-count attention/);
  assert.match(home, /generator-health-count healthy/);
  assert.match(home, /Replacement now/);
  assert.match(home, /Plan soon/);
  assert.match(home, /Healthy/);
});

test("health glance uses compact color-coded dots and handles missing inventory", () => {
  assert.match(css, /generator-health-count\.risk i\{background:#df5b50\}/);
  assert.match(css, /generator-health-count\.attention i\{background:#e5ad36\}/);
  assert.match(css, /generator-health-count\.healthy i\{background:#31aa80\}/);
  assert.match(home, /generator-health-empty/);
});
