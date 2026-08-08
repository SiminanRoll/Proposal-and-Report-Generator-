import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const editor = fs.readFileSync(new URL("../src/components/segment-editor-dialog.tsx", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10927-polish.css", import.meta.url), "utf8");
const types = fs.readFileSync(new URL("../src/lib/segments/types.ts", import.meta.url), "utf8");

async function runtime() {
  return transpileTestModule("../src/lib/segments/engine.ts", import.meta.url, { prefix: "v10927-os-segments" });
}

function device(clientId, id, deviceType, osName, videoCard = "") {
  return { id, clientId, deviceType, osName, videoCard, lifecycle: "current", isVirtual: deviceType.startsWith("virtual") };
}

test("v1.0.9.28 exposes separate server virtual-server and workstation OS criteria", async () => {
  const { SEGMENT_RULE_FIELDS, SERVER_OS_OPTIONS, WORKSTATION_OS_OPTIONS, buildSegmentClientMetrics, segmentRuleMatches } = await runtime();
  for (const field of ["server-os", "virtual-server-os", "workstation-os"]) assert.equal(SEGMENT_RULE_FIELDS.some((item) => item.id === field), true);
  assert.equal(SERVER_OS_OPTIONS.some((item) => item.value === "windows-server-2016"), true);
  assert.equal(WORKSTATION_OS_OPTIONS.some((item) => item.value === "windows-10"), true);
  assert.equal(WORKSTATION_OS_OPTIONS.some((item) => item.value === "windows-10-home"), true);
  assert.equal(WORKSTATION_OS_OPTIONS.some((item) => item.value === "windows-11-home"), true);

  const dataset = {
    clients: [{ id: "c1", name: "Example", assignedOwner: "", city: "", state: "", market: "", industry: "", tags: [], lastAccountReview: "", lastQuoteDate: "", quoted: false }],
    devices: [
      device("c1", "ps", "physical-server", "Microsoft Windows Server 2016 Standard"),
      device("c1", "vs", "virtual-server", "Windows Server 2016 Datacenter"),
      device("c1", "w10h", "physical-workstation", "Microsoft Windows 10 Home", "Intel(R) UHD Graphics 630"),
      device("c1", "w11h", "physical-workstation", "Windows 11 Home"),
    ],
    summaries: [{ clientId: "c1", totalEstimatedValue: 0, priorityScore: 0 }],
    locations: [],
  };
  const metrics = buildSegmentClientMetrics(dataset, "c1");
  assert.ok(metrics);
  assert.equal(segmentRuleMatches({ id: "a", field: "server-os", operator: "is", value: "windows-server-2016" }, metrics), true);
  assert.equal(segmentRuleMatches({ id: "b", field: "virtual-server-os", operator: "is", value: "windows-server-2016" }, metrics), true);
  assert.equal(segmentRuleMatches({ id: "c", field: "workstation-os", operator: "is", value: "windows-10" }, metrics), true);
  assert.equal(segmentRuleMatches({ id: "d", field: "workstation-os", operator: "is", value: "windows-10-home" }, metrics), true);
  assert.equal(segmentRuleMatches({ id: "e", field: "workstation-os", operator: "is", value: "windows-11-home" }, metrics), true);
});

test("segment editor renders OS rules as dropdown criteria rather than free text", () => {
  assert.match(types, /"server-os"/);
  assert.match(types, /"virtual-server-os"/);
  assert.match(types, /"workstation-os"/);
  assert.match(editor, /segmentOsOptions\(rule\.field\)/);
  assert.match(editor, /nextKind === "os"/);
  assert.match(editor, /device age, device counts/);
});

test("client inventory adds a compact GPU column while prohibiting horizontal scroll", () => {
  assert.match(workspace, /<th>GPU<\/th>/);
  assert.match(workspace, /compactVideoCard\(device\.videoCard\)/);
  assert.match(workspace, /title=\{device\.videoCard \|\| "Video card not reported"\}/);
  assert.match(css, /overflow-x:hidden!important/);
  assert.match(css, /min-width:0!important/);
  assert.match(css, /table-layout:fixed!important/);
  assert.match(css, /nth-child\(4\).*width:11%/);
});
