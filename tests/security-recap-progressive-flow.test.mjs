import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const recap = read("../src/components/hipaa-presentation.tsx");
const css = read("../src/components/security-review-premium.module.css");
const version = read("../src/lib/app-version.ts");
const pkg = JSON.parse(read("../package.json"));
const lock = JSON.parse(read("../package-lock.json"));

const results = recap.slice(recap.indexOf("export function HipaaResultsPresentation("));

test("THR recap reveals score, answers, and next-step ownership as three distinct phases", () => {
  assert.match(results, /type RecapPhase = "score" \| "answers" \| "actions"/);
  assert.match(results, /useState<RecapPhase>\("score"\)/);
  assert.match(results, /\{ id: "score", label: "THR score" \}/);
  assert.match(results, /\{ id: "answers", label: "Answers" \}/);
  assert.match(results, /\{ id: "actions", label: "Next steps" \}/);
  assert.match(results, /aria-current=\{phase === step\.id \? "step" : undefined\}/);
  assert.match(results, /phase === "score" && <section/);
  assert.match(results, /phase === "answers" && <section/);
  assert.match(results, /phase === "actions" && <section/);
  assert.match(results, /<div key=\{phase\} className=\{premium\.recapStage\}/);
  assert.match(results, /Review answers/);
  assert.match(results, /Assign next steps/);
  assert.doesNotMatch(results, /hipaa-results-metrics|hipaa-incomplete-banner|hipaa-readiness-meaning/);
  assert.match(css, /@keyframes recapStageEnter/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.recapStage/);
});

test("score reveal never claims the security review is complete when score is provisional", () => {
  assert.match(results, /health\.securityReviewIncluded \? "Your updated THR score" : "Your current THR score"/);
  assert.match(results, /health\.securityReviewIncluded \? "Security review included" : "Review still in progress"/);
  assert.match(results, /health\.securityReviewIncluded \? "Updated after review" : "Current baseline"/);
  assert.match(results, /The technology score will appear when the supporting assessment is available/);
  assert.match(results, /health\.overall/);
});

test("recorded answers and missing responses remain source-derived and editable", () => {
  assert.match(results, /const recorded = score\.assessedQuestionCount/);
  assert.match(results, /const needsInput = score\.notYetAssessedCount/);
  assert.match(results, /const flagged = score\.counts\.no \+ score\.counts\.partially/);
  assert.match(results, /responseSegments\.filter\(\(item\) => item\.count > 0\)/);
  assert.match(results, /HIPAA_QUESTIONS\.flatMap/);
  assert.match(results, /answer\?\.includeInReport === false/);
  assert.match(results, /setEditingAnswers\(true\)/);
  assert.match(results, /onReturnToQuestions/);
  assert.match(results, /setShowAllAnswers\(!showAllAnswers\)/);
});

test("ownership changes and client confirmation remain on the final phase", () => {
  assert.match(results, /securityFollowUpOwner\(question, answer\) === "client"/);
  assert.match(results, /followUps\.map\(\(\{ question, answer \}\) => <SecurityFollowUpOwnerEditor/);
  assert.match(results, /clientFollowUps/);
  assert.match(results, /advantageFollowUps/);
  assert.match(results, /onUpdate\(confirmHipaaAssessment\(prepared, confirmer\)\)/);
  assert.match(results, /disabled=\{!accepted \|\| unresolved\.length > 0\}/);
  assert.match(results, /project\.hipaa\.clientConfirmation\.status === "confirmed"/);
  assert.match(results, /HIPAA_DISCLAIMER/);
  assert.match(results, /hipaaTopGaps\(project, 3\)/);
});

test("new patch number is synchronized and displayed from package metadata", () => {
  assert.equal(pkg.version, "1.3.15");
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
  assert.match(version, /packageMetadata\.version/);
});
