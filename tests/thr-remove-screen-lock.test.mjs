import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const definitions = source("src/lib/hipaa/questions.ts");
const engineSource = source("src/lib/hipaa/engine.ts");
const followup = source("src/lib/hipaa/client-facing.ts");
const presenter = source("src/components/hipaa-presentation.tsx");
const pdf = source("src/lib/outcomes/export-html.ts");

function loadTs(code, deps = {}) {
  const compiled = ts.transpileModule(code, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }}).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", compiled)(module, module.exports, (name) => {
    if (name in deps) return deps[name];
    throw new Error("Unexpected import: " + name);
  });
  return module.exports;
}

const questionModule = loadTs(definitions);
const hipaaEngine = loadTs(engineSource, { "./questions": questionModule });

test("SEC-10 is still an encryption question but no longer asks about automatic screen locking", () => {
  const questions = questionModule.HIPAA_QUESTIONS;
  assert.equal(questions.length, 12);
  assert.equal(new Set(questions.map((q) => q.id)).size, 12);
  const sec10 = questions.find((question) => question.id === "SEC-10");
  assert.equal(sec10.title, "Device encryption");
  assert.match(sec10.question, /encrypted where appropriate/i);
  assert.match(sec10.reviewPrompts.join(" "), /lost or stolen/);
  const displayedText = [sec10.title, sec10.question, sec10.plainLanguageExplanation, ...(sec10.reviewPrompts ?? []), ...(sec10.clientConfirms ?? []), ...(sec10.advantageConfirms ?? []), followup].join(" ");
  assert.doesNotMatch(displayedText, /screen[ -]?lock|automatic(?:ally)? lock|automatic logoff|locking controls/i);
  assert.deepEqual(sec10.regulationMappings, ["45 CFR 164.312(a)(2)(iv)"]);
  assert.equal(questionModule.HIPAA_QUESTION_SET_VERSION, "2026-technology-safeguards-4");
  assert.match(presenter, /HIPAA_QUESTIONS/);
  assert.match(pdf, /HIPAA_QUESTIONS/);
});

test("existing answers to combined SEC-10 are archived, not misrepresented as encryption answers", () => {
  const oldAnswer = { questionId: "SEC-10", response: "no", internalNotes: "Previous call discussed automatic screen locks", includeInReport: true };
  const preserved = { questionId: "SEC-12", response: "yes", internalNotes: "Annual training completed", includeInReport: true };
  const project = {
    intelligence: { facts: [], lastRunAt: "" },
    hipaa: {
      questionSetVersion: "2026-technology-safeguards-3",
      enabled: true,
      status: "confirmed",
      answers: [oldAnswer, preserved],
      reportingPeriod: { start: "", end: "" },
      clientConfirmation: { status: "confirmed", confirmer: "Office manager", confirmedAt: "2026-11-01", acceptedResponsibility: true },
      snapshots: [{ id: "prior-approval" }],
      includeDetailedAppendix: true,
      lastUpdatedAt: "",
    },
  };
  const normalized = hipaaEngine.normalizeHipaaAssessment(project);
  assert.equal(normalized.questionSetVersion, "2026-technology-safeguards-4");
  assert.equal(normalized.answers.find((a) => a.questionId === "SEC-10").response, "not-yet-assessed");
  assert.equal(normalized.answers.find((a) => a.questionId === "SEC-10").internalNotes, "");
  assert.equal(normalized.answers.find((a) => a.questionId === "SEC-12").response, "yes");
  assert.equal(normalized.clientConfirmation.status, "pending");
  assert.equal(normalized.legacyAnswers.find((a) => a.questionId === "SEC-10").response, "no");
  assert.deepEqual(normalized.snapshots, [{ id: "prior-approval" }]);
  assert.deepEqual(hipaaEngine.hipaaQuestionsForPresentation({ hipaa: normalized }).filter((a) => a.question.id === "SEC-10").map((a) => a.question.question),
    [questionModule.HIPAA_QUESTIONS.find((q) => q.id === "SEC-10").question]);
});

test("older v2 reviews preserve their other answers while dropping the combined SEC-10 answer", () => {
  const project = {
    intelligence: { facts: [], lastRunAt: "" },
    hipaa: {
      questionSetVersion: "2026-technology-safeguards-2", enabled: true, status: "in-progress",
      answers: [{ questionId: "SEC-10", response: "yes" }, { questionId: "SEC-03", response: "yes" }],
      clientConfirmation: { status: "pending", confirmer: "", confirmedAt: "", acceptedResponsibility: false },
      reportingPeriod: { start: "", end: "" }, snapshots: [],
    },
  };
  const normalized = hipaaEngine.normalizeHipaaAssessment(project);
  assert.equal(normalized.answers.find((a) => a.questionId === "SEC-10").response, "not-yet-assessed");
  assert.equal(normalized.answers.find((a) => a.questionId === "SEC-03").response, "yes");
  assert.equal(normalized.answers.find((a) => a.questionId === "SEC-12").response, "not-yet-assessed");
});
