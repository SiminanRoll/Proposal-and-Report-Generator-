import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const helperSource = read("../src/lib/security/remote-access-audit.ts");
const types = read("../src/lib/projects/types.ts");
const slide = read("../src/components/remote-access-audit-presentation.tsx");
const card = read("../src/components/hipaa-presentation.tsx");
const css = read("../src/components/security-review-premium.module.css");
const outcome = read("../src/components/outcome-experience.tsx");
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

test("audit stays with the project, independently of existing HIPAA answers", () => {
  assert.match(types, /remoteAccessAudit\?: RemoteAccessAudit/);
  assert.match(types, /removalVerifiedAt: string/);
  assert.match(outcome, /section === "remote-access"/);
  assert.match(outcome, /RemoteAccessAuditPresentation project=\{project\} onUpdate=\{onUpdate\}/);
  assert.match(outcome, /"hipaa", "remote-access"/);
});

test("multiple GoToMyPC accounts can be reviewed independently and logged", async () => {
  const audit = await helper();
  let project = {};
  project = audit.addRemoteAccessEntry(project, "GoToMyPC");
  project = audit.addRemoteAccessEntry(project, "GoToMyPC");
  let rows = audit.remoteAccessEntries(project);
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].id, rows[1].id);
  project = audit.updateRemoteAccessEntry(project, rows[0].id, { account: "Reception", assignedTo: "Front desk", status: "needed" });
  project = audit.updateRemoteAccessEntry(project, rows[1].id, { account: "Former staff", status: "remove" });
  rows = audit.remoteAccessEntries(project);
  assert.equal(rows[0].status, "needed");
  assert.equal(rows[1].status, "remove");
  assert.ok(rows[0].reviewedAt);
  assert.ok(rows[1].reviewedAt);
  assert.equal(audit.remoteAccessAuditCounts(rows).removalNeeded, 1);
  assert.equal(audit.remoteAccessAuditCounts(rows).needed, 1);
  assert.equal(audit.remoteAccessAuditCounts(rows).removedVerified, 0);
});

test("flagging removal is not the same as verified revocation", async () => {
  const audit = await helper();
  let project = audit.addRemoteAccessEntry({}, "AnyDesk");
  const id = audit.remoteAccessEntries(project)[0].id;
  project = audit.updateRemoteAccessEntry(project, id, { status: "remove" });
  assert.equal(audit.remoteAccessEntries(project)[0].removalVerifiedAt, "");
  project = audit.updateRemoteAccessEntry(project, id, { removalVerifiedAt: "2026-11-18T18:00:00.000Z" });
  assert.equal(audit.remoteAccessAuditCounts(audit.remoteAccessEntries(project)).removedVerified, 1);
  project = audit.updateRemoteAccessEntry(project, id, { status: "needed" });
  assert.equal(audit.remoteAccessEntries(project)[0].removalVerifiedAt, "");
  assert.equal(audit.remoteAccessAuditCounts(audit.remoteAccessEntries(project)).removalNeeded, 0);
  project = audit.removeRemoteAccessAuditEntry(project, id);
  assert.equal(audit.remoteAccessEntries(project).length, 0);
});

test("UI uses exclusive, accessible keep/remove decisions and has no account deletion API", () => {
  assert.match(slide, /type="radio"/);
  assert.match(slide, /Yes, still active/);
  assert.match(slide, /No, do not need/);
  assert.match(slide, /Removal actually verified/);
  assert.match(slide, /GoToMyPC account/);
  assert.match(slide, /other remote-access products|Other software/i);
  assert.match(slide, /does not deactivate a tool/);
  assert.match(slide, /no passwords/i);
  assert.doesNotMatch(slide, /fetch\(|XMLHttpRequest|navigator\.sendBeacon/);
});

test("question cards flip, handle incomplete answers, and respect reduced-motion preferences", () => {
  assert.match(card, /setIsFlipped\(true\)/);
  assert.match(card, /setIsFlipped\(false\)/);
  assert.match(card, /aria-hidden=\{isFlipped\}/);
  assert.match(card, /inert=\{!isFlipped\}/);
  assert.match(card, /Save &amp; next question/);
  assert.match(card, /SecurityTrainingDecision/);
  assert.match(css, /rotateY\(-180deg\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("print report records each account and distinguishes pending removal from verified removal", () => {
  assert.match(report, /remoteAccessEntries\(project\)/);
  assert.match(report, /NO — REMOVE ACCESS/);
  assert.match(report, /REMOVAL VERIFIED/);
  assert.match(report, /Accounts listed/);
  assert.match(report, /escapeHtml\(entry\.account/);
  assert.match(report, /do not include passwords/i);
  assert.match(exportHtml, /printRemoteAccess/);
  assert.match(exportHtml, /remoteAccessAuditReportHtml\(project, "page"\)/);
});
