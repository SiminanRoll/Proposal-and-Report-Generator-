import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadRuntimeDependencies() {
  try {
    const [typescript, xlsx] = await Promise.all([import("typescript"), import("xlsx")]);
    return { ts: typescript.default, XLSX: xlsx.default ?? xlsx };
  } catch {
    try {
      const typescript = await import("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js");
      const xlsx = await import("xlsx");
      return { ts: typescript.default, XLSX: xlsx.default ?? xlsx };
    } catch {
      return null;
    }
  }
}

async function loadAnalyzer() {
  const dependencies = await loadRuntimeDependencies();
  if (!dependencies) return null;
  const { ts, XLSX } = dependencies;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "spreadsheet-analyzer-"));
  const compilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    verbatimModuleSyntax: true,
  };

  const adaptersSource = fs.readFileSync(new URL("../src/lib/intelligence/browser/report-adapters.ts", import.meta.url), "utf8");
  const adaptersOutput = ts.transpileModule(adaptersSource, { compilerOptions }).outputText;
  const adaptersPath = path.join(directory, "report-adapters.mjs");
  fs.writeFileSync(adaptersPath, adaptersOutput);

  const analyzerSource = fs.readFileSync(new URL("../src/lib/intelligence/browser/analyze-file.ts", import.meta.url), "utf8");
  const analyzerOutput = ts.transpileModule(analyzerSource, { compilerOptions }).outputText
    .replace('from "xlsx"', `from ${JSON.stringify(import.meta.resolve("xlsx"))}`)
    .replace('from "mammoth"', `from ${JSON.stringify(import.meta.resolve("mammoth"))}`)
    .replace('from "./report-adapters"', `from ${JSON.stringify(pathToFileURL(adaptersPath).href)}`);
  const analyzerPath = path.join(directory, "analyze-file.mjs");
  fs.writeFileSync(analyzerPath, analyzerOutput);

  const analyzer = await import(`${pathToFileURL(analyzerPath).href}?v=${Date.now()}`);
  return { analyzer, XLSX };
}

function exactArrayBuffer(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function values(analysis) {
  return Object.fromEntries(analysis.facts.map((item) => [item.key, item.value]));
}

const headers = [
  "Organization",
  "Location",
  "Display Name",
  "Device Role",
  "Last Online",
  "Manufacturer Fulfillment Date",
  "Device Make",
  "Device Model",
  "BIOS Serial Number",
  "OS Name",
];

const device = [
  "Sample Practice",
  "Main Office",
  "FRONT-01",
  "Windows Desktop",
  "2026-08-04T14:25:13.000-0500",
  "2025-07-02T00:00:00.000-0500",
  "Dell Inc.",
  "OptiPlex 7010",
  "ABC123",
  "Microsoft Windows 11 Pro Edition",
];

test("device spreadsheet detection searches every worksheet and scans past title rows", async (context) => {
  const runtime = await loadAnalyzer();
  if (!runtime) return context.skip("Runtime spreadsheet dependencies are not installed in this checkout.");
  const { analyzer, XLSX } = runtime;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Device Inventory Export"], ["Generated for review"]]), "Overview");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Hardware details"], [], ["Generated", "August 4, 2026"], [], headers, device]), "Device Details");
  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const analysis = await analyzer.analyzeFile({
    buffer: exactArrayBuffer(bytes),
    fileName: "Devices.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    expectedKind: "scalepad-pdf",
    fileId: "devices",
  });

  assert.equal(analysis.sourceType, "scalepad");
  assert.equal(analysis.confidence, "high");
  assert.equal(values(analysis)["scalepad.totalAssets"], 1);
  assert.match(values(analysis)["scalepad.inventory"][0], /FRONT-01/);
});

test("device export detection supports UTF-16 tab-delimited files mislabeled as CSV", async (context) => {
  const runtime = await loadAnalyzer();
  if (!runtime) return context.skip("Runtime spreadsheet dependencies are not installed in this checkout.");
  const { analyzer } = runtime;
  const text = [["Device Inventory Export"], [], headers, device].map((row) => row.join("\t")).join("\r\n");
  const encoded = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);

  const analysis = await analyzer.analyzeFile({
    buffer: exactArrayBuffer(encoded),
    fileName: "Devices.csv",
    mimeType: "application/vnd.ms-excel",
    expectedKind: "scalepad-pdf",
    fileId: "devices",
  });

  assert.equal(analysis.sourceType, "scalepad");
  assert.equal(values(analysis)["scalepad.totalAssets"], 1);
});

test("device export detection recognizes Last Uptime headers without role or make/model columns", async (context) => {
  const runtime = await loadAnalyzer();
  if (!runtime) return context.skip("Runtime spreadsheet dependencies are not installed in this checkout.");
  const { analyzer } = runtime;
  const leanHeaders = [
    "Display Name",
    "Organization",
    "Location",
    "Last Uptime",
    "Last Uptime_formatted",
    "Video Card",
    "Warranty Start Date",
    "Warranty Start Date_formatted",
    "Warranty End Date",
    "Warranty End Date_formatted",
    "Last Login",
    "Memory Capacity GiB",
    "OS Name",
    "Disk Volume Usage",
  ];
  const leanDevice = [
    "LEB-SURGERY-02",
    "Midstate Oral Surgery and Implant Center",
    "Lebanon",
    "2026-08-04T16:42:45.000-0500",
    "8/4/2026, 4:42 PM",
    "Intel(R) Graphics,NVIDIA RTX A400",
    "2026-01-13T00:00:00.000-0600",
    "1/13/2026, 12:00 AM",
    "2031-01-13T23:59:59.000-0600",
    "1/13/2031, 11:59 PM",
    "MSOS\\lsur2",
    "15.46",
    "Microsoft Windows 11 Pro Edition",
    "C: 174.4/252.8 GB (69.0%)",
  ];
  const text = [leanHeaders, leanDevice].map((row) => row.map((value) => JSON.stringify(value)).join(",")).join("\r\n");

  const analysis = await analyzer.analyzeFile({
    buffer: exactArrayBuffer(Buffer.from(text, "utf8")),
    fileName: "Devices (8).csv",
    mimeType: "text/csv",
    expectedKind: "scalepad-pdf",
    fileId: "devices-lean",
  });

  assert.equal(analysis.sourceType, "scalepad");
  assert.equal(analysis.confidence, "high");
  assert.equal(values(analysis)["scalepad.totalAssets"], 1);
  assert.equal(values(analysis)["scalepad.workstations"], 1);
  assert.deepEqual(values(analysis)["scalepad.locations"], ["Lebanon"]);
  assert.match(values(analysis)["scalepad.inventory"][0], /LEB-SURGERY-02/);
  assert.match(values(analysis)["scalepad.inventory"][0], /NVIDIA RTX A400/);
  assert.match(values(analysis)["scalepad.inventory"][0], /08\/04\/2026/);
  assert.match(values(analysis)["scalepad.inventory"][0], /C: 174\.4 \/ 252\.8 GB \(69%\)/);
  assert.equal(values(analysis)["scalepad.storage.reported"], 1);
});

test("unrecognized spreadsheets explain the missing structure instead of silently returning empty inventory", async (context) => {
  const runtime = await loadAnalyzer();
  if (!runtime) return context.skip("Runtime spreadsheet dependencies are not installed in this checkout.");
  const { analyzer, XLSX } = runtime;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Notes"], ["No device columns here"]]), "Sheet1");
  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const analysis = await analyzer.analyzeFile({
    buffer: exactArrayBuffer(bytes),
    fileName: "Unknown.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    expectedKind: "scalepad-pdf",
    fileId: "unknown",
  });

  assert.equal(analysis.sourceType, "unknown");
  assert.equal(analysis.confidence, "low");
  assert.match(analysis.warnings.join(" "), /No supported device header row or RFT worksheet set/i);
});

test("device export detection accepts the exact Device header and preserves virtual-machine rows", async (context) => {
  const runtime = await loadAnalyzer();
  if (!runtime) return context.skip("Runtime spreadsheet dependencies are not installed in this checkout.");
  const { analyzer } = runtime;
  const vmHeaders = [
    "Device", "Organization", "Location", "Last Uptime", "Last Uptime_formatted", "Video Card",
    "Warranty Start Date", "Warranty Start Date_formatted", "Warranty End Date", "Warranty End Date_formatted",
    "Last Login", "Memory Capacity GiB", "OS Name", "Disk Volume Usage", "Device Model",
  ];
  const vmRow = [
    "DIC-DATA-01", "Midstate Oral Surgery and Implant Center", "Dickson Business Office",
    "2026-08-04T18:57:02.000-0500", "8/4/2026, 6:57 PM", "Microsoft Hyper-V Video",
    "", "", "", "", "DIC-DATA-01\\Administrator", "24",
    "Microsoft Windows Server 2022 Standard Edition",
    "C: 29.04/119.37 GB (24%),D: 1543.80/2949.20 GB (52%)", "Virtual Machine",
  ];
  const text = [vmHeaders, vmRow].map((row) => row.map((value) => JSON.stringify(value)).join(",")).join("\r\n");
  const analysis = await analyzer.analyzeFile({
    buffer: exactArrayBuffer(Buffer.from(text, "utf8")),
    fileName: "Devices.csv",
    mimeType: "text/csv",
    expectedKind: "scalepad-pdf",
    fileId: "devices-vm",
  });
  const facts = values(analysis);
  assert.equal(analysis.sourceType, "scalepad");
  assert.equal(facts["scalepad.vms"], 1);
  assert.match(facts["scalepad.inventory"][0], /DIC-DATA-01/);
  assert.match(facts["scalepad.inventory"][0], /Microsoft Hyper-V Video/);
  assert.match(facts["scalepad.inventory"][0], /"type":"vm"/);
});
