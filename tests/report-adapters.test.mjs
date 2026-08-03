import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadAdapters() {
  let ts;
  try {
    ts = await import("typescript");
  } catch {
    ts = await import("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js");
  }
  const source = fs.readFileSync(new URL("../src/lib/intelligence/browser/report-adapters.ts", import.meta.url), "utf8");
  const compiled = ts.default.transpileModule(source, {
    compilerOptions: {
      target: ts.default.ScriptTarget.ES2022,
      module: ts.default.ModuleKind.ESNext,
      verbatimModuleSyntax: true,
    },
  }).outputText;
  const file = path.join(os.tmpdir(), `report-adapters-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(file, compiled);
  return import(`${pathToFileURL(file).href}?v=${Date.now()}`);
}

function values(analysis) {
  return Object.fromEntries(analysis.facts.map((item) => [item.key, item.value]));
}

const scalePadText = `[[PAGE 1]]
Hardware Lifecycle Report
Sample Practice
July 2026
16 Hardware assets
Replacement status: 4 Due soon 9 Overdue 3 Unknown
Operating System: 9 OS supported 2 OS ending soon 3 OS unsupported
1 12 1 2
Servers Workstations VMs Network
[[PAGE 2]]
Servers User Last Check-In Make Serial Model OS Age Purchased Expires RAM CPU Storage
SERVER- Administrator 07/23/2026 Dell ABC123 PowerEdge T340 Server 2016 Standard Edition 6.9 09/14/2019 09/16/2023 34.1 GB Intel Xeon E-2134 2.0 TB
HOST-
01
Workstations User Last Check-In Make Serial Model OS Age Purchased Expires RAM CPU Storage
FRONTDESK User1 07/22/2026 Dell XYZ123 OptiPlex 3060 Windows 11 Professional Edition 64-bit 6.8 09/21/2019 09/22/2023 8.4 GB Intel Core i5-8500 498.2 GB
IMAGING-PC Imaging 07/22/2026 Dell IMG123 OptiPlex 7010 Windows 10 Professional Edition 64-bit 11.5 01/29/2015 04/29/2018 4.2 GB Core i3-3240 3.40GHZ 498.7 GB
Virtual Machines User Last Check-In Make Model OS RAM CPU Storage
DC-01 Administrator 07/23/2026 Microsoft Virtual Machine Server 2016 Standard Edition 21.5 GB Intel Xeon E-2134 1.2 TB
Network Make Serial Model Storage
WAP Ubiquiti NET123 AP-AC-LR 0.0 bytes
[[PAGE 3]]
Sample Evergreen/Replacement Budget
Budget Amount $36,900
The Hidden Cost of Old Hardware`;

const huntressText = `[[PAGE 1]]
Threat Report
2026-04-01 - 2026-06-30
[[PAGE 2]]
SUMMARY
During the time frame of this report, your cybersecurity platform analyzed 3,246,038 events from 14 entities on your network.
Of those events, there were 21 signals detected through automated and human analysis. None of the detected signals were suspicious in nature, thus no further investigation was warranted by your security team.
[[PAGE 3]]
PERSISTENT FOOTHOLDS
During this time frame, your cybersecurity platform analyzed 24,528 autorun events.
Of those events, there were 16 autorun signals detected.
None of the detected signals were suspicious in nature.
0 Foothold Incidents Reported
[[PAGE 4]]
RANSOMWARE CANARIES
During this time frame, your cybersecurity team monitored 198 canary files deployed on Windows endpoints.
Protected User Profiles
28 with 198 total canary files
Ransomware Incidents Reported
0 across 14 endpoints
[[PAGE 5]]
MANAGED AV
During this time frame, your cybersecurity platform analyzed 1 antivirus event and automatically blocked 1 potential malware file from executing.
Of those events, there were 0 antivirus signals investigated.
0 ANTIVIRUS INCIDENTS REPORTED
[[PAGE 6]]
PROCESS INSIGHTS
During this time frame, your cybersecurity platform analyzed 3,221,283 process events.
Of those events, there were 2 process signals detected.
None of the detected signals were suspicious in nature.
0 PROCESS INCIDENTS REPORTED
[[PAGE 7]]
INCIDENT SUMMARY
Great news! During this time frame you had no targeted attacks and had 0 incidents reported.`;

test("ScalePad adapter extracts lifecycle totals and detailed inventory", async () => {
  const { parseScalePadReport } = await loadAdapters();
  const result = parseScalePadReport(scalePadText, "scale", "Lifecycle.pdf");
  const fact = values(result);
  assert.equal(fact["scalepad.totalAssets"], 16);
  assert.equal(fact["scalepad.servers"], 1);
  assert.equal(fact["scalepad.workstations"], 12);
  assert.equal(fact["scalepad.vms"], 1);
  assert.equal(fact["scalepad.networkDevices"], 2);
  assert.equal(fact["scalepad.replacement.overdue"], 9);
  assert.equal(fact["scalepad.replacement.dueSoon"], 4);
  assert.ok(fact["scalepad.inventory"].some((item) => item.includes("SERVER-HOST-01")));
});

test("Huntress adapter distinguishes active monitoring from incidents", async () => {
  const { parseHuntressReport } = await loadAdapters();
  const result = parseHuntressReport(huntressText, "huntress", "Threat.pdf");
  const fact = values(result);
  assert.equal(fact["huntress.eventsAnalyzed"], 3246038);
  assert.equal(fact["huntress.entitiesProtected"], 14);
  assert.equal(fact["huntress.signalsDetected"], 21);
  assert.equal(fact["huntress.canaryFiles"], 198);
  assert.equal(fact["huntress.protectedProfiles"], 28);
  assert.equal(fact["huntress.malwareFilesBlocked"], 1);
  assert.equal(fact["huntress.incidentsReported"], 0);
  assert.match(result.findingCandidates.map((item) => item.title).join("\n"), /No reportable security incidents/);
});

test("combined report UI exposes lifecycle, security, and evidence views", () => {
  const experience = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
  const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
  for (const phrase of ["Technology health", "Security protection", "Ransomware early warning", "Managed antivirus", "Device detail"]) {
    assert.match(experience, new RegExp(phrase));
  }
  for (const phrase of ["Device inventory", "Autorun events analyzed", "Process events analyzed", "Generated locally from ScalePad and Huntress"]) {
    assert.match(exportHtml, new RegExp(phrase));
  }
});
