import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(new URL("../src/app/project/pdf-editor/page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/pdf-editor-v1294.css", import.meta.url), "utf8");

test("PDF editing is routed to its own screen and the legacy modal section stays hidden", () => {
  assert.match(route, /ProjectPdfEditorPageClient/);
  assert.match(css, /report-copy-editor\{display:none!important\}/);
});
