import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadPromptParser() {
  let ts;
  try { ts = await import("typescript"); }
  catch { ts = await import("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js"); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "client-compass-trs-regression-"));
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

function emptyOutcome() {
  return {
    status: "not-reviewed",
    reviewedAt: "",
    meetingSummary: "",
    agreedNextStep: "",
    reportTitle: "",
    executiveSummary: "",
    presentationConcerns: [],
    clientConcern: "",
    items: [],
    lastUpdatedAt: "",
  };
}

test("plain numbered TRS decisions expand into usable structured Review Outcome fields", async () => {
  const { applyTailoredReportPrompt } = await loadPromptParser();
  const prompt = `### Meeting Summary

Met with Jeremy to review the practice’s current technology health, security posture, lifecycle concerns, and HIPAA readiness.

The biggest issue is the age of the practice’s computers. The report identified nine systems already in the lifecycle risk zone, with another approaching it. Most are around six years old. Jeremy specifically called out the Consult PC, which has already required a workaround because of network/driver compatibility problems following a Windows upgrade. He expects that computer may be one of the next to fail.

One remotely used computer, primarily used by Dr. Chamberlain’s mother for accounting/financial work, is currently running Windows 11 Home. Recommended upgrading it to Windows 11 Pro to improve manageability and security. Jeremy asked that this recommendation be included in the follow-up information so he can review it with Dr. Chamberlain.

Completed the HIPAA readiness review with Jeremy. The primary improvement identified was expanding multi-factor authentication, particularly for email. The HIPAA readiness score finished at 96%.

### Agreed Next Step

Chris will perform an onsite planning assessment on Friday, August 28 at 3:00 PM. The goal is to evaluate the aging systems, determine replacement priorities, understand implementation requirements, and prepare an estimate so Jeremy and Dr. Chamberlain can make an informed decision.

### Agreed Decisions

1. Develop a replacement plan and estimate for the aging computers rather than waiting for individual systems to fail.
2. Review the Consult PC closely because of its existing connectivity/compatibility issues.
3. Recommend upgrading the accounting computer from Windows 11 Home to Windows 11 Pro.
4. Consider expanding MFA, particularly for email access.
5. Plan any eventual workstation replacement project around patient flow, preferably with an onsite technician and scheduling that minimizes disruption.
6. Jeremy will review the resulting recommendations and pricing with Dr. Chamberlain.`;

  const result = applyTailoredReportPrompt(prompt, emptyOutcome());
  assert.equal(result.outcome.items.length, 6);
  assert.ok(result.outcome.items.every((item) => item.clientFacingNote.trim().length > 0));
  assert.ok(result.outcome.items.every((item) => item.technicalFinding.trim().length > 0));
  assert.ok(result.outcome.items.every((item) => item.responsibleParty.trim().length > 0));
  assert.ok(result.outcome.items.every((item) => item.targetDate.trim().length > 0));

  assert.equal(result.outcome.items[0].disposition, "advantage-replace");
  assert.match(result.outcome.items[0].technicalFinding, /age of the practice’s computers|lifecycle risk zone/i);
  assert.match(result.outcome.items[0].advantageResponsibility, /replacement plan and estimate/i);

  assert.equal(result.outcome.items[1].disposition, "investigate");
  assert.match(result.outcome.items[1].technicalFinding, /Consult PC/i);

  assert.equal(result.outcome.items[2].disposition, "upgrade-only");
  assert.match(result.outcome.items[2].technicalFinding, /Windows 11 Home/i);

  assert.match(result.outcome.items[3].technicalFinding, /multi-factor authentication/i);
  assert.match(result.outcome.items[5].clientResponsibility, /Jeremy will review/i);
  assert.equal(result.outcome.items[5].responsibleParty, "Client");
  assert.deepEqual(result.warnings, []);
});
