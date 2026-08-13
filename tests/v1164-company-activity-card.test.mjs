import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const layout = fs.readFileSync(new URL("../src/components/client-workspace-layout-runtime.tsx", import.meta.url), "utf8");
const layoutCss = fs.readFileSync(new URL("../src/app/company-details-layout.css", import.meta.url), "utf8");
const activity = fs.readFileSync(new URL("../src/components/client-activity-runtime.tsx", import.meta.url), "utf8");
const history = fs.readFileSync(new URL("../src/lib/compass/captains-log-company-history.ts", import.meta.url), "utf8");

test("Company Detail visibility choices override forced responsive card display", () => {
  assert.match(layout, /classList\.toggle\("is-company-layout-hidden-v1164", !visible\)/);
  assert.match(layoutCss, /\.is-company-layout-hidden-v1164\s*\{[\s\S]*display:none!important/);
});

test("opening Company Detail loads and persists the same completed activity as refresh", () => {
  assert.match(activity, /void syncCompanyActivity\(client\)/);
  assert.match(activity, /persistCompanyActivitySync\(client\.id, sync, config\)/);
  assert.match(activity, /const sync = await syncCompanyActivity\(client\)/);
  assert.match(activity, /await persistActivitySync\(sync\)/);
});

test("Company Detail reuses Workbench task identity and all supported completion states", () => {
  assert.match(activity, /client\.captainsLog\?\.openTasks/);
  assert.match(activity, /client\.captainsLog\?\.recentActivity/);
  assert.match(activity, /\["completed", "done", "closed", "resolved"\]/);
  assert.match(history, /knownTaskIdValues/);
  assert.match(history, /\.\.\.knownTaskIds/);
});
