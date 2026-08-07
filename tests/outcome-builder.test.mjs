import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const builder = fs.readFileSync(new URL("../src/lib/outcomes/builder.ts", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/project-workspace.tsx", import.meta.url), "utf8");
const experience = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const fillablePdf = fs.readFileSync(new URL("../src/lib/outcomes/fillable-pdf.ts", import.meta.url), "utf8");

test("approved intelligence composes findings, recommendations, and a presentation", () => {
  assert.match(builder, /buildOutcome/);
  assert.match(builder, /executiveSummary/);
  for (const category of ["security", "network", "lifecycle", "backup", "operations", "planning"]) assert.match(builder, new RegExp(`${category}:`));
});


test("a tailored review summary wins over generic count-based client report framing", () => {
  assert.match(builder, /const tailoredFraming = project\.reviewOutcome\.executiveSummary\.trim\(\) \|\| project\.reviewOutcome\.meetingSummary\.trim\(\)/);
  assert.match(builder, /if \(tailoredFraming\) return tailoredFraming/);
});

test("the standard flow is one-click generation instead of a document editor", () => {
  assert.match(workspace, /Generate .*client report|Generate .*proposal/);
  assert.match(workspace, /projectWithBuiltOutcome/);
  assert.doesNotMatch(workspace, /section ordering|proposal schema|drag and drop/i);
});

test("the client experience has a local presentation and finalized PDF handoff", () => {
  assert.match(experience, /presentation-overlay/);
  assert.match(experience, /Overview/);
  assert.match(experience, /What we found/);
  assert.match(experience, /Recommended plan/);
  assert.match(experience, /Download PDF/);
  assert.doesNotMatch(experience, /Download interactive HTML/);
  assert.match(exportHtml, /downloadFillableClientPdf/);
  assert.match(exportHtml, /Print or save PDF/);
});

test("outcome export does not invent a hosted sharing service", () => {
  assert.doesNotMatch(`${exportHtml}
${fillablePdf}`, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.match(fillablePdf, /URL\.createObjectURL/);
  assert.doesNotMatch(exportHtml, /downloadOutcomeHtml|text\/html;charset=utf-8/);
});

test("changing a source invalidates the old generated story", () => {
  assert.match(workspace, /findings: \[\]/);
  assert.match(workspace, /recommendations: \[\]/);
  assert.match(workspace, /executiveSummary: \"\"/);
});
