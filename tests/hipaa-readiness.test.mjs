import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const questions = read("../src/lib/hipaa/questions.ts");
const engine = read("../src/lib/hipaa/engine.ts");
const preparation = read("../src/components/hipaa-readiness.tsx");
const live = read("../src/components/hipaa-presentation.tsx");
const training = read("../src/components/security-training-decision.tsx");
const experience = read("../src/components/outcome-experience.tsx");
const exportHtml = read("../src/lib/outcomes/export-html.ts");
const types = read("../src/lib/projects/types.ts");
const score = read("../src/lib/outcomes/client-report-score.ts");
const preMeeting = read("../src/lib/outcomes/pre-meeting.ts");

test("security conversation consists of ten cross-industry questions", () => {
  assert.equal([...questions.matchAll(/id: "SEC-\d{2}"/g)].length, 10);
  assert.match(questions, /2026-security-conversation-1/);
  for (const topic of [
    "Endpoint protection and threat monitoring",
    "Local and encrypted cloud backups",
    "Backup status emails and records",
    "Documented disaster recovery and restore testing",
    "Workforce cybersecurity awareness training",
    "Written policies and independent compliance responsibilities",
  ]) assert.ok(questions.includes(topic), topic);
  assert.doesNotMatch(questions, /id: "HIPAA-\d{2}"/);
});

test("managed controls require real verification and never silently answer Yes", () => {
  assert.match(engine, /Imported inventory can suggest which controls/);
  assert.match(engine, /question.id === "SEC-01"/);
  assert.match(engine, /question.id === "SEC-05"/);
  assert.match(engine, /scalepad.backupServers/);
  assert.match(engine, /huntress.entitiesProtected/);
  assert.doesNotMatch(engine, /answer\.response = "yes"/);
  assert.match(engine, /verificationStatus = "proposed"/);
  assert.match(questions, /rather than assume every system or cloud app is backed up/);
});

test("training answers distinguish provided, planned elsewhere and declined", () => {
  assert.match(training, /"other-provider"/);
  assert.match(training, /"planned-elsewhere"/);
  assert.match(training, /declined/);
  assert.match(live, /SecurityTrainingDecision/);
  assert.match(preparation, /SecurityTrainingDecision/);
  assert.match(engine, /questionId === "SEC-08"/);
  assert.match(engine, /serviceDisposition/);
  assert.match(engine, /dispositionRecordedAt/);
  assert.match(types, /serviceDisposition\?/);
  assert.match(exportHtml, /securityTrainingDecisionDescription/);
});

test("backup notifications are distinct from protected workloads and recovery testing", () => {
  assert.match(questions, /id: "SEC-05"/);
  assert.match(questions, /id: "SEC-06"/);
  assert.match(questions, /id: "SEC-07"/);
  assert.match(questions, /backup status emails or reports/);
  assert.match(questions, /An email alone does not prove backups are restorable/);
  assert.match(questions, /encrypted off-site cloud backup copies/);
});

test("historic HIPAA answers survive migration but are never repurposed as new Yes/No confirmations", () => {
  assert.match(engine, /migrateLegacyAnswers/);
  assert.match(engine, /return HIPAA_QUESTIONS\.map\(\(question\) => baseAnswer\(question\)\)/);
  assert.match(engine, /legacyAnswers: migrating/);
  assert.match(engine, /legacyClientConfirmation: migrating/);
  assert.match(engine, /clientConfirmation: migrating/);
  assert.match(types, /legacyAnswers\?/);
});

test("the security review is available to all industries in both slides and reports", () => {
  assert.match(experience, /"safeguards"/);
  assert.match(experience, /section === "hipaa"/);
  assert.match(live, /Security safeguards · Conversation recap/);
  assert.match(preparation, /Security Safeguards Review/);
  assert.match(preparation, /Enable Security Review/);
  assert.match(preMeeting, /Security safeguards conversation/);
  assert.match(exportHtml, /Security safeguards recap/);
});

test("self-reported security answers do not change the technology health score", () => {
  assert.match(score, /weighted = \(security \* 0\.5\) \+ \(network \* 0\.5\)/);
  assert.match(score, /provisional: false/);
  assert.match(experience, /Security conversation incomplete/);
  assert.match(live, /questions discussed/);
});

test("questionnaire supports simple Yes or No and a genuine Not sure state", () => {
  assert.match(live, /value: "yes", label: "Yes"/);
  assert.match(live, /value: "no", label: "No"/);
  assert.match(live, /Skip for now/);
  assert.match(engine, /deferRemainingHipaaAnswers/);
  assert.match(preMeeting, /data-pdf-options="Yes\|No\|Not sure\|Not applicable"/);
  assert.match(exportHtml, /data-pdf-field="hipaa\.SEC-08\.training-source"/);
});

test("legal responsibilities and recordable service decline remain separate", () => {
  assert.match(engine, /not legal advice/i);
  assert.match(engine, /not a waiver/i);
  assert.match(questions, /regulationMappings/);
  assert.match(live, /does not transfer responsibility or certify compliance/);
  assert.match(exportHtml, /does not determine compliance/i);
});

test("client PDFs retain fillable follow-up questions and return instructions", () => {
  assert.match(exportHtml, /hipaaResponseAppendixHtml/);
  assert.match(exportHtml, /data-pdf-field="hipaa\./);
  assert.match(exportHtml, /Please email this completed document to your Technology Consultant/);
  assert.match(exportHtml, /Security safeguards · Answer record/);
  assert.doesNotMatch(exportHtml, /hipaaConsultantGuidance/);
});
