import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("live content review stays isolated and browser-safe", () => {
  const data = readFileSync("src/lib/compass/content-review-live.ts", "utf8");
  const runtime = readFileSync("src/components/client-compass-runtime.tsx", "utf8");
  const page = readFileSync("src/app/content/page.tsx", "utf8");

  assert.match(data, /sb_publishable_/);
  assert.doesNotMatch(data, /service_role|SUPABASE_SERVICE_ROLE/i);
  assert.match(data, /content_reviews/);
  assert.match(data, /content-assets/);
  assert.match(data, /reviewer_user_id/);
  assert.match(data, /uploadContentAsset/);
  assert.match(runtime, /pathname === "\/content"/);
  assert.match(page, /ContentReviewWorkspace/);
});

test("ready-to-arm remains a handoff state, not a publisher", () => {
  const data = readFileSync("src/lib/compass/content-review-live.ts", "utf8");
  assert.match(data, /publishing_status: "ready_to_arm"/);
  assert.doesNotMatch(data, /leadconnector|gohighlevel|social planner/i);
});
