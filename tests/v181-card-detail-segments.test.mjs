import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const model = fs.readFileSync(new URL("../src/lib/compass/project-coverage.ts", import.meta.url), "utf8");
const card = fs.readFileSync(new URL("../src/components/project-coverage-card.tsx", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../src/components/project-coverage-dashboard.tsx", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
const list = fs.readFileSync(new URL("../src/components/project-coverage-client-list.tsx", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("v1.8.1 card-back detail blocks carry client segments and are clickable", () => {
  assert.match(model, /export interface ProjectCoverageCardStat/);
  assert.match(model, /clientIds: string\[\]/);
  for (const id of ["server-projects", "workstation-projects", "no-relationship-history", "oldest-discussion", "past-due-followups", "missing-outcome", "recent-quotes", "quotes-6-12-months", "quotes-older-12-months", "review-history-missing"]) {
    assert.match(model, new RegExp(`id: "${id}"`));
  }
  assert.match(model, /id: `client-\$\{client\.clientId\}`/);
  assert.match(card, /className=\{`project-coverage-stat\$\{selectedStatId === stat\.id \? " is-active" : ""\}`\}/);
  assert.match(card, /onClick=\{\(\) => onSelectStat\?\.\(stat\.id\)\}/);
  assert.match(card, /aria-pressed=\{selectedStatId === stat\.id\}/);
  assert.match(css, /\.project-coverage-stat-grid>\.project-coverage-stat\.is-active/);
});

test("v1.8.1 selected card detail filters the client list and can be cleared", () => {
  assert.match(home, /activeCoverageStatId/);
  assert.match(home, /onSelectStat=\{selectCoverageStat\}/);
  assert.match(home, /activeSegmentId=\{activeCoverageStatId\}/);
  assert.match(dashboard, /selectedStatId=\{selectedCardId === metric\.id \? selectedStatId : null\}/);
  assert.match(list, /const activeSegment = useMemo/);
  assert.match(list, /new Set\(activeSegment\.clientIds\)/);
  assert.match(list, /project-coverage-active-segment/);
  assert.match(list, /Clear segment/);
});

test("v1.8.1 lightweight client details displays the last quote date", () => {
  assert.match(workspace, /Last quote: \{formatDate\(draft\.lastQuoteDate\)\}/);
});
