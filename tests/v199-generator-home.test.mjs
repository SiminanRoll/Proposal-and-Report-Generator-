import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard = fs.readFileSync(new URL("../src/components/home-dashboard.tsx", import.meta.url), "utf8");
const settings = fs.readFileSync(new URL("../src/components/compass-settings-page.tsx", import.meta.url), "utf8");
const masterBackup = fs.readFileSync(new URL("../src/components/compass-master-backup-settings.tsx", import.meta.url), "utf8");
const backupEngine = fs.readFileSync(new URL("../src/lib/compass/backup.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/generator-home-v199.css", import.meta.url), "utf8");
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("Client Compass 1.1.0 keeps the compact generator landing header", () => {
  assert.equal(pkg.version, "1.1.0");
  assert.match(dashboard, /generator-home-header/);
  assert.match(dashboard, /<h1>Report Generator<\/h1>/);
  assert.match(dashboard, /generator-create-grid/);
  assert.doesNotMatch(dashboard, /hero-panel|hero-orbit|Private browser workspace/);
});

test("generator uses current report and proposal language in the recent list", () => {
  assert.match(dashboard, /Recent[\s\S]*Reports &amp; proposals/);
  assert.match(dashboard, /Technology Review/);
  assert.match(dashboard, /Advantage 360/);
  assert.match(dashboard, /Proposal Update/);
  assert.match(dashboard, /Ready to tailor/);
  assert.doesNotMatch(dashboard, /Recent workspaces|Search workspaces|Package ready|Open workspace|Delete workspace/);
});

test("report and proposal workspaces use the unified master backup", () => {
  assert.doesNotMatch(dashboard, /exportProjectsBackup|importProjectsBackup|Download local backup/);
  assert.doesNotMatch(settings, /exportProjectsBackup|importProjectsBackup|proposal-report-workspaces/);
  assert.match(masterBackup, /<h3>Backup &amp; restore<\/h3>/);
  assert.match(masterBackup, /Clients · activity · segments · workspaces · settings · map state/);
  assert.match(masterBackup, /Download metadata/);
  assert.match(masterBackup, /Download full backup/);
  assert.match(backupEngine, /WORKSPACES_SHEET = "Reports & Proposals"/);
  assert.match(backupEngine, /restoreProjectsSnapshot/);
});

test("generator remains dense on desktop", () => {
  assert.match(css, /\.generator-dashboard-v199\{gap:22px/);
  assert.match(css, /\.generator-create-card\{min-height:76px/);
  assert.match(css, /\.generator-project-row\{min-height:58px/);
});
