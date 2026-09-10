import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const editor = fs.readFileSync(new URL("../src/components/project-pdf-editor-page-client.tsx", import.meta.url), "utf8");

test("dedicated editor returns to the originating report and warns about unsaved edits", () => {
  assert.match(editor, /You have unsaved PDF edits/);
  assert.match(editor, /router\.push\(`\/project\?id=/);
});
