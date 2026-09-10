import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const core = fs.readFileSync(new URL("../src/lib/outcomes/fillable-pdf-core.ts", import.meta.url), "utf8");
const preview = fs.readFileSync(new URL("../src/lib/outcomes/pdf-editor-preview.ts", import.meta.url), "utf8");

test("WYSIWYG editor tracks the portrait raster capture box used by the PDF generator", () => {
  assert.match(core, /captureWidth: 816/);
  assert.match(core, /captureHeight: 1056/);
  assert.match(preview, /captureWidth: 816, captureHeight: 1056/);
  assert.match(core, /font-family:Arial,"Segoe UI",sans-serif!important/);
  assert.match(preview, /font-family:Arial,"Segoe UI",sans-serif!important/);
  assert.match(core, /\[data-pdf-capture-page\]\{display:flex!important/);
  assert.match(preview, /\[data-pdf-capture-page\]\{display:flex!important/);
  assert.match(core, /\.pdf-page-footer\{position:absolute!important;left:18px!important;right:18px!important;bottom:12px!important\}/);
  assert.match(preview, /\.pdf-page-footer\{position:absolute!important;left:18px!important;right:18px!important;bottom:12px!important\}/);
});
