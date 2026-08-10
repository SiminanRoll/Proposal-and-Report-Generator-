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

test("default Technology Health summary uses simple client-facing language", () => {
  assert.match(builder, /higher risk of unexpected failure/);
  assert.match(builder, /Advantage can help prioritize the highest-risk systems and build a practical plan over time/);
  assert.match(builder, /Security monitoring remains active/);
  assert.match(builder, /HIPAA readiness is also included so any remaining items can be reviewed alongside the technology plan/);
  assert.match(builder, /The goal is simple: understand what is working, what needs attention, and what to plan for next/);
  assert.doesNotMatch(builder, /technical controls, client-confirmed practices, skipped questions, and corrective actions/);
  assert.doesNotMatch(builder, /The review moves from protection and network health into readiness, planning, and a final recap/);
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
  assert.match(workspace, /executiveSummary: ""/);
});
