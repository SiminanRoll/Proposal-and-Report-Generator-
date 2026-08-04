import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const types = fs.readFileSync(new URL("../src/lib/projects/types.ts", import.meta.url), "utf8");
const templates = fs.readFileSync(new URL("../src/lib/projects/templates.ts", import.meta.url), "utf8");

test("shared schema includes the three product levers", () => {
  for (const value of ["client-report", "prospect-proposal", "legacy-modernization"]) {
    assert.match(types, new RegExp(`\\"${value}\\"`));
    assert.match(templates, new RegExp(`\\"${value}\\"`));
  }
});

test("project model includes future presentation, signature, and handoff surfaces", () => {
  for (const key of ["presentation", "signature", "handoff", "catalogItems", "findings", "recommendations"]) {
    assert.match(types, new RegExp(`${key}:`));
  }
});

test("source templates contain the agreed intake documents", () => {
  for (const source of ["ScalePad report", "Huntress report", "RFT spreadsheet", "TC onsite notes", "Office photos", "Existing proposal"]) {
    assert.match(templates, new RegExp(source));
  }
});


test("JSON schema is versioned and disallows unknown root fields", () => {
  const schema = JSON.parse(fs.readFileSync(new URL("../schemas/project.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.properties.schemaVersion.const, 2);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.type.enum, ["client-report", "prospect-proposal", "legacy-modernization"]);
});
