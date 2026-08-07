import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard = fs.readFileSync(new URL("../src/components/home-dashboard.tsx", import.meta.url), "utf8");
const createPage = fs.readFileSync(new URL("../src/components/create-page-client.tsx", import.meta.url), "utf8");
const notFound = fs.readFileSync(new URL("../src/app/not-found.tsx", import.meta.url), "utf8");
const outcome = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const store = fs.readFileSync(new URL("../src/lib/projects/store.ts", import.meta.url), "utf8");

test("visible navigation keeps current report and proposal terminology", () => {
  assert.match(dashboard, /Reports &amp; proposals/);
  assert.match(dashboard, /Technology Review/);
  assert.doesNotMatch(dashboard, /Recent workspaces|Package ready|Open workspace|Delete workspace/);
  assert.match(createPage, /workspace types/);
  assert.match(notFound, /That workspace is not available/);
  assert.doesNotMatch(`${dashboard}\n${createPage}\n${notFound}`, /Back to projects|saved projects|project types|Present to client|client experience starts/i);
});

test("deleting a workspace also removes locally cached HIPAA evidence", () => {
  assert.match(store, /hipaaEvidenceIds/);
  assert.match(store, /answer\.evidenceAttachment\?\.id/);
  assert.match(store, /new Set\(\[\.\.\.sourceFileIds, \.\.\.hipaaEvidenceIds\]\)/);
  assert.match(store, /deleteLocalSourceFiles\(fileIds\)/);
});


test("HIPAA disabled workspace icon stays compact", () => {
  const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.hipaa-invite \.section-kicker svg\{width:15px;height:15px/);
  assert.match(css, /\.hipaa-invite\.hipaa-disabled\{min-height:0\}/);
});
