import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace = fs.readFileSync(new URL("../src/components/compass-client-review-workspace-v10941.tsx", import.meta.url), "utf8");
const wrapper = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10941-client-review.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

test("v1.0.9.41 replaces the old CRM panes with one Client Review workspace", () => {
  assert.match(wrapper, /CompassClientReviewWorkspaceV10941 as CompassClientWorkspace/);
  assert.match(workspace, /<h2 id="compass-client-workspace-title">\{client\.name\}<\/h2>/);
  assert.match(workspace, />Client Review</);
  assert.match(workspace, />Account Review Outcome</);
  assert.match(workspace, />Upcoming needs</);
  assert.match(workspace, />Technical overview</);
  assert.doesNotMatch(workspace, />Next follow-up</);
  assert.doesNotMatch(workspace, />Captain's Log</);
});

test("primary contact stays compact until clicked and latest activity is a single glance row", () => {
  assert.match(workspace, /client-review-contact-card-v10941/);
  assert.match(workspace, /setContactOpen\(\(open\) => !open\)/);
  assert.match(workspace, /\{contactOpen && <section className="client-review-contact-editor-v10941"/);
  assert.match(workspace, /client-review-latest-activity-v10941/);
  assert.match(workspace, /const latestActivity = activityHistory\[0\]/);
  assert.doesNotMatch(workspace, /compass-captains-log-activity-list/);
});

test("activity refresh bypasses the cached single-client path and completed status wins duplicate activity", () => {
  assert.match(workspace, /syncClientsFromCaptainsLog\(\[\{ clientId: client\.id, company: client\.name, aliases: client\.aliases \}\], 9000\)/);
  assert.match(workspace, /function resolvedActivityHistory/);
  assert.match(workspace, /incomingRank > existingRank/);
  assert.match(workspace, /if \(item\.completed_at \|\| status === "completed" \|\| status === "done"\) return "completed"/);
});

test("client review owns a working vertical scroll surface", () => {
  assert.match(css, /\.client-review-scroll-v10941\{/);
  assert.match(css, /overflow-y:auto!important/);
  assert.match(css, /flex:1 1 auto/);
  assert.match(css, /scrollbar-width:thin/);
});

test("v1.0.9.41 client review styles remain loaded before current map overrides", () => {
  assert.match(layout, /v10941-client-review\.css";\nimport "\.\/v10942-map-hero\.css";\nimport "\.\/v10943-map-layout\.css";\nimport "\.\/v10944-segment-toggle\.css"/);
  assert.match(version, /APP_VERSION = "1\.0\.9\.44"/);
});
