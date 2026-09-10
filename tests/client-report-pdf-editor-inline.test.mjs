import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const editor = fs.readFileSync(new URL("../src/components/project-pdf-editor-page-client.tsx", import.meta.url), "utf8");

test("report copy edits happen on contentEditable PDF text itself", () => {
  assert.match(editor, /contentEditable = "plaintext-only"/);
  assert.match(editor, /element\.addEventListener\("input"/);
  assert.match(editor, /patchFromDisplayedText/);
  assert.match(editor, /srcDoc=\{previewHtml\}/);
});
