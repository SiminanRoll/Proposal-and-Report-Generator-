import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function loadHeaderMapper() {
  const source = fs.readFileSync("src/lib/compass/headers.ts", "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", compiled)(module.exports, module);
  return module.exports;
}

test("real Ninja Processors Name header maps to the CPU field", () => {
  const { mapCompassHeaders } = loadHeaderMapper();
  const ninjaHeaders = [
    "index",
    "Location",
    "Display Name",
    "Age",
    "Memory",
    "OS Name",
    "Device Make",
    "Device Model",
    "Serial Number",
    "Processors Name",
    "Video Card",
    "Organization",
  ];

  const mapped = mapCompassHeaders(ninjaHeaders);
  assert.equal(mapped.deviceName, 2);
  assert.equal(mapped.processor, 9);
  assert.equal(mapped.videoCard, 10);
  assert.equal(mapped.organization, 11);
});

test("v1.2.87 carries the Ninja Processors Name CPU fix", () => {
  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\.2\.87"/);
  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\.2\.87/);
});
