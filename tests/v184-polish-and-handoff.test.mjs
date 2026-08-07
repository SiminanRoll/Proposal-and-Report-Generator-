import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");

test("v1.8.4 gives Project Coverage cards stronger premium metric hierarchy", () => {
  assert.match(css, /v1\.8\.4 — premium Project Coverage card hierarchy/);
  assert.match(css, /\.project-coverage-count strong\{font-size:clamp\(70px,6vw,92px\)/);
  assert.match(css, /\.project-coverage-card-front::before\{/);
  assert.match(css, /\.project-coverage-card\.is-selected \.project-coverage-card-front/);
});

test("v1.8.4 hardware inventory is fixed-width to the presentation viewport without horizontal scrolling", () => {
  assert.match(exportHtml, /device-table-wrap\{overflow-x:hidden;overflow-y:auto/);
  assert.match(exportHtml, /device-table\{width:100%;min-width:0;table-layout:fixed/);
  assert.match(exportHtml, /device-table th:nth-child\(10\)\{width:7%\}/);
  assert.doesNotMatch(exportHtml, /device-table\{width:100%;min-width:1060px/);
});

test("v1.8.4 uses client-facing Technology Health wording instead of internal weighting language", () => {
  assert.match(exportHtml, /critical systems need attention/);
  assert.doesNotMatch(exportHtml, /critical systems weighted/);
});

test("v1.8.4 Captain's Log creation can fall back to durable Windows handoff while reverse sync remains optional", () => {
  assert.match(bridge, /sendCoordinationCallToCaptainsLogReliable/);
  assert.match(bridge, /launchCaptainsLogCoordinationCall/);
  assert.match(bridge, /queued-via-protocol/);
  assert.match(bridge, /Number\(body\.version \|\| 0\) >= 839/);
  assert.match(workspace, /sendCoordinationCallToCaptainsLogReliable/);
  assert.match(workspace, /Windows handoff/);
});
