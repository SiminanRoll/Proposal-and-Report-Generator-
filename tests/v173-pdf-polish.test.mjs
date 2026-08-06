import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const packetStart = exportHtml.indexOf("const locationPackets =");
const packetEnd = exportHtml.indexOf("const siteOverview =", packetStart);
const packetBuilder = exportHtml.slice(packetStart, packetEnd);
const printStart = exportHtml.indexOf("const printReport =");
const printEnd = exportHtml.indexOf("return `<!doctype", printStart);
const printReport = exportHtml.slice(printStart, printEnd);

test("v1.7.4 PDF adds friendly vector graphics to the main client story", () => {
  for (const value of ["pdf-score-ring", "pdf-review-story", "pdf-plan-path", "pdf-report-icon", "pdf-focus-summary"]) {
    assert.match(exportHtml, new RegExp(value));
  }
  assert.match(exportHtml, /stroke-dasharray="\$\{safeScore\} 100"/);
  assert.match(exportHtml, /<text x="50" y="53"/);
  for (const icon of ["shield", "activity", "computer", "storage", "windows", "plan", "people", "check"]) {
    assert.match(exportHtml, new RegExp(`${icon}:`));
  }
});

test("single and multisite details consolidate lifecycle storage and OS concerns by computer", () => {
  assert.ok(packetStart >= 0 && packetEnd > packetStart);
  assert.match(packetBuilder, /const byDevice = new Map/);
  assert.match(packetBuilder, /group\.priorities\.forEach/);
  assert.match(packetBuilder, /group\.storageDevices\.forEach/);
  assert.match(packetBuilder, /group\.osDevices\.forEach/);
  assert.match(packetBuilder, /for \(let index = 0; index < cards\.length; index \+= 6\)/);
  assert.match(packetBuilder, /Replacement, storage, and operating-system items are combined by computer/);
  assert.doesNotMatch(packetBuilder, /pdf-site-priorities|pdf-site-storage|pdf-site-os|pdf-site-virtual|pdf-location-cover/);
});

test("client PDF removes internal workflow labels and standalone recap duplication", () => {
  assert.ok(printStart >= 0);
  assert.doesNotMatch(printReport, /Not quoted|Account review not recorded|current project category not yet quoted/i);
  assert.match(exportHtml, /const printRecap = ""/);
  assert.match(printReport, /No pressure - just a clear plan/);
});

test("device age values are rounded for client-facing output", () => {
  assert.match(exportHtml, /function formatReportAge/);
  assert.match(exportHtml, /value\.toFixed\(1\)/);
  assert.match(exportHtml, /formatReportAge\(device\.age\)/);
  assert.doesNotMatch(packetBuilder, /\$\{device\.age\} years old/);
});

test("storage and operating-system explanations stay plain and action oriented", () => {
  assert.match(packetBuilder, /Disk volume usage:/);
  assert.match(packetBuilder, /Storage pressure is an operational health item/);
  assert.match(packetBuilder, /It does not automatically change the device replacement recommendation/);
  assert.match(packetBuilder, /Review Windows 11 Pro for the business environment/);
});
