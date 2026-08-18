import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dialog = fs.readFileSync(new URL("../src/components/compass-data-dialog.tsx", import.meta.url), "utf8");

test("Ninja refresh only surfaces organizations that need review", () => {
  assert.match(dialog, /reviewOrganizations\.map/);
  assert.doesNotMatch(dialog, /preview\.organizations\.map/);
  assert.match(dialog, /matched automatically/);
  assert.doesNotMatch(dialog, /Treat unresolved as new/);
});

test("Ninja review provides searchable existing-company mapping and explicit new-client creation", () => {
  assert.match(dialog, /Search existing company/);
  assert.match(dialog, /datalist id="compass-existing-company-options-v1224"/);
  assert.match(dialog, /Create new client/);
});

test("Ninja matching consults canonical Supabase company identity and preserves company IDs", () => {
  assert.match(dialog, /refreshCompanyIdentityRegistry/);
  assert.match(dialog, /normalizeUniversalCompanyName/);
  assert.match(dialog, /ensureCompanyIdentitiesForClients/);
  assert.match(dialog, /companyId: existing\.companyId \?\? client\.companyId/);
});
