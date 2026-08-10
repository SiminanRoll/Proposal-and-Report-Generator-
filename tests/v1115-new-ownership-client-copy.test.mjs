import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const report = fs.readFileSync(new URL("../src/lib/outcomes/new-ownership-report-export.ts", import.meta.url), "utf8");

test("new ownership technology health PDF speaks directly to the client", () => {
  assert.match(report, /Here’s where your technology stands today\./);
  assert.match(report, /You are taking over/);
  assert.match(report, /Advantage will help you decide what matters most and plan what comes next/);
  assert.match(report, /The goal is to avoid surprises, not create a shopping list/);
  assert.doesNotMatch(report, /Know what you are inheriting before it becomes a surprise/);
  assert.doesNotMatch(report, /A practical baseline of the computers, servers, network equipment/);
  assert.doesNotMatch(report, /Worth keeping visible/);
  assert.doesNotMatch(report, /lifecycle-planning window/);
});
