import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const { ninjaCompanyMatchKey, uniqueNinjaClientMatch, applyRememberedNinjaOrganizationMappings, NINJA_ORGANIZATION_MAP_KEY } = await transpileTestModule(
  "../src/lib/compass/ninja-company-matching.ts",
  import.meta.url,
  { prefix: "v1227-ninja-match" },
);

const pairs = [
  ["Blumenthal, Peter T.DMD", "Blumenthal, Peter T. DMD"],
  ["Bonnie P.Patel, DDS, P.C.", "Bonnie P. Patel, DDS, P.C."],
  ["Chamberland Dentistry, P.C.", "Chamberland Dentistry, P. C."],
  ["Dr Jerrold W.Smith", "Dr Jerrold W. Smith"],
  ["Dr.Brandon Schmidt", "Dr. Brandon Schmidt"],
  ["Dr.Geoff Bennett", "Dr. Geoff Bennett"],
  ["Dr.Josh Tillinger", "Dr. Josh Tillinger"],
  ["Dr.Parker Family Dentistry", "Dr. Parker Family Dentistry"],
  ["H.Meigan Miller, D.M.D., Family Dentistry", "H. Meigan Miller, D.M.D., Family Dentistry"],
  ["J.Andrew Ramsey, DMD", "J. Andrew Ramsey, DMD"],
  ["Jeffrey L.Hardenburg D.D.S.", "Jeffrey L. Hardenburg D.D.S."],
  ["Laurie B.Patrick, DMD", "Laurie B. Patrick, DMD"],
  ["Michael D.Vaughan, D.D.S.", "Michael D. Vaughan, D.D.S."],
  ["Okoniewski, Gregory M.DDS", "Okoniewski, Gregory M. DDS"],
  ["Peterson Orthodontics, LTD.Wilmette", "Peterson Orthodontics, LTD. Wilmette"],
  ["Pine, Gregory J.DDS", "Pine, Gregory J. DDS"],
  ["Smiley Face Orthodontics (Dr.Benjamin Burris DDS)", "Smiley Face Orthodontics (Dr. Benjamin Burris DDS)"],
  ["St.Augustine Oral & Facial Surgical Center", "St. Augustine Oral & Facial Surgical Center"],
  ["Timothy T.Ryan, DDS & Associates SC", "Timothy T. Ryan, DDS & Associates SC"],
  ["William M.Shows DMD", "William M. Shows DMD"],
];

test("the recurring Ninja punctuation variants resolve to the same company key", () => {
  for (const [ninjaName, compassName] of pairs) {
    assert.equal(ninjaCompanyMatchKey(ninjaName), ninjaCompanyMatchKey(compassName), `${ninjaName} should match ${compassName}`);
    assert.equal(uniqueNinjaClientMatch(ninjaName, [{ id: "target", name: compassName, aliases: [] }]), "target");
  }
});

test("ambiguous compact matches are never guessed", () => {
  assert.equal(uniqueNinjaClientMatch("Dr.Brandon Schmidt", [
    { id: "a", name: "Dr. Brandon Schmidt", aliases: [] },
    { id: "b", name: "Dr Brandon Schmidt", aliases: [] },
  ]), null);
});

test("remembered Ninja mappings resolve only to client IDs that still exist", () => {
  const values = new Map([[NINJA_ORGANIZATION_MAP_KEY, JSON.stringify({ [ninjaCompanyMatchKey("Dr.Brandon Schmidt")]: "client-brandon" })]]);
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  };
  const base = { "Dr.Brandon Schmidt": { mode: "unresolved" } };
  const resolved = applyRememberedNinjaOrganizationMappings(base, { clients: [{ id: "client-brandon" }] });
  assert.deepEqual(resolved["Dr.Brandon Schmidt"], { mode: "existing", clientId: "client-brandon" });
  const stale = applyRememberedNinjaOrganizationMappings(base, { clients: [{ id: "different-client" }] });
  assert.deepEqual(stale["Dr.Brandon Schmidt"], { mode: "unresolved" });
  delete globalThis.window;
});

test("dialog resolves the import preview keys rather than raw spreadsheet strings", () => {
  const dialog = fs.readFileSync(new URL("../src/components/compass-data-dialog.tsx", import.meta.url), "utf8");
  assert.match(dialog, /for \(const \[organization, resolution\] of Object\.entries\(next\)\)/);
  assert.match(dialog, /Object\.keys\(resolutions\)/);
  assert.match(dialog, /applyRememberedNinjaOrganizationMappings/);
  assert.match(dialog, /rememberNinjaOrganizationMappings/);
});

test("canonical alias freshness requires the literal learned Ninja alias", () => {
  const identity = fs.readFileSync(new URL("../src/lib/compass/company-identity.ts", import.meta.url), "utf8");
  assert.match(identity, /function exactAliasKey/);
  assert.match(identity, /knownExactAliases/);
  assert.match(identity, /every\(\(alias\) => knownExactAliases\.has\(alias\)\)/);
});
