import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const prioritySource = read("../src/lib/far/far-priorities.ts");
const pdfSource = read("../src/lib/outcomes/far-review-report.ts");
const slides = read("../src/components/outcome-experience.tsx");
const editor = read("../src/components/far-evidence-editor.tsx");
const report = read("../src/lib/outcomes/export-html.ts");
const budget = read("../src/lib/outcomes/technology-budget-outlook.ts");
const score = read("../src/lib/outcomes/client-report-score.ts");

async function loadModule(source, deps = {}) {
  const ts = (await import("typescript")).default;
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  const require = (path) => {
    if (path in deps) return deps[path];
    throw Error("Unexpected dependency in test: " + path);
  };
  new Function("module", "exports", "require", js)(module, module.exports, require);
  return module.exports;
}

const sourceId = "far-doc";
const goodText = (value) => value.length >= 12 && value.length <= 165 && !value.includes("@");
const rows = [
  { id: "p1", sourceFileId: sourceId, category: "open-decision", clientText: "Verify remaining workstation replacement needs", evidence: "Internal inventory planning note", approved: true },
  { id: "p2", sourceFileId: sourceId, category: "open-decision", clientText: "Verify current backup recovery readiness", evidence: "Internal continuity note", approved: true },
  { id: "p3", sourceFileId: sourceId, category: "potential-adjustment", clientText: "Review recurring interruptions during the year", evidence: "Internal support history note", approved: true },
  { id: "hidden", sourceFileId: sourceId, category: "potential-adjustment", clientText: "Unapproved account material must not be shown", evidence: "Potentially sensitive internal source", approved: false },
];
const groups = (project) => ({
  "service-value": [],
  "open-decision": rows.filter((row) => row.category === "open-decision" && row.approved).map((row) => project.farReview.items.find((item) => item.id === row.id) ?? row),
  "potential-adjustment": rows.filter((row) => row.category === "potential-adjustment" && row.approved).map((row) => project.farReview.items.find((item) => item.id === row.id) ?? row),
});
const project = {
  type: "client-report", farReview: { items: rows },
  sources: [{ kind: "far-brief", files: [{ id: sourceId, status: "ready", analysis: { sourceType: "far-brief" } }] }],
  intelligence: { facts: [] },
};

test("only approved FAR decisions can be selected; status and scored status remain separate", async () => {
  const priority = await loadModule(prioritySource, { "./far-review": { farPresentationItems: groups, farSourceFile: (value) => value.sources.find((source) => source.kind === "far-brief")?.files[0] ?? null, safeFarClientText: goodText } });
  assert.deepEqual(priority.farTopPriorities(project).map((item) => item.id), ["p1", "p2", "p3"]);
  assert.equal(priority.farPriorityStatus(rows[0]), "verify");
  assert.equal(priority.farPriorityScoreLink(project, rows[0]).scored, false);
  assert.equal(priority.farPriorityScoreLink(project, rows[2]).area, "Operational improvement");
  assert.equal(priority.safeFarActionText("ticket #123 — client internal"), "");
  assert.equal(priority.safeFarActionText("Coordinate next review with Advantage"), "Coordinate next review with Advantage");
  const selection = { ...project, farReview: { items: rows.map((item) => ({ ...item, prioritySelected: item.id === "p2" })) } };
  assert.deepEqual(priority.farTopPriorities(selection).map((item) => item.id), ["p2"]);
});

test("THR area link requires another present verified source, not the FAR itself", async () => {
  const priority = await loadModule(prioritySource, { "./far-review": { farPresentationItems: groups, farSourceFile: (value) => value.sources.find((source) => source.kind === "far-brief")?.files[0] ?? null, safeFarClientText: goodText } });
  const current = { ...project,
    sources: [...project.sources, { kind: "scalepad", files: [{ id: "asset-2026", status: "ready", analysis: { sourceType: "scalepad" } }] }],
    intelligence: { facts: [{ key: "scalepad.inventory", confidence: "high", sourceFileId: "asset-2026" }] },
  };
  assert.equal(priority.farPriorityScoreLink(current, rows[0]).scored, true);
  assert.equal(priority.farPriorityScoreLink({ ...current, sources: project.sources }, rows[0]).scored, false);
  assert.doesNotMatch(score, /farTopPriorities|farPriorityStatus|farPriorityScoreLink/);
});

test("PDF contains safe action owners and outcomes but no unapproved or internal FAR text", async () => {
  const priorities = await loadModule(prioritySource, { "./far-review": { farPresentationItems: groups, farSourceFile: (value) => value.sources.find((source) => source.kind === "far-brief")?.files[0] ?? null, safeFarClientText: goodText } });
  const pdfModule = await loadModule(pdfSource, {
    "@/lib/far/far-review": { FAR_CATEGORY_LABEL: {}, farPresentationItems: groups },
    "@/lib/far/far-priorities": priorities,
  });
  const updated = { ...project, farReview: { items: [
    { ...rows[0], priorityStatus: "plan", priorityOwner: "client", priorityNextAction: "Confirm the workstation count", priorityTargetDate: "2027-02-01" },
    { ...rows[1], priorityStatus: "resolved", priorityResolutionNote: "Client reports UPS already replaced" },
    { ...rows[2], priorityStatus: "later", priorityNextAction: "Review during the next planning cycle" },
    rows[3],
  ] } };
  const html = pdfModule.farPriorityActionPlanHtml(updated, "pdf-page", "<footer>Footer</footer>");
  assert.equal((html.match(/background:linear-gradient\(135deg,#f8fcff/g) ?? []).length, 3);
  assert.match(html, /Top priorities &amp; agreed actions/);
  assert.match(html, /Client · Target 2027-02-01/);
  assert.match(html, /Reported resolved/);
  assert.match(html, /Technical verification pending/);
  assert.match(html, /Future review/);
  assert.doesNotMatch(html, /Unapproved account material|Potentially sensitive internal source|Internal inventory planning note/);
  assert.equal(pdfModule.farPriorityActionPlanHtml({ ...updated, type: "prospect-proposal" }), "");
});

test("one Top 3 slide comes after budget, before recap; review and export retain approved decisions", () => {
  const branch = slides.slice(slides.indexOf('if (project.type === "client-report" && clientReportAvailable(project)) {'), slides.indexOf('if (project.type !== "client-report")'));
  assert.match(branch, /const priorities: PresentationSection\[\] = farTopPriorities\(project\)\.length \? \["priorities"\] : \[\]/);
  assert.match(branch, /\.\.\.planning, \.\.\.budget, \.\.\.priorities, \.\.\.agreement, "recap"/);
  assert.doesNotMatch(branch, /"overview", \.\.\.far/);
  assert.match(slides, /section === "priorities" && <FarTopPrioritiesPresentation project=\{project\} onUpdate=\{onUpdate\}/);
  assert.match(slides, /<RecapVisual project=\{project\}/);
  assert.match(editor, /Top 3 priority/);
  assert.match(report, /printFarPriorities/);
  assert.doesNotMatch(report, /printFarReview/);
  assert.match(budget, /pdf-far-priority-page/);
  assert.equal(JSON.parse(read("../package.json")).version, "1.3.30");
  assert.equal(JSON.parse(read("../package-lock.json")).version, "1.3.30");
});
