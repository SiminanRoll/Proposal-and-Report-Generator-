import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(new URL("../src/app/project/pdf-editor/page.tsx", import.meta.url), "utf8");
const launcher = fs.readFileSync(new URL("../src/components/pdf-editor-global.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/pdf-editor-v1294.css", import.meta.url), "utf8");

test("PDF editor is a dedicated project route instead of another Tailor Report panel", () => {
  assert.match(route, /ProjectPdfEditorPageClient/);
  assert.match(launcher, /href=\{`\/project\/pdf-editor\?id=/);
  assert.match(css, /\.review-outcome-section\.report-copy-editor\{display:none!important\}/);
});
