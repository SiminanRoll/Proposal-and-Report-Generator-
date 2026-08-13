import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const activity = fs.readFileSync(new URL("../src/components/client-activity-runtime.tsx", import.meta.url), "utf8");
const currentState = fs.readFileSync(new URL("../src/lib/compass/captains-log-current-state.ts", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/components/client-workspace-layout-runtime.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/company-details-layout.css", import.meta.url), "utf8");

test("Company Detail never leaves an unmatched response stuck on loading", () => {
  assert.match(activity, /if \(!sync\.ok\)[\s\S]*setActivityLoadState\("error"\)/);
  assert.match(activity, /setActivityLoadState\("loaded"\)/);
  assert.match(activity, /No Supabase company link was resolved/);
  assert.match(activity, /client-review-activity-diagnostic-v1168/);
});

test("empty UUID state gets one bounded exact-company compatibility read", () => {
  assert.match(activity, /loadSelectedCompanyActivityByName\(client\.name\)/);
  assert.match(currentState, /company: `eq\.\$\{company\}`/);
  assert.match(currentState, /limit: "24"/);
  assert.doesNotMatch(currentState, /loadSelectedCompanyActivityByName[\s\S]*offset|loadSelectedCompanyActivityByName[\s\S]*setInterval/);
});

test("Company Detail cards drag directly with a ghost and snap target", () => {
  assert.match(layout, /company-layout-grab-handle-v1168/);
  assert.match(layout, /setDragImage\(node/);
  assert.match(layout, /is-company-layout-dragging-v1168/);
  assert.match(layout, /is-company-layout-drop-target-v1168/);
  assert.match(layout, /order: moveKey\(current\.order, source, key\)/);
  assert.match(css, /is-company-layout-dragging-v1168[\s\S]*opacity:\.34/);
  assert.match(css, /is-company-layout-drop-target-v1168[\s\S]*outline:2px dashed/);
});
