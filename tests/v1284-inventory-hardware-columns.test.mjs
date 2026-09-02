import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sync = fs.readFileSync("src/lib/outcomes/pdf-inventory-sync.ts", "utf8");
const exportHtml = fs.readFileSync("src/lib/outcomes/export-html.ts", "utf8");

test("portrait inventory carries CPU memory storage and clean OS values from source rows", () => {
  assert.match(exportHtml, /data-os-name=/);
  assert.match(exportHtml, /data-cpu=/);
  assert.match(exportHtml, /data-memory=/);
  assert.match(exportHtml, /data-storage-capacity=/);
  assert.match(sync, /rowAttribute\(row, "cpu"\)/);
  assert.match(sync, /rowAttribute\(row, "memory"\)/);
  assert.match(sync, /rowAttribute\(row, "storage-capacity"\)/);
});

test("portrait inventory has seven compact columns without repeated per-row labels", () => {
  assert.match(sync, /<span>CPU<\/span><span>Memory<\/span><span>Storage<\/span><span>Needs attention<\/span>/);
  assert.match(sync, /grid-template-columns:1\.72fr \.58fr 1\.08fr 1\.28fr \.62fr \.78fr 1\.22fr/);
  assert.doesNotMatch(sync, /<span>What needs attention<\/span><strong>\$\{attention\.text\}<\/strong>/);
});

test("CPU and OS values can wrap to two lines while rows stay compact", () => {
  assert.match(sync, /pdf-device-list-cpu strong/);
  assert.match(sync, /-webkit-line-clamp:2/);
  assert.match(sync, /min-height:27px/);
  assert.match(sync, /const pageSize = 24/);
});

test("inventory hardware column release is version 1.2.84", () => {
  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\.2\.84"/);
  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\.2\.84/);
});
