import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const questions = fs.readFileSync(new URL("../src/lib/hipaa/questions.ts", import.meta.url), "utf8");
const engine = fs.readFileSync(new URL("../src/lib/hipaa/engine.ts", import.meta.url), "utf8");
const preparation = fs.readFileSync(new URL("../src/components/hipaa-readiness.tsx", import.meta.url), "utf8");
const livePresentation = fs.readFileSync(new URL("../src/components/hipaa-presentation.tsx", import.meta.url), "utf8");
const experience = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const appendix = fs.readFileSync(new URL("../src/lib/hipaa/export.ts", import.meta.url), "utf8");
const types = fs.readFileSync(new URL("../src/lib/projects/types.ts", import.meta.url), "utf8");

function count(pattern, source) { return [...source.matchAll(pattern)].length; }

test("HIPAA question library contains the full 31-question ownership model", () => {
  assert.equal(count(/"id": "HIPAA-\d{2}"/g, questions), 31);
  assert.equal(count(/"ownership": "client"/g, questions), 16);
  assert.equal(count(/"ownership": "joint"/g, questions), 8);
  assert.equal(count(/"ownership": "advantage-prefill"/g, questions), 7);
});

test("question records preserve ownership, evidence, scoring, and report fields", () => {
  for (const key of ["originalControlMapId", "regulationMappings", "plainLanguageExplanation", "reviewPrompts", "evidenceHints"]) assert.match(questions, new RegExp(key));
  for (const key of ["evidenceSource", "evidenceDate", "evidenceAttachment", "clientVisibleObservation", "riskSeverity", "recommendedAction", "responsibleParty", "targetDate", "clientConfirmationStatus", "includeInReport", "deferredAt"]) assert.match(types, new RegExp(key));
});

test("scoring separates confirmed readiness, completion, and completion-adjusted result", () => {
  assert.match(engine, /confirmedReadiness/);
  assert.match(engine, /completionPercentage/);
  assert.match(engine, /const overall = denominator \? Math\.round\(pointTotal \/ denominator\) : 0/);
  assert.match(engine, /notYetAssessedCount/);
  assert.match(engine, /Incomplete Assessment/);
});

test("response workflow enforces evidence, remediation, and N-A explanations", () => {
  assert.match(engine, /Add notes or supporting evidence/);
  assert.match(engine, /Add a recommended corrective action/);
  assert.match(engine, /Explain why this control does not apply/);
  assert.match(preparation, /Anything not completed here becomes a live presentation question/);
});

test("anything not prepared becomes part of the live client presentation", () => {
  assert.match(engine, /hipaaQuestionsForPresentation/);
  assert.match(engine, /!answerIsComplete\(answer\) && !answer\.deferred/);
  assert.match(experience, /HipaaReviewPresentation/);
  assert.match(livePresentation, /Complete what was not prepared in advance/);
});

test("live presentation supports individual and bulk skipping", () => {
  assert.match(livePresentation, /Skip for now/);
  assert.match(livePresentation, /Skip all .* remaining questions for now/);
  assert.match(livePresentation, /Skip all remaining/);
  assert.match(engine, /deferHipaaAnswer/);
  assert.match(engine, /deferRemainingHipaaAnswers/);
  assert.match(engine, /completionStatus: "deferred"/);
});

test("skipped questions are called out prominently in results", () => {
  assert.match(livePresentation, /hipaa-incomplete-banner/);
  assert.match(livePresentation, /Not Yet Assessed/);
  assert.match(livePresentation, /The completion adjustment lowers the reportable result/);
  assert.match(livePresentation, /Skipped for later/);
  assert.match(exportHtml, /package remains an incomplete assessment/);
});

test("technical prefills map Huntress and RFT evidence without making a compliance conclusion", () => {
  for (const key of ["huntress.entitiesProtected", "huntress.eventsAnalyzed", "huntress.signalsDetected", "environment.enabledLocalAccounts", "backup.endpointMissing"]) assert.match(engine, new RegExp(key.replaceAll(".", "\\.")));
  assert.match(engine, /verificationStatus = evidence\.evidence \? "proposed"/);
  assert.match(engine, /Not yet verified/);
});

test("HIPAA results appear in the package and optional appendix", () => {
  assert.match(experience, /HIPAA results/);
  assert.match(exportHtml, /hipaaSummaryHtml/);
  assert.match(appendix, /HIPAA Security Readiness Assessment Appendix/);
  assert.match(appendix, /Print or save PDF/);
});

test("required disclaimer and approved client-facing terminology are present", () => {
  for (const phrase of ["not legal advice", "formal audit", "certification", "guarantee of HIPAA compliance", "Continuous Security Monitoring"]) assert.match(`${engine}\n${questions}`, new RegExp(phrase, "i"));
  assert.doesNotMatch(`${preparation}\n${livePresentation}\n${experience}\n${appendix}`, /Security Operations Center|24\/7 SOC|SOC monitoring/i);
});
