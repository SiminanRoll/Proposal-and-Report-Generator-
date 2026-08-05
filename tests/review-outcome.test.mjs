import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function transpileModel() {
  let ts;
  try { ts = await import("typescript"); }
  catch { ts = await import("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js"); }
  const source = fs.readFileSync(new URL("../src/lib/review-outcomes/model.ts", import.meta.url), "utf8");
  const output = ts.default.transpileModule(source, {
    compilerOptions: { target: ts.default.ScriptTarget.ES2022, module: ts.default.ModuleKind.ESNext, verbatimModuleSyntax: true },
  }).outputText;
  const file = path.join(os.tmpdir(), `client-compass-review-outcome-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(file, output);
  return import(`${pathToFileURL(file).href}?v=${Date.now()}`);
}

test("review outcome model supports conversation-driven dispositions and old saved data", async () => {
  const { emptyReviewOutcome, normalizeReviewOutcome, createReviewOutcomeItem, reviewOutcomePlanActions, latestReviewOutcome } = await transpileModel();
  const empty = emptyReviewOutcome();
  assert.equal(empty.status, "not-reviewed");
  assert.equal(empty.reportTitle, "");
  assert.equal(empty.executiveSummary, "");

  const migrated = normalizeReviewOutcome({ status: "draft", meetingSummary: "Legacy saved review", items: [] });
  assert.equal(migrated.meetingSummary, "Legacy saved review");
  assert.equal(migrated.reportTitle, "");
  assert.equal(migrated.executiveSummary, "");

  const outcome = normalizeReviewOutcome({
    status: "confirmed",
    reviewedAt: "2026-08-05",
    meetingSummary: "The client already ordered replacement workstations and agreed to retire the old server.",
    agreedNextStep: "Coordinate workstation deployment, verify server dependencies, then decommission it.",
    items: [
      createReviewOutcomeItem({
        id: "workstations",
        title: "Deploy client-purchased workstations",
        disposition: "advantage-install-client-purchased",
        clientFacingNote: "Advantage will configure and install the computers the client already ordered.",
      }),
      createReviewOutcomeItem({
        id: "server",
        title: "Retire the legacy server",
        disposition: "retire-decommission",
        clientFacingNote: "Verify remaining dependencies and securely decommission the server.",
      }),
      createReviewOutcomeItem({ id: "internal-only", title: "Hidden", includeInReport: false }),
    ],
  });
  const actions = reviewOutcomePlanActions(outcome);
  assert.equal(actions.length, 2);
  assert.deepEqual(actions.map((item) => item.title), ["Deploy client-purchased workstations", "Retire the legacy server"]);
  assert.equal(actions[0].owner, "Advantage + Client");
  assert.equal(actions[1].timing, "Planned retirement");

  const olderLocal = normalizeReviewOutcome({ status: "draft", meetingSummary: "Old local", lastUpdatedAt: "2026-08-05T10:00:00.000Z" });
  const newerIncoming = normalizeReviewOutcome({ status: "confirmed", meetingSummary: "New Compass outcome", lastUpdatedAt: "2026-08-05T11:00:00.000Z" });
  assert.equal(latestReviewOutcome(olderLocal, newerIncoming).meetingSummary, "New Compass outcome");
  assert.equal(latestReviewOutcome(newerIncoming, olderLocal).meetingSummary, "New Compass outcome");

  const undatedLocal = normalizeReviewOutcome({ status: "not-reviewed" });
  const undatedIncoming = normalizeReviewOutcome({ status: "draft", agreedNextStep: "Use the agreed plan" });
  assert.equal(latestReviewOutcome(undatedLocal, undatedIncoming).agreedNextStep, "Use the agreed plan");
});

test("review outcome is persisted in Compass, carried into the generator, and editable before PDF delivery", () => {
  const engine = fs.readFileSync(new URL("../src/lib/compass/engine.ts", import.meta.url), "utf8");
  const bridge = fs.readFileSync(new URL("../src/lib/compass/generator-bridge.ts", import.meta.url), "utf8");
  const workspace = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");
  const editor = fs.readFileSync(new URL("../src/components/review-outcome-editor.tsx", import.meta.url), "utf8");
  const model = fs.readFileSync(new URL("../src/lib/review-outcomes/model.ts", import.meta.url), "utf8");
  const outcome = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
  const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
  const projectWorkspace = fs.readFileSync(new URL("../src/components/project-workspace.tsx", import.meta.url), "utf8");

  assert.match(engine, /reviewOutcome: existing\?\.reviewOutcome \?\? emptyReviewOutcome\(\)/);
  assert.match(bridge, /reviewOutcome: client\.reviewOutcome/);
  assert.match(workspace, /Update Review Outcome/);
  assert.match(workspace, /Record client-purchased equipment, retirements, deferrals/);
  assert.match(model, /Client already purchased equipment/);
  assert.match(model, /Advantage to install client-purchased equipment/);
  assert.match(model, /Retire and decommission/);
  assert.match(editor, /Include in PDF/);
  assert.match(editor, /Client-facing plan language/);
  assert.match(editor, /Responsible party/);
  assert.match(outcome, /Tailor report/);
  assert.match(outcome, /The technical findings stay factual/);
  assert.match(exportHtml, /Agreed technology roadmap/);
  assert.match(exportHtml, /Agreed next step/);
  assert.match(exportHtml, /clientReportPlanActions/);
  assert.match(projectWorkspace, /latestReviewOutcome/);
  assert.match(projectWorkspace, /reviewOutcomeChanged/);
  assert.match(projectWorkspace, /Refresh source data/);
});

test("tailored client-facing framing remains part of the persistent review outcome", () => {
  const types = fs.readFileSync(new URL("../src/lib/review-outcomes/types.ts", import.meta.url), "utf8");
  const editor = fs.readFileSync(new URL("../src/components/review-outcome-editor.tsx", import.meta.url), "utf8");
  const builder = fs.readFileSync(new URL("../src/lib/outcomes/builder.ts", import.meta.url), "utf8");
  assert.match(types, /reportTitle: string/);
  assert.match(types, /executiveSummary: string/);
  assert.match(editor, /reportTitle: finalPresentation\?\.title/);
  assert.match(editor, /executiveSummary: finalPresentation\?\.executiveSummary/);
  assert.match(builder, /project\.reviewOutcome\.reportTitle\.trim\(\)/);
  assert.match(builder, /project\.reviewOutcome\.executiveSummary\.trim\(\)/);

  const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
  assert.match(exportHtml, /const reportTitle =/);
  assert.match(exportHtml, /const reportSummary =/);
  assert.match(exportHtml, /escapeHtml\(reportTitle\)/);
  assert.match(exportHtml, /escapeHtml\(reportSummary\)/);
});
