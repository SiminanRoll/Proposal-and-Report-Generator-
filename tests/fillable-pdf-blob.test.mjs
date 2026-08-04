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

test("fillable PDF supports portrait client reports without changing proposal landscape output", () => {
  const source = readFileSync("src/lib/outcomes/fillable-pdf.ts", "utf8");
  assert.match(source, /const LANDSCAPE_LAYOUT: PdfPageLayout/);
  assert.match(source, /const PORTRAIT_LAYOUT: PdfPageLayout/);
  assert.match(source, /pdfPageWidth: 612,[\s\S]*pdfPageHeight: 792/);
  assert.match(source, /meta\[name="adv-pdf-layout"\]/);
  assert.match(source, /requested === "portrait" \? PORTRAIT_LAYOUT : LANDSCAPE_LAYOUT/);
  assert.match(source, /\/MediaBox \[0 0 \$\{layout\.pdfPageWidth\} \$\{layout\.pdfPageHeight\}\]/);
});

test("page rasterization remains origin-clean for browser PDF downloads", () => {
  const source = readFileSync("src/lib/outcomes/fillable-pdf.ts", "utf8");
  assert.match(source, /data:image\/svg\+xml;charset=utf-8,\$\{encodeURIComponent\(svg\)\}/);
  assert.doesNotMatch(source, /createObjectURL\(new Blob\(\[svg\]/);
});

test("raster capture promotes print CSS and applies an explicit PDF font stack", () => {
  const source = readFileSync("src/lib/outcomes/fillable-pdf.ts", "utf8");
  assert.match(source, /replace\(\/@media\\s\+print\/gi, "@media all"\)/);
  assert.match(source, /font-family:Arial,"Segoe UI",sans-serif!important/);
});

test("fillable PDF measures fields in the exact cloned wrapper used for rasterization", () => {
  const source = readFileSync("src/lib/outcomes/fillable-pdf.ts", "utf8");
  assert.match(source, /const measurementHost = documentRef\.createElement\("div"\)/);
  assert.match(source, /measurementHost\.className = wrapperClass/);
  assert.match(source, /measurementHost\.appendChild\(clone\)/);
  assert.match(source, /fields = captureFields\(clone, layout\)/);
  assert.doesNotMatch(source, /captureFields\(page, layout\)/);
});

test("pre-meeting pages retain block layout during field measurement", () => {
  const source = readFileSync("src/lib/outcomes/pre-meeting.ts", "utf8");
  assert.match(source, /\.premeeting-page\[data-pdf-capture-page\][^}]*display:block!important/);
});
