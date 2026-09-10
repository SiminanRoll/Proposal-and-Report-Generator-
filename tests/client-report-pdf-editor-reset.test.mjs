import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const editor = fs.readFileSync(new URL("../src/components/project-pdf-editor-page-client.tsx", import.meta.url), "utf8");
const overrides = fs.readFileSync(new URL("../src/lib/outcomes/pdf-report-overrides.ts", import.meta.url), "utf8");

test("reset clears every saved copy override before rebuilding the default PDF", () => {
  assert.match(editor, /function resetToDefault\(\)/);
  assert.match(editor, /setDraftOverrides\(\{\}\)/);
  assert.match(editor, /setPreviewHtml\(buildPdfPreview\(project, \{\}\)\)/);
  assert.match(editor, /Defaults restored\. Save changes to keep the reset\./);
});

test("inventory inline edits retain location identity instead of flattening a multi-site report", () => {
  assert.match(editor, /inventoryLocationKey/);
  assert.match(editor, /locations\[locationKey\]/);
  assert.match(overrides, /override\.locations\?\.\[key\]/);
  assert.match(overrides, /exactInventory/);
});
