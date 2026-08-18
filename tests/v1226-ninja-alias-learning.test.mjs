import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dialog = fs.readFileSync(new URL("../src/components/compass-data-dialog.tsx", import.meta.url), "utf8");
const identity = fs.readFileSync(new URL("../src/lib/compass/company-identity.ts", import.meta.url), "utf8");

test("Ninja matching ignores punctuation and spacing when the result is unique", () => {
  assert.match(dialog, /function punctuationInsensitiveCompanyKey/);
  assert.match(dialog, /normalizeUniversalCompanyName\(value\)\.replace\(\/\[\^a-z0-9\]\+\/g, ""\)/);
  assert.match(dialog, /compactNames\.includes\(compact\)/);
  assert.match(dialog, /identityNames\.map\(punctuationInsensitiveCompanyKey\)/);
});

test("manual Ninja mappings are explicitly learned as client aliases", () => {
  assert.match(dialog, /reviewedAliasesByClient/);
  assert.match(dialog, /aliases\.push\(organization\)/);
  assert.match(dialog, /const learnedAliases = reviewedAliasesByClient\.get\(client\.id\) \?\? \[\]/);
  assert.match(dialog, /const aliases = \[\.\.\.new Set/);
});

test("learned aliases are sent through the canonical Supabase company identity writer", () => {
  assert.match(dialog, /ensureCompanyIdentitiesForClients\(canonicalClients\)/);
  assert.match(identity, /p_aliases: unique\(client\.aliases \?\? \[\]\)/);
});
