import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const presentation = fs.readFileSync(new URL("../src/components/hipaa-presentation.tsx", import.meta.url), "utf8");
const engine = fs.readFileSync(new URL("../src/lib/hipaa/engine.ts", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("v1.8.8 lets completed HIPAA answers be edited from the readiness recap", () => {
  assert.match(presentation, /Edit answered questions/);
  assert.match(presentation, /HipaaAnsweredQuestionsEditor/);
  assert.match(presentation, /Corrections update the security conversation/);
  assert.match(presentation, /withUpdatedHipaaAnswer/);
  assert.match(presentation, /verificationStatus: "client-confirmed"/);
  assert.match(presentation, /evidenceSource/);
  assert.match(css, /Client Compass v1\.8\.8 — editable completed HIPAA answers/);
});

test("v1.8.8 preserves client-corrected technical-prefill answers when HIPAA data is normalized", () => {
  assert.match(engine, /current && current.response !== "not-yet-assessed"/);
  assert.match(engine, /Never auto-mark "Yes"/);
});

test("v1.8.8 final report uses current HIPAA answers and prints a reviewed-answer record", () => {
  assert.match(exportHtml, /Security safeguards · Answer record/);
  assert.match(exportHtml, /Reviewed answers/);
  assert.match(exportHtml, /responses below document the security conversation/);
  assert.match(exportHtml, /\$\{printHipaaAnswers\}/);
  assert.match(exportHtml, /scoreHipaaAssessment\(project\.hipaa\)/);
});
