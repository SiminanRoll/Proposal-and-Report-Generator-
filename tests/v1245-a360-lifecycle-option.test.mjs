import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("A360 lifecycle planning is an opt-in PDF section", () => {
  const editor = read("src/components/a360-presentation-details-editor.tsx");
  const readableExport = read("src/lib/prospects/a360-readable-report-export.ts");

  assert.ok(editor.includes("Optional PDF sections · off by default"));
  assert.ok(editor.includes("Lifecycle planning"));
  assert.ok(editor.includes("checked={activeRecord.includeLifecyclePlanning === true}"));
  assert.ok(editor.includes("includeLifecyclePlanning: value"));

  assert.ok(readableExport.includes("includeLifecyclePlanning?: boolean"));
  assert.ok(readableExport.includes("includeLifecyclePlanning === true"));
  assert.ok(readableExport.includes("if (includeLifecyclePlanning) return html;"));
  assert.ok(readableExport.includes("LIFECYCLE_PLANNING_SECTION"));
  assert.ok(readableExport.includes('.replace(LIFECYCLE_PLANNING_SECTION, "")'));
  assert.ok(readableExport.includes('.replace(".value:last-child{grid-column:1/-1}", ".value:last-child{grid-column:auto}")'));
});