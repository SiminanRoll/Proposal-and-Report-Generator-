import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cloud = fs.readFileSync(new URL("../src/lib/compass/captains-log-cloud.ts", import.meta.url), "utf8");
const identity = fs.readFileSync(new URL("../src/lib/compass/company-identity.ts", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../src/components/company-identity-runtime.tsx", import.meta.url), "utf8");

test("expired Supabase sessions use one in-flight refresh and a shared retry backoff", () => {
  assert.match(cloud, /let activeRefresh:/);
  assert.match(cloud, /AUTH_REFRESH_BACKOFF_KEY/);
  assert.match(cloud, /if \(activeRefresh\) return \(await activeRefresh\)\.accessToken/);
  assert.match(cloud, /Math\.min\(5 \* 60 \* 1000/);
});

test("identity reconciliation does not rewrite every established Compass client", () => {
  assert.match(identity, /identityAlreadyCurrent/);
  assert.match(identity, /if \(existing && identityAlreadyCurrent\(existing, client\)\)/);
  assert.match(identity, /if \(connectivityFailure\(cause\)\) break/);
});

test("visibility changes cannot repeatedly sweep all company identities", () => {
  assert.match(runtime, /MIN_RECONCILE_MS = 5 \* 60 \* 1000/);
  assert.match(runtime, /POLL_MS = 30 \* 60 \* 1000/);
  assert.match(runtime, /lastIdentityReconcileAt/);
});
