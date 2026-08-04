import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("fillable PDF download gives Blob a concrete ArrayBuffer", () => {
  const source = readFileSync("src/lib/outcomes/fillable-pdf.ts", "utf8");
  assert.match(source, /const pdfBuffer = new ArrayBuffer\(pdf\.byteLength\)/);
  assert.match(source, /new Uint8Array\(pdfBuffer\)\.set\(pdf\)/);
  assert.match(source, /new Blob\(\[pdfBuffer\], \{ type: "application\/pdf" \}\)/);
  assert.doesNotMatch(source, /new Blob\(\[pdf\], \{ type: "application\/pdf" \}\)/);
});
