import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace = fs.readFileSync(new URL("../src/components/a360-conversation-workspace.tsx", import.meta.url), "utf8");

test("A360 record uses white inner data and edit surfaces inside tinted section shells", () => {
  assert.match(workspace, /--a360-field-surface:#fff/);
  assert.match(workspace, /\.a360-details-editor \.summary-card\{background:var\(--a360-field-surface\)!important/);
  assert.match(workspace, /\.a360-details-editor \.priority-summary\{background:var\(--a360-field-surface\)!important/);
  assert.match(workspace, /\.report-editor input,[\s\S]*background:var\(--a360-field-surface\)/);
  assert.match(workspace, /\.next-step-fact\{[\s\S]*background:var\(--a360-field-surface\)/);
  assert.match(workspace, /\.a360-details-editor input,[\s\S]*background:var\(--a360-field-surface\)!important/);
});
