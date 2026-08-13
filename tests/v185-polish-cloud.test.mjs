import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const rail = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
const currentState = fs.readFileSync(new URL("../src/lib/compass/captains-log-current-state.ts", import.meta.url), "utf8");
const cloud = fs.readFileSync(new URL("../src/lib/compass/captains-log-cloud.ts", import.meta.url), "utf8");
const settings = fs.readFileSync(new URL("../src/components/captains-log-cloud-settings.tsx", import.meta.url), "utf8");

test("Project Coverage metrics retain premium hierarchy", () => {
  assert.match(css, /font-size:clamp\(88px,7\.2vw,112px\)!important/);
});

test("navigation keeps Find a client global", () => {
  assert.match(rail, /dispatchGlobalClientSearch\(\)/);
  assert.match(rail, /event\.preventDefault\(\)/);
});

test("Client Compass uses authenticated canonical task state as its direct data source", () => {
  assert.match(bridge, /syncClientsFromCompassCurrentState/);
  assert.match(currentState, /"GET", "tasks"/);
  assert.match(currentState, /company_id: `eq\.\$\{companyId\}`/);
  assert.doesNotMatch(currentState, /task_events|app_events|client_compass_current_state/);
  assert.equal(cloud.includes("/auth/v1/token?grant_type=${grantType}"), true);
  assert.match(cloud, /rest\/v1/);
  assert.match(settings, /Supabase project URL/);
  assert.match(settings, /Publishable \/ anon key/);
  assert.match(settings, /Sign-in email/);
  assert.match(settings, /CompassMasterBackupSettings/);
});
