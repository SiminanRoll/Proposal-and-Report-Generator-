import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const controller = fs.readFileSync(new URL("../src/components/quick-present-global.tsx", import.meta.url), "utf8");
const list = fs.readFileSync(new URL("../src/components/project-coverage-client-list.tsx", import.meta.url), "utf8");
const projectPage = fs.readFileSync(new URL("../src/components/project-page-client.tsx", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/project-workspace.tsx", import.meta.url), "utf8");
const outcome = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("Quick Present remains global while Project Coverage rows use the streamlined Open and Report actions", () => {
  assert.match(shell, /QuickPresentGlobal/);
  assert.match(controller, /global-quick-present-button/);
  assert.match(controller, /Quick Present/);
  assert.match(list, /project-coverage-open-client/);
  assert.match(list, /project-coverage-report-client/);
  assert.doesNotMatch(list, /requestQuickPresent|project-coverage-present-quick/);
  assert.match(css, /global-quick-present-button/);
});

test("Quick Present reuses a finished local client report before asking for another source", () => {
  assert.match(controller, /findClientReportProject/);
  assert.match(controller, /outcomeReady\(project\)/);
  assert.match(controller, /goToPresentation\(project\)/);
  assert.match(controller, /present=1/);
  assert.match(controller, /Ready to present/);
});

test("Quick Present asks only for Huntress when a finished report is unavailable and can generate the package", () => {
  assert.match(controller, /Add current Huntress PDF/);
  assert.match(controller, /Security activity is the only missing source/);
  assert.match(controller, /expectedKind: "huntress-pdf"/);
  assert.match(controller, /buildCompassGeneratorPrefill/);
  assert.match(controller, /createProject\(/);
  assert.match(controller, /projectWithBuiltOutcome\(project\)/);
  assert.match(controller, /Generate & Present/);
  assert.match(controller, /confirmation.*still required|confirmations.*still required/s);
});

test("project routes can open an already-generated package directly in presentation mode", () => {
  assert.match(projectPage, /params\.get\("present"\) === "1"/);
  assert.match(projectPage, /autoPresent=\{autoPresent\}/);
  assert.match(workspace, /initialPresent=\{autoPresent\}/);
  assert.match(outcome, /initialPresent = false/);
  assert.match(outcome, /useState\(initialPresent\)/);
});
