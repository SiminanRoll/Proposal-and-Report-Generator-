import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const questions = fs.readFileSync(new URL("../src/lib/hipaa/questions.ts", import.meta.url), "utf8");
const engine = fs.readFileSync(new URL("../src/lib/hipaa/engine.ts", import.meta.url), "utf8");
const handoff = fs.readFileSync(new URL("../src/lib/hipaa/handoff.ts", import.meta.url), "utf8");
const preparation = fs.readFileSync(new URL("../src/components/hipaa-readiness.tsx", import.meta.url), "utf8");
const livePresentation = fs.readFileSync(new URL("../src/components/hipaa-presentation.tsx", import.meta.url), "utf8");
const experience = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const appendix = fs.readFileSync(new URL("../src/lib/hipaa/export.ts", import.meta.url), "utf8");
const types = fs.readFileSync(new URL("../src/lib/projects/types.ts", import.meta.url), "utf8");

function count(pattern, source) { return [...source.matchAll(pattern)].length; }

test("HIPAA readiness uses a practical 12-question ownership model", () => {
  assert.equal(count(/id: "HIPAA-\d{2}"/g, questions), 12);
  assert.equal(count(/ownership: "client"/g, questions), 6);
  assert.equal(count(/ownership: "joint"/g, questions), 4);
  assert.equal(count(/ownership: "advantage-prefill"/g, questions), 2);
  assert.match(questions, /HIPAA_QUESTION_SET_VERSION = "2026-quick-1"/);
});

test("the condensed questions still cover administrative physical technical and organizational requirements", () => {
  for (const category of ["Administrative Safeguards", "Physical Safeguards", "Technical Safeguards", "Organizational Requirements"]) assert.match(questions, new RegExp(category));
  for (const phrase of ["Risk analysis and follow-through", "Contingency and disaster recovery", "Facilities, workstations, and device disposal", "Accounts, authentication, and secure exchange", "Business associates and vendor oversight"]) assert.match(questions, new RegExp(phrase));
  assert.match(questions, /regulationMappings/);
});

test("question records preserve optional follow-up and report fields", () => {
  for (const key of ["originalControlMapId", "regulationMappings", "plainLanguageExplanation", "reviewPrompts", "evidenceHints"]) assert.match(questions, new RegExp(key));
  for (const key of ["evidenceSource", "evidenceDate", "evidenceAttachment", "clientVisibleObservation", "riskSeverity", "recommendedAction", "responsibleParty", "targetDate", "clientConfirmationStatus", "includeInReport", "deferredAt"]) assert.match(types, new RegExp(key));
  assert.match(types, /Client questionnaire/);
});

test("scoring separates confirmed readiness completion and completion-adjusted result", () => {
  assert.match(engine, /confirmedReadiness/);
  assert.match(engine, /completionPercentage/);
  assert.match(engine, /const overall = denominator \? Math\.round\(pointTotal \/ denominator\) : 0/);
  assert.match(engine, /notYetAssessedCount/);
  assert.match(engine, /Incomplete Assessment/);
});

test("quick responses do not require evidence action plans or NA explanations", () => {
  assert.match(engine, /if \(answer\.response === "not-yet-assessed"\)/);
  assert.match(engine, /return \[\];/);
  assert.doesNotMatch(engine, /Add notes or supporting evidence/);
  assert.doesNotMatch(engine, /Add a recommended corrective action/);
  assert.doesNotMatch(engine, /Explain why this control does not apply/);
  assert.match(preparation, /Choose an answer\. Add a note only when it helps\./);
  assert.match(preparation, /Add a follow-up action/);
  assert.doesNotMatch(preparation, /Attach optional file/);
  assert.doesNotMatch(preparation, /Information source/);
  assert.doesNotMatch(preparation, /Reviewed date/);
});

test("anything unanswered becomes part of the live client presentation", () => {
  assert.match(engine, /hipaaQuestionsForPresentation/);
  assert.match(engine, /!answerIsComplete\(answer\) && !answer\.deferred/);
  assert.match(experience, /HipaaReviewPresentation/);
  assert.match(livePresentation, /Finish only the questions that remain open/);
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
  assert.match(livePresentation, /Not sure/);
  assert.match(livePresentation, /completion adjustment lowers the reportable result/i);
  assert.match(livePresentation, /Skipped for later/);
  assert.match(exportHtml, /package remains an incomplete readiness screening/);
});

test("technical prefills stay limited to observable monitoring and backup checkpoints", () => {
  for (const key of ["huntress.entitiesProtected", "huntress.eventsAnalyzed", "huntress.signalsDetected", "backup.endpointMissing", "scalepad.backupServers"]) assert.match(engine, new RegExp(key.replaceAll(".", "\\.")));
  assert.doesNotMatch(engine, /environment\.enabledLocalAccounts/);
  assert.match(engine, /question\.id === "HIPAA-11"/);
  assert.match(engine, /question\.id === "HIPAA-12"/);
  assert.match(engine, /verificationStatus = evidence\.evidence \? "proposed"/);
  assert.match(engine, /Not yet verified/);
});

test("Cloud Plus BDR contributes evidence to the HIPAA backup and recovery checkpoint without overcommitting", () => {
  const intelligenceClient = fs.readFileSync(new URL("../src/lib/intelligence/client.ts", import.meta.url), "utf8");
  assert.match(engine, /Cloud Plus BDR emergency standby server/);
  assert.match(engine, /local recovery copy and cloud backup path/);
  assert.match(engine, /current backup-job health and the most recent recovery test still require confirmation/);
  assert.match(engine, /"partially"/);
  assert.match(questions, /presence alone does not verify current backup health or recovery testing/);
  assert.match(intelligenceClient, /rebuilt\.hipaa\.enabled \? enableHipaaAssessment\(rebuilt\)/);
});

test("client handoff can be downloaded completed and imported locally", () => {
  assert.match(preparation, /Export client form/);
  assert.match(preparation, /Copy email text/);
  assert.match(preparation, /Import responses/);
  assert.match(handoff, /advantage-hipaa-readiness-client-handoff/);
  assert.match(handoff, /hipaaClientHandoffHtml/);
  assert.match(handoff, /downloadHipaaClientHandoff/);
  assert.match(handoff, /importHipaaClientHandoff/);
  assert.match(handoff, /Download completed responses/);
  assert.match(handoff, /application\/json/);
  assert.match(handoff, /Client questionnaire/);
  assert.match(handoff, /localStorage\.setItem/);
  assert.match(handoff, /hipaaClientHandoffEmailBody/);
  assert.match(handoff, /This response file was created for/);
  assert.match(handoff, /typeof imported\.note === "string"/);
  assert.doesNotMatch(handoff, /patient name|medical record/i);
  assert.match(handoff, /Please do not include patient information/);
});

test("older cached 31-question assessments migrate into the condensed question set", () => {
  assert.match(engine, /LEGACY_QUESTION_GROUPS/);
  assert.match(engine, /migrateLegacyAnswers/);
  assert.match(engine, /existing\.questionSetVersion !== HIPAA_QUESTION_SET_VERSION/);
  assert.match(engine, /clientConfirmation: migrating/);
});

test("HIPAA results appear in the package and optional appendix", () => {
  assert.match(livePresentation, /HIPAA results/);
  assert.match(exportHtml, /hipaaSummaryHtml/);
  assert.match(appendix, /HIPAA Security Readiness Assessment Appendix/);
  assert.match(appendix, /Optional notes \/ source/);
  assert.match(appendix, /Print or save PDF/);
});

test("required disclaimer and approved client-facing terminology are present", () => {
  for (const phrase of ["not legal advice", "formal audit", "certification", "guarantee of HIPAA compliance"]) assert.match(`${engine}\n${questions}\n${handoff}`, new RegExp(phrase, "i"));
  assert.doesNotMatch(`${preparation}\n${livePresentation}\n${experience}\n${appendix}`, /Security Operations Center|24\/7 SOC|SOC monitoring/i);
});

test("HIPAA can be disabled at the workspace level and omitted from the package", () => {
  const workspace = fs.readFileSync(new URL("../src/components/project-workspace.tsx", import.meta.url), "utf8");
  const store = fs.readFileSync(new URL("../src/lib/projects/store.ts", import.meta.url), "utf8");
  assert.match(preparation, /Include HIPAA Readiness/);
  assert.match(preparation, /HIPAA Security Readiness is off/);
  assert.match(workspace, /toggleHipaa/);
  assert.match(experience, /project\.hipaa\.enabled \? \["hipaa-review", "hipaa-results"\] : \[\]/);
  assert.match(exportHtml, /if \(!project\.hipaa\.enabled\) return ""/);
  assert.doesNotMatch(store, /enableHipaaAssessment\(normalized\)/);
});

test("skipped HIPAA sessions are labeled incomplete rather than fully reviewed", () => {
  assert.match(livePresentation, /The live review is finished, but some questions remain open/);
  assert.match(livePresentation, /Skipped questions remain marked Not sure/);
  assert.match(livePresentation, /Questions answered/);
  assert.doesNotMatch(livePresentation, /All HIPAA questions have been reviewed for this session/);
});
