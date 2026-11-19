import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

async function typescriptModule(source) {
  const ts = (await import("typescript")).default;
  const js = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    verbatimModuleSyntax: true,
  } }).outputText;
  return import("data:text/javascript;charset=utf-8," + encodeURIComponent(js));
}

test("FAR recognizes supported generic evidence sections; does not invent conclusions", async () => {
  const parser = await typescriptModule(read("../src/lib/intelligence/browser/far-evidence.ts"));
  const text = [
    "FAR Account Evidence Brief",
    "Five strongest facts demonstrating value",
    "The support team restored access to the application after a server outage.",
    "The engineer resolved a network outage and restored office connectivity.",
    "Top potential savings opportunities",
    "Reconcile 24 managed workstations against the current active inventory before adjusting billing.",
    "Most important unanswered questions",
    "Which server stores historical imaging files and where are they backed up?",
  ].join("\n");
  const items = parser.extractFarCandidates(text);
  assert.equal(items.filter((item) => item.category === "service-value").length, 2);
  assert.equal(items.filter((item) => item.category === "potential-adjustment").length, 1);
  assert.equal(items.filter((item) => item.category === "open-decision").length, 1);
  assert.ok(items.every((item) => item.evidence && item.suggestion && item.section));
  assert.ok(items.some((item) => item.reviewStatus === "conditional"));
  assert.equal(parser.extractFarCandidates("A statement without evidence headings.").length, 0);
});

test("FAR content requires current-source approval and rejects identifiers and internal prices", async () => {
  const far = await typescriptModule(read("../src/lib/far/far-review.ts"));
  const sample = {
    sources: [{ kind: "far-brief", files: [{ id: "brief-1", status: "processed", analysis: { sourceType: "far-brief", facts: [{ key: "far.candidates", value: ['{"id":"far_1","category":"service-value","section":"Documented outcomes","evidence":"Resolved a critical workstation failure.","suggestion":"Resolved critical workstation issues","reviewStatus":"documented"}'] }] } }] }],
  };
  assert.equal(far.hasFarPresentationItems(sample), false);
  const candidates = far.farCandidates(sample);
  assert.equal(candidates.length, 1);
  let reviewed = far.updateFarReviewItem(sample, { id: candidates[0].recordId, sourceFileId: "brief-1", category: "service-value", clientText: candidates[0].suggestion, evidence: candidates[0].evidence, approved: true });
  assert.equal(far.hasFarPresentationItems(reviewed), true);
  assert.equal(far.farPresentationItems(reviewed)["service-value"].length, 1);
  assert.equal(far.safeFarClientText("Ticket 123456 saved $999 for Dr. Someone."), false);
  assert.equal(far.safeFarClientText("Resolved a critical workstation issue"), true);
  reviewed = { ...reviewed, sources: [{ kind: "far-brief", files: [] }] };
  assert.equal(far.hasFarPresentationItems(reviewed), false);
});

test("both optional document slots survive existing report migrations and are browser-only", () => {
  const templates = read("../src/lib/projects/templates.ts");
  const store = read("../src/lib/projects/store.ts");
  const parser = read("../src/lib/intelligence/browser/analyze-file.ts");
  const workspace = read("../src/components/project-workspace.tsx");
  assert.match(templates, /kind: "far-brief".*required: false/);
  assert.match(templates, /kind: "remote-access-inventory".*required: false/);
  assert.match(store, /withCurrentSourceSlots/);
  assert.match(workspace, /FarEvidenceEditor project=\{currentProject\}/);
  assert.match(workspace, /withImportedRemoteAccess\(inventoryRebuilt\)/);
  assert.match(workspace, /detachOptionalSource/);
  assert.match(parser, /extractFarCandidates\(text\)/);
  assert.match(parser, /remoteAccessFromSpreadsheet/);
  assert.match(parser, /rawTextPreview: ""/);
});

test("remote access sections and reports are hidden without a valid uploaded document", () => {
  const presentation = read("../src/components/outcome-experience.tsx");
  const report = read("../src/lib/outcomes/remote-access-report.ts");
  const helper = read("../src/lib/security/remote-access-audit.ts");
  assert.match(presentation, /hasRemoteAccessSource\(project\) \? \["remote-access"\] : \[\]/);
  assert.match(presentation, /hasRemoteAccessSource\(project\) && remoteAccessRemovalEntries\(project\)/);
  assert.match(report, /!hasRemoteAccessSource\(project\) \|\| !entries\.length/);
  assert.match(report, /!hasRemoteAccessSource\(project\) \|\| !rows\.length/);
  assert.match(helper, /withImportedRemoteAccess/);
});

test("FAR slide and PDF include only approved, short client-safe phrases", () => {
  const slides = read("../src/components/outcome-experience.tsx");
  const component = read("../src/components/far-evidence-presentation.tsx");
  const report = read("../src/lib/outcomes/far-review-report.ts");
  const pdf = read("../src/lib/outcomes/export-html.ts");
  assert.match(slides, /hasFarPresentationItems\(project\)/);
  assert.match(slides, /section === "far"/);
  assert.match(slides, /"overview", \.\.\.far, "security"/);
  assert.match(component, /farPresentationItems\(project\)/);
  assert.match(report, /farPresentationItems\(project\)/);
  assert.match(report, /escapeHtml\(item\.clientText\)/);
  assert.match(pdf, /printFarReview/);
});

test("security question screen is compact and retains flip-card behavior", () => {
  const ui = read("../src/components/hipaa-presentation.tsx");
  const css = read("../src/components/security-review-premium.module.css");
  assert.match(ui, /<h2>Security review<\/h2>/);
  assert.match(ui, /compactQuestionHeader/);
  assert.doesNotMatch(ui, /premium\.progressBubble|premium\.progressTrack|premium\.progressMeta|premium\.cardIcon/);
  assert.match(ui, /setIsFlipped\(true\)/);
  assert.match(ui, /Save &amp; next question/);
  assert.match(css, /\.questionExperience \.card\{min-height:260px/);
});
