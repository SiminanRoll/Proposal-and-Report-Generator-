import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const nav = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
const segmentDetail = fs.readFileSync(new URL("../src/components/segment-detail-page.tsx", import.meta.url), "utf8");
const generator = fs.readFileSync(new URL("../src/components/home-dashboard.tsx", import.meta.url), "utf8");
const backup = fs.readFileSync(new URL("../src/lib/compass/backup.ts", import.meta.url), "utf8");
const projectStore = fs.readFileSync(new URL("../src/lib/projects/store.ts", import.meta.url), "utf8");
const settings = fs.readFileSync(new URL("../src/components/compass-settings-page.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10918-polish.css", import.meta.url), "utf8");

test("segment rail hot buttons show live client count and estimated value", () => {
  assert.match(nav, /buildSegmentSnapshot/);
  assert.match(nav, /snapshot\.aggregate\.clientCount/);
  assert.match(nav, /snapshot\.aggregate\.estimatedValue/);
  assert.match(nav, /compass-segment-hot-stats/);
  assert.match(nav, /formatCompactMoney/);
});

test("segment and report lists expose sortable column headers", () => {
  assert.match(segmentDetail, /type SegmentSortKey/);
  assert.match(segmentDetail, /updateSort/);
  assert.match(segmentDetail, /compass-column-sort/);
  assert.match(segmentDetail, /sortButton\("health", "Health"\)/);
  assert.match(segmentDetail, /sortButton\("estimated", "Est\. need"\)/);
  assert.match(generator, /type HomeSortKey/);
  assert.match(generator, /sortButton\("client", "Client"\)/);
  assert.match(generator, /sortButton\("health", "Health"\)/);
  assert.match(generator, /sortButton\("updated", "Updated"\)/);
});

test("master backup includes saved reports and proposals in both backup modes", () => {
  assert.match(backup, /WORKSPACES_SHEET = "Reports & Proposals"/);
  assert.match(backup, /projects\?: Project\[\]/);
  assert.match(backup, /getProjectsSnapshot\(\)/);
  assert.match(backup, /workspacesForSheet/);
  assert.match(backup, /restoreProjectsSnapshot/);
  assert.match(backup, /projectCount/);
  assert.match(projectStore, /export function getProjectsSnapshot/);
  assert.match(projectStore, /export function restoreProjectsSnapshot/);
  assert.doesNotMatch(settings, /exportProjectsBackup|importProjectsBackup|proposal-report-workspaces/);
});

test("navigation seam fix removes vertical rail translation and covers the masthead edge", () => {
  assert.match(layout, /v10918-polish\.css/);
  assert.match(css, /\.compass-navigation-rail\{[\s\S]*top:72px!important;[\s\S]*transform:none!important/);
  assert.match(css, /box-shadow:0 -8px 0 #082f63/);
  assert.match(css, /\.compass-navigation-system\.is-expanded \.compass-corner-trigger\{[\s\S]*border-radius:0!important/);
});
