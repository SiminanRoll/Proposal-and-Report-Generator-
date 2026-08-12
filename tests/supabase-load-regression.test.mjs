import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("routine Captain's Log sync uses compact current-state RPC before legacy fallback", async () => {
  const runtime = await readFile("src/components/captains-log-cross-device-runtime.tsx", "utf8");
  const currentState = await readFile("src/lib/compass/captains-log-current-state.ts", "utf8");
  assert.match(runtime, /syncClientsFromCompassCurrentState/);
  assert.match(runtime, /\?\? await syncClientsFromCaptainsLog/);
  assert.match(currentState, /rpc\/client_compass_current_state/);
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

test("cross-device sync asks for changed company UUIDs without downloading payload history", async () => {
  const source = await readFile("src/components/captains-log-cross-device-runtime.tsx", "utf8");
  const marker = source.indexOf("if (!cursor || cursor.fingerprint !== currentFingerprint");
  const end = source.indexOf("const nextCursor", marker);
  const baseline = source.slice(marker, end);
  assert.doesNotMatch(baseline, /refreshClients\(/);
  assert.match(source, /auto-sync\.v7/);
  assert.match(source, /rpc\/client_compass_changed_company_ids/);
  assert.match(source, /select: "event_id,inserted_at,company_id"/);
  assert.doesNotMatch(source, /select: "event_id,inserted_at,company_id,metadata"/);
  assert.doesNotMatch(source, /select: "event_id,inserted_at,company_id,payload"/);
});

test("routine identity reconciliation resolves only missing UUIDs and never downloads the full registry", async () => {
  const runtime = await readFile("src/components/company-identity-runtime.tsx", "utf8");
  const bulk = await readFile("src/lib/compass/company-identity-bulk.ts", "utf8");
  assert.match(runtime, /filter\(\(client\) => !isUuid\(client\.companyId\)\)/);
  assert.match(runtime, /resolveCompassCompanyIdsBulk/);
  assert.match(bulk, /rpc\/resolve_client_compass_companies/);
  assert.doesNotMatch(runtime, /refreshCompanyIdentityRegistry|ensureCompanyIdentitiesForClients/);
});

test("automatic Captain's Log sync preserves TC-owned Last Sales Activity", async () => {
  const runtime = await readFile("src/components/captains-log-cross-device-runtime.tsx", "utf8");
  assert.match(runtime, /lastSalesInteraction: client\.lastSalesInteraction/);
});
