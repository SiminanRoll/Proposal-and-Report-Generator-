import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const settings = fs.readFileSync(new URL("../src/components/captains-log-cloud-settings.tsx", import.meta.url), "utf8");
const taskWrite = fs.readFileSync(new URL("../src/lib/compass/captains-log-task-write.ts", import.meta.url), "utf8");
const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

test("Supabase connection setup reports sign-in and data access as separate stages", () => {
  assert.match(settings, /Signing in to Supabase/);
  assert.match(settings, /Supabase sign-in failed:/);
  assert.match(settings, /Signed in\. Checking Captain's Log data access/);
  assert.match(settings, /Supabase sign-in succeeded, but Captain's Log data access failed:/);
});

test("task path labels Data API failures instead of surfacing a bare fetch error", () => {
  assert.match(taskWrite, /Supabase Data API check failed:/);
  assert.match(taskWrite, /captainsLogCloudRest/);
});

test("diagnostic release is Client Compass 1.1.22", () => {
  assert.match(version, /APP_VERSION = "1\.1\.22"/);
});
