import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const editor = fs.readFileSync(new URL("../src/components/project-pdf-editor-page-client.tsx", import.meta.url), "utf8");

test("the WYSIWYG editor documents source facts as locked", () => {
  assert.match(editor, /Scores, inventory facts, security activity, HIPAA answers, dates, and other source data remain locked/);
});
