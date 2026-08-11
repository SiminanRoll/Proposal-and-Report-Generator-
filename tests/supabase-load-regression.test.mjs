import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("routine Captain's Log sync never loads the full historical ledger", async () => {
  const source = await readFile("src/lib/compass/captains-log-bridge.ts", "utf8");
  const syncStart = source.indexOf("export async function syncClientFromCaptainsLog");
  const mergeStart = source.indexOf("export async function sendCoordinationCallToCaptainsLogReliable");
  const routine = source.slice(syncStart, mergeStart);
  assert.match(routine, /loadSupabaseLedgerForCompanyIds/);
  assert.doesNotMatch(routine, /loadSupabaseLedger\(/);
  assert.match(source, /company_id: companyFilter/);
  assert.match(source, /order: "inserted_at\.asc,event_id\.asc"/);
});

test("automatic durable protection does not post a cloud snapshot on every local save", async () => {
  const source = await readFile("src/components/durable-storage-runtime.tsx", "utf8");
  assert.match(source, /CLOUD_SAVE_INTERVAL_MS = 30 \* 60_000/);
  assert.match(source, /saveDurableDatabaseMirrorNow\(\)/);
  assert.match(source, /cloudDirty/);
  assert.doesNotMatch(source, /Promise\.allSettled/);
});

test("Add task skips the redundant connection preflight", async () => {
  const source = await readFile("src/components/client-tracked-action.tsx", "utf8");
  assert.doesNotMatch(source, /verifyCaptainsLogTaskConnection/);
  assert.match(source, /writeCoordinationTaskToCaptainsLog\(request\)/);
});

test("cross-device startup establishes a baseline without rebuilding every client", async () => {
  const source = await readFile("src/components/captains-log-cross-device-runtime.tsx", "utf8");
  const marker = source.indexOf("if (!cursor || cursor.fingerprint !== currentFingerprint");
  const end = source.indexOf("const nextCursor", marker);
  const baseline = source.slice(marker, end);
  assert.doesNotMatch(baseline, /refreshClients\(/);
  assert.match(source, /auto-sync\.v6/);
});
