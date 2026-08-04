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
