import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const correction = fs.readFileSync(new URL("../src/lib/compass/company-inventory-correction.ts", import.meta.url), "utf8");
const headers = fs.readFileSync(new URL("../src/lib/compass/headers.ts", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../src/components/company-inventory-correction-runtime.tsx", import.meta.url), "utf8");

test("selected-company imports bypass organization-name inference", () => {
  assert.match(correction, /selectedCompanyToken/);
  assert.match(correction, /mode:\s*"existing",\s*clientId/);
  assert.match(correction, /organization:\s*client\.name/);
});

test("Ninja headers are matched by meaning rather than physical column order", () => {
  assert.match(headers, /Last Uptime_formatted[\s\S]*Last Uptime/);
  assert.match(headers, /Warranty Start Date_formatted[\s\S]*Warranty Start Date[\s\S]*Purchase Date/);
  assert.match(headers, /Serial Number/);
  assert.match(headers, /for \(const alias of aliases\)/);
  assert.match(headers, /normalized\.indexOf\(normalizeCompassHeader\(alias\)\)/);
});

test("inventory correction is available from client and report preparation workflows", () => {
  assert.match(runtime, /client-review-technical-glance-v10941/);
  assert.match(runtime, /generator-prefill-banner/);
  assert.match(runtime, /report-workspace-header/);
  assert.match(runtime, /refreshOpenReportProject/);
  assert.match(runtime, /buildCompassGeneratorPrefill/);
});
