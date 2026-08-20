import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const outcome = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/client-report-recap-stability-v1251.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

test("client report recap keeps HIPAA percentage atomic and disables recap entrance reflow", () => {
  assert.match(outcome, /presentation-stage-\$\{section\}/);
  assert.match(outcome, /recap-hipaa-status/);
  assert.match(css, /presentation-stage-recap/);
  assert.match(css, /white-space:\s*nowrap/);
  assert.match(css, /word-break:\s*keep-all/);
  assert.match(css, /overflow-anchor:\s*none/);
  assert.match(css, /presentation-slide-motion[\s\S]*animation:\s*none/);
  assert.match(layout, /client-report-recap-stability-v1251\.css/);
});
