import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/app/a360-record-surface-v1249.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

test("A360 record uses white major panels with softly tinted inner fields", () => {
  assert.match(layout, /a360-record-surface-v1249\.css/);
  assert.match(css, /record-grid > \.record-card[\s\S]*background:#fff !important/);
  assert.match(css, /report-editor textarea[\s\S]*background:#f6faff !important/);
  assert.match(css, /a360-details-editor \.summary-card[\s\S]*background:#fff !important/);
  assert.match(css, /a360-details-editor input[\s\S]*background:#f6faff !important/);
});
