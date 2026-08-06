import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const questions = fs.readFileSync(new URL("../src/lib/hipaa/questions.ts", import.meta.url), "utf8");
const consultantGuidance = fs.readFileSync(new URL("../src/lib/hipaa/consultant-guidance.ts", import.meta.url), "utf8");
const hipaaPresentation = fs.readFileSync(new URL("../src/components/hipaa-presentation.tsx", import.meta.url), "utf8");
const plan = fs.readFileSync(new URL("../src/lib/outcomes/client-report-plan.ts", import.meta.url), "utf8");
const messaging = fs.readFileSync(new URL("../src/lib/outcomes/client-report-messaging.ts", import.meta.url), "utf8");
const experience = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const preMeeting = fs.readFileSync(new URL("../src/lib/outcomes/pre-meeting.ts", import.meta.url), "utf8");

async function planningRuntime() {
  let typescript;
  try { typescript = await import("typescript"); }
  catch { typescript = await import("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js"); }
  const ts = typescript.default;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "client-compass-v172-plan-"));
  const write = (name, content) => {
    const file = path.join(directory, name);
    fs.writeFileSync(file, content);
    return pathToFileURL(file).href;
  };
  const dataUrl = write("data.mjs", `
export const reportableLifecycleDevices = (project) => project.testDevices || [];
export const sortLifecycleDevices = (devices) => devices;
export const isServerClassDevice = (device) => device.type === "server" || device.type === "backup-server";
export const factNumber = () => 0;
export const osSupportSummary = () => ({ attention: 0, endOfSupport: 0, planning: 0 });
export const securityIncidentDetails = () => [];
`);
  const hipaaUrl = write("hipaa.mjs", `export const scoreHipaaAssessment = () => ({ notYetAssessedCount: 0, counts: { no: 0, partially: 0 } });`);
  const languageUrl = write("language.mjs", `export const applicationPlanningCopy = () => "software"; export const organizationPossessive = () => "practice's";`);
  const modeUrl = write("mode.mjs", `export const isRemoteConsultation = (project) => Boolean(project.remote);`);
  const reviewUrl = write("review.mjs", `export const hasAgreedReviewPlan = () => false; export const reviewOutcomePlanActions = () => [];`);
  let output = ts.transpileModule(plan, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true },
  }).outputText;
  output = output
    .replace('from "@/lib/hipaa/engine"', `from ${JSON.stringify(hipaaUrl)}`)
    .replace('from "./client-report-data"', `from ${JSON.stringify(dataUrl)}`)
    .replace('from "@/lib/projects/client-language"', `from ${JSON.stringify(languageUrl)}`)
    .replace('from "./planning-mode"', `from ${JSON.stringify(modeUrl)}`)
    .replace('from "@/lib/review-outcomes/model"', `from ${JSON.stringify(reviewUrl)}`);
  const moduleUrl = write("plan.mjs", output);
  return import(`${moduleUrl}?v=${Date.now()}`);
}


test("question 10 includes ongoing qualified HIPAA guidance without expanding the questionnaire", () => {
  assert.match(questions, /id: "HIPAA-10"[\s\S]*title: "Ongoing HIPAA review and guidance"/);
  assert.match(questions, /qualified HIPAA consultant or compliance professional/);
  assert.match(questions, /policies, staff training, and compliance needs/);
  assert.match(questions, /does not determine HIPAA compliance/);
  assert.equal([...questions.matchAll(/id: "HIPAA-\d{2}"/g)].length, 12);
});

test("report and presentation include concise consultant guidance", () => {
  assert.match(consultantGuidance, /potential weaknesses/);
  assert.match(consultantGuidance, /does not determine HIPAA compliance/);
  assert.match(consultantGuidance, /several answers are No or Not sure/);
  assert.match(consultantGuidance, /questionId === "HIPAA-10"/);
  assert.match(hipaaPresentation, /hipaaConsultantGuidance\(project\)/);
  assert.match(hipaaPresentation, /hipaa-consultant-guidance/);
  assert.match(exportHtml, /hipaa-consultant-note/);
  assert.match(exportHtml, /pdf-hipaa-consultant-note/);
  assert.match(preMeeting, /qualified HIPAA consultant or compliance professional/);
});

test("one to four workstation replacements use optional purchase-planning language", () => {
  assert.match(plan, /mode: "purchase-planning"/);
  assert.match(plan, /The next step is to plan for (?:its|those) replacement/);
  assert.match(plan, /When you are ready, our team can help confirm the right business-class computer/);
  assert.match(plan, /whenever the practice is ready/);
  assert.match(plan, /timing: approach\.mode === "purchase-planning" \? "When ready"/);
  assert.match(messaging, /Computer replacements to plan/);
});

test("small replacement guidance does not open or promote a consultation scheduler", () => {
  assert.match(experience, /hasHardwareActions && approach\.mode !== "purchase-planning" \? <OnsitePlanningScheduler/);
  assert.match(experience, /canSchedulePlanning = healthPriorities > 0 && !agreedPlan && approach\.mode !== "purchase-planning"/);
  assert.match(experience, /Plan the purchase/);
  assert.match(experience, /Coordinate when ready/);
  assert.match(experience, /without pressure/);
  assert.match(exportHtml, /agreedPlan \|\| approach\.mode === "purchase-planning" \? null : scheduledPlanningAppointment/);
  assert.match(exportHtml, /When you are ready/);
  assert.match(exportHtml, /Let us help confirm the fit/);
  assert.match(exportHtml, /Choose a comfortable purchase and installation timeline without pressure/);
});

test("five-or-more workstation refreshes and server projects retain guided planning options", () => {
  assert.match(plan, /const largeRefresh = priorities\.length > 4/);
  assert.match(plan, /if \(hasServerProject\)/);
  assert.match(plan, /if \(largeRefresh\)/);
  assert.match(plan, /Schedule a consultation call with your Technology Consultant/);
  assert.match(plan, /Schedule an onsite project-planning review/);
});


test("planning behavior switches exactly at five workstation replacements", async () => {
  const { technologyPlanningApproach } = await planningRuntime();
  const workstation = (index) => ({ name: `PC-${index}`, type: "workstation", lifecycleStatus: "overdue" });
  const base = { reviewOutcome: { items: [] }, remote: true };
  const four = technologyPlanningApproach({ ...base, testDevices: [1, 2, 3, 4].map(workstation) });
  const five = technologyPlanningApproach({ ...base, testDevices: [1, 2, 3, 4, 5].map(workstation) });
  const server = technologyPlanningApproach({ ...base, testDevices: [{ name: "Server", type: "server", lifecycleStatus: "overdue" }] });

  assert.equal(four.mode, "purchase-planning");
  assert.match(four.consultationCopy, /When you are ready/);
  assert.doesNotMatch(four.consultationCopy, /consultation call|onsite/i);
  assert.equal(five.mode, "remote-estimate");
  assert.match(five.consultationCopy, /consultation call/i);
  assert.equal(server.mode, "remote-estimate");
});
