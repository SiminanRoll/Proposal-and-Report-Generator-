import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const ui = read("../src/components/hipaa-presentation.tsx");
const css = read("../src/components/security-review-premium.module.css");
const scoreSource = read("../src/lib/outcomes/client-report-score.ts");
const pdfSource = read("../src/lib/outcomes/export-html.ts");
const presentationSource = read("../src/components/outcome-experience.tsx");

async function scoringUnderTest() {
  const ts = (await import("typescript")).default;
  const strippedImports = scoreSource.replace(/^import[^\n]*\n/gm, "");
  const js = ts.transpileModule(strippedImports, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  } }).outputText;
  const stubs = [
    "const lifecycleSummary = () => ({assessed:1,current:1,dueSoon:0,overdue:0});",
    "const factNumber = (project, key) => project.mockFacts?.[key] ?? 0;",
    "const reportableLifecycleDevices = () => [];",
    "const osSupportSummary = () => ({endOfSupport:0,planning:0});",
    "const inventoryReportDevices = () => [];",
    "const osSupportStatus = () => 'supported';",
    "const scoreHipaaAssessment = (assessment) => assessment.mockScore;",
  ].join("\n");
  return import("data:text/javascript;charset=utf-8," + encodeURIComponent(stubs + "\n" + js));
}

function project(answers, remaining) {
  return {
    type: "client-report",
    mockFacts: {
      "huntress.eventsAnalyzed": 200,
      "huntress.entitiesProtected": 10,
      "huntress.canaryFiles": 4,
    },
    hipaa: {
      enabled: true,
      mockScore: {
        overall: answers, confirmedReadiness: answers,
        assessedQuestionCount: 11 - remaining, notYetAssessedCount: remaining,
      },
    },
  };
}

test("answer notes appear only after selection with a blank manual-entry placeholder", () => {
  assert.match(ui, /hasChoice && <div className=\{premium\.inlineConfirmation\}/);
  assert.match(ui, /Additional notes/);
  assert.match(ui, /aria-label="Additional notes"/);
  assert.match(ui, /placeholder="Add context only if needed\."/);
  assert.doesNotMatch(ui, /Notes for the security review|placeholder="Relevant detail or confirmation from the client"/);
});

test("answer confirmation animates only the inline note panel, not a flipped card", () => {
  assert.match(css, /\.inlineConfirmation/);
  assert.match(css, /@keyframes inlineNoteEnter/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.inlineConfirmation/);
  assert.doesNotMatch(css, /rotateY\(|securityCardSheen|perspective:1800px/);
  assert.doesNotMatch(ui, /isFlipped|setIsFlipped|premium\.back\}|premium\.flipped/);
  assert.match(ui, /aria-pressed=\{selectedResponse === "yes"\}/);
});

test("premium score reveal leads the questionnaire summary", () => {
  const reveal = ui.indexOf('<section className={premium.thrRevealRoot}');
  const detailed = ui.indexOf('<div className="hipaa-results-heading">', reveal);
  assert.ok(reveal >= 0 && detailed > reveal);
  assert.match(ui, /Your updated THR score/);
  assert.match(ui, /Updated after review/);
  assert.match(ui, /clientReportAvailable\(project\)/);
  assert.match(ui, /AnimatedNumber value=\{health.overall\}/);
  assert.match(css, /conic-gradient\(from -90deg,var\(--thr-accent\) var\(--thr-progress\)/);
  assert.match(css, /@keyframes thrRevealEnter/);
});

test("incomplete/unknown conversations preserve baseline, complete ones update THR", async () => {
  const score = await scoringUnderTest();
  const incomplete = score.clientReportScores(project(50, 4));
  assert.equal(incomplete.baselineOverall, 100);
  assert.equal(incomplete.overall, 100);
  assert.equal(incomplete.provisional, true);
  assert.equal(incomplete.securityReviewIncluded, false);

  const complete = score.clientReportScores(project(60, 0));
  assert.equal(complete.baselineOverall, 100);
  assert.equal(complete.overall, 94);
  assert.equal(complete.securityReviewScore, 60);
  assert.equal(complete.provisional, false);
  assert.equal(complete.securityReviewIncluded, true);

  const unknown = score.clientReportScores(project(0, 11));
  assert.equal(unknown.overall, 100);
  assert.equal(unknown.provisional, true);
  const disabled = score.clientReportScores({ ...project(0, 11), hipaa: { enabled: false } });
  assert.equal(disabled.overall, 100);
  assert.equal(disabled.provisional, false);
});

test("presentation and PDF use exactly the same recalculated technology health number", () => {
  assert.match(presentationSource, /const scores = clientReportScores\(project\)/);
  assert.match(presentationSource, /value=\{scores\.overall\}/);
  assert.match(pdfSource, /scoreRingHtml\(scores\.overall, scoreTone\(scores\.overall\)\)/);
  assert.match(scoreSource, /reviewScore \* 0\.15/);
  assert.match(scoreSource, /reviewComplete = Boolean\(project\.type === "client-report"/);
  assert.match(pdfSource, /technology baseline will update once the security review is completed/i);
});
