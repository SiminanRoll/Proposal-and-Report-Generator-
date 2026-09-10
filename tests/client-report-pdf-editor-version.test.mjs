import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

test("WYSIWYG PDF editor ships as v1.2.94", () => {
  assert.equal(packageJson.version, "1.2.94");
  assert.match(version, /1\.2\.94/);
});
