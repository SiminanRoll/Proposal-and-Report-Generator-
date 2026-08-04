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
  assert.equal(fact["scalepad.totalAssets"], 13);
  assert.equal(fact["scalepad.servers"], 1);
  assert.equal(fact["scalepad.workstations"], 12);
  assert.equal(fact["scalepad.vms"], 1);
  assert.equal(fact["scalepad.networkDevices"], 2);
  assert.equal(fact["scalepad.replacement.overdue"], 3);
  assert.equal(fact["scalepad.replacement.dueSoon"], 0);
  assert.equal(fact["scalepad.replacement.unknown"], 10);
  assert.ok(fact["scalepad.inventory"].some((item) => item.includes("SERVER-HOST-01")));
});


test("ScalePad adapter preserves healthy devices when only part of the physical fleet is overdue", async () => {
  const { parseScalePadReport } = await loadAdapters();
  const text = `[[PAGE 1]]
Hardware Lifecycle Report
Sample Practice
August 2026
8 Hardware assets
Replacement status: 2 Overdue 3 Unknown
1 4 1 2
Servers Workstations VMs Network
[[PAGE 2]]
Servers User Last Check-In Make Serial Model OS Age Purchased Expires RAM CPU Storage
SERVER Administrator 07/23/2026 Dell S1 PowerEdge T340 Server 2019 Standard Edition 6.9 09/14/2019 09/16/2023 32 GB Intel Xeon E-2134 2 TB
Workstations User Last Check-In Make Serial Model OS Age Purchased Expires RAM CPU Storage
OLD-PC User1 07/22/2026 Dell W1 OptiPlex 3060 Windows 11 Professional Edition 64-bit 7.0 09/21/2019 09/22/2023 8 GB Intel Core i5-8500 498 GB
GOOD-ONE User2 07/22/2026 Dell W2 OptiPlex 7010 Windows 11 Professional Edition 64-bit 2.0 08/11/2024 08/12/2027 16 GB Intel Core i5-12500 500 GB
GOOD-TWO User3 07/22/2026 Dell W3 OptiPlex 7010 Windows 11 Professional Edition 64-bit 2.1 08/11/2024 08/12/2027 16 GB Intel Core i5-12500 500 GB
GOOD-THREE User4 07/22/2026 Dell W4 OptiPlex 7010 Windows 11 Professional Edition 64-bit 2.2 08/11/2024 08/12/2027 16 GB Intel Core i5-12500 500 GB
Virtual Machines User Last Check-In Make Model OS RAM CPU Storage
DC-01 Administrator 07/23/2026 Microsoft Virtual Machine Server 2019 Standard Edition 16 GB Intel Xeon E-2134 1 TB
Network Make Serial Model Storage
WAP Ubiquiti N1 AP-AC-LR 0 bytes
Switch Ubiquiti N2 US-24 0 bytes`;
  const result = parseScalePadReport(text, "scale", "Lifecycle.pdf");
  const fact = values(result);
  assert.equal(fact["scalepad.totalAssets"], 5);
  assert.equal(fact["scalepad.replacement.overdue"], 2);
  assert.equal(fact["scalepad.replacement.current"], 3);
  assert.equal(fact["scalepad.replacement.unknown"], 0);
  assert.equal(fact["scalepad.inventory"].length, 8);
  const inventory = fact["scalepad.inventory"].map((item) => JSON.parse(item));
  assert.equal(inventory.find((device) => device.name === "GOOD-THREE")?.lifecycleStatus, "current");
});



test("ScalePad lifecycle status is based on device age rather than forcing summary counts onto young machines", async () => {
  const { parseScalePadReport } = await loadAdapters();
  const text = `[[PAGE 1]]
Hardware Lifecycle Report
Sample Practice
August 2026
3 Hardware assets
Replacement status: 3 Overdue
0 3 0 0
Servers Workstations VMs Network
[[PAGE 2]]
Workstations User Last Check-In Make Serial Model OS Age Purchased Expires RAM CPU Storage
OLD-ONE User1 07/22/2026 Dell W1 OptiPlex 3060 Windows 11 Professional Edition 64-bit 6.5 01/01/2020 01/01/2024 8 GB Intel Core i5-8500 500 GB
OLD-TWO User2 07/22/2026 Dell W2 OptiPlex 3060 Windows 11 Professional Edition 64-bit 5.8 01/01/2021 01/01/2025 8 GB Intel Core i5-8500 500 GB
YOUNG-PC User3 07/22/2026 Dell W3 OptiPlex 7010 Windows 11 Professional Edition 64-bit 2.2 05/25/2024 05/25/2029 16 GB Intel Core i5-12500 500 GB`;
  const result = parseScalePadReport(text, "scale", "Lifecycle.pdf");
  const fact = values(result);
  const inventory = fact["scalepad.inventory"].map((item) => JSON.parse(item));
  assert.equal(fact["scalepad.totalAssets"], 3);
  assert.equal(fact["scalepad.replacement.overdue"], 2);
  assert.equal(fact["scalepad.replacement.current"], 1);
  assert.equal(inventory.find((device) => device.name === "YOUNG-PC")?.lifecycleStatus, "current");
});

test("ScalePad adapter catches CPBDR systems on later inventory pages as Cloud Plus backup servers", async () => {
  const { parseScalePadReport } = await loadAdapters();
  const text = `[[PAGE 1]]
Hardware Lifecycle Report
Sample Practice
August 2026
3 Hardware assets
Replacement status: 2 Overdue
2 1 0 0
Servers Workstations VMs Network
[[PAGE 2]]
Servers User Last Check-In Make Serial Model OS Age Purchased Expires RAM CPU Storage
PRIMARY-SERVER Administrator 08/03/2026 Dell S1 PowerEdge T440 Server 2019 Standard Edition 6.2 04/01/2020 04/01/2024 32 GB Intel Xeon E-2236 2 TB
[[PAGE 3]]
Servers User Last Check-In Make Serial Model OS Age Purchased Expires RAM CPU Storage
SITE-CPBDR-01 Administrator 08/03/2026 Dell B1 Recovery Appliance Server 2019 Standard Edition 6.1 05/01/2020 05/01/2024 32 GB Intel Xeon E-2236 4 TB
Workstations User Last Check-In Make Serial Model OS Age Purchased Expires RAM CPU Storage
FRONT-01 User1 08/03/2026 Dell W1 OptiPlex 7010 Windows 11 Professional Edition 64-bit 2.4 03/01/2024 03/01/2029 16 GB Intel Core i5-12500 500 GB`;
  const result = parseScalePadReport(text, "scale", "Lifecycle.pdf");
  const fact = values(result);
  const inventory = fact["scalepad.inventory"].map((item) => JSON.parse(item));
  const backup = inventory.find((device) => device.name === "SITE-CPBDR-01");

  assert.equal(fact["scalepad.totalAssets"], 3);
  assert.equal(fact["scalepad.servers"], 1);
  assert.equal(fact["scalepad.backupServers"], 1);
  assert.equal(fact["scalepad.workstations"], 1);
  assert.equal(fact["scalepad.replacement.overdue"], 2);
  assert.equal(fact["scalepad.replacement.current"], 1);
  assert.equal(backup?.type, "backup-server");
  assert.equal(backup?.lifecycleStatus, "overdue");
  assert.match(result.findingCandidates.map((item) => item.title).join("\n"), /Cloud Plus backup server/);
});

test("ScalePad adapter also recognizes EQUUS recovery hardware when the device name does not contain CPBDR", async () => {
  const { parseScalePadReport } = await loadAdapters();
  const text = `[[PAGE 1]]
Hardware Lifecycle Report
Sample Practice
August 2026
2 Hardware assets
Replacement status: 1 Overdue
1 1 0 0
Servers Workstations VMs Network
[[PAGE 2]]
Servers User Last Check-In Make Serial Model OS Age Purchased Expires RAM CPU Storage
RECOVERY-01 Administrator 08/03/2026 EQUUS B1 Cloud Plus Recovery Appliance Server 2019 Standard Edition 6.1 05/01/2020 05/01/2024 32 GB Intel Xeon E-2236 4 TB
Workstations User Last Check-In Make Serial Model OS Age Purchased Expires RAM CPU Storage
FRONT-01 User1 08/03/2026 Dell W1 OptiPlex 7010 Windows 11 Professional Edition 64-bit 2.4 03/01/2024 03/01/2029 16 GB Intel Core i5-12500 500 GB`;
  const result = parseScalePadReport(text, "scale", "Lifecycle.pdf");
  const fact = values(result);
  const inventory = fact["scalepad.inventory"].map((item) => JSON.parse(item));
  assert.equal(fact["scalepad.servers"], 0);
  assert.equal(fact["scalepad.backupServers"], 1);
  assert.equal(inventory.find((device) => device.name === "RECOVERY-01")?.type, "backup-server");
});

test("ScalePad adapter recovers a wrapped CPBDR appliance even when the normal server row parser cannot read it", async () => {
  const { parseScalePadReport } = await loadAdapters();
  const text = `[[PAGE 1]]
Hardware Lifecycle Report
Sample Practice
August 2026
2 Hardware assets
Replacement status: 2 Overdue
2 0 0 0
Servers Workstations VMs Network
[[PAGE 2]]
Servers User Last Check-In Make Serial Model OS Age Purchased Expires RAM CPU Storage
PRIMARY-SERVER Administrator 08/03/2026 Dell S1 PowerEdge T440 Server 2019 Standard Edition 6.2 04/01/2020 04/01/2024 32 GB Intel Xeon E-2236 2 TB
[[PAGE 3]]
Backup and recovery appliance
SITE-
CPBDR-01
Administrator 08/03/2026
EQUUS B1 Cloud Plus Recovery Appliance 6.1 05/01/2020 05/01/2024 32 GB 4 TB`;
  const result = parseScalePadReport(text, "scale", "Lifecycle.pdf");
  const fact = values(result);
  const inventory = fact["scalepad.inventory"].map((item) => JSON.parse(item));
  const backup = inventory.find((device) => device.type === "backup-server");

  assert.equal(fact["scalepad.totalAssets"], 2);
  assert.equal(fact["scalepad.servers"], 1);
  assert.equal(fact["scalepad.backupServers"], 1);
  assert.equal(backup?.name, "SITE-CPBDR-01");
  assert.equal(backup?.make, "EQUUS");
  assert.equal(backup?.age, 6.1);
  assert.equal(backup?.lifecycleStatus, "overdue");
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
  for (const phrase of ["Technology overview", "Network health", "Security protection", "Ransomware early warning", "Managed antivirus", "Hardware inventory", "HIPAA readiness", "Final recap"]) {
    assert.match(experience, new RegExp(phrase));
  }
  for (const phrase of ["Hardware inventory", "Autorun events", "Process events", "HIPAA Security Readiness", "Final recap"]) {
    assert.match(exportHtml, new RegExp(phrase));
  }
});
