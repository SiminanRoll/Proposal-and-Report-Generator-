import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");

test("v1.8.8 gives Project Coverage cards stronger premium metric hierarchy", () => {
  assert.match(css, /Client Compass v1\.8\.5 — card balance/);
  assert.match(css, /font-size:clamp\(88px,7\.2vw,112px\)!important/);
  assert.match(css, /\.project-coverage-card-front::before\{/);
  assert.match(css, /\.project-coverage-card\.is-selected \.project-coverage-card-front/);
});

test("v1.8.8 hardware inventory is fixed-width to the presentation viewport without horizontal scrolling", () => {
  assert.match(exportHtml, /device-table-wrap\{overflow-x:hidden;overflow-y:auto/);
  assert.match(exportHtml, /device-table\{width:100%;min-width:0;table-layout:fixed/);
  assert.match(exportHtml, /device-table th:nth-child\(10\)\{width:7%\}/);
  assert.doesNotMatch(exportHtml, /device-table\{width:100%;min-width:1060px/);
});

test("v1.8.8 uses client-facing Technology Health wording instead of internal weighting language", () => {
  assert.match(exportHtml, /critical systems need attention/);
  assert.doesNotMatch(exportHtml, /critical systems weighted/);
});

test("v1.8.8 Captain's Log creation uses the shared Supabase app_events queue", () => {
  const cloud = fs.readFileSync(new URL("../src/lib/compass/captains-log-cloud.ts", import.meta.url), "utf8");
  assert.match(bridge, /sendCoordinationCallToCaptainsLogReliable/);
  assert.match(bridge, /client_compass_request/);
  assert.match(bridge, /client_compass_response/);
  assert.match(bridge, /queued-cloud/);
  assert.match(cloud, /auth\/v1\/token/);
  assert.match(workspace, /sendCoordinationCallToCaptainsLogReliable/);
  assert.doesNotMatch(workspace, /Windows handoff/);
});
