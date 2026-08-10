import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/compass-client-review-workspace-v10941.tsx", import.meta.url), "utf8");
const wrapper = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10941-client-review.css", import.meta.url), "utf8");

test("client history still uses the shared Supabase ledger without a desktop acknowledgement path", () => {
  assert.match(bridge, /fetchAllRows<SupabaseTaskEventRow>\("task_events"/);
  assert.match(bridge, /fetchAllRows<SupabaseCallModeEventRow>\("app_events"/);
  assert.doesNotMatch(bridge, /desktopVersion|Open V843|probeCaptainsLogCloudDesktop|client_compass_response|127\.0\.0\.1|captainslog:\/\//);
});

test("v1.0.9.41 client review uses one dedicated working vertical scroll surface", () => {
  assert.match(wrapper, /import \{ CompassClientReviewWorkspaceV10941 \}/);
  assert.match(wrapper, /<CompassClientReviewWorkspaceV10941/);
  assert.match(workspace, /className="client-review-scroll-v10941"/);
  assert.match(css, /\.client-review-scroll-v10941\{[\s\S]*?flex:1 1 auto;[\s\S]*?overflow-y:auto!important;[\s\S]*?scrollbar-gutter:stable/);
  assert.match(css, /\.client-review-scroll-v10941::-webkit-scrollbar\{width:9px\}/);
});

test("v1.0.9.41 client header exposes Quick Present for the active client", () => {
  assert.match(workspace, /requestQuickPresent\(client\.id\)/);
  assert.match(workspace, /Present report/);
  assert.match(workspace, /compass-client-present-button/);
});
