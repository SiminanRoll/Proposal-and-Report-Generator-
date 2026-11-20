import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const parserSource = read("src/lib/intelligence/browser/far-evidence.ts");
const reviewSource = read("src/lib/far/far-review.ts");
const prioritiesSource = read("src/lib/far/far-priorities.ts");
const workspace = read("src/components/project-workspace.tsx");
const modal = read("src/components/far-generation-review-dialog.tsx");

async function compile(source, deps = {}) {
  const ts = (await import("typescript")).default;
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", js)(module, module.exports, (name) => {
    if (name in deps) return deps[name];
    throw Error("Unexpected import " + name);
  });
  return module.exports;
}

// Text mirrors the table/paragraph order of the actual Shine Dental DOCX,
// without copying client names, IDs, confidential support evidence or prices.
const wordTableText = [
  "ADVANTAGE TECHNOLOGIES | FULL ACCOUNT REVIEW",
  "FULL ACCOUNT REVIEW",
  "Sample Dental",
  "Top Three Things",
  "",
  "1. The server decision is overdue and directly tied to the CBCT workflow",
  "The server is older and needs a fresh plan for the imaging workflow.",
  "",
  "2. Replace Doc 1 and Op 1 first, then add the office-manager workstation",
  "Doc 1 and Op 1 are slow, and the manager needs a workstation.",
  "",
  "3. Present a phased project, not a generic refresh",
  "Confirm the server design, application dependencies, graphics workstation and firewall before a proposal.",
  "",
  "Executive Snapshot",
  "Area",
  "Verified detail",
  "Current request",
  "Restart the earlier server proposal and review the computers",
  "Service Value and Actual Support Evidence",
  "Monitoring and managed infrastructure",
].join("\n");

const expected = [
  "The server decision is overdue and directly tied to the CBCT workflow",
  "Replace Doc 1 and Op 1 first, then add the office-manager workstation",
  "Present a phased project, not a generic refresh",
];

test("Shine Dental style Top Three Things DOCX table yields three original, ordered priorities", async () => {
  const { extractFarCandidates } = await compile(parserSource);
  const results = extractFarCandidates(wordTableText);
  const top = results.filter((item) => item.id.startsWith("far_top_"));
  assert.deepEqual(top.map((item) => item.id), ["far_top_1", "far_top_2", "far_top_3"]);
  assert.deepEqual(top.map((item) => item.suggestion), expected);
  assert.ok(top.every((item) => item.category === "open-decision"));
  assert.ok(top.every((item) => item.section === "Top Three Things"));
  assert.ok(top.every((item) => item.evidence.length > item.suggestion.length), "keep evidence for presenter");
  assert.ok(top.every((item) => !/Executive Snapshot|Verified detail/.test(item.evidence)), "stop at section end");
});

test("Top Three Things supports Word table rows with combined title and description, and alternate heading", async () => {
  const { extractFarCandidates } = await compile(parserSource);
  const merged = wordTableText.replace("Top Three Things", "Top 3 Priorities")
    .replace("1. The server decision is overdue and directly tied to the CBCT workflow\nThe server", "1. The server decision is overdue and directly tied to the CBCT workflow\nThe server");
  assert.deepEqual(extractFarCandidates(merged).filter((item) => item.id.startsWith("far_top_")).map((item) => item.suggestion), expected);
  const noHeadlineBreak = wordTableText.replace(
    "1. The server decision is overdue and directly tied to the CBCT workflow",
    "1.\nThe server decision is overdue and directly tied to the CBCT workflow");
  assert.deepEqual(extractFarCandidates(noHeadlineBreak).filter((item) => item.id.startsWith("far_top_")).map((item) => item.suggestion), expected);
});

test("the original rule-based FAR style remains supported", async () => {
  const { extractFarCandidates } = await compile(parserSource);
  const legacy = ["Open Questions", "Confirm whether backup data restores were tested before project approval", "Top Potential Savings Opportunities", "Review unused software licenses before reducing the managed plan"].join("\n");
  const findings = extractFarCandidates(legacy);
  assert.equal(findings.length, 2);
  assert.deepEqual(findings.map((item) => item.category), ["open-decision", "potential-adjustment"]);
});

test("extracted priority cards traverse source analysis, popup approval and PDF/slide source selection", async () => {
  const { extractFarCandidates } = await compile(parserSource);
  const review = await compile(reviewSource);
  const priorities = await compile(prioritiesSource, { "./far-review": review });
  const findings = extractFarCandidates(wordTableText).filter((item) => item.id.startsWith("far_top_"));
  const project = {
    sources: [{ kind: "far-brief", files: [{
      id: "file-one", name: "FAR.docx", status: "processed",
      analysis: { sourceType: "far-brief", facts: [{ key: "far.candidates", value: findings.map((item) => JSON.stringify(item)) }] },
    }] }],
    farReview: { items: [] },
    intelligence: { facts: [] },
  };
  const candidates = review.farCandidates(project);
  assert.equal(candidates.length, 3);
  const rows = candidates.map((item) => ({
    id: item.recordId, sourceFileId: item.sourceFileId, category: item.category,
    clientText: item.suggestion, evidence: item.evidence, approved: false, priorityStatus: "verify",
  }));
  assert.ok(rows.every((item) => review.safeFarClientText(item.clientText)));
  const approved = review.applyFarGenerationReview(project, rows);
  assert.deepEqual(priorities.farTopPriorities(approved).map((item) => item.clientText), expected);
  assert.equal(priorities.farTopPriorities({ ...approved, sources: [] }).length, 0);
  assert.deepEqual(priorities.farTopPriorities(review.applyFarGenerationReview(project, [], true)), []);
  assert.match(modal, /farCandidates\(project\)/);
  assert.match(workspace, /analyzeBrowserFile\(\{ file: cachedFile, expectedKind: "far-brief", fileId: far.id \}\)/);
  assert.match(workspace, /setFarReviewPreflightOpen\(true\)/);
});
