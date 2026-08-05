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
  assert.match(parser, /retire and decommission/);
});
