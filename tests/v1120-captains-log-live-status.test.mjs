import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const settings = fs.readFileSync(new URL("../src/components/captains-log-cloud-settings.tsx", import.meta.url), "utf8");
const action = fs.readFileSync(new URL("../src/components/client-tracked-action.tsx", import.meta.url), "utf8");

test("Settings only shows Connected after the same live task-path check used by Add Task", () => {
  assert.match(settings, /verifyCaptainsLogTaskConnection/);
  assert.match(settings, /Checking live connection/);
  assert.match(settings, /await verifyCaptainsLogTaskConnection\(\)/);
  assert.match(action, /await verifyCaptainsLogTaskConnection\(\)/);
  assert.doesNotMatch(settings, /setConnected\(snapshot\.signedIn\)/);
});

test("task failures distinguish connection-check failure from write failure", () => {
  assert.match(action, /Captain's Log connection check failed:/);
  assert.match(action, /Captain's Log is connected, but the task write failed:/);
});
