import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
const currentState = fs.readFileSync(new URL("../src/lib/compass/captains-log-current-state.ts", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/compass-client-review-workspace-v10941.tsx", import.meta.url), "utf8");
const wrapper = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10941-client-review.css", import.meta.url), "utf8");

test("client task state uses canonical public.tasks without desktop acknowledgement", () => {
  assert.match(bridge, /syncClientsFromCompassCurrentState/);
  assert.match(currentState, /"GET", "tasks"/);
  assert.doesNotMatch(currentState, /task_events|app_events|client_compass_response|127\.0\.0\.1|captainslog:\/\//);
});

test("client review uses one dedicated working vertical scroll surface", () => {
  assert.match(wrapper, /import \{ CompassClientReviewWorkspaceV10941 \}/);
  assert.match(wrapper, /<CompassClientReviewWorkspaceV10941/);
  assert.match(workspace, /className="client-review-scroll-v10941"/);
  assert.match(css, /\.client-review-scroll-v10941\{[\s\S]*?overflow-y:auto!important/);
});

test("client header exposes Quick Present for the active client", () => {
  assert.match(workspace, /requestQuickPresent\(client\.id\)/);
  assert.match(workspace, /Present report/);
});
