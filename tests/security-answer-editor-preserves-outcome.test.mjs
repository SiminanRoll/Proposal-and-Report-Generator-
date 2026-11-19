import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const securityEditor = read("../src/components/hipaa-readiness.tsx");
const workspace = read("../src/components/project-workspace.tsx");
const builder = read("../src/lib/outcomes/builder.ts");
const engine = read("../src/lib/hipaa/engine.ts");

function editorUpdate() {
  const match = securityEditor.match(/function updateAssessment\(next: Project\)\s*\{([\s\S]*?)\n\s{2}\}/);
  assert.ok(match, "Security editor's updateAssessment callback must remain present");
  // Exercise the actual handler body using an injected onUpdate callback,
  // without rendering the unrelated application shell or resetting data.
  return new Function("onUpdate", "return function updateAssessment(next) {" + match[1] + "}"); // eslint-disable-line no-new-func
}

test("typing Responsible Party does not invalidate the generated THR or unmount the review modal", () => {
  assert.match(securityEditor, /onChange=\{\(event: ChangeEvent<HTMLInputElement>\) => patch\(\{ responsibleParty: event\.target\.value \}\)\}/);
  assert.match(securityEditor, /function patch\(value: Partial<HipaaAnswer>\) \{ onUpdate\(withUpdatedHipaaAnswer\(project, questionId, value\)\); \}/);
  assert.match(workspace, /const streamlinedReport = hasOutcome && currentProject\.type === "client-report"/);
  assert.match(builder, /return Boolean\(project\.presentation\.executiveSummary && project\.findings\.length && project\.recommendations\.length\)/);

  const existing = {
    id: "example-review",
    type: "client-report",
    findings: [{ id: "finding", title: "Example" }],
    recommendations: [{ id: "recommendation" }],
    presentation: { executiveSummary: "Generated review summary", publishedAt: "2026-11-19T00:00:00.000Z" },
    hipaa: { enabled: true, answers: [{ questionId: "SEC-04", response: "partially", responsibleParty: "" }] },
  };
  const edited = {
    ...existing,
    hipaa: { ...existing.hipaa, answers: [{ ...existing.hipaa.answers[0], responsibleParty: "IT" }] },
  };
  let received;
  const updateAssessment = editorUpdate()((next) => { received = next; });
  updateAssessment(edited);
  assert.deepEqual(received, edited, "Report editor must save the complete updated project");
  assert.deepEqual(received.findings, existing.findings);
  assert.deepEqual(received.recommendations, existing.recommendations);
  assert.equal(received.presentation.executiveSummary, existing.presentation.executiveSummary);
  assert.equal(received.hipaa.answers[0].responsibleParty, "IT");
});

test("all security answer and date edits share the safe update path", () => {
  assert.doesNotMatch(securityEditor, /onUpdate\(\{ \.\.\.next, findings:\s*\[\], recommendations:\s*\[\]/);
  assert.match(securityEditor, /onUpdate\(next\);/);
  assert.match(securityEditor, /onUpdate=\{updateAssessment\}/);
  assert.match(securityEditor, /reportingPeriod: \{ \.\.\.project\.hipaa\.reportingPeriod/);
  assert.match(securityEditor, /confirmHipaaAssessment\(project, confirmer\)/);
  assert.match(engine, /responsibleParty: patch\.followUpOwner === "client" \? "Client" : patch\.followUpOwner === "advantage" \? "Advantage" : \(patch\.responsibleParty \?\? answer\.responsibleParty\)/);
  assert.match(workspace, /setProject\(next\);\s*saveProject\(next\);/);
});
