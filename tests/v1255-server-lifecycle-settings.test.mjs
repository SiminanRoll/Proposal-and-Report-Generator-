import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const reportData = readFileSync("src/lib/outcomes/client-report-data.ts", "utf8");
const technicalTruth = readFileSync("src/lib/technical-truth/index.ts", "utf8");

test("client reports use saved Compass server lifecycle thresholds", () => {
  assert.match(reportData, /client-compass\.configuration\.v1/);
  assert.match(reportData, /normalizeCompassConfig\(JSON\.parse\(raw\)/);
  assert.match(reportData, /classifyTechnicalLifecycle\([\s\S]*ageYears: age,[\s\S]*\}, thresholds,/);
  assert.match(technicalTruth, /age >= thresholds\.serverCriticalYears[\s\S]*return "replace-now"/);
  assert.match(technicalTruth, /age >= thresholds\.serverPlanningYears[\s\S]*return "plan-soon"/);
});

test("client report lifecycle summaries and replacement lists use corrected device status", () => {
  assert.match(reportData, /export function lifecycleDevices\(project: Project\)/);
  assert.match(reportData, /export function inventoryReportDevices\(project: Project\)/);
  assert.match(reportData, /export function reportableLifecycleDevices\(project: Project\)/);
  assert.match(reportData, /export function replacementDevices\(project: Project\)/);
  assert.match(reportData, /export function lifecycleSummary\(project: Project\)/);
  assert.match(reportData, /device\.lifecycleStatus === "overdue"/);
});

test("server planning packages display actual inventory age instead of a hardcoded age band", () => {
  assert.match(reportData, /function serverAgeDriver\(devices: ClientReportDevice\[\]\)/);
  assert.match(reportData, /Number\(device\.age\)/);
  assert.match(reportData, /`1 physical server · \$\{formattedAge\(oldest\)\} · \$\{status\}`/);
  assert.match(reportData, /Replace now/);
  assert.match(reportData, /filter\(\(driver\) => !\/physical servers\?\.\*\(\?:years\?\|lifecycle\)\/i\.test\(driver\)\)/);
  assert.doesNotMatch(reportData, /7\+ years old/);
});

test("location snapshots inherit the same corrected replace-now and plan-soon status", () => {
  assert.match(reportData, /export function compassLocationSnapshots/);
  assert.match(reportData, /replaceNow: matched\.filter\(\(device\) => device\.lifecycleStatus === "overdue"\)\.length/);
  assert.match(reportData, /planSoon: matched\.filter\(\(device\) => device\.lifecycleStatus === "due-soon"\)\.length/);
});
