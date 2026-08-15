import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/company-technology-summary-runtime.tsx", "utf8");

test("technology summary publisher sends only approved aggregate fields", () => {
  assert.match(source, /device\.deviceType !== "physical-workstation"/);
  assert.match(source, /healthy_count:/);
  assert.match(source, /planning_count:/);
  assert.match(source, /replace_count:/);
  assert.match(source, /estimated_replacement_need:/);
  assert.match(source, /last_quote_date:/);
  assert.match(source, /snapshot_updated_at:/);
  assert.doesNotMatch(source, /device\.name|serial|ip_address|osName:/);
});

test("publisher resolves canonical company UUIDs itself before publishing", () => {
  assert.match(source, /resolveCompassCompanyIdsBulk/);
  assert.match(source, /const resolved = await resolveCompassCompanyIdsBulk\(dataset\.clients\)/);
  assert.match(source, /const resolvedId = String\(resolved\.get\(client\.id\)/);
  assert.match(source, /const companyId = isUuid\(existingId\) \? existingId : resolvedId/);
});

test("publisher verifies Supabase before caching and forces a clean v3 republish", () => {
  assert.match(source, /company_technology_summary\.v3/);
  assert.match(source, /scopedFingerprintKey\(auth\.userId, row\.company_id\)/);
  assert.match(source, /processed !== batch\.length/);
  assert.match(source, /accepted !== batch\.length/);
  assert.match(source, /Supabase technology summary publish was not confirmed/);
});

test("publisher retries when Compass returns to the foreground or network", () => {
  assert.match(source, /RETRY_POLL_MS = 30_000/);
  assert.match(source, /window\.addEventListener\("focus", trigger\)/);
  assert.match(source, /window\.addEventListener\("online", trigger\)/);
  assert.match(source, /document\.addEventListener\("visibilitychange", onVisibility\)/);
});
