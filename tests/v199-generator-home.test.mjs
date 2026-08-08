import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard = fs.readFileSync(new URL("../src/components/home-dashboard.tsx", import.meta.url), "utf8");
const settings = fs.readFileSync(new URL("../src/components/compass-settings-page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/generator-home-v199.css", import.meta.url), "utf8");
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("v1.0.9.16 replaces the legacy generator hero with a compact landing header", () => {
  assert.equal(pkg.version, "1.0.9.16");
  assert.match(dashboard, /generator-home-header/);
  assert.match(dashboard, /<h1>Report Generator<\/h1>/);
  assert.match(dashboard, /generator-create-grid/);
  assert.doesNotMatch(dashboard, /hero-panel|hero-orbit|Private browser workspace/);
});

test("v1.0.9.16 uses current report and proposal language in the recent list", () => {
  assert.match(dashboard, /Recent[\s\S]*Reports &amp; proposals/);
  assert.match(dashboard, /Technology Review/);
  assert.match(dashboard, /Advantage 360/);
  assert.match(dashboard, /Proposal Update/);
  assert.match(dashboard, /Ready to tailor/);
  assert.doesNotMatch(dashboard, /Recent workspaces|Search workspaces|Package ready|Open workspace|Delete workspace/);
});

test("v1.0.9.16 moves report and proposal backup controls into Settings", () => {
  assert.doesNotMatch(dashboard, /exportProjectsBackup|importProjectsBackup|Download local backup|Restore backup/);
  assert.match(settings, /exportProjectsBackup, importProjectsBackup/);
  assert.match(settings, /Backup &amp; restore/);
  assert.match(settings, />Download backup</);
  assert.match(settings, />Restore backup</);
});

test("v1.0.9.16 keeps the generator dense on desktop", () => {
  assert.match(css, /\.generator-dashboard-v199\{gap:22px/);
  assert.match(css, /\.generator-create-card\{min-height:76px/);
  assert.match(css, /\.generator-project-row\{min-height:58px/);
});
