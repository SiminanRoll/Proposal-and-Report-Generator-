import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/app/ota-tracker/ota-tc-input-enhancer.tsx", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../src/app/ota-tracker/page.tsx", import.meta.url), "utf8");
const contacts = fs.readFileSync(new URL("../src/lib/outcomes/consultant-contacts.ts", import.meta.url), "utf8");

assert.match(source, /loadConsultantContacts/);
assert.match(source, /consultantContactFor/);
assert.match(source, /Other \/ custom…/);
assert.match(source, /Unassigned/);
assert.match(source, /Assigned TC/);
assert.match(source, /dispatchEvent\(new Event\("input"/);
assert.match(source, /CONSULTANT_CONTACTS_CHANGED_EVENT/);
assert.match(page, /<OtaTcInputEnhancer \/>/);

for (const name of ["Chris Beadle", "Shawn Lamb", "Caleb Peake", "Eric Prywitowski", "Marty Goldmintz", "Josh Bruckmoser", "Jason Keller"]) {
  assert.ok(contacts.includes(name), `canonical consultant roster should include ${name}`);
}

console.log("OTA TC dropdown source checks passed");
