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

test("v1.8.8 removes the navigation hover seam and restores direct Find a client dispatch", () => {
  assert.match(css, /\.compass-navigation-rail,[\s\S]*top:70px!important/);
  assert.match(css, /\.compass-corner-trigger\{[^}]*margin-bottom:-3px/s);
  assert.match(rail, /dispatchCompassShellAction\("find-client"\)/);
  assert.match(rail, /event\.preventDefault\(\)/);
});

test("Client Compass uses authenticated Supabase history as its direct data source", () => {
  assert.match(bridge, /fetchAllRows<SupabaseTaskEventRow>\("task_events"/);
  assert.match(bridge, /fetchAllRows<SupabaseCallModeEventRow>\("app_events"/);
  assert.match(bridge, /sendCoordinationCallToCaptainsLogReliable/);
  assert.doesNotMatch(bridge, /client_compass_response|probeCaptainsLogCloudDesktop|captainslog:\/\//);
  assert.equal(cloud.includes("/auth/v1/token?grant_type=${grantType}"), true);
  assert.match(cloud, /rest\/v1/);
  assert.match(settings, /Captain&amp;apos;s Log|Captain&apos;s Log/);
  assert.match(settings, /<h2>History connection<\/h2>/);
  assert.match(settings, /password is never stored/i);
  assert.match(settings, /shared task and Call Mode history directly from Supabase/i);
  assert.doesNotMatch(settings, /Test desktop sync|Desktop ready|V843/);
});
