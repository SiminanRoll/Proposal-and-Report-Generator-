import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const filename = path.join(root, "src/lib/prospects/technology-health.ts");
const source = readFileSync(filename, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, { exports: exportsObject, module: { exports: exportsObject } }, { filename });
const thr = exportsObject;

function session() {
  return {
    discovery: {
      contactName: "Test Contact",
      organizationName: "Sample Dental",
      organizationLanguage: "practice",
      industry: "Dental",
      priorities: ["Backup & recovery", "Better support"],
      workstations: 9,
      server: "not-sure",
      locations: 1,
      managementSoftware: "Dentrix",
      imagingSoftware: "",
      imagingEnvironment: "",
      otherSoftware: "",
    },
    conversationContext: "Prospect wants clear planning before replacing anything.",
    health: { responses: {}, notes: {} },
    hipaaEnabled: true,
    hipaa: { responses: {}, notes: {} },
  };
}

test("the introductory review has eight questions, each with four accessible choices", () => {
  assert.equal(thr.THR_QUESTIONS.length, 8);
  assert.equal(thr.THR_HIPAA_QUESTIONS.length, 5);
  for (const question of [...thr.THR_QUESTIONS, ...thr.THR_HIPAA_QUESTIONS]) {
    assert.equal(question.options.length, 4);
    assert.ok(question.verification.length > 10);
  }
});

test("unknown and missing answers remain unverified, never 'healthy' or failed", () => {
  assert.equal(thr.thrStatus("unknown"), "needs-verification");
  assert.equal(thr.thrStatus(undefined), "not-discussed");
  assert.equal(thr.thrStatus("positive"), "reported-positive");
  assert.equal(thr.thrStatus("partial"), "potential-concern");
  assert.equal(thr.thrStatus("concern"), "reported-problem");
});

test("reported positives are not automatically treated as technical proof", () => {
  const value = session();
  value.health.responses.backup = "positive";
  value.health.responses.equipment = "unknown";
  const observations = thr.prospectThrObservations(value);
  assert.equal(observations.find((item) => item.id === "backup").status, "reported-positive");
  assert.equal(observations.find((item) => item.id === "equipment").status, "needs-verification");
  assert.equal(thr.prospectThrOpenItems(value).some((item) => item.id === "backup"), false);
  assert.equal(thr.prospectThrOpenItems(value).some((item) => item.id === "equipment"), true);
  assert.match(thr.prospectThrSummary(value), /technical condition and security coverage require independent verification/i);
});

test("optional HIPAA module does not manufacture HIPAA findings when excluded", () => {
  const value = session();
  value.hipaaEnabled = false;
  assert.equal(thr.prospectThrHipaaObservations(value).length, 0);
  assert.equal(thr.prospectThrOpenItems(value).length, 8);
});

test("consultant briefing captures reported concerns and specific technical verification", () => {
  const value = session();
  value.health.responses.reliability = "concern";
  value.health.notes.reliability = "Recurring slowness after lunch";
  value.health.responses.backup = "unknown";
  const brief = thr.prospectThrConsultantBrief(value, {
    date: "2026-11-06", time: "10:00", timeZone: "America/Chicago", consultantName: "Chris",
  });
  assert.match(brief, /Recurring slowness after lunch/);
  assert.match(brief, /2026-11-06 10:00 America\/Chicago with Chris/);
  assert.match(brief, /CPU, RAM, storage and supported OS versions/);
  assert.match(brief, /firewall\/network model/);
  assert.match(brief, /backup monitoring/);
  assert.match(brief, /not confirmed findings/i);
});

test("existing presentation remains separate from the prospect THR", () => {
  const shell = readFileSync(path.join(root, "src/components/app-shell.tsx"), "utf8");
  const styling = readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
  const component = readFileSync(path.join(root, "src/components/prospect-thr-global.tsx"), "utf8");
  assert.match(shell, /<ProspectA360Global\s*\/>/);
  assert.match(shell, /<ProspectThrGlobal\s*\/>/);
  assert.match(styling, /prospect-thr\.css/);
  assert.match(component, /Save your report as PDF/);
  assert.match(component, /does not create a calendar invitation or send a ConnectWise ticket/);
});


test("prospect THR opens with brief client-facing copy and no note-taking obligation", () => {
  const source = readFileSync(path.join(root, "src/components/prospect-thr-global.tsx"), "utf8");
  const welcome = source.split('{index === 0 && <section className="thr-welcome">')[1]?.split("{index === 1 &&")[0] ?? "";
  assert.match(welcome, /Let’s take a simple look at how your technology is doing today\./);
  assert.match(welcome, /Start the review/);
  assert.doesNotMatch(welcome, /textarea|passwords or scanners|What prompted today's conversation/);
  assert.match(source, /thr-report-context/);
});

test("health and HIPAA questions use one animated question at a time with optional notes", () => {
  const presenter = readFileSync(path.join(root, "src/components/prospect-thr-global.tsx"), "utf8");
  const guided = readFileSync(path.join(root, "src/components/prospect-thr-guided-question.tsx"), "utf8");
  const styles = readFileSync(path.join(root, "src/app/prospect-thr.css"), "utf8");
  assert.equal((presenter.match(/<GuidedThrQuestion/g) ?? []).length, 2);
  assert.match(presenter, /healthQuestion < THR_QUESTIONS\.length - 1/);
  assert.match(presenter, /hipaaQuestion < THR_HIPAA_QUESTIONS\.length - 1/);
  assert.match(presenter, /environmentQuestion < environmentCount - 1/);
  assert.match(presenter, /window\.setTimeout/);
  assert.doesNotMatch(presenter, /healthQuestions\.map|THR_HIPAA_QUESTIONS\.map/);
  assert.match(guided, /autoAdvance: boolean/);
  assert.match(guided, /setNotesOpen/);
  assert.match(guided, /Not sure/);
  assert.match(styles, /@keyframes thrFloatIn/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
});

test("the opening title has room for descenders and the slide has no inset frame", () => {
  const styles = readFileSync(path.join(root, "src/app/prospect-thr.css"), "utf8");
  assert.match(styles, /line-height:1\.075!important/);
  assert.match(styles, /padding-bottom:\.095em/);
  assert.match(styles, /presentation-stage\.thr-stage\s*\{[^}]*padding:0!important/s);
  assert.match(styles, /prospect-slide\.thr-slide\s*\{[^}]*border:0!important/s);
});


test("priorities prompt matches broad choices and server selections are not numbered", () => {
  const presentation = readFileSync(path.join(root, "src/components/prospect-thr-global.tsx"), "utf8");
  const questionUI = readFileSync(path.join(root, "src/components/prospect-thr-guided-question.tsx"), "utf8");
  assert.match(presentation, /What are your top technology priorities\?/);
  const serverCards = questionUI.split('{isServer && <div className="thr-guided-options thr-server-choices">')[1]?.split("{!isNumber && !isServer")[0];
  assert.ok(serverCards, "Expected server answer-card section");
  assert.doesNotMatch(serverCards, /thr-choice-number|index \+ 1/);
  assert.match(serverCards, /"Yes"/);
  assert.match(serverCards, /"No"/);
  assert.match(serverCards, /"Not sure"/);
  assert.match(questionUI, /<span className="thr-choice-number">0\{index \+ 1\}<\/span>/, "Other guided answer cards remain unchanged");
});


function narrativeModule() {
  const file = path.join(root, "src/lib/prospects/technology-health-narrative.ts");
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = {};
  vm.runInNewContext(code, {
    exports: result,
    module: { exports: result },
    require(id) {
      if (id === "./technology-health") return thr;
      throw new Error("Unexpected runtime import: " + id);
    },
  }, { filename: file });
  return result;
}

test("prospect outcomes explain business impact and Advantage's role without manufacturing technical facts", () => {
  const narrative = narrativeModule();
  const value = session();
  value.health.responses.backup = "unknown";
  value.health.responses.reliability = "concern";
  value.health.responses.security = "positive";
  const story = narrative.prospectThrStory(value);
  assert.equal(story.concernCount, 1);
  assert.equal(story.pendingCount, 1);
  assert.match(story.businessMeaning, /technology interruptions|slow appointments|interrupt/i);
  assert.match(story.advantageApproach, /review|onsite technology assessment/i);
  assert.equal(story.positives[0].title, "Security monitoring");
  assert.equal(story.findings.some((item) => item.status === "not-discussed"), false);
});

test("unknown responses are verification needs, never confirmed vulnerabilities", () => {
  const narrative = narrativeModule();
  const value = session();
  value.health.responses.backup = "unknown";
  const story = narrative.prospectThrStory(value);
  assert.equal(story.concernCount, 0);
  assert.equal(story.pendingCount, 1);
  assert.match(story.businessMeaning, /does not mean anything is wrong/i);
});

test("prospect report is separate from the presentation preview and uses color-coded health priority content", () => {
  const present = readFileSync(path.join(root, "src/components/prospect-thr-global.tsx"), "utf8");
  const report = readFileSync(path.join(root, "src/components/prospect-thr-report.tsx"), "utf8");
  const css = readFileSync(path.join(root, "src/app/prospect-thr-outcomes.css"), "utf8");
  assert.match(present, /<ProspectThrReportPreview session=\{session\}/);
  assert.match(present, /<ProspectThrReport session=\{session\} appointment=\{appointment\}/);
  assert.match(report, /Technology Health Report/);
  assert.match(report, /Your priorities and environment/);
  assert.match(report, /thr-report-finding/);
  assert.match(report, /thr-report-next-step/);
  assert.match(css, /thr-report-finding\.tone-reported-problem/);
  assert.match(css, /thr-report-finding\.tone-potential-concern/);
  assert.match(css, /thr-report-finding\.tone-needs-verification/);
  assert.match(css, /break-before:page/);
});

test("the onsite scheduler is offered on the report and final slide with manual verification and a persistent appointment", () => {
  const present = readFileSync(path.join(root, "src/components/prospect-thr-global.tsx"), "utf8");
  const scheduler = readFileSync(path.join(root, "src/components/prospect-a360-scheduler.tsx"), "utf8");
  const model = readFileSync(path.join(root, "src/lib/prospects/technology-health.ts"), "utf8");
  assert.equal((present.match(/<ProspectA360Scheduler appointment=\{appointment\} onConfirm=\{confirmAppointment\} requireAvailabilityCheck/g) ?? []).length, 2);
  assert.match(present, /appointment: value/);
  assert.match(present, /Onsite visit/);
  assert.match(model, /appointment\?: PlanningAppointment \| null/);
  assert.match(scheduler, /availabilityVerified/);
  assert.match(scheduler, /requireAvailabilityCheck && !availabilityVerified/);
});
