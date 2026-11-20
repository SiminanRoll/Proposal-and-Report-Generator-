import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const farLogic = read("src/lib/far/far-review.ts");
const priorities = read("src/lib/far/far-priorities.ts");
const preflight = read("src/components/far-generation-review-dialog.tsx");
const workspace = read("src/components/project-workspace.tsx");
const presentation = read("src/components/outcome-experience.tsx");
const pdf = read("src/lib/outcomes/far-review-report.ts");

async function compile(source, deps = {}) {
  const ts = (await import("typescript")).default;
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", js)(module, module.exports, (name) => {
    if (name in deps) return deps[name];
    throw Error("Unexpected runtime dependency: " + name);
  });
  return module.exports;
}

const fileId = "far-attachment-1";
const file = { id: fileId, name: "FAR.docx", status: "ready", analysis: { sourceType: "far-brief", facts: [] } };
const initial = {
  type: "client-report",
  sources: [{ kind: "far-brief", files: [file] }],
  farReview: { items: [
    { id: "a", sourceFileId: fileId, category: "open-decision", clientText: "Plan the aging workstations", evidence: "internal a", approved: true, prioritySelected: true },
    { id: "b", sourceFileId: fileId, category: "potential-adjustment", clientText: "Review backup readiness", evidence: "internal b", approved: true, prioritySelected: true },
    { id: "c", sourceFileId: fileId, category: "open-decision", clientText: "Check unused licenses", evidence: "internal c", approved: false },
    { id: "svc", sourceFileId: fileId, category: "service-value", clientText: "Supported the office with remote support", evidence: "private", approved: true },
  ] },
};

test("pre-generation FAR modal gates report creation only with a usable FAR attachment", () => {
  assert.match(workspace, /function createOutcome\(\)/);
  assert.match(workspace, /if \(currentProject\.type === "client-report"\)/);
  assert.match(workspace, /if \(farSourceFile\(currentProject\)\)/);
  assert.match(workspace, /<FarGenerationReviewDialog/);
  assert.match(workspace, /onGenerate=\{finishCreateOutcome\}/);
  assert.match(workspace, /finishCreateOutcome\(currentProject\)/);
  assert.match(workspace, /The attached FAR could not be analyzed/);
  assert.match(preflight, /Review your three FAR concerns/);
  assert.match(preflight, /Approve &amp; generate report/);
  assert.match(preflight, /Generate without FAR priorities/);
  assert.match(preflight, /Other FAR suggestions/);
});

test("selected FAR concerns are the only approved current-source decisions", async () => {
  const lib = await compile(farLogic);
  const result = lib.applyFarGenerationReview(initial, [
    { ...initial.farReview.items[2], priorityStatus: "plan", clientText: "Review license cleanup with office leadership" },
  ]);
  assert.equal(result.farReview.items.find((item) => item.id === "a").approved, false);
  assert.equal(result.farReview.items.find((item) => item.id === "b").prioritySelected, false);
  assert.equal(result.farReview.items.find((item) => item.id === "c").approved, true);
  assert.equal(result.farReview.items.find((item) => item.id === "c").priorityStatus, "plan");
  assert.equal(result.farReview.items.find((item) => item.id === "svc").approved, true);
  assert.equal(result.farReview.items.some((item) => "included" in item), false);

  const p = await compile(priorities, { "./far-review": lib });
  assert.deepEqual(p.farTopPriorities(result).map((item) => item.id), ["c"]);
  assert.equal(p.farTopPriorities({ ...result, sources: [] }).length, 0);
});

test("PDF and presentation skip FAR-specific sections when none is attached or selected", async () => {
  const lib = await compile(farLogic);
  const p = await compile(priorities, { "./far-review": lib });
  const absent = { ...initial, sources: [] };
  assert.strictEqual(lib.applyFarGenerationReview(absent, []), absent);
  assert.deepEqual(p.farTopPriorities(absent), []);
  const skipped = lib.applyFarGenerationReview(initial, [], true);
  assert.deepEqual(p.farTopPriorities(skipped), []);
  const report = await compile(pdf, { "@/lib/far/far-review": lib, "@/lib/far/far-priorities": p });
  assert.equal(report.farPriorityActionPlanHtml(absent), "");
  assert.equal(report.farPriorityActionPlanHtml(skipped), "");
  assert.match(presentation, /farTopPriorities\(project\)\.length \? \["priorities"\] : \[\]/);
  assert.match(presentation, /\.{3}budget, \.{3}priorities/);
});

test("unapproved and unsuitable suggestions cannot be exported accidentally", async () => {
  const lib = await compile(farLogic);
  assert.throws(() => lib.applyFarGenerationReview(initial, [
    { ...initial.farReview.items[0], clientText: "ticket #123 client request" },
  ]), /Review the wording/);
  assert.throws(() => lib.applyFarGenerationReview(initial, [
    ...Array.from({ length: 4 }, (_, i) => ({ ...initial.farReview.items[0], id: "x" + i })),
  ]), /at most three/);
  assert.throws(() => lib.applyFarGenerationReview(initial, [
    { ...initial.farReview.items[0], sourceFileId: "another-far" },
  ]), /Review the wording/);
  assert.match(preflight, /safeFarClientText\(item\.clientText\)/);
  assert.match(preflight, /farCandidates\(project\)/);
  assert.match(preflight, /farReviewEntry\(project, candidate\.recordId\)/);
});

test("the validated FAR selections still do not change technology-health scoring", () => {
  const scoring = read("src/lib/outcomes/client-report-score.ts");
  assert.doesNotMatch(scoring, /farTopPriorities|farPriorityStatus|applyFarGenerationReview/);
});
