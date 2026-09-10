import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const editor = fs.readFileSync(new URL("../src/components/project-pdf-editor-page-client.tsx", import.meta.url), "utf8");

test("inline PDF editing remains plain text and blocks accidental layout markup", () => {
  assert.match(editor, /contentEditable = "plaintext-only"/);
  assert.match(editor, /insertParagraph/);
  assert.match(editor, /clipboardData\?\.getData\("text\/plain"\)/);
});
