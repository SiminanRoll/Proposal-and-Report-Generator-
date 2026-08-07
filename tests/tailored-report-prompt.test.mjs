import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function transpilePromptModule() {
  let ts;
  try { ts = await import("typescript"); }
  catch { ts = await import("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js"); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "client-compass-tailored-prompt-"));
  for (const name of ["model", "tailored-prompt"]) {
    const source = fs.readFileSync(new URL(`../src/lib/review-outcomes/${name}.ts`, import.meta.url), "utf8");
    let output = ts.default.transpileModule(source, {
      compilerOptions: { target: ts.default.ScriptTarget.ES2022, module: ts.default.ModuleKind.ESNext, verbatimModuleSyntax: true },
    }).outputText;
    output = output.replaceAll('from "./model"', 'from "./model.mjs"');
    fs.writeFileSync(path.join(dir, `${name}.mjs`), output);
  }
  return import(`${pathToFileURL(path.join(dir, "tailored-prompt.mjs")).href}?v=${Date.now()}`);
}

function baseOutcome() {
  return {
    status: "not-reviewed",
    reviewedAt: "",
    meetingSummary: "",
    agreedNextStep: "",
    reportTitle: "",
    executiveSummary: "",
    items: [],
    lastUpdatedAt: "",
  };
}

test("labeled tailored report summary fills report framing, review record, and decisions", async () => {
  const { applyTailoredReportPrompt } = await transpilePromptModule();
  const prompt = `TAILORED REPORT SUMMARY
Plan status: Confirmed with client
Review date: 2026-08-05
Report title: Agreed Technology Roadmap
Executive summary: The practice has already ordered replacement computers and will retire its legacy server.
Meeting summary: The client ordered five computers. The server will be retired rather than replaced.
Agreed next step: Coordinate deployment, validate dependencies, and schedule decommissioning.

DECISION 1
Plan item: Deploy client-purchased workstations
Outcome: Advantage to install client-purchased equipment
Technical finding: Five aging workstations remain in service.
Client-facing plan language: Advantage will prepare and deploy the computers already ordered by the practice.
Responsible party: Advantage + Client
Target date or timing: After equipment arrives
Internal note: Confirm models and licensing before scheduling.
Include in PDF: Yes
END DECISION

DECISION 2
Plan item: Retire the legacy server
Outcome: Retire and decommission
Technical finding: The legacy server remains visible in inventory.
Client-facing plan language: Verify remaining dependencies and securely decommission the server.
Responsible party: Advantage + Client
Target date or timing: After dependency review
Internal note: Do not quote a replacement server.
Include in PDF: Yes
END DECISION`;

  const result = applyTailoredReportPrompt(prompt, baseOutcome(), { title: "Old title", executiveSummary: "Old summary" });
  assert.equal(result.outcome.status, "confirmed");
  assert.equal(result.outcome.reviewedAt, "2026-08-05");
  assert.equal(result.outcome.reportTitle, "Agreed Technology Roadmap");
  assert.match(result.outcome.executiveSummary, /already ordered replacement computers/);
  assert.equal(result.outcome.items.length, 2);
  assert.equal(result.outcome.items[0].disposition, "advantage-install-client-purchased");
  assert.equal(result.outcome.items[1].disposition, "retire-decommission");
  assert.equal(result.outcome.items[1].internalNote, "Do not quote a replacement server.");
  assert.equal(result.presentation.title, "Agreed Technology Roadmap");
  assert.deepEqual(result.warnings, []);
});

test("natural tailored report headings and numbered decisions are accepted", async () => {
  const { applyTailoredReportPrompt } = await transpilePromptModule();
  const prompt = `Meeting Summary

The practice has largely transitioned from its onsite server to a cloud platform. The existing server remains in limited use while final imaging migrations and historical account items are completed. Advantage must verify the remaining data and dependencies before formally confirming that the server can be safely retired.

Three new Dell computers have already been purchased, but several additional computers are beyond or approaching their recommended lifecycle. Continuing the replacement process should remain a priority, particularly for systems already showing memory errors, slow performance, or other reliability concerns. The environment remains stable, with no confirmed security incidents during the reporting period.

Agreed Next Step

Coordinate onsite installation of the three client-purchased computers once all have arrived. Advantage will also verify the remaining server data and dependencies, provide a corrected and prioritized computer replacement list, and help the practice plan the next phase of replacements so additional aging systems are not deferred too long. Complete the remaining HIPAA readiness questions and update the final score.

Agreed Decisions

1. Conditionally plan for server retirement
The long-term goal is to retire rather than replace the server. Advantage must first verify all remaining data, applications, devices, and workflow dependencies before providing approval to decommission it.

2. Install the three Dell computers onsite
Schedule one coordinated onsite installation after Anne confirms that all three computers have arrived.

3. Prioritize the remaining aging computers
The three new systems are an important first step, but several additional computers remain beyond or near their recommended lifecycle. Continue replacements in manageable phases while prioritizing systems with performance problems, memory errors, or the greatest operational risk.

4. Complete the HIPAA readiness review
Finish the two remaining questionnaire items and recalculate the score before presenting it as final.`;

  const result = applyTailoredReportPrompt(prompt, baseOutcome(), { title: "Technology Review", executiveSummary: "Existing executive summary" });
  assert.match(result.outcome.meetingSummary, /largely transitioned/);
  assert.match(result.outcome.agreedNextStep, /Coordinate onsite installation/);
  assert.equal(result.outcome.status, "draft");
  assert.equal(result.outcome.items.length, 4);
  assert.equal(result.outcome.items[0].disposition, "retire-decommission");
  assert.equal(result.outcome.items[1].disposition, "advantage-install-client-purchased");
  assert.equal(result.outcome.items[2].disposition, "advantage-replace");
  assert.equal(result.outcome.items[3].disposition, "investigate");
  assert.match(result.outcome.items[2].clientFacingNote, /Continue replacements in manageable phases/);
  assert.equal(result.presentation.title, "Technology Review");
  assert.match(result.presentation.executiveSummary, /largely transitioned/);
  assert.deepEqual(result.warnings, []);
});


test("three-section TRS uses Meeting Summary as client-facing Summary Framing instead of preserving generic framing", async () => {
  const { applyTailoredReportPrompt } = await transpilePromptModule();
  const prompt = `Meeting Summary

Security performance was strong, with approximately 3 million events analyzed, 65 signals, zero confirmed incidents, and no malware activity. Ransomware protection is active with no detected issues.

The primary concern is the practice server, which is approximately seven years old and presents the greatest operational risk if it fails. Several workstations are also aging, including one check-in computer running unsupported Windows 8.

Agreed Next Step

Coordinate with Eric to complete a no-cost onsite server planning review.

Agreed Decisions

1. Prioritize the server
Treat the aging server as the primary technology planning item.

2. Address unsupported operating systems
The Windows 8 check-in computer requires attention.`;

  const result = applyTailoredReportPrompt(prompt, baseOutcome(), {
    title: "Technology Review",
    executiveSummary: "27 technology assets are included in the environment review, with 8 recommended for replacement now.",
  });

  assert.match(result.outcome.executiveSummary, /Security performance was strong/);
  assert.match(result.outcome.executiveSummary, /primary concern is the practice server/);
  assert.doesNotMatch(result.outcome.executiveSummary, /technology assets are included/);
  assert.equal(result.presentation.executiveSummary, result.outcome.meetingSummary);
  assert.ok(result.appliedFields.includes("summary framing"));
});

test("explicit Summary Framing heading overrides Meeting Summary for the report intro", async () => {
  const { applyTailoredReportPrompt } = await transpilePromptModule();
  const result = applyTailoredReportPrompt(`Summary Framing
The server is the immediate planning priority while the rest of the environment remains stable.

Meeting Summary
The meeting covered security, lifecycle, HIPAA readiness, and server planning.

Agreed Next Step
Complete the server planning review.`, baseOutcome(), { title: "Technology Review", executiveSummary: "Old framing" });

  assert.equal(result.outcome.executiveSummary, "The server is the immediate planning priority while the rest of the environment remains stable.");
  assert.equal(result.presentation.executiveSummary, result.outcome.executiveSummary);
  assert.match(result.outcome.meetingSummary, /security, lifecycle/);
});

test("markdown-style natural headings are accepted", async () => {
  const { applyTailoredReportPrompt } = await transpilePromptModule();
  const result = applyTailoredReportPrompt(`## Meeting Summary\nReviewed current priorities.\n\n**Agreed Next Step**\nSchedule the follow-up.\n\n### Agreed Decisions\n1. Monitor storage\nContinue monitoring capacity.`, baseOutcome());
  assert.equal(result.outcome.meetingSummary, "Reviewed current priorities.");
  assert.equal(result.outcome.agreedNextStep, "Schedule the follow-up.");
  assert.equal(result.outcome.items[0].disposition, "monitor");
});

test("JSON tailored prompt is supported and omitted decisions do not erase existing decisions", async () => {
  const { applyTailoredReportPrompt } = await transpilePromptModule();
  const current = baseOutcome();
  current.items = [{
    id: "existing",
    title: "Keep this decision",
    technicalFinding: "Existing finding",
    disposition: "monitor",
    clientFacingNote: "Continue monitoring.",
    internalNote: "",
    responsibleParty: "Advantage",
    targetDate: "Ongoing",
    includeInReport: true,
    deviceIds: [],
  }];
  const result = applyTailoredReportPrompt(JSON.stringify({
    planStatus: "draft",
    meetingSummary: "Only update the summary.",
    agreedNextStep: "Follow up next quarter.",
  }), current);
  assert.equal(result.outcome.status, "draft");
  assert.equal(result.outcome.items.length, 1);
  assert.equal(result.outcome.items[0].id, "existing");
  assert.equal(result.outcome.meetingSummary, "Only update the summary.");
});

test("unrecognized prompts fail visibly instead of silently changing the review", async () => {
  const { applyTailoredReportPrompt } = await transpilePromptModule();
  assert.throws(() => applyTailoredReportPrompt("Please make this report nicer.", baseOutcome()), /No recognized tailored-report fields/);
  assert.throws(() => applyTailoredReportPrompt("   ", baseOutcome()), /Paste a tailored report summary/);
});

test("review outcome editor exposes the tailored report prompt shortcut", () => {
  const editor = fs.readFileSync(new URL("../src/components/review-outcome-editor.tsx", import.meta.url), "utf8");
  const parser = fs.readFileSync(new URL("../src/lib/review-outcomes/tailored-prompt.ts", import.meta.url), "utf8");
  assert.match(editor, /Apply a tailored report summary/);
  assert.match(editor, /Tailored report prompt/);
  assert.match(editor, /Apply tailored summary/);
  assert.match(editor, /Nothing is saved until/);
  assert.match(parser, /TAILORED REPORT SUMMARY/);
  assert.match(parser, /Meeting Summary/);
  assert.match(editor, /Normal headings are supported/);
  assert.match(parser, /retire and decommission/);
});
