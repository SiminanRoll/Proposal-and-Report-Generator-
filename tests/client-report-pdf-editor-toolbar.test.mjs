import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const editor = fs.readFileSync(new URL("../src/components/project-pdf-editor-page-client.tsx", import.meta.url), "utf8");

test("dedicated editor exposes save and full reset controls", () => {
  assert.match(editor, />Reset to default</);
  assert.match(editor, /Save changes/);
  assert.match(editor, /Defaults restored\. Save changes to keep the reset\./);
});
