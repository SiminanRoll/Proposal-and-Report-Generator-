import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const rail = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
const cloud = fs.readFileSync(new URL("../src/lib/compass/captains-log-cloud.ts", import.meta.url), "utf8");
const settings = fs.readFileSync(new URL("../src/components/captains-log-cloud-settings.tsx", import.meta.url), "utf8");

test("v1.8.8 enlarges and aligns Project Coverage metrics while balancing the flipped card footer", () => {
  assert.match(css, /Client Compass v1\.8\.5 — card balance/);
  assert.match(css, /\.project-coverage-count\{[^}]*grid-template-columns:auto 1fr[^}]*align-items:baseline/s);
  assert.match(css, /font-size:clamp\(88px,7\.2vw,112px\)!important/);
  assert.match(css, /\.project-coverage-card-back\{[^}]*grid-template-rows:auto minmax\(0,1fr\) auto auto/s);
  assert.match(css, /\.project-coverage-card-back \.project-coverage-view,[\s\S]*min-height:44px/);
});

test("v1.8.8 removes the navigation hover seam and keeps Find a client global", () => {
  assert.match(css, /\.compass-navigation-rail,[\s\S]*top:70px!important/);
  assert.match(css, /\.compass-corner-trigger\{[^}]*margin-bottom:-3px/s);
  assert.match(rail, /dispatchGlobalClientSearch\(\)/);
  assert.match(rail, /event\.preventDefault\(\)/);
  assert.match(rail, /compassShellActionHref\("find-client"\)/);
});

test("Client Compass uses authenticated Supabase history as its direct data source", () => {
  assert.match(bridge, /fetchAllRows<SupabaseTaskEventRow>\("task_events"/);
  assert.match(bridge, /fetchAllRows<SupabaseCallModeEventRow>\("app_events"/);
  assert.match(bridge, /sendCoordinationCallToCaptainsLogReliable/);
  assert.doesNotMatch(bridge, /client_compass_response|probeCaptainsLogCloudDesktop|captainslog:\/\//);
  assert.equal(cloud.includes("/auth/v1/token?grant_type=${grantType}"), true);
  assert.match(cloud, /rest\/v1/);
  assert.match(settings, /<h3>History connection<\/h3>/);
  assert.match(settings, /Supabase project URL/);
  assert.match(settings, /Publishable \/ anon key/);
  assert.match(settings, /Sign-in email/);
  assert.match(settings, /CompassMasterBackupSettings/);
  assert.doesNotMatch(settings, /Test desktop sync|Desktop ready|V843/);
});
