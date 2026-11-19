import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

async function loadStandaloneTs(path) {
  const ts = (await import("typescript")).default;
  const js = ts.transpileModule(read(path), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    verbatimModuleSyntax: true,
  } }).outputText;
  return import("data:text/javascript;charset=utf-8," + encodeURIComponent(js));
}

test("the client-facing safeguards have distinct application logins and cloud/offsite MFA", async () => {
  const { HIPAA_QUESTIONS, HIPAA_QUESTION_SET_VERSION } = await loadStandaloneTs("../src/lib/hipaa/questions.ts");
  assert.equal(HIPAA_QUESTIONS.length, 11);
  assert.equal(new Set(HIPAA_QUESTIONS.map((q) => q.id)).size, HIPAA_QUESTIONS.length);
  assert.equal(HIPAA_QUESTION_SET_VERSION, "2026-technology-safeguards-2");
  const login = HIPAA_QUESTIONS.find((q) => q.id === "SEC-03");
  const mfa = HIPAA_QUESTIONS.find((q) => q.id === "SEC-04");
  assert.match(login.question, /\[\[core-software\]\]/);
  assert.match(login.question, /own username.*shared office login/i);
  assert.doesNotMatch(login.question, /Windows|workstation|MFA|remote access/i);
  assert.match(login.clientHint, /not signing into each workstation/i);
  assert.match(mfa.question, /multifactor authentication/i);
  assert.match(mfa.question, /email.*\[\[core-software\]\] when cloud-hosted.*outside the office/i);
  assert.match(mfa.clientHint, /Even when used at the office/i);
  assert.doesNotMatch(mfa.question, /every workstation|all onsite devices/i);
  assert.ok(HIPAA_QUESTIONS.every((q) => !/GoToMyPC|TeamViewer|ScreenConnect/i.test(q.question)));
  assert.ok(HIPAA_QUESTIONS.every((q) => !/risk assessment|regulatory compliance|formal policy/i.test(q.question)));
});

test("onsite/cloud backups, notifications, and restores remain independently reviewable", async () => {
  const { HIPAA_QUESTIONS } = await loadStandaloneTs("../src/lib/hipaa/questions.ts");
  const questions = new Map(HIPAA_QUESTIONS.map((q) => [q.id, q.question]));
  assert.match(questions.get("SEC-06"), /local backups and encrypted offsite or cloud copies/i);
  assert.match(questions.get("SEC-07"), /backup status emails or reports/i);
  assert.match(questions.get("SEC-08"), /recovery plan.*tested to confirm they can restore/i);
  assert.match(questions.get("SEC-09"), /joins, changes roles or leaves/i);
  assert.match(questions.get("SEC-10"), /encryption and automatic screen locks/i);
  assert.match(questions.get("SEC-11"), /securely removed or the media destroyed/i);
  assert.equal(HIPAA_QUESTIONS.filter((q) => /remote access accounts/i.test(q.question)).length, 0);
});

test("main application terminology adapts across practice, firm, hospital and business", async () => {
  const { adaptOrganizationLanguage } = await loadStandaloneTs("../src/lib/projects/client-language.ts");
  const q = "When your team opens [[core-software]], does each person have their own username?";
  for (const [term, expected] of [
    ["practice", "your practice management software"],
    ["firm", "your main client or case management software"],
    ["hospital", "your patient management software"],
    ["business", "the main software used for client or business records"],
  ]) {
    const copy = adaptOrganizationLanguage(q, { client: { organizationTerm: term } });
    assert.ok(copy.includes(expected), term);
    assert.doesNotMatch(copy, /\[\[core-software\]\]/);
  }
});

test("the previous combined access answer is archived rather than falsely split into two Yes answers", () => {
  const engine = read("../src/lib/hipaa/engine.ts");
  assert.match(engine, /previousVersion !== "2026-security-conversation-1"/);
  assert.match(engine, /"SEC-05": "SEC-04"/);
  assert.match(engine, /"SEC-06": "SEC-05"/);
  assert.match(engine, /"SEC-07": "SEC-06"/);
  assert.match(engine, /"SEC-08": "SEC-07"/);
  assert.doesNotMatch(engine, /"SEC-03": "SEC-03"/);
  assert.doesNotMatch(engine, /"SEC-04": "SEC-03"/);
  assert.match(engine, /legacyAnswers: migrating \? \[\.\.\.\(existing\.legacyAnswers \?\? \[\]\), \.\.\.existing\.answers\]/);
  assert.match(engine, /clientConfirmation: migrating/);
  assert.match(engine, /if \(question\.id === "SEC-06"\)/);
  assert.doesNotMatch(engine, /if \(answer\.questionId === "SEC-08" && answer\.response/);
});

test("the security card supports partial and unknown answers and does not mix in remote account audit", () => {
  const ui = read("../src/components/hipaa-presentation.tsx");
  const security = read("../src/components/outcome-experience.tsx");
  const documentGate = read("../src/lib/security/remote-access-audit.ts");
  assert.match(ui, /chooseResponse\("partially"\)/);
  assert.match(ui, />Somewhat<\/button>/);
  assert.match(ui, /onClick=\{skipCurrent\}>Not sure/);
  assert.match(ui, /HIPAA_QUESTIONS\.length/);
  assert.match(ui, /current\.question\.clientHint/);
  assert.doesNotMatch(ui, /SecurityTrainingDecision|trainingDecisionLabel/);
  assert.match(security, /hasRemoteAccessSource\(project\) \? \["remote-access"\] : \[\]/);
  assert.match(documentGate, /kind === "remote-access-inventory"/);
});

test("PDF report follows current control names, not the retired training or policy questionnaire", () => {
  const pdf = read("../src/lib/outcomes/export-html.ts");
  const followups = read("../src/lib/hipaa/client-facing.ts");
  assert.match(pdf, /These technology safeguards cover managed protection, software sign-ins, cloud MFA/);
  assert.doesNotMatch(pdf, /SEC-08\.training-source|These ten checkpoints/);
  assert.match(followups, /"SEC-03": "Confirm whether staff use individual logins/);
  assert.match(followups, /"SEC-04": "Review MFA for cloud sign-ins/);
  assert.match(followups, /"SEC-11": "Confirm secure wiping or destruction/);
});
