import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

async function loadAdapters() {
  return transpileTestModule("../src/lib/intelligence/browser/report-adapters.ts", import.meta.url, { prefix: "report-adapters" });
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



const huntressIncidentText = `[[PAGE 1]]
Threat Report
2026-07-01 - 2026-07-31
[[PAGE 2]]
SUMMARY
During the time frame of this report, your cybersecurity platform analyzed 18,000,000 events from 116 entities on your network.
Of those events, there were 401 signals detected through automated and human analysis.
SIGNALS INVESTIGATED 10
INCIDENTS REPORTED 1
[[PAGE 7]]
INCIDENT SUMMARY
During this time frame you had 1 incidents reported
MOST TARGETED DEVICES
LEB-SURGERY-02 1
MOST COMMONLY REPORTED AV SIGNALS
Captcha-type Trojan 1
RESPONSE COMPLETED
The computer was isolated from the network. The affected file was cleaned and the malicious file was deleted.`;

test("ScalePad adapter extracts lifecycle totals and detailed inventory", async () => {
  const { parseScalePadReport } = await loadAdapters();
  const result = parseScalePadReport(scalePadText, "scale", "Lifecycle.pdf");
  const fact = values(result);
  assert.equal(fact["scalepad.totalAssets"], 16);
  assert.equal(fact["scalepad.servers"], 1);
  assert.equal(fact["scalepad.workstations"], 12);
  assert.equal(fact["scalepad.vms"], 1);
  assert.equal(fact["scalepad.networkDevices"], 2);
  assert.equal(fact["scalepad.physicalAssets"], 13);
  assert.equal(fact["scalepad.sourceReportedTotal"], 16);
  assert.equal(fact["scalepad.parsedInventoryTotal"], 5);
  assert.equal(fact["scalepad.replacement.overdue"], 9);
  assert.equal(fact["scalepad.replacement.dueSoon"], 4);
  assert.equal(fact["scalepad.replacement.unknown"], 0);
  assert.match(result.warnings.join(" "), /Inventory reconciliation needs review/i);
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
  assert.equal(fact["scalepad.totalAssets"], 8);
  assert.equal(fact["scalepad.physicalAssets"], 5);
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
  assert.equal(fact["scalepad.replacement.overdue"], 3);
  assert.equal(fact["scalepad.replacement.current"], 0);
  assert.equal(inventory.find((device) => device.name === "OLD-ONE")?.lifecycleStatus, "due-soon");
  assert.equal(inventory.find((device) => device.name === "OLD-TWO")?.lifecycleStatus, "due-soon");
  assert.equal(inventory.find((device) => device.name === "YOUNG-PC")?.lifecycleStatus, "current");
});


test("ScalePad adapter keeps physical servers when Last Check-In is blank", async () => {
  const { parseScalePadReport } = await loadAdapters();
  const text = `[[PAGE 1]]
Hardware Lifecycle Report
Midway Family Dental
August 2026
2 Hardware assets
Replacement status: 1 Overdue
2 0 0 0
Servers Workstations VMs Network
[[PAGE 2]]
Servers User Last Check-In Make Serial Model OS Age Purchased Expires RAM CPU Storage
MID-VMHOST-01 Administrator 08/04/2026 Dell 1SJ6XB4 PowerEdge T160 Server 2025 Standard Edition 1.0 08/01/2025 08/01/2030 32 GB Intel Xeon E-2434 2 TB
MID-
HYPERV-
01
Dell 8YWSCH2 PowerEdge T330 Server 2012 R2 Standard 9.5 02/01/2017 02/01/2021 32 GB Intel Xeon E5-2620 2 TB`;
  const result = parseScalePadReport(text, "scale", "Lifecycle.pdf");
  const fact = values(result);
  const inventory = fact["scalepad.inventory"].map((item) => JSON.parse(item));
  const missingCheckInServer = inventory.find((device) => device.name === "MID-HYPERV-01");

  assert.equal(fact["scalepad.servers"], 2);
  assert.equal(fact["scalepad.totalAssets"], 2);
  assert.equal(missingCheckInServer?.lastCheckIn, "");
  assert.equal(missingCheckInServer?.model, "PowerEdge T330");
  assert.equal(missingCheckInServer?.age, 9.5);
  assert.equal(missingCheckInServer?.lifecycleStatus, "overdue");
});


test("ScalePad adapter reconstructs a fragmented server row with blank check-in and only visible lifecycle columns", async () => {
  const { parseScalePadReport } = await loadAdapters();
  const text = `[[PAGE 1]]
Hardware Lifecycle Report
Midway Family Dental
August 2026
2 Hardware assets
Replacement status: 1 Overdue
2 0 0 0
Servers Workstations VMs Network
[[PAGE 2]]
Servers User Last Check-In Make Serial Model OS Age
MID-
VMHOST-
01 Administrator 08/04/2026 Dell 1SJ6XB4 PowerEdge T160 Server 2025 Standard Edition 1
MID-
HYPERV-
01 Dell 8YWSCH2 PowerEdge T330 Server 2012 R2 Standard 9.5`;
  const result = parseScalePadReport(text, "scale", "Lifecycle.pdf");
  const fact = values(result);
  const inventory = fact["scalepad.inventory"].map((item) => JSON.parse(item));
  const secondServer = inventory.find((device) => device.serial === "8YWSCH2");

  assert.equal(fact["scalepad.servers"], 2);
  assert.equal(fact["scalepad.totalAssets"], 2);
  assert.equal(secondServer?.name, "MID-HYPERV-01");
  assert.equal(secondServer?.lastCheckIn, "");
  assert.equal(secondServer?.model, "PowerEdge T330");
  assert.equal(secondServer?.os, "Server 2012 R2 Standard");
  assert.equal(secondServer?.age, 9.5);
  assert.equal(secondServer?.lifecycleStatus, "overdue");
});

test("ScalePad adapter preserves inline wrapped hostname fragments before a blank-check-in server row", async () => {
  const { parseScalePadReport } = await loadAdapters();
  const text = `[[PAGE 1]]
Hardware Lifecycle Report
Midway Family Dental
August 2026
2 Hardware assets
2 0 0 0
Servers Workstations VMs Network
[[PAGE 2]]
Servers User Last Check-In Make Serial Model OS Age
MID-VMHOST-01 Administrator 08/04/2026 Dell 1SJ6XB4 PowerEdge T160 Server 2025 Standard Edition 1
MID-
HYPERV- Dell 8YWSCH2 PowerEdge T330 Server 2012 R2 Standard 9.5
01`;
  const result = parseScalePadReport(text, "scale", "Lifecycle.pdf");
  const fact = values(result);
  const inventory = fact["scalepad.inventory"].map((item) => JSON.parse(item));
  const secondServer = inventory.find((device) => device.serial === "8YWSCH2");

  assert.equal(fact["scalepad.servers"], 2);
  assert.equal(secondServer?.name, "MID-HYPERV-01");
  assert.equal(secondServer?.lastCheckIn, "");
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
  assert.equal(backup?.lifecycleStatus, "due-soon");
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
  assert.equal(backup?.lifecycleStatus, "due-soon");
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



test("Huntress adapter captures the affected computer, threat, and completed response", async () => {
  const { parseHuntressReport } = await loadAdapters();
  const result = parseHuntressReport(huntressIncidentText, "huntress-incident", "Threat.pdf");
  const fact = values(result);
  assert.equal(fact["huntress.incidentsReported"], 1);
  assert.deepEqual(fact["huntress.incidentDevices"], ["LEB-SURGERY-02"]);
  assert.deepEqual(fact["huntress.incidentThreats"], ["Captcha-type Trojan"]);
  assert.deepEqual(fact["huntress.incidentResponseActions"], [
    "Computer isolated from the network",
    "Affected file cleaned",
    "Malicious file deleted",
  ]);
  const detail = JSON.parse(fact["huntress.incidentDetails"][0]);
  assert.equal(detail.device, "LEB-SURGERY-02");
  assert.equal(detail.threat, "Captcha-type Trojan");
  assert.equal(detail.status, "Response completed");
  assert.match(result.findingCandidates.map((item) => item.title).join("\n"), /security incident was identified/);
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

test("ScalePad adapter never prefixes fragmented column headers to a server hostname", async () => {
  const { parseScalePadReport } = await loadAdapters();
  const text = `[[PAGE 1]]
Hardware Lifecycle Report
Franklin Family Dental
August 2026
11 Hardware assets
1 Servers
10 Workstations
[[PAGE 2]]
Servers User Last
Check-In
Make Serial Model OS Age Purchased Warranty
Expiry
RAM CPU Storage
FRA-VMHOST-01
Administrator 08/03/2026 Dell FTQ2T13 PowerEdge T340 Server 2019 Standard Edition 6.5 01/23/2020 04/25/2024 34.1 GB Intel Xeon E-2134 4.0 TB
Workstations User Last
Check-In
Make Serial Model OS Age Purchased Warranty
Expiry
RAM CPU Storage
FRA-OFFICE02 OFFICE2 08/03/2026 Dell BJ0ZMD4 Pro Slim QCS1250 Windows 11 25H2 Pro Edition 64-bit 0.7 11/28/2025 11/29/2030 16.6 GB Intel Core Ultra 5 235 508.8 GB`;
  const result = parseScalePadReport(text, "scale", "Hardware Lifecycle Report.pdf");
  const fact = values(result);
  const inventory = fact["scalepad.inventory"].map((item) => JSON.parse(item));
  const server = inventory.find((device) => device.serial === "FTQ2T13");

  assert.equal(server?.name, "FRA-VMHOST-01");
  assert.equal(server?.user, "Administrator");
  assert.equal(fact["scalepad.servers"], 1);
  assert.equal(inventory.some((device) => /Check-?In|Expiry/i.test(device.name)), false);
});

test("device inventory spreadsheet adapter produces ScalePad-compatible lifecycle facts and preserves graphics", async () => {
  const { parseDeviceInventoryExport } = await loadAdapters();
  const rows = [
    {
      Organization: "Sample Dental",
      Location: "Main Office",
      "Display Name": "SERVER-01",
      "Device Role": "Windows Server",
      "Last Online": "2026-08-04T14:25:13.000-0500",
      "Warranty Start Date": "2020-01-23T00:00:00.000-0600",
      "Warranty End Date": "2024-04-24T23:59:59.000-0500",
      "Last Login": "DOMAIN\\Administrator",
      "Memory Capacity": "34060496896",
      "OS Name": "Microsoft Windows Server 2019 Standard Edition",
      "Device Make": "Dell Inc.",
      "Device Model": "PowerEdge T340",
      "BIOS Serial Number": "SERVER123",
      "Processors Name": "Intel(R) Xeon(R) E-2134 CPU @ 3.50GHz",
      Volumes: 'Name: "C:"/ Type: "Local Disk"/ Capacity: "2000000000000 (1.8 TiB)"/ Usage %: "59%"',
      "Manufacturer Fulfillment Date": "2020-01-23T00:00:00.000-0600",
      "Video Controllers": "Matrox G200eW3"
    },
    {
      Organization: "Sample Dental",
      Location: "North Office",
      "Display Name": "OPERATORY-01",
      "Device Role": "Windows Desktop",
      "Last Online": "2026-08-04T14:25:13.000-0500",
      "Warranty Start Date": "2025-07-02T00:00:00.000-0500",
      "Warranty End Date": "2030-07-02T23:59:59.000-0500",
      "Last Login": "DOMAIN\\OP1",
      "Memory Capacity": "16595546112",
      "OS Name": "Microsoft Windows 11 Pro Edition",
      "Device Make": "Dell Inc.",
      "Device Model": "Dell Pro Slim QCS1250",
      "BIOS Serial Number": "WORK123",
      "Processors Name": "Intel(R) Core(TM) Ultra 5 235",
      Volumes: 'Name: "C:"/ Type: "Local Disk"/ Capacity: "252878778368 (235.5 GiB)"/ Usage %: "91%"',
      "Manufacturer Fulfillment Date": "2025-07-02T00:00:00.000-0500",
      "Display Adapters": "Intel(R) Graphics"
    },
    {
      Organization: "Sample Dental",
      Location: "Main Office",
      "Display Name": "DC-01",
      "Device Role": "Windows Server",
      "Last Online": "2026-08-04T14:25:13.000-0500",
      "Last Login": "DOMAIN\\Administrator",
      "OS Name": "Microsoft Windows Server 2019 Standard Edition",
      "Device Make": "Microsoft Corporation",
      "Device Model": "Virtual Machine",
      "BIOS Serial Number": "VM123",
      "Processors Name": "Intel(R) Xeon(R) E-2134 CPU @ 3.50GHz",
      Volumes: 'Name: "C:"/ Type: "Local Disk"/ Capacity: "3297888956416 (3.0 TiB)"/ Usage %: "13%"'
    }
  ];
  const result = parseDeviceInventoryExport(rows, "devices", "Devices.csv");
  const fact = values(result);
  const inventory = fact["scalepad.inventory"].map((item) => JSON.parse(item));

  assert.equal(result.sourceType, "scalepad");
  assert.equal(fact["scalepad.totalAssets"], 3);
  assert.equal(fact["scalepad.physicalAssets"], 2);
  assert.equal(fact["scalepad.servers"], 1);
  assert.equal(fact["scalepad.workstations"], 1);
  assert.equal(fact["scalepad.vms"], 1);
  assert.deepEqual(fact["scalepad.locations"], ["Main Office", "North Office"]);
  assert.equal(fact["scalepad.replacement.overdue"], 1);
  assert.equal(fact["scalepad.replacement.dueSoon"], 0);
  assert.equal(fact["scalepad.replacement.current"], 1);
  assert.equal(inventory.find((device) => device.name === "OPERATORY-01")?.graphics, "Intel Graphics");
  assert.equal(inventory.find((device) => device.name === "OPERATORY-01")?.location, "North Office");
  assert.equal(inventory.find((device) => device.name === "SERVER-01")?.graphics, "Matrox G200eW3");
  assert.equal(inventory.find((device) => device.name === "SERVER-01")?.location, "Main Office");
  assert.equal(inventory.find((device) => device.name === "DC-01")?.type, "vm");
  assert.equal(inventory.find((device) => device.name === "OPERATORY-01")?.storageUsage, "C: 214.3 / 235.5 GB (91%)");
  assert.equal(inventory.find((device) => device.name === "OPERATORY-01")?.storagePercent, 91);
  assert.equal(fact["scalepad.storage.reported"], 3);
  assert.deepEqual(fact["scalepad.storage.critical"], ["OPERATORY-01"]);
  assert.deepEqual(fact["scalepad.storage.watch"], []);
  assert.match(result.findingCandidates.map((item) => item.title).join(" "), /storage-capacity attention/i);
});

test("device inventory spreadsheet adapter parses compact Disk Volume Usage values", async () => {
  const { parseDeviceInventoryExport } = await loadAdapters();
  const result = parseDeviceInventoryExport([{
    "Display Name": "LEB-SURGERY-02",
    Organization: "Midstate Oral Surgery and Implant Center",
    Location: "Lebanon",
    "Last Uptime": "2026-08-04T16:42:45.000-0500",
    "Warranty Start Date": "2026-01-13T00:00:00.000-0600",
    "OS Name": "Microsoft Windows 11 Pro Edition",
    "System Model": "Precision 3680",
    "Video Card": "Intel(R) Graphics,NVIDIA RTX A400",
    "Disk Volume Usage": "C: 174.4/252.8 GB (69.0%)",
  }], "devices", "Devices.csv");
  const fact = values(result);
  const device = JSON.parse(fact["scalepad.inventory"][0]);
  assert.equal(device.model, "Precision 3680");
  assert.equal(device.storageUsage, "C: 174.4 / 252.8 GB (69%)");
  assert.equal(device.storagePercent, 69);
  assert.equal(device.storageFreeGb, 78.4);
  assert.equal(fact["scalepad.storage.reported"], 1);
  assert.deepEqual(fact["scalepad.storage.watch"], []);
  assert.deepEqual(fact["scalepad.storage.critical"], []);
});

test("device inventory spreadsheet adapter keeps brand-new physical devices current", async () => {
  const { parseDeviceInventoryExport } = await loadAdapters();
  const result = parseDeviceInventoryExport([{
    "Display Name": "NEW-PC",
    "Device Role": "Windows Desktop",
    "Last Online": "2026-08-04T14:25:13.000-0500",
    "Manufacturer Fulfillment Date": "2026-07-25T00:00:00.000-0500",
    "Device Make": "Dell Inc.",
    "Device Model": "Dell Tower ECT1250",
    "BIOS Serial Number": "NEW123",
    "OS Name": "Microsoft Windows 11 Pro Edition"
  }], "devices", "Devices.csv");
  const fact = values(result);
  const device = JSON.parse(fact["scalepad.inventory"][0]);
  assert.equal(device.age, 0.1);
  assert.equal(device.lifecycleStatus, "current");
  assert.equal(device.graphics, "Not included in source export");
  assert.equal(fact["scalepad.replacement.current"], 1);
  assert.match(result.warnings.join(" "), /video-card or graphics-adapter column/i);
});

test("device inventory spreadsheet recognizes Device as the computer name and Hyper-V video as a virtual machine signal", async () => {
  const { parseDeviceInventoryExport } = await loadAdapters();
  const result = parseDeviceInventoryExport([{
    Device: "DIC-DATA-01",
    Organization: "Midstate Oral Surgery and Implant Center",
    Location: "Dickson Business Office",
    "Last Uptime": "2026-08-04T18:57:02.000-0500",
    "Last Uptime_formatted": "8/4/2026, 6:57 PM",
    "Video Card": "Microsoft Hyper-V Video",
    "Last Login": "DIC-DATA-01\\Administrator",
    "Memory Capacity GiB": "24",
    "OS Name": "Microsoft Windows Server 2022 Standard Edition",
    "Disk Volume Usage": "C: 29.04/119.37 GB (24%),D: 1543.80/2949.20 GB (52%)",
    "Device Model": "Virtual Machine",
  }], "devices-vm", "Devices.csv");
  const fact = values(result);
  const inventory = fact["scalepad.inventory"].map((item) => JSON.parse(item));
  const vm = inventory[0];

  assert.equal(result.sourceType, "scalepad");
  assert.equal(vm.name, "DIC-DATA-01");
  assert.equal(vm.type, "vm");
  assert.equal(vm.graphics, "Microsoft Hyper-V Video");
  assert.equal(vm.model, "Virtual Machine");
  assert.equal(vm.location, "Dickson Business Office");
  assert.equal(vm.storagePercent, 52);
  assert.equal(fact["scalepad.vms"], 1);
  assert.equal(fact["scalepad.totalAssets"], 1);
  assert.equal(fact["scalepad.physicalAssets"], 0);
  assert.equal(fact["scalepad.storage.reported"], 1);
});
