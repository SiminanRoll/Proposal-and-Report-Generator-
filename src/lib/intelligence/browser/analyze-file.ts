import * as XLSX from "xlsx";
import mammoth from "mammoth";
import type { ExtractedFact, FileAnalysis, FindingCandidate, Confidence, IntelligenceCategory } from "@/lib/projects/types";
import { parseHuntressReport, parseScalePadReport } from "./report-adapters";

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

function sheetRows(workbook: XLSX.WorkBook, name: string): unknown[][] {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
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

function parseRft(buffer: ArrayBuffer, fileId: string): FileAnalysis {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false, dense: false });
  const sheets = workbook.SheetNames;
  const requiredSignals = ["Assessment Summary", "Computers-Other", "Security and Backup-Other"];
  const signalCount = requiredSignals.filter((name) => sheets.includes(name)).length;
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
    if (firewallName && firewallIndicator === "") state.firewallOff = true;

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

  const oldServers = serverAgingRows
    .filter((row) => textValue(row[0]))
    .map((row) => ({ name: textValue(row[0]), os: textValue(row[1]), months: numberValue(row[3]) }))
    .filter((server) => server.months >= 60 || /2012|2016|2019/i.test(server.os));
  const oldWorkstations = workstationAgingRows
    .filter((row) => textValue(row[0]))
    .map((row) => ({ name: textValue(row[0]), os: textValue(row[1]), months: numberValue(row[3]) }))
    .filter((workstation) => workstation.months >= 60);
  const workstationVersions = workstationAgingRows
    .filter((row) => textValue(row[0]))
    .reduce<Record<string, number>>((acc, row) => {
      const os = textValue(row[1]);
      acc[os] = (acc[os] ?? 0) + 1;
      return acc;
    }, {});

  const facts: ExtractedFact[] = [
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
    fact({ key: "backup.endpointMissing", label: "Devices without endpoint backup identified", value: noEndpointBackup.length, category: "backup", confidence: "medium", sourceFileId: fileId, evidence: "Security and Backup report shows None in the backup field", requiresConfirmation: true }),
    fact({ key: "patching.affectedComputers", label: "Computers with missing or failed updates", value: patchAffected.length, category: "security", confidence: "high", sourceFileId: fileId, evidence: `${patchIssueCount} update records across ${patchAffected.length} computers` }),
    fact({ key: "lifecycle.serverReview", label: "Servers needing lifecycle review", value: oldServers.map((server) => `${server.name} — ${server.os}, ${server.months} months`), category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Server Aging-Other" }),
    fact({ key: "lifecycle.serversNeedingReplacement", label: "Servers in replacement scope", value: oldServers.length, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Server Aging-Other systems at or beyond 60 months" }),
    fact({ key: "lifecycle.workstationsNeedingReplacement", label: "Workstations in replacement scope", value: oldWorkstations.length, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Workstation Aging-Other systems at or beyond 60 months" }),
    fact({ key: "lifecycle.workstationVersions", label: "Workstation OS distribution", value: Object.entries(workstationVersions).map(([os, count]) => `${count} × ${os}`), category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Workstation Aging-Other" }),
  ];

  const findings: FindingCandidate[] = [];
  if (firewallDisabled.length) {
    findings.push(finding({ category: "security", title: "Firewall protection needs verification", clientSummary: `${firewallDisabled.length} devices reported Windows Firewall as turned off. This should be verified and standardized so every computer has a consistent protective layer.`, severity: "priority", sourceFileId: fileId, evidence: firewallDisabled.slice(0, 10).join(", ") }));
  }
  if (patchAffected.length) {
    findings.push(finding({ category: "security", title: "Updates are not consistently completing", clientSummary: `${patchAffected.length} computers show missing or failed update activity. A managed patching process helps close preventable gaps without relying on staff to notice them.`, severity: "attention", sourceFileId: fileId, evidence: `${patchIssueCount} update records` }));
  }
  if (oldServers.length) {
    findings.push(finding({ category: "lifecycle", title: "Server lifecycle planning should begin now", clientSummary: `${oldServers.length} server${oldServers.length === 1 ? "" : "s"} should be reviewed for age, operating-system version, and replacement timing before reliability or compatibility forces a rushed decision.`, severity: "priority", sourceFileId: fileId, evidence: oldServers.map((server) => `${server.name}: ${server.os}, ${server.months} months`).join("; ") }));
  }
  if (noEndpointBackup.length) {
    findings.push(finding({ category: "backup", title: "Recovery coverage needs confirmation", clientSummary: `The assessment did not identify endpoint backup on ${noEndpointBackup.length} devices. This does not prove that centralized backup is absent, but the current recovery design and recovery-time expectations should be confirmed.`, severity: "attention", sourceFileId: fileId, evidence: "Security and Backup report lists None for endpoint backup" }));
  }
  if (clinicalApps.length) {
    findings.push(finding({ category: "operations", title: "Clinical application dependencies are visible", clientSummary: `The environment includes practice and imaging applications that should be protected during support, upgrades, and any future transition.`, severity: "healthy", sourceFileId: fileId, evidence: clinicalApps.slice(0, 8).join(", ") }));
  }

  const highlights = [
    `${computers.length || summaryNumber(summary, "Total Computers")} computers discovered`,
    `${servers.length} servers and ${workstations.length} workstations`,
    clinicalApps.length ? `${clinicalApps.length} clinical application families identified` : "Application inventory captured",
    `${firewallDisabled.length} firewall exceptions`,
  ];

  return {
    sourceType: "rft",
    confidence: confidenceFromScore(signalCount),
    title: "RFT technical assessment",
    summary: `The workbook contains ${sheets.length} assessment sections and produced a structured inventory of devices, operating systems, applications, security controls, patching, and lifecycle indicators.`,
    facts,
    findingCandidates: findings,
    highlights,
    warnings: [
      ...(enabledLocalAccounts ? ["Enabled local accounts are not the same as billable or managed users."] : []),
      ...(noEndpointBackup.length ? ["The endpoint backup field does not confirm whether a separate server or cloud backup system exists."] : []),
    ],
    rawTextPreview: `Sheets: ${sheets.join(", ")}`.slice(0, 2400),
    analyzedAt: new Date().toISOString(),
  };
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
  if (["xlsx", "xls"].includes(extension)) return parseRft(input.buffer, input.fileId);
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
