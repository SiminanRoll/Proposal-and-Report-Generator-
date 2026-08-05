import * as XLSX from "xlsx";
import mammoth from "mammoth";
import type { ExtractedFact, FileAnalysis, FindingCandidate, Confidence, IntelligenceCategory } from "@/lib/projects/types";
import { parseDeviceInventoryExport, parseHuntressReport, parseScalePadReport, type DeviceInventoryExportRow } from "./report-adapters";

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function fact(input: Omit<ExtractedFact, "id">): ExtractedFact {
  return { id: id("fact"), ...input };
}

function finding(input: Omit<FindingCandidate, "id">): FindingCandidate {
  return { id: id("candidate"), ...input };
}

function textValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function numberValue(value: unknown): number {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedSpreadsheetLabel(value: unknown): string {
  return textValue(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchingSheetName(workbook: XLSX.WorkBook, requestedName: string): string | undefined {
  const requested = normalizedSpreadsheetLabel(requestedName);
  return workbook.SheetNames.find((name) => normalizedSpreadsheetLabel(name) === requested);
}

function sheetRows(workbook: XLSX.WorkBook, name: string): unknown[][] {
  const actualName = matchingSheetName(workbook, name);
  const sheet = actualName ? workbook.Sheets[actualName] : undefined;
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false, blankrows: false });
}

function summaryMap(rows: unknown[][]): Map<string, string> {
  const result = new Map<string, string>();
  for (const row of rows) {
    const key = textValue(row[0]);
    if (key) result.set(key.toLowerCase(), textValue(row[1]));
  }
  return result;
}

function summaryNumber(map: Map<string, string>, label: string): number {
  return numberValue(map.get(label.toLowerCase()));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function confidenceFromScore(score: number): Confidence {
  if (score >= 3) return "high";
  if (score >= 1) return "medium";
  return "low";
}

function categoryForText(line: string): IntelligenceCategory {
  const value = line.toLowerCase();
  if (/security|antivirus|firewall|ransomware|threat|vulnerab|edr|mfa/.test(value)) return "security";
  if (/backup|recovery|restore|continuity/.test(value)) return "backup";
  if (/server|computer|device|warranty|age|lifecycle|replace/.test(value)) return "lifecycle";
  if (/network|switch|firewall|wifi|wireless|internet/.test(value)) return "network";
  if (/\$|monthly|one.?time|price|total|investment/.test(value)) return "pricing";
  return "operations";
}

function sheetRecords(workbook: XLSX.WorkBook, name: string, headerRow = 0): Record<string, string>[] {
  const rows = sheetRows(workbook, name);
  if (rows.length <= headerRow) return [];
  const headers = rows[headerRow].map((value) => textValue(value));
  return rows.slice(headerRow + 1).flatMap((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => { if (header) record[header] = textValue(row[index]); });
    return Object.values(record).some(Boolean) ? [record] : [];
  });
}

function recordValue(record: Record<string, string> | undefined, aliases: string[]): string {
  if (!record) return "";
  const normalized = new Map(Object.entries(record).map(([key, value]) => [normalizedSpreadsheetLabel(key), textValue(value)]));
  return aliases.map((alias) => normalized.get(normalizedSpreadsheetLabel(alias)) ?? "").find(Boolean) ?? "";
}

function recordMap(records: Record<string, string>[], aliases: string[]): Map<string, Record<string, string>> {
  const result = new Map<string, Record<string, string>>();
  for (const record of records) {
    const key = recordValue(record, aliases).toLowerCase();
    if (key) result.set(key, record);
  }
  return result;
}

function rftMakeAndModel(value: string): { make: string; model: string } {
  const clean = value.trim();
  if (!clean) return { make: "", model: "" };
  const separator = clean.indexOf("/");
  if (separator > 0) return { make: clean.slice(0, separator).trim(), model: clean.slice(separator + 1).trim() };
  return { make: "", model: clean };
}

function rftDeviceExportRows(workbook: XLSX.WorkBook): DeviceInventoryExportRow[] {
  const computers = sheetRecords(workbook, "Computers-Other");
  const detailedRows = sheetRecords(workbook, "Detailed Computer Analysis-Othe");
  const detailed = recordMap(detailedRows, ["Computer Name", "Computer", "Device"]);
  const serverAges = recordMap(sheetRecords(workbook, "Server Aging-Other"), ["Computer", "Computer Name", "Device"]);
  const workstationAges = recordMap(sheetRecords(workbook, "Workstation Aging-Other"), ["Computer", "Computer Name", "Device"]);
  const loginRows = sheetRecords(workbook, "Login Sessions");
  const logins = new Map<string, string>();
  for (const record of loginRows) {
    const computer = recordValue(record, ["Computer Name", "Computer"]).toLowerCase();
    const user = recordValue(record, ["Username", "User"]);
    const state = recordValue(record, ["Connection State", "State"]);
    if (!computer || !user || /system|anonymous|dwm-|umfd-/i.test(user)) continue;
    const domain = recordValue(record, ["Login Domain", "Domain"]);
    const label = domain ? `${domain}\\${user}` : user;
    if (!logins.has(computer) || /active/i.test(state)) logins.set(computer, label);
  }

  const drivesByComputer = new Map<string, string[]>();
  const capacitiesByComputer = new Map<string, string[]>();
  for (const record of sheetRecords(workbook, "Drive Detail")) {
    const computer = recordValue(record, ["Computer", "Computer Name", "Device"]).toLowerCase();
    const drive = recordValue(record, ["Drive", "Volume"]) || "Disk";
    const capacity = numberValue(recordValue(record, ["Capacity (GB)", "Capacity GB", "Capacity"]));
    const used = numberValue(recordValue(record, ["Used (GB)", "Used GB", "Used"]));
    const percent = numberValue(recordValue(record, ["% Used", "Percent Used", "Usage %"]));
    if (!computer || capacity <= 0) continue;
    const effectivePercent = percent > 0 ? percent : Math.max(0, Math.min(100, (used / capacity) * 100));
    const usage = `${drive.replace(/:$/, "")}: ${used.toFixed(2)} / ${capacity.toFixed(2)} GB (${effectivePercent.toFixed(1)}%)`;
    drivesByComputer.set(computer, [...(drivesByComputer.get(computer) ?? []), usage]);
    capacitiesByComputer.set(computer, [...(capacitiesByComputer.get(computer) ?? []), `${drive.replace(/:$/, "")}: ${capacity.toFixed(2)} GB`]);
  }

  const result: DeviceInventoryExportRow[] = [];
  const names = new Set<string>();
  for (const computer of computers) {
    const name = recordValue(computer, ["Computer Name", "Computer", "Device"]);
    if (!name) continue;
    const key = name.toLowerCase();
    names.add(key);
    const detail = detailed.get(key);
    const os = recordValue(computer, ["Operating System", "OS Name", "O/S"]) || recordValue(detail, ["OS Caption", "O/S", "Operating System"]);
    const ageRecord = serverAges.get(key) ?? workstationAges.get(key);
    const ageMonths = numberValue(recordValue(ageRecord, ["Age (months)", "Age Months"]));
    const makeModel = rftMakeAndModel(recordValue(detail, ["Make and Model", "Make/Model", "Model"]));
    const memoryMb = numberValue(recordValue(detail, ["RAM", "Memory"]));
    const lastLogin = logins.get(key) || recordValue(computer, ["Last Login"]) || recordValue(detail, ["Last Login"]);
    result.push({
      Device: name,
      "Device Role": /windows server/i.test(os) ? "Server" : "Workstation",
      "Device Make": makeModel.make,
      "Device Model": makeModel.model,
      "OS Name": os,
      "BIOS Serial Number": recordValue(computer, ["Service Tag", "Serial Number"]) || recordValue(detail, ["Service Tag", "Serial Number"]),
      "Last Login": /^<never>$/i.test(lastLogin) ? "" : lastLogin,
      "Memory Capacity GiB": memoryMb > 0 ? String(Math.round((memoryMb / 1024) * 100) / 100) : "",
      "Processors Name": recordValue(detail, ["CPU", "Processor"]),
      "Disk Capacity": (capacitiesByComputer.get(key) ?? []).join(","),
      "Disk Volume Usage": (drivesByComputer.get(key) ?? []).join(","),
      "Age (months)": ageMonths > 0 ? String(ageMonths) : "",
    });
  }

  // Hyper-V can reveal a virtual guest even when the guest is absent from the main computer table.
  for (const guest of sheetRecords(workbook, "Hyper-V Servers-Other", 1)) {
    const name = recordValue(guest, ["Name", "Guest Name"]);
    const os = recordValue(guest, ["Operating System", "OS"]);
    if (!name || names.has(name.toLowerCase()) || /^(server|vm|guest|virtual machine)$/i.test(name)) continue;
    names.add(name.toLowerCase());
    result.push({
      Device: name,
      "Device Role": /server/i.test(os) ? "Server" : "Workstation",
      "Device Make": "Microsoft",
      "Device Model": "Virtual Machine",
      "Video Card": "Microsoft Hyper-V Video",
      "OS Name": os,
    });
  }
  return result;
}

function parseRft(buffer: ArrayBuffer, fileId: string): FileAnalysis {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false, dense: false });
  const sheets = workbook.SheetNames;
  const requiredSignals = ["Assessment Summary", "Computers-Other", "Security and Backup-Other"];
  const signalCount = requiredSignals.filter((name) => Boolean(matchingSheetName(workbook, name))).length;
  const summary = summaryMap(sheetRows(workbook, "Assessment Summary"));
  const computerRows = sheetRows(workbook, "Computers-Other");
  const serverAgingRows = sheetRows(workbook, "Server Aging-Other").slice(1);
  const workstationAgingRows = sheetRows(workbook, "Workstation Aging-Other").slice(1);
  const securityRows = sheetRows(workbook, "Security and Backup-Other");
  const patchRows = sheetRows(workbook, "Patches (Windows Updates)").slice(1);
  const appRows = sheetRows(workbook, "Major Apps-Other-Windows").slice(1);

  const computers = computerRows.slice(1).filter((row) => textValue(row[0]));
  const servers = computers.filter((row) => /windows server/i.test(textValue(row[6])));
  const workstations = computers.filter((row) => !/windows server/i.test(textValue(row[6])));
  const cidrs = unique(computers.map((row) => textValue(row[3])));
  const operatingSystems = unique(computers.map((row) => textValue(row[6])));
  const enabledLocalAccounts = summaryNumber(summary, "# Enabled");
  const printers = summaryNumber(summary, "Printers");
  const networkShares = summaryNumber(summary, "Network Shares");
  const sqlServers = summaryNumber(summary, "MS SQL Servers");
  const installedApplications = summaryNumber(summary, "Installed Applications");

  let currentComputer = "";
  const securityByComputer = new Map<string, { firewallOff: boolean; backupNames: string[] }>();
  for (const row of securityRows.slice(2)) {
    const namedComputer = textValue(row[0]);
    if (namedComputer) currentComputer = namedComputer;
    if (!currentComputer) continue;
    const state = securityByComputer.get(currentComputer) ?? { firewallOff: false, backupNames: [] };
    const firewallName = textValue(row[7]);
    const firewallIndicator = textValue(row[8]);
    if (firewallName && (firewallIndicator === "" || /off|false|disabled|no/i.test(firewallIndicator))) state.firewallOff = true;
    const backupName = textValue(row[9]);
    if (backupName) state.backupNames.push(backupName);
    securityByComputer.set(currentComputer, state);
  }
  const firewallDisabled = [...securityByComputer.entries()].filter(([, state]) => state.firewallOff).map(([computer]) => computer);
  const noEndpointBackup = [...securityByComputer.entries()].filter(([, state]) => state.backupNames.some((name) => /^none$/i.test(name))).map(([computer]) => computer);
  const patchAffected = unique(patchRows.filter((row) => textValue(row[0])).map((row) => textValue(row[0])));
  const patchIssueCount = patchRows.filter((row) => textValue(row[0])).length;

  const clinicalKeywords = /eaglesoft|dentrix|open dental|carestream|dexis|cdr|patterson|schick|sidexis|omsvision|winoms|romexis|apteryx|curve dental|ortho2|dolphin|practiceworks|softdent/i;
  const clinicalApps = unique(appRows.filter((row) => clinicalKeywords.test(textValue(row[0]))).map((row) => textValue(row[0]))).slice(0, 20);

  const oldServers = serverAgingRows.filter((row) => textValue(row[0])).map((row) => ({ name: textValue(row[0]), os: textValue(row[1]), months: numberValue(row[3]) })).filter((server) => server.months >= 60 || /2012|2016|2019/i.test(server.os));
  const oldWorkstations = workstationAgingRows.filter((row) => textValue(row[0])).map((row) => ({ name: textValue(row[0]), os: textValue(row[1]), months: numberValue(row[3]) })).filter((workstation) => workstation.months >= 60);
  const workstationVersions = workstationAgingRows.filter((row) => textValue(row[0])).reduce<Record<string, number>>((acc, row) => { const os = textValue(row[1]); acc[os] = (acc[os] ?? 0) + 1; return acc; }, {});

  // The RFT is the proposal's primary technical source. Normalize its detailed sheets into the
  // same inventory facts used by the client report so both proposal paths inherit VM, storage,
  // operating-system support, and lifecycle behavior without requiring a separate ScalePad file.
  const normalizedInventory = parseDeviceInventoryExport(rftDeviceExportRows(workbook), fileId, "RFT hardware inventory");

  const facts: ExtractedFact[] = [
    ...normalizedInventory.facts,
    fact({ key: "environment.totalComputers", label: "Total computers", value: computers.length || summaryNumber(summary, "Total Computers"), category: "operations", confidence: "high", sourceFileId: fileId, evidence: "Computers-Other and Assessment Summary" }),
    fact({ key: "environment.workstations", label: "Workstations", value: workstations.length, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Computers-Other operating-system inventory" }),
    fact({ key: "environment.servers", label: "Servers", value: servers.length, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Computers reporting a Windows Server operating system" }),
    fact({ key: "environment.enabledLocalAccounts", label: "Enabled local accounts", value: enabledLocalAccounts, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Assessment Summary — # Enabled", requiresConfirmation: true }),
    fact({ key: "environment.printers", label: "Printers", value: printers, category: "operations", confidence: "high", sourceFileId: fileId, evidence: "Assessment Summary — Printers" }),
    fact({ key: "environment.networkShares", label: "Network shares", value: networkShares, category: "network", confidence: "high", sourceFileId: fileId, evidence: "Assessment Summary — Network Shares" }),
    fact({ key: "environment.sqlServers", label: "SQL servers", value: sqlServers, category: "operations", confidence: "high", sourceFileId: fileId, evidence: "Assessment Summary — MS SQL Servers" }),
    fact({ key: "environment.installedApplications", label: "Installed applications", value: installedApplications || appRows.length, category: "operations", confidence: "high", sourceFileId: fileId, evidence: "Assessment Summary and Major Apps" }),
    fact({ key: "network.cidrs", label: "Detected network ranges", value: cidrs, category: "network", confidence: cidrs.length ? "high" : "low", sourceFileId: fileId, evidence: "Computers-Other CIDR column" }),
    fact({ key: "environment.operatingSystems", label: "Operating systems", value: operatingSystems, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Computers-Other OS inventory" }),
    fact({ key: "applications.clinical", label: "Clinical applications", value: clinicalApps, category: "operations", confidence: clinicalApps.length ? "high" : "medium", sourceFileId: fileId, evidence: "Major Apps matched to known dental and imaging platforms" }),
    fact({ key: "security.firewallDisabled", label: "Devices with firewall reported off", value: firewallDisabled.length, category: "security", confidence: "high", sourceFileId: fileId, evidence: firewallDisabled.slice(0, 8).join(", ") }),
    fact({ key: "security.firewallDisabledDevices", label: "Computers with firewall reported off", value: firewallDisabled, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Security and Backup-Other" }),
    fact({ key: "backup.endpointMissing", label: "Devices without endpoint backup identified", value: noEndpointBackup.length, category: "backup", confidence: "medium", sourceFileId: fileId, evidence: "Security and Backup report shows None in the backup field", requiresConfirmation: true }),
    fact({ key: "backup.endpointMissingDevices", label: "Computers without endpoint backup identified", value: noEndpointBackup, category: "backup", confidence: "medium", sourceFileId: fileId, evidence: "Security and Backup-Other", requiresConfirmation: true }),
    fact({ key: "patching.affectedComputers", label: "Computers with missing or failed updates", value: patchAffected.length, category: "security", confidence: "high", sourceFileId: fileId, evidence: `${patchIssueCount} update records across ${patchAffected.length} computers` }),
    fact({ key: "patching.affectedDeviceNames", label: "Computers with missing or failed updates", value: patchAffected, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Patches (Windows Updates)" }),
    fact({ key: "lifecycle.serverReview", label: "Servers needing lifecycle review", value: oldServers.map((server) => `${server.name} — ${server.os}, ${server.months} months`), category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Server Aging-Other" }),
    fact({ key: "lifecycle.serversNeedingReplacement", label: "Servers in replacement scope", value: oldServers.length, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Server Aging-Other systems at or beyond 60 months" }),
    fact({ key: "lifecycle.workstationsNeedingReplacement", label: "Workstations in replacement scope", value: oldWorkstations.length, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Workstation Aging-Other systems at or beyond 60 months" }),
    fact({ key: "lifecycle.workstationVersions", label: "Workstation OS distribution", value: Object.entries(workstationVersions).map(([os, count]) => `${count} × ${os}`), category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Workstation Aging-Other" }),
  ];

  const findings: FindingCandidate[] = [...normalizedInventory.findingCandidates];
  if (firewallDisabled.length) findings.push(finding({ category: "security", title: "Firewall coverage needs standardization", clientSummary: `${firewallDisabled.length} computer${firewallDisabled.length === 1 ? " was" : "s were"} reported with Windows Firewall off. The proposal should include verification and standardization of endpoint firewall policy.`, severity: "priority", sourceFileId: fileId, evidence: firewallDisabled.join(", ") }));
  if (patchAffected.length) findings.push(finding({ category: "security", title: "Windows update issues need remediation", clientSummary: `${patchAffected.length} computer${patchAffected.length === 1 ? " has" : "s have"} missing or failed update records. Patch health should be standardized and monitored as part of onboarding.`, severity: "attention", sourceFileId: fileId, evidence: `${patchIssueCount} update records across ${patchAffected.join(", ")}` }));
  if (noEndpointBackup.length) findings.push(finding({ category: "backup", title: "Recovery coverage needs confirmation", clientSummary: `The assessment did not identify endpoint backup on ${noEndpointBackup.length} devices. This does not prove that centralized backup is absent, but the current recovery design and recovery-time expectations should be confirmed.`, severity: "attention", sourceFileId: fileId, evidence: "Security and Backup report lists None for endpoint backup" }));
  if (clinicalApps.length) findings.push(finding({ category: "operations", title: "Clinical application dependencies are visible", clientSummary: "The environment includes management and imaging applications that should be protected during support, upgrades, and any future transition.", severity: "healthy", sourceFileId: fileId, evidence: clinicalApps.slice(0, 8).join(", ") }));

  const totalComputers = computers.length || summaryNumber(summary, "Total Computers");
  const vmCount = normalizedInventory.facts.find((item) => item.key === "scalepad.vms")?.value;
  const virtualMachines = typeof vmCount === "number" ? vmCount : 0;
  const highlights = [
    `${totalComputers} computers discovered`,
    `${servers.length} servers and ${workstations.length} workstations`,
    ...(virtualMachines ? [`${virtualMachines} virtual machine${virtualMachines === 1 ? "" : "s"} identified`] : []),
    clinicalApps.length ? `${clinicalApps.length} clinical application families identified` : "Application inventory captured",
    `${firewallDisabled.length} firewall exceptions`,
  ];

  return {
    sourceType: "rft",
    confidence: confidenceFromScore(signalCount + (normalizedInventory.facts.length ? 1 : 0)),
    title: "RFT technical assessment",
    summary: `The RFT contains ${sheets.length} assessment sections and is the primary source for the proposal's device inventory, lifecycle, operating-system support, storage, security configuration, patching, backup, and application recommendations.`,
    facts,
    findingCandidates: findings,
    highlights,
    warnings: [
      ...normalizedInventory.warnings,
      ...(enabledLocalAccounts ? ["Enabled local accounts are not the same as billable or managed users."] : []),
      ...(noEndpointBackup.length ? ["The endpoint backup field does not confirm whether a separate server or cloud backup system exists."] : []),
      "RFT findings are a point-in-time technical assessment and are not a live security incident report.",
    ],
    rawTextPreview: `Sheets: ${sheets.join(", ")}`.slice(0, 2400),
    analyzedAt: new Date().toISOString(),
  };
}

const DEVICE_HEADER_GROUPS = [
  ["device", "displayname", "systemname", "devicename", "computername", "hostname", "name"],
  ["devicerole", "role", "devicetype", "type"],
  ["devicemake", "manufacturer", "make"],
  ["devicemodel", "model"],
  ["osname", "operatingsystem", "os"],
  ["biosserialnumber", "serialnumber", "serial"],
  ["lastonline", "lastupdate", "lastcheckin", "lastuptime", "lastuptimeformatted"],
  ["manufacturerfulfillmentdate", "warrantystartdate", "purchased"],
] as const;

function delimitedRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { value += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else value += character;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === delimiter) { row.push(value); value = ""; }
    else if (character === '\n') { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
    else value += character;
  }
  if (value.length || row.length) { row.push(value.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((candidate) => candidate.some((cell) => cell.trim()));
}

function delimitedScore(rows: string[][]): number {
  const counts = rows.slice(0, 30).map((row) => row.length).filter((count) => count > 1);
  if (!counts.length) return 0;
  const frequencies = new Map<number, number>();
  for (const count of counts) frequencies.set(count, (frequencies.get(count) ?? 0) + 1);
  const [columns, occurrences] = [...frequencies.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
  return occurrences * 100 + columns;
}

function csvRows(text: string): string[][] {
  const candidates = [",", "\t", ";"].map((delimiter) => {
    const rows = delimitedRows(text, delimiter);
    return { rows, score: delimitedScore(rows) };
  });
  return candidates.sort((a, b) => b.score - a.score)[0].rows;
}

function decodeDelimitedText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2)).replace(/^\uFEFF/, "");
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2)).replace(/^\uFEFF/, "");
  const sample = bytes.subarray(0, Math.min(bytes.length, 512));
  const evenNulls = sample.filter((value, index) => index % 2 === 0 && value === 0).length;
  const oddNulls = sample.filter((value, index) => index % 2 === 1 && value === 0).length;
  if (oddNulls > sample.length / 8 && oddNulls > evenNulls * 2) return new TextDecoder("utf-16le").decode(bytes).replace(/^\uFEFF/, "");
  if (evenNulls > sample.length / 8 && evenNulls > oddNulls * 2) return new TextDecoder("utf-16be").decode(bytes).replace(/^\uFEFF/, "");
  return new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
}

function deviceHeaderScore(row: unknown[]): number {
  const labels = new Set(row.map(normalizedSpreadsheetLabel).filter(Boolean));
  if (!DEVICE_HEADER_GROUPS[0].some((header) => labels.has(header))) return 0;
  return 5 + DEVICE_HEADER_GROUPS.slice(1).filter((group) => group.some((header) => labels.has(header))).length;
}

function deviceHeaderMatch(rows: unknown[][]): { index: number; score: number } | null {
  const candidates = rows.slice(0, 60).map((row, index) => ({ index, score: deviceHeaderScore(row) }));
  const best = candidates.sort((a, b) => b.score - a.score || a.index - b.index)[0];
  return best && best.score >= 8 ? best : null;
}

function deviceInventoryRecordsFromRows(rows: unknown[][]): DeviceInventoryExportRow[] {
  const match = deviceHeaderMatch(rows);
  if (!match) return [];
  const headers = rows[match.index].map((value) => textValue(value).replace(/^\uFEFF/, ""));
  return rows.slice(match.index + 1).flatMap((row) => {
    const record: DeviceInventoryExportRow = {};
    headers.forEach((header, index) => { if (header) record[header] = textValue(row[index]); });
    const name = DEVICE_HEADER_GROUPS[0].map((header) => Object.entries(record).find(([key]) => normalizedSpreadsheetLabel(key) === header)?.[1]).find(Boolean);
    return name ? [record] : [];
  });
}

function workbookRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName];
  return sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false, blankrows: false }) : [];
}

function deviceInventoryWorkbookMatch(workbook: XLSX.WorkBook): { sheetName: string; records: DeviceInventoryExportRow[]; score: number } | null {
  const candidates = workbook.SheetNames.map((sheetName) => {
    const rows = workbookRows(workbook, sheetName);
    const header = deviceHeaderMatch(rows);
    const records = header ? deviceInventoryRecordsFromRows(rows) : [];
    return { sheetName, records, score: (header?.score ?? 0) * 1000 + records.length };
  }).filter((candidate) => candidate.records.length > 0);
  return candidates.sort((a, b) => b.score - a.score)[0] ?? null;
}

function rftWorkbookSignalCount(workbook: XLSX.WorkBook): number {
  return ["Assessment Summary", "Computers-Other", "Security and Backup-Other"]
    .filter((name) => Boolean(matchingSheetName(workbook, name))).length;
}

function unrecognizedSpreadsheet(fileId: string, fileName: string, details: string): FileAnalysis {
  return {
    sourceType: "unknown",
    confidence: "low",
    title: fileName,
    summary: "The spreadsheet opened, but its device-inventory or RFT structure was not recognized.",
    facts: [],
    findingCandidates: [],
    highlights: ["Spreadsheet opened successfully"],
    warnings: ["No supported device header row or RFT worksheet set was found. Export the device list with Device (computer name), Device Model, OS, and date columns, or attach the original RFT workbook."],
    rawTextPreview: details.slice(0, 5000),
    analyzedAt: new Date().toISOString(),
  };
}

function parseDeviceInventoryCsv(text: string, fileId: string, fileName: string): FileAnalysis {
  const rows = csvRows(text);
  const records = deviceInventoryRecordsFromRows(rows);
  return records.length
    ? parseDeviceInventoryExport(records, fileId, fileName)
    : unrecognizedSpreadsheet(fileId, fileName, `Delimited rows: ${rows.length}\nFirst rows:\n${rows.slice(0, 8).map((row) => row.join(" | ")).join("\n")}`);
}

function parseSpreadsheetWorkbook(buffer: ArrayBuffer, fileId: string, fileName: string, expectedKind: string): FileAnalysis {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false, dense: false });
  const deviceMatch = deviceInventoryWorkbookMatch(workbook);
  const rftSignals = rftWorkbookSignalCount(workbook);

  if (expectedKind === "rft-spreadsheet" && rftSignals > 0) return parseRft(buffer, fileId);
  if (deviceMatch) return parseDeviceInventoryExport(deviceMatch.records, fileId, fileName);
  if (rftSignals >= 2) return parseRft(buffer, fileId);

  return unrecognizedSpreadsheet(fileId, fileName, `Worksheets: ${workbook.SheetNames.join(", ")}`);
}

function looksLikeWorkbookBinary(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  return (bytes[0] === 0x50 && bytes[1] === 0x4b)
    || (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0);
}

function linesFromText(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function classifyPdf(text: string, expectedKind: string): { type: FileAnalysis["sourceType"]; score: number } {
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {
    scalepad: ["scalepad", "lifecycle manager", "warranty", "asset", "hardware lifecycle"].filter((term) => lower.includes(term)).length,
    huntress: ["huntress", "ransomware canary", "persistent foothold", "managed edr", "threat report"].filter((term) => lower.includes(term)).length,
    legacy: ["proposal", "quote", "monthly", "one-time", "signature", "advantage 360"].filter((term) => lower.includes(term)).length,
  };
  if (expectedKind === "scalepad-pdf") scores.scalepad += 2;
  if (expectedKind === "huntress-pdf") scores.huntress += 2;
  if (expectedKind === "legacy-proposal") scores.legacy += 2;
  const ordered = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [winner, score] = ordered[0];
  if (score <= 1) return { type: "generic-pdf", score };
  if (winner === "scalepad") return { type: "scalepad", score };
  if (winner === "huntress") return { type: "huntress", score };
  return { type: "legacy-proposal", score };
}

function extractMoneyFacts(lines: string[], fileId: string): ExtractedFact[] {
  const money = /\$\s?([0-9][0-9,]*(?:\.\d{2})?)/g;
  const matches: Array<{ line: string; amount: number; category: "monthly" | "one-time" | "unknown" }> = [];
  for (const line of lines) {
    for (const match of line.matchAll(money)) {
      const lower = line.toLowerCase();
      const category = /month|monthly|\/mo|recurring/.test(lower) ? "monthly" : /one.?time|setup|installation|project/.test(lower) ? "one-time" : "unknown";
      matches.push({ line, amount: numberValue(match[1]), category });
    }
  }
  const monthly = matches.filter((item) => item.category === "monthly");
  const oneTime = matches.filter((item) => item.category === "one-time");
  const facts: ExtractedFact[] = [];
  if (monthly.length) facts.push(fact({ key: "pricing.monthlyCandidates", label: "Monthly price candidates", value: monthly.slice(0, 12).map((item) => `${item.line}`), category: "pricing", confidence: "medium", sourceFileId: fileId, evidence: "Lines containing monthly language and currency", requiresConfirmation: true }));
  if (oneTime.length) facts.push(fact({ key: "pricing.oneTimeCandidates", label: "One-time price candidates", value: oneTime.slice(0, 12).map((item) => `${item.line}`), category: "pricing", confidence: "medium", sourceFileId: fileId, evidence: "Lines containing one-time or installation language and currency", requiresConfirmation: true }));
  if (matches.length) facts.push(fact({ key: "pricing.currencyLines", label: "Pricing lines extracted", value: matches.length, category: "pricing", confidence: "high", sourceFileId: fileId, evidence: "Currency-formatted values in proposal text" }));
  return facts;
}

function analyzeText(text: string, fileId: string, expectedKind: string, fileName: string): FileAnalysis {
  const lines = linesFromText(text);
  const lower = text.toLowerCase();
  const classification = expectedKind === "tc-discovery" || expectedKind === "supporting-notes"
    ? { type: "tc-notes" as const, score: 3 }
    : classifyPdf(text, expectedKind);
  const sourceType = classification.type;
  const facts: ExtractedFact[] = [];
  const findings: FindingCandidate[] = [];
  const highlights: string[] = [];
  const warnings: string[] = [];

  const emailMatches = unique(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []);
  if (emailMatches.length) facts.push(fact({ key: "client.emailCandidates", label: "Email candidates", value: emailMatches.slice(0, 8), category: "client", confidence: "medium", sourceFileId: fileId, evidence: "Email addresses found in source text", requiresConfirmation: true }));

  if (sourceType === "legacy-proposal") {
    facts.push(...extractMoneyFacts(lines, fileId));
    const quantityLines = lines.filter((line) => /\bqty\b|\bquantity\b|\bsku\b/i.test(line)).slice(0, 20);
    if (quantityLines.length) facts.push(fact({ key: "proposal.itemCandidates", label: "Service and SKU lines", value: quantityLines, category: "pricing", confidence: "medium", sourceFileId: fileId, evidence: "Lines containing quantity or SKU labels", requiresConfirmation: true }));
    highlights.push(`${lines.length} text lines extracted`, `${facts.filter((item) => item.category === "pricing").length} pricing groups identified`);
    warnings.push("Legacy proposal pricing is intentionally flagged for confirmation before publication.");
  } else if (sourceType === "scalepad") {
    return parseScalePadReport(text, fileId, fileName);
  } else if (sourceType === "huntress") {
    return parseHuntressReport(text, fileId, fileName);
  } else if (sourceType === "tc-notes") {
    const painLines = lines.filter((line) => /problem|issue|frustrat|concern|slow|down|fail|pain|worried|need|want|replace|support/i.test(line)).slice(0, 20);
    const dependencyLines = lines.filter((line) => /eaglesoft|dentrix|imaging|server|cbct|carestream|dexis|omsvision|vpn|remote|backup/i.test(line)).slice(0, 20);
    if (painLines.length) facts.push(fact({ key: "discovery.painPointCandidates", label: "Pain-point candidates", value: painLines, category: "operations", confidence: "medium", sourceFileId: fileId, evidence: "Problem and concern language from onsite notes", requiresConfirmation: true }));
    if (dependencyLines.length) facts.push(fact({ key: "discovery.dependencies", label: "Operational dependencies", value: dependencyLines, category: "operations", confidence: "medium", sourceFileId: fileId, evidence: "Application, server, imaging, and recovery references" }));
    highlights.push(`${painLines.length} pain-point candidates`, `${dependencyLines.length} dependency references`);
  } else {
    const categoryCounts = lines.reduce<Record<string, number>>((acc, line) => {
      const category = categoryForText(line);
      acc[category] = (acc[category] ?? 0) + 1;
      return acc;
    }, {});
    facts.push(fact({ key: `document.${fileId}.lineCategories`, label: "Document themes", value: Object.entries(categoryCounts).map(([key, value]) => `${key}: ${value}`), category: "operations", confidence: "low", sourceFileId: fileId, evidence: "Keyword grouping from extracted text", requiresConfirmation: true }));
    warnings.push("Document was readable but did not match a supported source template with high confidence.");
    highlights.push(`${lines.length} text lines extracted`);
  }

  if (/firewall.{0,30}(off|disabled)|(?:off|disabled).{0,30}firewall/i.test(lower)) {
    findings.push(finding({ category: "security", title: "Firewall status needs review", clientSummary: "The source material includes language indicating that one or more firewall controls may be disabled or inconsistent.", severity: "priority", sourceFileId: fileId, evidence: "Firewall-disabled language in source document" }));
  }
  if (/no backup|backup.{0,30}(failed|missing|not protected)/i.test(lower)) {
    findings.push(finding({ category: "backup", title: "Backup coverage needs review", clientSummary: "The source material includes a possible backup gap or failed protection condition that should be confirmed before recommendations are finalized.", severity: "priority", sourceFileId: fileId, evidence: "Backup-gap language in source document" }));
  }

  const confidence = confidenceFromScore(classification.score);
  return {
    sourceType,
    confidence,
    title: sourceType === "tc-notes" ? "Onsite discovery notes" : fileName,
    summary: `${lines.length} readable lines were extracted and classified as ${sourceType.replaceAll("-", " ")}.`,
    facts,
    findingCandidates: findings,
    highlights: highlights.length ? highlights : [`${lines.length} readable lines extracted`],
    warnings,
    rawTextPreview: lines.slice(0, 45).join("\n").slice(0, 5000),
    analyzedAt: new Date().toISOString(),
  };
}


interface PositionedPdfTextItem {
  str?: string;
  transform?: number[];
}

function pdfPageLines(items: unknown[]): string[] {
  const positioned = items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as PositionedPdfTextItem;
    if (!candidate.str?.trim() || !Array.isArray(candidate.transform)) return [];
    return [{ text: candidate.str.trim(), x: Number(candidate.transform[4] ?? 0), y: Number(candidate.transform[5] ?? 0) }];
  });
  const rows: Array<{ y: number; items: Array<{ text: string; x: number }> }> = [];
  for (const item of positioned.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 4.25);
    if (row) row.items.push({ text: item.text, x: item.x });
    else rows.push({ y: item.y, items: [{ text: item.text, x: item.x }] });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => row.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("/pdf.worker.min.mjs", window.location.origin).toString();
  }
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const document = await loadingTask.promise;
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(`[[PAGE ${pageNumber}]]\n${pdfPageLines(content.items).join("\n")}`);
    }
  } finally {
    await document.destroy();
  }
  return pages.join("\n");
}

export async function analyzeFile(input: {
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
  expectedKind: string;
  fileId: string;
}): Promise<FileAnalysis> {
  const extension = input.fileName.toLowerCase().split(".").pop() ?? "";
  const mimeType = input.mimeType.toLowerCase();
  const delimitedSpreadsheet = ["csv", "tsv"].includes(extension) || /(?:csv|tab-separated-values)/.test(mimeType);
  const binarySpreadsheet = ["xlsx", "xls", "xlsm", "xlsb"].includes(extension)
    || /spreadsheetml|ms-excel/.test(mimeType);

  if (delimitedSpreadsheet) {
    return parseDeviceInventoryCsv(decodeDelimitedText(input.buffer), input.fileId, input.fileName);
  }
  if (binarySpreadsheet) {
    if (!looksLikeWorkbookBinary(input.buffer) && /ms-excel/.test(mimeType)) {
      return parseDeviceInventoryCsv(decodeDelimitedText(input.buffer), input.fileId, input.fileName);
    }
    try {
      return parseSpreadsheetWorkbook(input.buffer, input.fileId, input.fileName, input.expectedKind);
    } catch (error) {
      return unrecognizedSpreadsheet(input.fileId, input.fileName, error instanceof Error ? error.message : "Spreadsheet parser failed.");
    }
  }
  if (["jpg", "jpeg", "png", "webp"].includes(extension) || input.mimeType.startsWith("image/")) {
    return {
      sourceType: "office-photo",
      confidence: "high",
      title: input.fileName,
      summary: "Office photo attached as visual evidence. Image interpretation is intentionally deferred until the visual-review phase.",
      facts: [fact({ key: `photo.${input.fileId}.metadata`, label: "Office photo", value: `${Math.max(1, Math.round(input.buffer.byteLength / 1024))} KB`, category: "operations", confidence: "high", sourceFileId: input.fileId, evidence: input.fileName })],
      findingCandidates: [],
      highlights: ["Visual evidence attached"],
      warnings: [],
      rawTextPreview: "",
      analyzedAt: new Date().toISOString(),
    };
  }

  let text = "";
  if (extension === "pdf" || input.mimeType === "application/pdf") {
    text = await extractPdfText(input.buffer);
  } else if (extension === "docx" || /wordprocessingml/.test(input.mimeType)) {
    const result = await mammoth.extractRawText({ arrayBuffer: input.buffer });
    text = result.value;
  } else if (extension === "txt" || input.mimeType.startsWith("text/")) {
    text = new TextDecoder("utf-8").decode(input.buffer);
  }

  if (!text.trim()) {
    return {
      sourceType: "unknown",
      confidence: "low",
      title: input.fileName,
      summary: "The file was received, but no readable text could be extracted.",
      facts: [],
      findingCandidates: [],
      highlights: ["File attached"],
      warnings: ["This source needs manual review or a text-searchable copy."],
      rawTextPreview: "",
      analyzedAt: new Date().toISOString(),
    };
  }
  return analyzeText(text, input.fileId, input.expectedKind, input.fileName);
}
