import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("v1.0.9.22 ships the transparent Client Compass icon and version label", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");
  const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  assert.equal(pkg.version, "1.0.9.22");
  assert.match(version, /1\.0\.9\.22/);
  assert.match(layout, /client-compass-icon\.png/);
  assert.match(layout, /client-compass\.ico/);
});
