import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("version 1.0.1.7 is visible through the global app shell", () => {
  const version = readFileSync("src/lib/app-version.ts", "utf8");
  const shell = readFileSync("src/components/app-shell.tsx", "utf8");
  assert.match(version, /APP_VERSION = "1\.0\.1\.7"/);
  assert.match(shell, /build-version/);
  assert.match(shell, /v\{APP_VERSION\}/);
});

test("hero includes Compliance outcome bubble", () => {
  const dashboard = readFileSync("src/components/home-dashboard.tsx", "utf8");
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(dashboard, /node-six">Compliance/);
  assert.match(css, /\.node-six/);
});


test("first two creation paths mention compliance readiness while modernization stays unchanged", () => {
  const templates = readFileSync("src/lib/projects/templates.ts", "utf8");
  assert.match(templates, /client-report[\s\S]*compliance readiness/);
  assert.match(templates, /prospect-proposal[\s\S]*compliance readiness/);
  const legacyBlock = templates.split('"legacy-modernization"')[1] ?? "";
  assert.doesNotMatch(legacyBlock, /compliance readiness/);
});
