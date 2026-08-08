import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const backup = fs.readFileSync(new URL("../src/lib/compass/backup.ts", import.meta.url), "utf8");
const backupUi = fs.readFileSync(new URL("../src/components/compass-master-backup-settings.tsx", import.meta.url), "utf8");
const cloudSettings = fs.readFileSync(new URL("../src/components/captains-log-cloud-settings.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10917-backup.css", import.meta.url), "utf8");

test("master backups offer metadata-only and full inventory datasets", () => {
  assert.match(backup, /export type CompassBackupMode = "metadata" \| "full"/);
  assert.match(backup, /mode === "full" \? dataset\.devices : \[\]/);
  assert.match(backup, /mode === "full" \? dataset\.locations : \[\]/);
  assert.match(backup, /Client Compass Metadata Backup/);
  assert.match(backup, /Client Compass Full Backup/);
  assert.match(backup, /Clients/);
  assert.match(backup, /Inventory/);
  assert.match(backup, /__RESTORE__/);
});

test("metadata restore preserves current inventory and full restore replaces it", () => {
  assert.match(backup, /payload\.mode === "full"/);
  assert.match(backup, /devices: payload\.snapshot\.devices/);
  assert.match(backup, /\.\.\.current,\s*clients: restoredClients/);
  assert.match(backup, /mergedIntoExistingInventory: current\.devices\.length > 0/);
  assert.match(backup, /saveCompassConfigAndDataset/);
  assert.match(backup, /saveSegments\(payload\.segments\)/);
  assert.match(backup, /recalculateDataset/);
});

test("restore validates and previews a backup before writing it", () => {
  assert.match(backupUi, /Choose backup file/);
  assert.match(backupUi, /Nothing is written until you review the backup type and confirm the restore/);
  assert.match(backupUi, /Restore full backup/);
  assert.match(backupUi, /Restore metadata/);
  assert.match(backupUi, /window\.confirm/);
  assert.match(cloudSettings, /<CompassMasterBackupSettings \/>/);
});

test("navigation hover no longer exposes the header seam", () => {
  assert.match(layout, /v10917-backup\.css/);
  assert.match(css, /\.compass-navigation-rail\{top:75px\}/);
  assert.match(css, /\.compass-navigation-system\.is-expanded \.compass-corner-trigger\{transform:none\}/);
  assert.match(css, /@media\(max-width:820px\)\{[\s\S]*\.compass-navigation-rail\{top:71px\}/);
});
