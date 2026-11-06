import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GHL_LOCAL_RECOVERY_KEYS, missingGhlStateFromBackup,
} from "../src/lib/compass/ghl-local-workspace-recovery.mjs";

const credsKey = GHL_LOCAL_RECOVERY_KEYS[0];
const mapKey = GHL_LOCAL_RECOVERY_KEYS[1];
const ledgerKey = GHL_LOCAL_RECOVERY_KEYS[2];
const tzKey = GHL_LOCAL_RECOVERY_KEYS[3];
const old = JSON.stringify({
  token: "test-only-not-real-token-123456789",
  locationId: "EHEhS0N72GQuZrYYzyAJ",
  assigneeId: "assigned-user-0001",
});
test("Protected Workspace restores absent GHL connection, contact links and retry ledger", () => {
  const saved = {
    [credsKey]: old,
    [mapKey]: JSON.stringify({ client1: { companyName: "Sample", contactId: "contact-0001" } }),
    [ledgerKey]: JSON.stringify({ request1: "pending" }),
    [tzKey]: "America/Chicago",
    "client-compass.configuration.v1": "SHOULD NOT RESTORE",
  };
  const restored = missingGhlStateFromBackup({}, saved);
  assert.deepEqual(restored, Object.fromEntries(
    Object.entries(saved).filter(([key]) => GHL_LOCAL_RECOVERY_KEYS.includes(key))
  ));
});

test("Local GHL state always wins over an older Protected Workspace copy", () => {
  const current = {
    [credsKey]: "NEWER TOKEN",
    [mapKey]: "{}",
    [ledgerKey]: JSON.stringify({ request1: "created:task-123" }),
  };
  const saved = {
    [credsKey]: old,
    [mapKey]: JSON.stringify({ client1: "stale" }),
    [ledgerKey]: JSON.stringify({ request1: "pending" }),
    [tzKey]: "America/Chicago",
  };
  assert.deepEqual(missingGhlStateFromBackup(current, saved), { [tzKey]: "America/Chicago" });
});

test("Corrupt, incomplete, and unknown Work Folder values do not become GHL settings", () => {
  const values = {
    [credsKey]: JSON.stringify({ token: "too-short", locationId: "bad", assigneeId: "" }),
    [mapKey]: "not json",
    [ledgerKey]: "[]",
    [tzKey]: "Not_A_Timezone",
    "client-compass.ghl-private-backdoor": "anything",
  };
  assert.deepEqual(missingGhlStateFromBackup({}, values), {});
  assert.deepEqual(missingGhlStateFromBackup({}, undefined), {});
});

test("Add Task auto-hydrates the connected Work Folder and hides setup after recovery", () => {
  const folder = readFileSync("src/lib/compass/durable-storage.ts", "utf8");
  const panel = readFileSync("src/components/ghl-local-connection-panel.tsx", "utf8");
  const settings = readFileSync("src/components/compass-master-backup-settings.tsx", "utf8");
  const dialog = readFileSync("src/components/ghl-task-preflight-dialog.tsx", "utf8");
  assert.match(folder, /restoreMissingGhlSettingsFromProtectedWorkspace/);
  assert.match(folder, /restoreMissingGhlSettings\(candidate\.snapshot\.browserState\)/);
  assert.match(panel, /await restoreMissingGhlSettingsFromProtectedWorkspace\(\)/);
  assert.match(panel, /if \(hydrating\) return null/);
  assert.match(panel, /!showSettingsControl && !connection/);
  assert.match(panel, /href="\/settings\/recovery\/"/);
  assert.match(panel, /connection && !editing && !showSettingsControl/);
  assert.match(settings, /showSettingsControl/);
  assert.match(dialog, /Add Task/);
  assert.doesNotMatch(dialog, /Run offline preflight|confirmCreate/);
});
