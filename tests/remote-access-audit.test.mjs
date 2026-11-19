import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const helperSource = read("../src/lib/security/remote-access-audit.ts");
const types = read("../src/lib/projects/types.ts");
const slide = read("../src/components/remote-access-audit-presentation.tsx");
const questionCards = read("../src/components/hipaa-presentation.tsx");
const css = read("../src/components/security-review-premium.module.css");
const presentation = read("../src/components/outcome-experience.tsx");
const report = read("../src/lib/outcomes/remote-access-report.ts");
const exportHtml = read("../src/lib/outcomes/export-html.ts");

async function helper() {
  const ts = (await import("typescript")).default;
  const js = ts.transpileModule(helperSource, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    verbatimModuleSyntax: true,
  } }).outputText;
  return import("data:text/javascript;charset=utf-8," + encodeURIComponent(js));
}

test("remote access choices stay within the existing browser-local project", () => {
  assert.match(types, /remoteAccessAudit\?: RemoteAccessAudit/);
  assert.match(presentation, /section === "remote-access"/);
  assert.match(presentation, /RemoteAccessAuditPresentation project=\{project\} onUpdate=\{onUpdate\}/);
  assert.match(presentation, /"hipaa", "remote-access"/);
  assert.doesNotMatch(slide, /fetch\(|XMLHttpRequest|navigator\.sendBeacon/);
});

test("GoToMyPC accounts are individually recorded with email and keep/remove decisions", async () => {
  const audit = await helper();
  let project = { client: { name: "Sample office" } };
  project = audit.addRemoteAccessEntry(project, "GoToMyPC");
  project = audit.addRemoteAccessEntry(project, "GoToMyPC");
  const ids = audit.remoteAccessEntries(project).map((row) => row.id);
  assert.notEqual(ids[0], ids[1]);
  project = audit.updateRemoteAccessEntry(project, ids[0], {
    account: "active@example.test", assignedTo: "Front desk", status: "needed",
  });
  project = audit.updateRemoteAccessEntry(project, ids[1], {
    account: "unused@example.test", assignedTo: "Former employee", status: "remove",
  });
  const rows = audit.remoteAccessEntries(project);
  assert.equal(rows[0].account, "active@example.test");
  assert.equal(rows[1].account, "unused@example.test");
  assert.equal(rows[0].status, "needed");
  assert.equal(rows[1].status, "remove");
  assert.ok(rows[0].reviewedAt && rows[1].reviewedAt);
  assert.equal(audit.remoteAccessRemovalEntries(project).length, 1);
  const support = audit.remoteAccessSupportHandoffText(project);
  assert.match(support, /Sample office/);
  assert.match(support, /unused@example\.test/);
  assert.match(support, /Former employee/);
  assert.match(support, /licensing \/ billing/);
  assert.doesNotMatch(support, /active@example\.test/);
});

test("verified removals are not new Support requests and changing decision clears verified state", async () => {
  const audit = await helper();
  let project = audit.addRemoteAccessEntry({}, "AnyDesk");
  const id = audit.remoteAccessEntries(project)[0].id;
  project = audit.updateRemoteAccessEntry(project, id, { account: "test@example.test", status: "remove" });
  assert.equal(audit.remoteAccessRemovalEntries(project).length, 1);
  project = audit.updateRemoteAccessEntry(project, id, { removalVerifiedAt: "2026-11-18T18:00:00.000Z" });
  assert.equal(audit.remoteAccessRemovalEntries(project).length, 0);
  project = audit.updateRemoteAccessEntry(project, id, { status: "needed" });
  assert.equal(audit.remoteAccessEntries(project)[0].removalVerifiedAt, "");
  project = audit.updateRemoteAccessEntry(project, id, { status: "remove" });
  assert.equal(audit.remoteAccessRemovalEntries(project).length, 1);
  project = audit.removeRemoteAccessAuditEntry(project, id);
  assert.equal(audit.remoteAccessEntries(project).length, 0);
});

test("client slide is a plain account list with email, user and one keep/remove decision", () => {
  assert.match(slide, /Remote access accounts/);
  assert.match(slide, /Account email/);
  assert.match(slide, /User \/ device \(optional\)/);
  assert.match(slide, /GoToMyPC/);
  assert.match(slide, /Other software/);
  assert.match(slide, /type="radio"/);
  assert.match(slide, /<span>Keep<\/span>/);
  assert.match(slide, /<span>Remove<\/span>/);
  assert.doesNotMatch(slide, /Removal actually verified|A review choice is not a removal action|reviewedAt/);
  assert.match(css, /accessSimpleRow/);
  assert.match(css, /@media\(max-width:650px\)/);
});

test("pending removals appear only at the end of the deck and can be copied for Support", () => {
  assert.match(presentation, /remoteAccessRemovalEntries\(project\)\.length > 0/);
  assert.match(presentation, /"recap", \.\.\.support/);
  assert.match(presentation, /"authorization", \.\.\.support/);
  assert.match(presentation, /section === "remote-access-handoff"/);
  assert.match(slide, /RemoteAccessSupportHandoffPresentation/);
  assert.match(slide, /remoteAccessSupportHandoffText\(project\)/);
  assert.match(slide, /navigator\.clipboard\.writeText/);
});

test("question cards still flip and support reduced motion", () => {
  assert.match(questionCards, /setIsFlipped\(true\)/);
  assert.match(questionCards, /setIsFlipped\(false\)/);
  assert.match(questionCards, /aria-hidden=\{isFlipped\}/);
  assert.match(questionCards, /inert=\{!isFlipped\}/);
  assert.match(css, /rotateY\(-180deg\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("PDFs show the brief account review and put unfinished Support removals at the end", () => {
  assert.match(report, /remoteAccessEntries\(project\)/);
  assert.match(report, /remoteAccessRemovalEntries\(project\)/);
  assert.match(report, /function remoteAccessRemovalHandoffHtml/);
  assert.match(report, /Account email:/);
  assert.match(report, /related account licenses or billing/);
  assert.match(exportHtml, /const printAccessHandoff = remoteAccessRemovalHandoffHtml/);
  assert.match(exportHtml, /\$\{printHipaaFollowUp\}\s*\$\{printAccessHandoff\}/);
  assert.match(exportHtml, /\$\{proposalHipaaFollowUp\}\s*\$\{remoteAccessRemovalHandoffHtml\(project, "page"\)\}/);
});
