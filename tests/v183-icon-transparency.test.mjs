import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("v1.0.9.27 ships the full-frame Client Compass browser favicon", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");
  const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  const favicon = fs.readFileSync(new URL("../public/client-compass-favicon.svg", import.meta.url), "utf8");
  assert.equal(pkg.version, "1.0.9.27");
  assert.match(version, /1\.0\.9\.27/);
  assert.match(layout, /client-compass-favicon\.svg\?v=10926/);
  assert.match(layout, /client-compass-icon\.png\?v=10926/);
  assert.match(favicon, /viewBox="0 0 32 32"/);
  assert.match(favicon, /r="14\.35"/);
  assert.equal(fs.existsSync(new URL("../public/client-compass-icon.png", import.meta.url)), true);
  assert.equal(fs.existsSync(new URL("../public/client-compass.ico", import.meta.url)), true);
  assert.equal(fs.existsSync(new URL("../src/app/icon.png", import.meta.url)), true);
  assert.equal(fs.existsSync(new URL("../src/app/favicon.ico", import.meta.url)), true);
});
