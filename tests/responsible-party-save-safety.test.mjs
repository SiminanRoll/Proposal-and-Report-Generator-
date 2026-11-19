import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf8");
const editor = read("../src/components/hipaa-readiness.tsx");
const workspace = read("../src/components/project-workspace.tsx");
const css = read("../src/app/globals.css");

/** Execute the actual project update handler body with mock browser storage. */
function updateHandler(stubs) {
  const match = workspace.match(/  function update\(next: Project\) \{([\s\S]*?)\n  \}/);
  assert.ok(match, "workspace update function exists");
  return new Function(
    "saveProject", "setProject", "setSaved", "setSaveError", "window",
    "return function update(next) {" + match[1] + "}"
  )(stubs.saveProject, stubs.setProject, stubs.setSaved, stubs.setSaveError, stubs.window);
}

test("one keystroke changes only local Responsible Party draft, not the whole project", () => {
  const input = editor.match(/function ResponsiblePartyInput\([\s\S]*?(?=\nfunction QuestionEditor)/)?.[0] ?? "";
  assert.ok(input, "isolated Responsible Party component exists");
  assert.match(input, /const \[draft, setDraft\] = useState\(value\)/);
  assert.match(input, /onChange=\{\(event: ChangeEvent<HTMLInputElement>\) => \{ setDraft\(event\.target\.value\); setDirty\(true\); \}\}/);
  assert.match(input, /onBlur=\{commit\}/);
  assert.match(input, /function commit\(\) \{\s*if \(dirty && draft !== value\) onCommit\(draft\)/);
  assert.doesNotMatch(input, /onChange=\{[^}]*onCommit\(/);
  assert.match(editor, /<ResponsiblePartyInput value=\{answer\.responsibleParty\} onCommit=\{\(value\) => patch\(\{ responsibleParty: value \}\)\} \/>/);
  assert.match(input, /Saves when you leave the field/);
  assert.match(input, /if \(!dirty\) setDraft\(value\);/);
});

test("failed browser write cannot replace the generated report or close the editor", () => {
  const calls = [];
  const update = updateHandler({
    saveProject: () => { calls.push("save"); throw new Error("Browser quota exceeded"); },
    setProject: () => calls.push("project-render"),
    setSaved: (v) => calls.push("saved:" + v),
    setSaveError: (m) => calls.push("error:" + m),
    window: { setTimeout: () => { throw Error("Should not schedule successful save") } },
  });
  const generated = {
    presentation: { executiveSummary: "Existing THR" },
    findings: [{ id: "existing-finding" }],
    recommendations: [{ id: "existing-recommendation" }],
    hipaa: { answers: [{ questionId: "SEC-04", responsibleParty: "IT" }] },
  };
  assert.doesNotThrow(() => update(generated));
  assert.deepEqual(calls, ["save", "saved:false", "error:Browser quota exceeded"]);
  assert.match(workspace, /role="alert"/);
  assert.match(workspace, /<div className="report-editor-scroll">\{saveError && <div className="workspace-save-error"/);
});

test("successful persistence precedes state updates and preserves report content", () => {
  const calls = [];
  const generated = {
    presentation: { executiveSummary: "Existing THR" },
    findings: [{ id: "existing-finding" }],
    recommendations: [{ id: "existing-recommendation" }],
    hipaa: { answers: [{ questionId: "SEC-04", responsibleParty: "IT" }] },
  };
  const update = updateHandler({
    saveProject: (p) => { assert.deepEqual(p, generated); calls.push("save"); },
    setProject: (p) => { assert.deepEqual(p, generated); calls.push("project-render"); },
    setSaved: (v) => calls.push("saved:" + v),
    setSaveError: (m) => calls.push("error:" + m),
    window: { setTimeout: () => calls.push("saved-timer") },
  });
  update(generated);
  assert.deepEqual(calls, ["save", "project-render", "error:", "saved:true", "saved-timer"]);
  assert.match(editor, /onUpdate\(next\);/);
  assert.doesNotMatch(editor, /onUpdate\(\{ \.\.\.next, findings: \[\], recommendations: \[\]/);
});

test("security modal retains accessibility and error visibility", () => {
  assert.match(workspace, /hipaaReviewOpen && <div className="report-editor-backdrop"/);
  assert.match(workspace, /onMouseDown=\{\(event\) => \{ if \(event.currentTarget === event.target\) setHipaaReviewOpen\(false\); \}\}/);
  assert.match(css, /\.workspace-save-error\{position:sticky/);
  assert.match(css, /\.hipaa-responsible-editor>small/);
});
