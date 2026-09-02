import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const core = fs.readFileSync("src/lib/outcomes/client-report-data-core.ts", "utf8");

test("client report device source includes CPU RAM and storage fields", () => {
  assert.match(core, /ram: string;/);
  assert.match(core, /cpu: string;/);
  assert.match(core, /storage: string;/);
});
