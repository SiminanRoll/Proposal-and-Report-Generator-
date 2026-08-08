import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const editor = fs.readFileSync(new URL("../src/components/segment-editor-dialog.tsx", import.meta.url), "utf8");
const mapPage = fs.readFileSync(new URL("../src/components/territory-map-page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10928-polish.css", import.meta.url), "utf8");

async function runtime() {
  return transpileTestModule("../src/lib/segments/engine.ts", import.meta.url, { prefix: "v10928-segment-units" });
}

function device(clientId, id, deviceType, warrantyStart, lifecycle = "current") {
  return { id, clientId, deviceType, warrantyStart, lifecycle, osName: "", isVirtual: deviceType.startsWith("virtual") };
}

test("v1.0.9.28 groups criteria by meaning and exposes explicit age units", async () => {
  const { SEGMENT_RULE_GROUPS, SEGMENT_RULE_FIELDS, segmentFieldUnit, segmentFieldDefaultValue } = await runtime();
  assert.deepEqual(SEGMENT_RULE_GROUPS, ["Device age", "Device counts", "Operating system", "Opportunity & priority", "Workflow & activity", "Client details"]);
  assert.equal(SEGMENT_RULE_FIELDS.find((field) => field.id === "physical-server-age-years")?.label, "Physical server age");
  assert.equal(SEGMENT_RULE_FIELDS.find((field) => field.id === "workstation-age-years")?.label, "Physical workstation age");
  assert.equal(SEGMENT_RULE_FIELDS.find((field) => field.id === "server-os")?.label, "Physical server OS");
  assert.equal(SEGMENT_RULE_FIELDS.some((field) => field.id === "virtual-servers"), true);
  assert.equal(segmentFieldUnit("physical-server-age-years"), "years");
  assert.equal(segmentFieldDefaultValue("physical-server-age-years"), "5");
  assert.match(editor, /<optgroup key={group} label={group}>/);
  assert.match(editor, /segment-rule-number-unit/);
});

test("physical server and workstation age criteria use oldest known warranty-start age", async () => {
  const { buildSegmentClientMetrics, segmentRuleMatches } = await runtime();
  const dataset = {
    clients: [{ id: "c1", name: "Example", assignedOwner: "", city: "", state: "", market: "", industry: "", tags: [], lastAccountReview: "", lastQuoteDate: "", quoted: false }],
    devices: [
      device("c1", "server-old", "physical-server", "2019-01-01"),
      device("c1", "server-new", "physical-server", "2024-01-01"),
      device("c1", "ws-old", "physical-workstation", "2020-01-01", "replace-now"),
      device("c1", "ws-new", "physical-workstation", "2025-01-01", "current"),
      device("c1", "vm", "virtual-server", "2020-01-01"),
    ],
    summaries: [{ clientId: "c1", totalEstimatedValue: 0, priorityScore: 0 }],
    locations: [],
  };
  const metrics = buildSegmentClientMetrics(dataset, "c1", new Date("2026-08-08T12:00:00Z"));
  assert.ok(metrics);
  assert.equal(metrics.physicalServers, 2);
  assert.equal(metrics.virtualServers, 1);
  assert.equal(metrics.replaceNow, 1);
  assert.equal(metrics.healthy, 1);
  assert.ok(metrics.physicalServerAgeYears > 7);
  assert.ok(metrics.workstationAgeYears > 6);
  assert.equal(segmentRuleMatches({ id: "server-age", field: "physical-server-age-years", operator: "gte", value: "7" }, metrics), true);
  assert.equal(segmentRuleMatches({ id: "ws-age", field: "workstation-age-years", operator: "gte", value: "6" }, metrics), true);
  assert.equal(segmentRuleMatches({ id: "virtual-count", field: "virtual-servers", operator: "gte", value: "1" }, metrics), true);
});

test("territory map supports bounded pointer drag panning without turning drags into selections", () => {
  assert.match(mapPage, /type MapPan =/);
  assert.match(mapPage, /clampMapPan/);
  assert.match(mapPage, /onPointerDown={beginMapPan}/);
  assert.match(mapPage, /onPointerMove={moveMapPan}/);
  assert.match(mapPage, /onPointerUp={endMapPan}/);
  assert.match(mapPage, /suppressMapClickRef/);
  assert.ok(mapPage.includes("viewBox={viewBoxForZoom(zoom, pan)}"));
  assert.match(css, /cursor:grab/);
  assert.match(css, /touch-action:none/);
});
