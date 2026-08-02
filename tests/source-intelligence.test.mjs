import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const analyzer = fs.readFileSync(new URL("../src/lib/intelligence/server/analyze-file.ts", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../src/lib/intelligence/client.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../src/app/api/intelligence/analyze/route.ts", import.meta.url), "utf8");
const templates = fs.readFileSync(new URL("../src/lib/projects/templates.ts", import.meta.url), "utf8");
const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("Phase 2 has a Node source-analysis endpoint", () => {
  assert.match(route, /runtime = "nodejs"/);
  assert.match(route, /analyzeFile/);
  assert.doesNotMatch(route, /python|subprocess|localhost:8765/i);
});

test("RFT intelligence maps the known workbook sections", () => {
  for (const sheet of ["Assessment Summary", "Computers-Other", "Server Aging-Other", "Workstation Aging-Other", "Security and Backup-Other", "Patches (Windows Updates)", "Major Apps-Other-Windows"]) {
    assert.match(analyzer, new RegExp(sheet.replace(/[()]/g, "\\$&")));
  }
});

test("RFT intelligence produces the agreed high-value facts", () => {
  for (const key of ["environment.totalComputers", "environment.servers", "applications.clinical", "security.firewallDisabled", "backup.endpointMissing", "patching.affectedComputers", "lifecycle.serverReview"]) {
    assert.match(analyzer, new RegExp(key.replaceAll(".", "\\.")));
  }
});

test("PDF and document sources have supported parsers", () => {
  assert.ok(packageJson.dependencies["pdf-parse"]);
  assert.ok(packageJson.dependencies.mammoth);
  assert.ok(packageJson.dependencies.xlsx);
  for (const sourceType of ["scalepad", "huntress", "legacy-proposal", "tc-notes", "office-photo"]) {
    assert.match(analyzer, new RegExp(sourceType));
  }
});

test("the exception queue stays focused on human-only answers", () => {
  for (const key of ["proposal.managedUsers", "client.locationCount", "discovery.primaryPain", "backup.currentDesign", "legacy.pricingReview"]) {
    assert.match(client, new RegExp(key.replaceAll(".", "\\.")));
  }
  assert.doesNotMatch(client, /for \(const item of facts\.filter/);
});

test("RFT is the only required prospect file", () => {
  const prospectBlock = templates.slice(templates.indexOf('"prospect-proposal"'), templates.indexOf('"legacy-modernization"'));
  assert.match(prospectBlock, /kind: "rft-spreadsheet"[\s\S]*?required: true/);
  assert.match(prospectBlock, /kind: "tc-discovery"[\s\S]*?required: false/);
  assert.match(prospectBlock, /kind: "office-photos"[\s\S]*?required: false/);
});

test("RFT security parser follows continuation rows for each computer", () => {
  assert.match(analyzer, /if \(!currentComputer\) continue/);
  assert.match(analyzer, /state\.firewallOff = true/);
  assert.doesNotMatch(analyzer, /if \(!namedComputer \|\| !currentComputer\) continue/);
});
