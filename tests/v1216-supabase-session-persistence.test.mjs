import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cloud = fs.readFileSync(new URL("../src/lib/compass/captains-log-cloud.ts", import.meta.url), "utf8");
const sessionRuntime = fs.readFileSync(new URL("../src/components/captains-log-cloud-session-runtime.tsx", import.meta.url), "utf8");
const settings = fs.readFileSync(new URL("../src/components/captains-log-cloud-settings.tsx", import.meta.url), "utf8");
const rootRuntime = fs.readFileSync(new URL("../src/components/client-compass-runtime.tsx", import.meta.url), "utf8");

test("Supabase auth stores a renewable session instead of the user's password", () => {
  assert.match(cloud, /SESSION_KEY = "client_compass_captains_log_cloud_session"/);
  assert.match(cloud, /refreshToken: String\(raw\.refresh_token/);
  assert.match(cloud, /writeJson\(SESSION_KEY, session\)/);
  assert.match(cloud, /grantType: "password" \| "refresh_token"/);
  assert.doesNotMatch(cloud, /password:\s*String\(raw\./);
});

test("Compass maintains remembered Supabase sessions in the background and after wake or reconnect", () => {
  assert.match(sessionRuntime, /CHECK_INTERVAL_MS = 5 \* 60 \* 1000/);
  assert.match(sessionRuntime, /RETRY_INTERVAL_MS = 30 \* 1000/);
  assert.match(sessionRuntime, /restoreCaptainsLogCloudLocalCache\(\)/);
  assert.match(sessionRuntime, /verifyCaptainsLogTaskConnection\(\)/);
  assert.match(sessionRuntime, /saveCaptainsLogCloudLocalCacheNow\(\)/);
  assert.match(sessionRuntime, /window\.addEventListener\("focus"/);
  assert.match(sessionRuntime, /window\.addEventListener\("online"/);
  assert.match(sessionRuntime, /document\.addEventListener\("visibilitychange"/);
  assert.match(rootRuntime, /<CaptainsLogCloudSessionRuntime \/>/);
});

test("settings distinguish a remembered session from a real sign-out", () => {
  assert.match(settings, /const \[remembered, setRemembered\] = useState\(false\)/);
  assert.match(settings, /Retry saved sign-in/);
  assert.match(settings, /Saved sign-in retained/);
  assert.match(settings, /Remember this device is automatic/);
  assert.match(settings, /your password is never saved/);
  assert.match(settings, /disabled=\{remembered\}/);
});
