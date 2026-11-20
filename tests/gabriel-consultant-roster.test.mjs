import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const source = read("src/lib/outcomes/consultant-contacts.ts");
const scheduler = read("src/components/onsite-planning-scheduler.tsx");
const settings = read("src/components/compass-consultant-settings-page.tsx");

function runtime(saved = null) {
  const entries = new Map(saved === null ? [] : [["client-compass.consultant-contacts.v1", JSON.stringify(saved)]]);
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, String(value)); },
    removeItem: (key) => { entries.delete(key); },
  };
  const window = { localStorage: storage, dispatchEvent: () => {} };
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }}).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "window", "Event", js)(module, module.exports, window, Event);
  return { contacts: module.exports, entries };
}

test("Gabriel Chittick is a default scheduling option with no invented contact details", () => {
  const { contacts } = runtime();
  const gabriel = contacts.DEFAULT_CONSULTANT_CONTACTS.find((row) => row.name === "Gabriel Chittick");
  assert.deepEqual(gabriel, { name: "Gabriel Chittick", aliases: ["Gabe Chittick"], role: "Technology Consultant" });
  assert.equal(contacts.loadConsultantContacts().filter((row) => row.name === "Gabriel Chittick").length, 1);
  assert.match(scheduler, /loadConsultantContacts\(\)/);
  assert.match(scheduler, /consultantOptions\.map\(\(contact\) =>/);
  assert.match(settings, /loadConsultantContacts\(\)/);
});

test("existing customized consultant rosters gain Gabriel once without changing other entries", () => {
  const old = [
    { name: "Jason Keller", role: "Technology Consultant", phone: "custom extension" },
    { name: "Marty Goldmintz", role: "Technology Consultant" },
  ];
  const { contacts, entries } = runtime(old);
  const first = contacts.loadConsultantContacts();
  assert.equal(first.length, 3);
  assert.equal(first.filter((row) => row.name === "Gabriel Chittick").length, 1);
  assert.equal(first.find((row) => row.name === "Jason Keller").phone, "custom extension");
  assert.equal(entries.get("client-compass.consultant-contacts.gabriel-v1"), "1");
  assert.equal(contacts.loadConsultantContacts().length, 3, "refresh must not duplicate Gabriel");

  contacts.saveConsultantContacts(first.filter((row) => row.name !== "Gabriel Chittick"));
  assert.equal(contacts.loadConsultantContacts().length, 2, "manual removal remains respected");
  contacts.resetConsultantContacts();
  assert.equal(contacts.loadConsultantContacts().filter((row) => row.name === "Gabriel Chittick").length, 1);
});

test("previous Gabe nickname is migrated to Gabriel without duplicating the contact or losing custom data", () => {
  const { contacts } = runtime([{
    name: "Gabe Chittick", role: "Technology Consultant", phone: "saved desk line",
    email: "verified-in-settings@example.org", calendarEmail: "verified@example.org",
  }]);
  const roster = contacts.loadConsultantContacts();
  assert.equal(roster.length, 1);
  assert.equal(roster[0].name, "Gabriel Chittick");
  assert.ok(roster[0].aliases.includes("Gabe Chittick"));
  assert.equal(roster[0].phone, "saved desk line");
  assert.equal(roster[0].calendarEmail, "verified@example.org");
  assert.equal(contacts.consultantContactFor("Gabe Chittick").name, "Gabriel Chittick");
  assert.equal(contacts.consultantContactFor("Gabriel Chittick").name, "Gabriel Chittick");
});
