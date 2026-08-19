import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const recoveryUi = fs.readFileSync(new URL("../src/components/compass-master-backup-settings.tsx", import.meta.url), "utf8");
const projectStore = fs.readFileSync(new URL("../src/lib/projects/store.ts", import.meta.url), "utf8");

test("backup and restore accepts additive workspace recovery JSON", () => {
  assert.match(recoveryUi, /importProjectsBackup/);
  assert.match(recoveryUi, /advantage-proposal-report-generator-backup/);
  assert.match(recoveryUi, /\.xlsx,\.json/);
  assert.match(recoveryUi, /Workspace recovery/);
  assert.match(recoveryUi, /Import recovered workspace/);
});

test("workspace recovery explicitly preserves the main Compass database", () => {
  assert.match(recoveryUi, /Existing clients, inventory, activity, segments, settings, map state, and other workspaces will be preserved/);
  assert.match(recoveryUi, /Additive import — your existing Client Compass database is preserved/);
  assert.match(recoveryUi, /refreshProjects\(\)/);
});

test("workspace import merges projects instead of replacing the project store", () => {
  assert.match(projectStore, /const merged = new Map\(safeRead\(\)\.map/);
  assert.match(projectStore, /merged\.set\(project\.id, project\)/);
  assert.match(projectStore, /write\(\[\.\.\.merged\.values\(\)\]\)/);
});
