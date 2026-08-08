import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace = fs.readFileSync(new URL("../src/components/project-workspace.tsx", import.meta.url), "utf8");
const outcome = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const hipaa = fs.readFileSync(new URL("../src/components/hipaa-readiness.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

function block(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  return source.slice(from, to === -1 ? undefined : to);
}

test("v1.9.8 finished-report layout remains intact in Client Compass 1.0.9.21", () => {
  assert.equal(pkg.version, "1.0.9.21");
  assert.match(workspace, /report-workspace-header/);
  assert.match(outcome, /report-status-strip/);
  assert.match(outcome, /report-main-cards/);
  assert.match(outcome, /report-summary-card/);
  assert.match(outcome, /report-plan-card/);
  assert.match(css, /\.report-workspace-toolbar\{position:static/);
  const richBranch = block(outcome, "{richClientReport ? <>", "</> : <>");
  assert.doesNotMatch(richBranch, /generator-command-center/);
  assert.doesNotMatch(richBranch, /Finished package/);
});

test("v1.9.8 source and HIPAA controls open focused editors instead of permanent report sections", () => {
  assert.match(outcome, /className="report-status-item sources"[\s\S]*onOpenSources/);
  assert.match(outcome, /className=\{`report-status-item hipaa/);
  assert.match(workspace, /source-editor-modal/);
  assert.match(workspace, /SourceWorkspaceRow/);
  assert.match(workspace, /hipaa-editor-modal/);
  assert.match(workspace, /Review and edit answers/);
  assert.match(hipaa, /initialOpen = false/);
  assert.match(hipaa, /useState\(initialOpen\)/);
});

test("v1.9.8 keeps a compact inventory snapshot directly below the report cards", () => {
  assert.match(outcome, /function CompactHardwareInventory/);
  assert.match(outcome, /assets included in the presentation/);
  for (const heading of ["Device", "Type", "Model", "Operating system", "Age", "Status"]) assert.match(outcome, new RegExp(`>${heading}<`));
  assert.match(outcome, /<CompactHardwareInventory project=\{project\} \/>/);
  assert.match(css, /\.report-compact-inventory-list\{[^}]*max-height:310px[^}]*overflow-y:auto/s);
  assert.match(css, /\.report-compact-inventory-row\{/);
});

test("v1.9.8 presentation hardware table fits the viewport without horizontal scrolling", () => {
  assert.match(css, /\.presentation-overlay \.presentation-device-table-wrap\{[^}]*overflow-x:hidden!important/s);
  assert.match(css, /\.presentation-overlay \.presentation-device-table\{[^}]*min-width:0!important[^}]*table-layout:fixed/s);
  assert.match(css, /\.presentation-overlay \.presentation-device-table th:nth-child\(10\)\{width:8%\}/);
});

test("v1.9.8 refreshing or replacing a source rebuilds an already-finished report", () => {
  assert.match(workspace, /const rebuilt = hasOutcome \? projectWithBuiltOutcome\(inventoryRebuilt\) : inventoryRebuilt/g);
  assert.match(workspace, /source\.multiple \? \[\.\.\.source\.files, \.\.\.records\] : records\.slice\(0, 1\)/);
});
