import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const questions = fs.readFileSync(new URL("../src/lib/hipaa/questions.ts", import.meta.url), "utf8");
const engine = fs.readFileSync(new URL("../src/lib/hipaa/engine.ts", import.meta.url), "utf8");
const preparation = fs.readFileSync(new URL("../src/components/hipaa-readiness.tsx", import.meta.url), "utf8");
const livePresentation = fs.readFileSync(new URL("../src/components/hipaa-presentation.tsx", import.meta.url), "utf8");
const experience = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const types = fs.readFileSync(new URL("../src/lib/projects/types.ts", import.meta.url), "utf8");
const fillablePdf = fs.readFileSync(new URL("../src/lib/outcomes/fillable-pdf.ts", import.meta.url), "utf8");

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
  assert.match(experience, /HipaaReviewAndResultsPresentation/);
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

test("skipped questions are called out prominently and carried into the finished PDF", () => {
  assert.match(livePresentation, /hipaa-incomplete-banner/);
  assert.match(livePresentation, /Skipped questions remain marked Not sure/);
  assert.match(livePresentation, /included in the client PDF/i);
  assert.match(livePresentation, /Skipped for later/);
  assert.match(exportHtml, /Complete the remaining questions for an updated score/);
  assert.match(exportHtml, /may improve the displayed score/);
});

test("Advantage-owned endpoint and backup checkpoints are always confirmed and kept out of client questionnaires", () => {
  for (const key of ["huntress.entitiesProtected", "huntress.eventsAnalyzed", "huntress.signalsDetected", "backup.endpointMissing", "scalepad.backupServers"]) assert.match(engine, new RegExp(key.replaceAll(".", "\\.")));
  assert.doesNotMatch(engine, /environment\.enabledLocalAccounts/);
  assert.match(engine, /question\.id === "HIPAA-11"/);
  assert.match(engine, /question\.id === "HIPAA-12"/);
  assert.match(engine, /answer\.response = "yes"/);
  assert.match(engine, /answer\.verificationStatus = "technically-verified"/);
  assert.match(engine, /answer\.evidenceSource = "Advantage-managed system"/);
  assert.match(engine, /clientConfirmer = "Advantage Technologies"/);
});

test("Cloud Plus backup coverage is represented as an Advantage-confirmed technical answer", () => {
  const intelligenceClient = fs.readFileSync(new URL("../src/lib/intelligence/client.ts", import.meta.url), "utf8");
  assert.match(engine, /Cloud Plus backup server/);
  assert.match(engine, /managed local and cloud backup protection and emergency recovery coverage/);
  assert.match(questions, /Advantage confirms managed backup and recovery coverage/);
  assert.match(intelligenceClient, /rebuilt\.hipaa\.enabled \? enableHipaaAssessment\(rebuilt\)/);
});

test("finished PDF carries unanswered questions and return instructions without a client portal", () => {
  assert.doesNotMatch(preparation, /Export client form|Copy email text|Import responses|Client pre-review/);
  assert.match(preparation, /Finished PDF follow-up/);
  assert.match(experience, /Download PDF/);
  assert.doesNotMatch(experience, /Download interactive HTML/);
  assert.match(exportHtml, /hipaaResponseAppendixHtml/);
  assert.match(exportHtml, /data-pdf-field="hipaa\./);
  assert.match(exportHtml, /Please email this completed document to your Technology Consultant, or Patric\.Beckman@adv-tech\.com\./);
  assert.match(exportHtml, /proposal\.authorization\.signature/);
  assert.match(fillablePdf, /\/AcroForm/);
  assert.match(fillablePdf, /application\/pdf/);
  assert.doesNotMatch(`${exportHtml}
${fillablePdf}`, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
});

test("older cached 31-question assessments migrate into the condensed question set", () => {
  assert.match(engine, /LEGACY_QUESTION_GROUPS/);
  assert.match(engine, /migrateLegacyAnswers/);
  assert.match(engine, /existing\.questionSetVersion !== HIPAA_QUESTION_SET_VERSION/);
  assert.match(engine, /clientConfirmation: migrating/);
});

test("HIPAA results are included in the unified client package", () => {
  assert.match(livePresentation, /HIPAA readiness recap/);
  assert.match(exportHtml, /hipaaSummaryHtml/);
  assert.match(exportHtml, /hipaaResponseAppendixHtml/);
});

test("required disclaimer and approved client-facing terminology are present", () => {
  for (const phrase of ["not legal advice", "formal audit", "certification", "guarantee of HIPAA compliance"]) assert.match(`${engine}\n${questions}`, new RegExp(phrase, "i"));
  assert.doesNotMatch(`${preparation}\n${livePresentation}\n${experience}\n${exportHtml}`, /Security Operations Center|24\/7 SOC|SOC monitoring/i);
});

test("HIPAA can be disabled at the workspace level and omitted from the package", () => {
  const workspace = fs.readFileSync(new URL("../src/components/project-workspace.tsx", import.meta.url), "utf8");
  const store = fs.readFileSync(new URL("../src/lib/projects/store.ts", import.meta.url), "utf8");
  assert.match(preparation, /Include HIPAA Readiness/);
  assert.match(preparation, /HIPAA Security Readiness is off/);
  assert.match(workspace, /toggleHipaa/);
  assert.match(experience, /project\.hipaa\.enabled \? \["hipaa"\] : \[\]/);
  assert.match(exportHtml, /if \(!project\.hipaa\.enabled\) return ""/);
  assert.doesNotMatch(store, /enableHipaaAssessment\(normalized\)/);
});

test("skipped HIPAA sessions are labeled incomplete rather than fully reviewed", () => {
  assert.match(livePresentation, /The live review is finished, but some questions remain open/);
  assert.match(livePresentation, /skipped questions will be included in the client PDF/i);
  assert.match(livePresentation, /Questions answered/);
  assert.doesNotMatch(livePresentation, /All HIPAA questions have been reviewed for this session/);
});

test("HIPAA return instructions are omitted when no questions remain", () => {
  assert.match(exportHtml, /const remaining = outstandingHipaaQuestionCount\(project\);[\s\S]*if \(!remaining\) return "This score reflects all responses currently provided/);
  assert.match(exportHtml, /const outstanding = HIPAA_QUESTIONS\.filter[\s\S]*ownership !== "advantage-prefill"[\s\S]*flatMap[\s\S]*if \(!outstanding\.length\) return "";/);
  assert.match(exportHtml, /Return instructions belong only to PDFs that contain unanswered HIPAA fields/);
});


