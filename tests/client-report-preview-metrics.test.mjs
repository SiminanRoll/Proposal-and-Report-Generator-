import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("workspace report metrics stay compact with prominent numbers", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /\.client-report-preview \{[^}]*align-items:\s*start/);
  assert.match(css, /\.client-report-preview-stats \{[^}]*grid-auto-rows:\s*92px/);
  assert.match(css, /\.client-report-preview-stats \{[^}]*height:\s*max-content/);
  assert.match(css, /\.client-report-preview-stats article \{[^}]*height:\s*92px/);
  assert.match(css, /\.client-report-preview-stats strong \{[^}]*font-size:\s*42px/);
});
