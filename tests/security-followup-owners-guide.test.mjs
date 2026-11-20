import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const pdf = read("../src/lib/outcomes/export-html.ts");
const card = read("../src/components/security-follow-up-owner-editor.tsx");
const meeting = read("../src/components/hipaa-presentation.tsx");
const editor = read("../src/components/hipaa-readiness.tsx");
const engine = read("../src/lib/hipaa/engine.ts");
const facing = read("../src/lib/hipaa/client-facing.ts");

async function loadTs(path) {
  const ts = (await import("typescript")).default;
  const transpiled = ts.transpileModule(read(path), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return import("data:text/javascript;charset=utf-8," + encodeURIComponent(transpiled));
}

test("THR PDF has concise 10-card insurance guide in interior-page format", async () => {
  const { securityControlsGuideHtml, SECURITY_CONTROLS_GUIDE_CSS } = await loadTs("../src/lib/outcomes/security-controls-guide.ts");
  const project = { type: "client-report", hipaa: { enabled: true } };
  const html = securityControlsGuideHtml(project, '<footer class="pdf-page-footer">footer</footer>');
  assert.match(html, /pdf-page pdf-controls-guide/);
  assert.match(html, /class="pdf-section-header"/);
  assert.match(html, /Cyber insurance &amp; security controls/);
  assert.equal((html.match(/class="pdf-controls-guide-card"/g) ?? []).length, 10);
  assert.doesNotMatch(html, /<img|pdf-brandline|advantage-logo/i);
  assert.match(html, /Before you check Yes/);
  assert.match(html, /active agreement/);
  assert.match(SECURITY_CONTROLS_GUIDE_CSS, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.equal(securityControlsGuideHtml({ ...project, hipaa: { enabled: false } }, "footer"), "");
  assert.equal(securityControlsGuideHtml({ ...project, type: "prospect-proposal" }, "footer"), "");
});

test("technical unknowns default Advantage, client unknowns default client, each can be reassigned", async () => {
  const { securityFollowUpOwner, isClientSecurityFollowUp, needsSecurityFollowUp } = await loadTs("../src/lib/hipaa/follow-up-owner.ts");
  const technical = { ownership: "joint" };
  const clients = { ownership: "client" };
  const unknown = { response: "not-yet-assessed", deferred: true };
  assert.equal(securityFollowUpOwner(technical, unknown), "advantage");
  assert.equal(securityFollowUpOwner(clients, unknown), "client");
  assert.equal(isClientSecurityFollowUp(technical, unknown), false);
  assert.equal(isClientSecurityFollowUp(clients, unknown), true);
  assert.equal(isClientSecurityFollowUp(technical, { ...unknown, followUpOwner: "client" }), true);
  assert.equal(isClientSecurityFollowUp(clients, { ...unknown, followUpOwner: "advantage" }), false);
  assert.equal(isClientSecurityFollowUp(clients, { ...unknown, response: "yes", deferred: false }), false);
  assert.equal(needsSecurityFollowUp({ ...unknown, response: "no", deferred: false }), false);
});

test("fillable security appendix is limited to client-owned unanswered items", () => {
  assert.match(pdf, /outstandingHipaaQuestionCount/);
  assert.match(pdf, /isClientSecurityFollowUp\(question, answer\)/);
  assert.match(pdf, /answer\?\.includeInReport !== false && isClientSecurityFollowUp\(question, answer\)/);
  assert.ok(pdf.includes('data-pdf-field="hipaa.' + "$" + '{escapeHtml(question.id)}.response"'));
  assert.ok(pdf.includes('data-pdf-field="hipaa.' + "$" + '{escapeHtml(question.id)}.notes"'));
  assert.match(pdf, /Security Follow-Up/);
  assert.doesNotMatch(pdf, /Shared responsibility, without compliance certification/);
  assert.doesNotMatch(pdf, /Client confirmation pending<\/strong>/);
  assert.equal(pdf.includes("$"+"{hipaaConfirmation}"),false);
  assert.equal(pdf.includes("$"+"{printSecurityInsights}"),false);
  assert.doesNotMatch(pdf, /securityInsightsPdfPage/);
});

test("guide sits immediately after reviewed answers before remote access", () => {
  const marker = (name) => "    " + "$" + "{" + name + "}";
  const answers = pdf.indexOf(marker("printHipaaAnswers"));
  const guide = pdf.indexOf(marker("printSecurityGuide"));
  const access = pdf.indexOf(marker("printRemoteAccess"));
  assert.ok(answers !== -1 && guide > answers && access > guide);
  assert.match(pdf, /SECURITY_CONTROLS_GUIDE_CSS/);
  assert.match(pdf, /securityControlsGuideHtml\(project, pdfFooter\("Security Controls Guide"\)\)/);
});

test("presentation and back-office editor offer owner choices and editable next steps", () => {
  assert.match(meeting, /followUps\.map/);
  assert.match(meeting, /SecurityFollowUpOwnerEditor/);
  assert.match(editor, /needsSecurityFollowUp\(answer\) && <SecurityFollowUpOwnerEditor/);
  assert.match(card, />Advantage<\/button>/);
  assert.match(card, />Your team<\/button>/);
  assert.match(card, /followUpOwner: "advantage"/);
  assert.match(card, /followUpOwner: "client"/);
  assert.match(card, /setDraft\(event\.target\.value\); setDirty\(true\)/);
  assert.match(card, /onBlur=\{commitAction\}/);
  assert.match(card, /owner === "client" \? "Your team to confirm" : "Advantage to verify"/);
  assert.match(card, /recommendedAction: draft/);
  assert.match(engine, /followUpOwner: question\.ownership === "client" \? "client" : "advantage"/);
  assert.match(facing, /needsSecurityFollowUp\(answer\)/);
  assert.match(facing, /Advantage will verify: /);
  assert.match(facing, /Client will confirm: /);
});
