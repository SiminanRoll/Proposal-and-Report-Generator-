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

const questions = loadTs(definitions);
const engine = loadTs(engineSource, { "./questions": questions });
const activeIds = questions.HIPAA_QUESTIONS.map((q) => q.id);

function legacyProject(version = "2026-technology-safeguards-4") {
  const answers = Array.from({ length: 12 }, (_, i) => ({
    questionId: "SEC-" + String(i + 1).padStart(2, "0"),
    response: i === 9 ? "no" : "yes",
    internalNotes: i === 9 ? "Old encryption / screen-lock finding" : "Confirmed previous answer",
    includeInReport: true,
    confidence: "low",
  }));
  return {
    intelligence: { facts: [], lastRunAt: "" },
    hipaa: {
      questionSetVersion: version,
      enabled: true,
      status: "confirmed",
      answers,
      reportingPeriod: { start: "", end: "" },
      clientConfirmation: { status: "confirmed", confirmer: "Office manager", confirmedAt: "2026-11-01", acceptedResponsibility: true },
      snapshots: [{ id: "prior-confirmed-review", answers: answers.map((a) => ({ ...a })) }],
      includeDetailedAppendix: true,
      lastUpdatedAt: "",
    },
  };
}

test("Device encryption / automatic screen-lock question is absent from the live THR presentation and PDF", () => {
  assert.equal(questions.HIPAA_QUESTION_SET_VERSION, "2026-technology-safeguards-5");
  assert.equal(questions.HIPAA_QUESTIONS.length, 11);
  assert.deepEqual(activeIds, [...Array.from({ length: 9 }, (_, i) => "SEC-" + String(i + 1).padStart(2, "0")), "SEC-11", "SEC-12"]);
  assert.equal(activeIds.includes("SEC-10"), false);
  assert.equal(questions.HIPAA_QUESTIONS.some((q) => /device encryption|automatic screen.lock/i.test([q.title, q.question].join(" "))), false);
  assert.doesNotMatch(followup, /"SEC-10"|screen.lock controls|verify encryption on applicable computers/i);
  assert.match(presenter, /HIPAA_QUESTIONS.length/);
  assert.match(pdf, /HIPAA_QUESTIONS.map\(\(question\) =>/);
  assert.ok(activeIds.includes("SEC-12"), "annual cybersecurity training stays in place");
});

test("Removing SEC-10 preserves other historical answers and client confirmation", () => {
  const project = legacyProject();
  const normalized = engine.normalizeHipaaAssessment(project);
  assert.equal(normalized.questionSetVersion, "2026-technology-safeguards-5");
  assert.equal(normalized.answers.length, 11);
  assert.equal(normalized.answers.some((answer) => answer.questionId === "SEC-10"), false);
  assert.equal(normalized.answers.find((a) => a.questionId === "SEC-12").response, "yes");
  assert.equal(normalized.answers.find((a) => a.questionId === "SEC-11").response, "yes");
  assert.equal(normalized.clientConfirmation.status, "confirmed");
  assert.equal(normalized.status, "confirmed");
  assert.equal(normalized.legacyAnswers.find((a) => a.questionId === "SEC-10").response, "no");
  assert.deepEqual(normalized.snapshots, project.hipaa.snapshots);
  assert.equal(engine.hipaaQuestionsForPresentation({ hipaa: normalized }).length, 0);
  const score = engine.scoreHipaaAssessment(normalized);
  assert.equal(score.assessedQuestionCount, 11);
  assert.equal(score.applicableQuestionCount, 11);
  assert.equal(score.counts.no, 0, "removed encryption answer is excluded from the active score");
  assert.equal(score.confirmedQuestionCount, 11);
});

test("Stale reviews cannot add retired SEC-10 to progress, follow-ups or confirmation", () => {
  const project = legacyProject();
  // Skip normalization to model an in-memory report that was open during an update.
  const score = engine.scoreHipaaAssessment(project.hipaa);
  assert.equal(score.assessedQuestionCount, 11);
  assert.equal(score.applicableQuestionCount, 11);
  assert.equal(score.counts.no, 0);
  const confirmed = engine.confirmHipaaAssessment(project, "Office manager");
  assert.equal(confirmed.hipaa.answers.length, 11);
  assert.equal(confirmed.hipaa.answers.some((a) => a.questionId === "SEC-10"), false);
  assert.equal(confirmed.hipaa.snapshots.at(-1).answers.length, 11);
});

test("Older questionnaire versions drop only retired SEC-10; all unchanged answers remain", () => {
  for (const version of ["2026-technology-safeguards-2", "2026-technology-safeguards-3"]) {
    const project = legacyProject(version);
    const normalized = engine.normalizeHipaaAssessment(project);
    assert.equal(normalized.answers.length, 11);
    assert.equal(normalized.answers.find((a) => a.questionId === "SEC-12").response, "yes");
    assert.equal(normalized.answers.find((a) => a.questionId === "SEC-03").response, "yes");
    assert.equal(normalized.answers.some((a) => a.questionId === "SEC-10"), false);
    assert.equal(normalized.clientConfirmation.status, "pending", "older modified questionnaires still require reconfirmation");
  }
});
