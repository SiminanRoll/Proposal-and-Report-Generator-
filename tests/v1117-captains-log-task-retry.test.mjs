import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/components/client-tracked-action.tsx", import.meta.url), "utf8");

test("Captain's Log outreach task creation retries transient fetch failures without changing request identity", () => {
  assert.match(source, /NETWORK_RETRY_DELAYS_MS/);
  assert.match(source, /failed to fetch\|networkerror\|network request failed\|load failed\|fetch failed/i);
  assert.match(source, /sendCoordinationCallWithRetry\(request\)/);
  assert.match(source, /same requestId across attempts/i);
  assert.match(source, /idempotent on event_id/i);
  assert.match(source, /queueCaptainsLogTask\(request\)/);
  assert.match(source, /Saved locally\. It will sync to Captain's Log automatically/);
});
