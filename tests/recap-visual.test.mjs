import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const recap = source("src/components/recap-visual.tsx");
const presentation = source("src/components/outcome-experience.tsx");
const styles = source("src/components/recap-visual.module.css");
const hipaa = source("src/components/hipaa-presentation.tsx");
const questionStyles = source("src/components/security-review-premium.module.css");
const questions = source("src/lib/hipaa/questions.ts");
const engine = source("src/lib/hipaa/engine.ts");
const clientFacing = source("src/lib/hipaa/client-facing.ts");
const pdf = source("src/lib/outcomes/export-html.ts");

test("THR final recap is scoped to real client-report presentation and visually concise", () => {
  assert.match(presentation, /isThrRecap \? <RecapVisual project=\{project\} \/>/);
  assert.match(presentation, /project\.type === "client-report" && clientReportAvailable\(project\)/);
  assert.match(presentation, /!noActionNeeded && !isThrRecap && <div className="recap-roadmap">/);
  assert.match(presentation, /recap-next-step/);
  assert.match(styles, /\.presentationSlide :global\(\.recap-heading-row\)/);
  assert.match(styles, /\.priorityCard summary/);
  assert.match(styles, /@media\(max-width:760px\)/);
  assert.match(recap, /lifecycleSummary\(project\)/);
  assert.match(styles, /conic-gradient\(/);
  assert.doesNotMatch(recap, /<AnimatedNumber|clientReportScores\(/);
});

test("cybersecurity status depends only on actual reported incident count", () => {
  assert.match(recap, /item\.key === "huntress\.incidentsReported"/);
  assert.match(recap, /factNumber\(project, "huntress\.incidentsReported"\)/);
  assert.match(recap, /incidentsReported \? incidents > 0 \? "training" : "healthy" : "unknown"/);
  assert.match(recap, /Cybersecurity Training Advised/);
  assert.match(recap, /"Healthy"/);
  assert.match(recap, /"Report pending"/);
  assert.match(recap, /role="status"/);
  assert.match(recap, /incident\{incidents === 1 \? "" : "s"\} reported/);
  assert.doesNotMatch(recap, /scoreTone|scoreLabel/);
});

test("FAR outcomes remain compact expandable decisions without scoring side effects", () => {
  assert.match(recap, /farTopPriorities\(project\)/);
  assert.match(recap, /farPriorityStatus\(item\)/);
  assert.match(recap, /priorityActionSummary\(item\)/);
  assert.match(recap, /<details className=\{styles\.priorityCard\}/);
  assert.doesNotMatch(recap, /updateFarReviewItem|onUpdate\(/);
});

test("security question progress and reviewed-by confirmation retain accessibility", () => {
  assert.match(recap, /role="progressbar"/);
  assert.match(recap, /aria-valuenow=\{answered\}/);
  assert.match(hipaa, /<span>Reviewed by<\/span><input aria-label="Reviewed by"/);
  assert.doesNotMatch(hipaa, /placeholder="Client representative"/);
  assert.match(hipaa, /confirmHipaaAssessment\(prepared, confirmer\)/);
});

test("SEC-12 asks about annual training or enrollment and is not auto-answered", () => {
  assert.match(questions, /id: "SEC-12", title: "Annual cybersecurity awareness training"/);
  assert.match(questions, /completed cybersecurity awareness training, or enrolled in a training program, within the past 12 months/);
  assert.match(questions, /id: "SEC-12"[\s\S]{0,130}ownership: "client"/);
  const ids = [...questions.matchAll(/id: "(SEC-\d+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, Array.from({ length: 12 }, (_, i) => "SEC-" + String(i + 1).padStart(2, "0")));
  assert.match(questions, /HIPAA_QUESTION_SET_VERSION = "2026-technology-safeguards-4"/);
  assert.match(clientFacing, /"SEC-12"/);
  assert.match(pdf, /HIPAA_QUESTIONS\.map\(\(question\) =>/);
});

test("adding training preserves old answers, while requiring confirmation of expanded review", () => {
  assert.match(engine, /previousVersion === "2026-technology-safeguards-2"/);
  assert.match(engine, /existingAnswers\.find\(\(answer\) => answer\.questionId === question\.id\)/);
  assert.match(engine, /prior \? \{ \.\.\.baseAnswer\(question\), \.\.\.prior \} : baseAnswer\(question\)/);
  assert.match(engine, /clientConfirmation: migrating/);
  assert.match(engine, /legacyClientConfirmation: migrating/);
  assert.match(engine, /legacyAnswers: migrating/);
});

test("training question shows a subtle count warning only for reported incidents", () => {
  assert.match(hipaa, /current\.question\.id === "SEC-12" \? Math\.max\(0, factNumber\(project, "huntress\.incidentsReported"\)\) : 0/);
  assert.match(hipaa, /trainingIncidentCount > 0 && <div className=\{premium\.trainingIncidentCallout\}/);
  assert.match(hipaa, /Staff training advised/);
  assert.match(questionStyles, /\.trainingIncidentCallout/);
});
