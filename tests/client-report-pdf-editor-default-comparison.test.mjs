import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const editor = fs.readFileSync(new URL("../src/components/project-pdf-editor-page-client.tsx", import.meta.url), "utf8");

test("returning inline copy to generated text removes the stored override", () => {
  assert.match(editor, /const isDefault = normalized === cleanText\(defaultValue\)/);
  assert.match(editor, /if \(isDefault\) delete section\[field\]/);
  assert.match(editor, /if \(isDefault\) delete location\[field\]/);
});
