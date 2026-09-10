import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const editor = fs.readFileSync(new URL("../src/components/project-pdf-editor-page-client.tsx", import.meta.url), "utf8");
const fillable = fs.readFileSync(new URL("../src/lib/outcomes/fillable-pdf.ts", import.meta.url), "utf8");

test("saved WYSIWYG copy is persisted in the report outcome and reused by PDF download", () => {
  assert.match(editor, /reportTextOverrides: cleaned/);
  assert.match(editor, /saveProject\(nextProject\)/);
  assert.match(editor, /saveCompassDataset/);
  assert.match(fillable, /prepareReportTextOverridesHtml/);
  assert.match(fillable, /prepareFillableClientPdfHtml/);
});
