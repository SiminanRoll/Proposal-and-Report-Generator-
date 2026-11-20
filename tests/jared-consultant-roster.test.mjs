import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const src = read("src/lib/outcomes/consultant-contacts.ts");
const scheduler = read("src/components/onsite-planning-scheduler.tsx");
const settings = read("src/components/compass-consultant-settings-page.tsx");

function runtime(initial = null, migrationKeys = []) {
  const entries = new Map(initial === null ? [] : [["client-compass.consultant-contacts.v1", JSON.stringify(initial)]]);
  migrationKeys.forEach((key) => entries.set("client-compass.consultant-contacts." + key, "1"));
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, String(value)); },
    removeItem: (key) => { entries.delete(key); },
  };
  const window = { localStorage: storage, dispatchEvent: () => {} };
  const js = ts.transpileModule(src, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }}).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "window", "Event", js)(module, module.exports, window, Event);
  return { api: module.exports, entries };
}

test("Jared Kellicker is in default roster with verified Central Florida scope", () => {
  const { api } = runtime();
  const jared = api.DEFAULT_CONSULTANT_CONTACTS.find((row) => row.name === "Jared Kellicker");
  assert.deepEqual(jared, { name: "Jared Kellicker", role: "Technology Consultant", region: "Central Florida" });
  assert.equal(api.loadConsultantContacts().filter((row) => row.name === "Jared Kellicker").length, 1);
  assert.equal(api.consultantContactFor("Jared Kellicker").region, "Central Florida");
  assert.match(scheduler, /loadConsultantContacts\(\)/);
  assert.match(scheduler, /contact\.region \? ` · \$\{contact\.region\}`/);
  assert.match(scheduler, /value=\{contact\.name\}/);
  assert.match(settings, /<span>Service area<\/span>/);
  assert.match(settings, /region: event\.target\.value/);
});

test("saved v1 roster with Gabriel migration complete receives Jared once, without changing other consultant records", () => {
  const previous = [
    { name: "Gabriel Chittick", aliases: ["Gabe Chittick"], role: "Technology Consultant", email: "existing@example.org" },
    { name: "Marty Goldmintz", role: "Technology Consultant", phone: "verified direct line" },
  ];
  const { api, entries } = runtime(previous, ["gabriel-v1"]);
  const migrated = api.loadConsultantContacts();
  assert.equal(migrated.length, 3);
  assert.equal(migrated.find((row) => row.name === "Jared Kellicker").region, "Central Florida");
  assert.equal(migrated.find((row) => row.name === "Marty Goldmintz").phone, "verified direct line");
  assert.equal(migrated.find((row) => row.name === "Gabriel Chittick").email, "existing@example.org");
  assert.equal(entries.get("client-compass.consultant-contacts.jared-v1"), "1");
  assert.equal(api.loadConsultantContacts().filter((row) => row.name === "Jared Kellicker").length, 1);
});

test("previously user-added Jared keeps their calendar contact, and missing service region is not overwritten", () => {
  const previous = [
    { name: "Jared Kellicker", role: "Senior Technology Consultant", phone: "verified extension", email: "person@example.org", calendarEmail: "calendar@example.org" },
    { name: "Gabriel Chittick", role: "Technology Consultant" },
  ];
  const { api } = runtime(previous, ["gabriel-v1"]);
  const roster = api.loadConsultantContacts();
  assert.equal(roster.length, 2);
  const jared = roster.find((row) => row.name === "Jared Kellicker");
  assert.equal(jared.calendarEmail, "calendar@example.org");
  assert.equal(jared.email, "person@example.org");
  assert.equal(jared.role, "Senior Technology Consultant");
  assert.equal(jared.phone, "verified extension");
  assert.equal(jared.region, undefined);
});

test("after migration, Jared can be intentionally removed and restored using reset to defaults", () => {
  const { api, entries } = runtime([{ name: "Chris Beadle", role: "Senior Technology Consultant" }], ["gabriel-v1"]);
  const added = api.loadConsultantContacts();
  assert.ok(added.some((item) => item.name === "Jared Kellicker"));
  api.saveConsultantContacts(added.filter((item) => item.name !== "Jared Kellicker"));
  assert.equal(api.loadConsultantContacts().some((row) => row.name === "Jared Kellicker"), false);
  const restored = api.resetConsultantContacts();
  assert.equal(restored.filter((row) => row.name === "Jared Kellicker").length, 1);
  assert.equal(entries.has("client-compass.consultant-contacts.jared-v1"), false);
  assert.equal(api.loadConsultantContacts().filter((row) => row.name === "Jared Kellicker").length, 1);
});
