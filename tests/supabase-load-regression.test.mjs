import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("routine Captain's Log sync uses compact current-state RPC before legacy fallback", async () => {
  const runtime = await readFile("src/components/compass-sync-runtime.tsx", "utf8");
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

test("one Compass sync coordinator owns background cloud reconciliation", async () => {
  const runtime = await readFile("src/components/compass-sync-runtime.tsx", "utf8");
  const root = await readFile("src/components/client-compass-runtime.tsx", "utf8");
  assert.match(root, /CompassSyncRuntime/);
  assert.doesNotMatch(root, /CompanyIdentityRuntime|CompanyRelationshipRuntime|CaptainsLogCrossDeviceRuntime|ReviewStateRuntime/);
  assert.equal((runtime.match(/window\.addEventListener\("focus"/g) || []).length, 1);
  assert.equal((runtime.match(/window\.addEventListener\("online"/g) || []).length, 1);
  assert.equal((runtime.match(/document\.addEventListener\("visibilitychange"/g) || []).length, 1);
  assert.match(runtime, /const TICK_MS = 60_000/);
  assert.match(runtime, /let inFlight = false/);
  assert.match(runtime, /let queued = false/);
  assert.match(runtime, /if \(datasetChanged\) await saveCompassDataset\(dataset\)/);
});

test("cross-device sync asks for changed company UUIDs without downloading payload history", async () => {
  const source = await readFile("src/components/compass-sync-runtime.tsx", "utf8");
  const marker = source.indexOf("if (!cursor || cursor.fingerprint !== currentFingerprint");
  const end = source.indexOf("const nextCursor", marker);
  const baseline = source.slice(marker, end);
  assert.doesNotMatch(baseline, /refreshCaptainsLogClients\(/);
  assert.match(source, /auto-sync\.v7/);
  assert.match(source, /rpc\/client_compass_changed_company_ids/);
  assert.match(source, /select: "event_id,inserted_at,company_id"/);
  assert.doesNotMatch(source, /select: "event_id,inserted_at,company_id,metadata"/);
  assert.doesNotMatch(source, /select: "event_id,inserted_at,company_id,payload"/);
});

test("routine identity reconciliation resolves only missing UUIDs through the bulk resolver", async () => {
  const runtime = await readFile("src/components/compass-sync-runtime.tsx", "utf8");
  const bulk = await readFile("src/lib/compass/company-identity-bulk.ts", "utf8");
  assert.match(runtime, /filter\(\(client\) => !isUuid\(client\.companyId\)\)/);
  assert.match(runtime, /resolveCompassCompanyIdsBulk/);
  assert.match(bulk, /rpc\/resolve_client_compass_companies/);
  assert.doesNotMatch(runtime, /refreshCompanyIdentityRegistry|ensureCompanyIdentitiesForClients/);
});

test("review state is coordinated and its cloud writes finish inside the shared pass", async () => {
  const runtime = await readFile("src/components/compass-sync-runtime.tsx", "utf8");
  assert.match(runtime, /loadCloudReviewStates/);
  assert.match(runtime, /Promise\.allSettled\(publishes\)/);
  assert.match(runtime, /saveWorkbenchState/);
});

test("automatic Captain's Log sync preserves TC-owned sales coverage fields", async () => {
  const runtime = await readFile("src/components/compass-sync-runtime.tsx", "utf8");
  assert.match(runtime, /lastSalesInteraction: client\.lastSalesInteraction/);
  assert.match(runtime, /technicalConsultant: client\.technicalConsultant/);
});
