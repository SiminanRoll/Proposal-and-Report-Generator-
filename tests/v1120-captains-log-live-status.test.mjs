import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const settings = fs.readFileSync(new URL("../src/components/captains-log-cloud-settings.tsx", import.meta.url), "utf8");
const action = fs.readFileSync(new URL("../src/components/client-tracked-action.tsx", import.meta.url), "utf8");

test("Settings verifies the live task path while Add Task avoids a duplicate preflight", () => {
  assert.match(settings, /verifyCaptainsLogTaskConnection/);
  assert.match(settings, /Checking Supabase data access/);
  assert.match(settings, /await verifyCaptainsLogTaskConnection\(\)/);
  assert.doesNotMatch(action, /verifyCaptainsLogTaskConnection/);
  assert.doesNotMatch(settings, /setConnected\(snapshot\.signedIn\)/);
});

test("task failures report the direct write failure", () => {
  assert.match(action, /Task write failed:/);
  assert.doesNotMatch(action, /Captain's Log connection check failed:/);
});
