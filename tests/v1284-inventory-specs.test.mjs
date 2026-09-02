import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pdf = fs.readFileSync("src/lib/outcomes/pdf-inventory-sync.ts", "utf8");
const exportHtml = fs.readFileSync("src/lib/outcomes/export-html.ts", "utf8");

test("PDF inventory carries CPU memory and storage from source rows", () => {
  assert.match(exportHtml, /data-cpu=/);
  assert.match(exportHtml, /data-memory=/);
  assert.match(exportHtml, /data-storage-detail=/);
  assert.match(pdf, /<span>CPU<\/span><span>Memory<\/span><span>Storage<\/span>/);
});

test("PDF inventory keeps seven compact columns", () => {
  assert.match(pdf, /grid-template-columns:1\.72fr \.55fr 1\.18fr 1\.18fr \.58fr \.72fr 1\.35fr/);
});

test("red age items sort first and oldest first inside each location", () => {
  assert.match(pdf, /if \(card\.fivePlus\) return 0/);
  assert.match(pdf, /if \(card\.osConcern \|\| card\.status === "overdue"\) return 1/);
  assert.match(pdf, /return rightAge - leftAge/);
  assert.match(pdf, /const sortedCards = sortedInventoryCards\(locationCards\)/);
});

test("compact OS column uses the OS name rather than the duplicated support sentence", () => {
  assert.match(pdf, /cells\[5\]\.match\(\/<b/);
});

test("inventory spec release is version 1.2.84", () => {
  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\.2\.84"/);
  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\.2\.84/);
});
