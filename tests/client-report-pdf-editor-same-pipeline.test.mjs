import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const fillable = fs.readFileSync(new URL("../src/lib/outcomes/fillable-pdf.ts", import.meta.url), "utf8");
const editor = fs.readFileSync(new URL("../src/components/project-pdf-editor-page-client.tsx", import.meta.url), "utf8");

test("editor and download share prepareFillableClientPdfHtml", () => {
  assert.match(fillable, /export function prepareFillableClientPdfHtml/);
  assert.match(editor, /prepareFillableClientPdfHtml/);
});
