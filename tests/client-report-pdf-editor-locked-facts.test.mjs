import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const editor = fs.readFileSync(new URL("../src/components/project-pdf-editor-page-client.tsx", import.meta.url), "utf8");

test("inline editor only wires section header headings and narrative paragraphs", () => {
  assert.match(editor, /header\.querySelector<HTMLElement>\("h2"\)/);
  assert.match(editor, /header\.querySelector<HTMLElement>\("p"\)/);
  assert.doesNotMatch(editor, /querySelectorAll<HTMLElement>\("\[data-pdf-field\]/);
  assert.match(editor, /other source data remain locked/);
});
