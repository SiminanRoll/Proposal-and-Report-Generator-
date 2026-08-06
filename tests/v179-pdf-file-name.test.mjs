import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const exportHtml = readFileSync("src/lib/outcomes/export-html.ts", "utf8");
const fillablePdf = readFileSync("src/lib/outcomes/fillable-pdf.ts", "utf8");

test("client technology review uses the requested readable PDF file name", () => {
  assert.match(exportHtml, /`Technology Health Review - \${clientName}`/);
  assert.match(exportHtml, /<title>\${escapeHtml\(clientFacingDocumentTitle\(project\)\)}<\/title>/);
  assert.match(exportHtml, /downloadFillableClientPdf\(outcomeHtml\(project\), clientFacingDocumentTitle\(project\)\)/);
});

test("PDF download preserves spaces and capitalization while removing invalid characters", () => {
  assert.match(fillablePdf, /anchor\.download = `\${safeFileName\(documentTitle\)}\.pdf`/);
  assert.match(fillablePdf, /replace\(\/\[<>:\"\/\\\\\|\?\*/);
  assert.match(fillablePdf, /replace\(\/\\s\+\/g, " "\)/);
  const start = fillablePdf.indexOf("function safeFileName");
  const end = fillablePdf.indexOf("function waitForFrame", start);
  const safeFileName = fillablePdf.slice(start, end);
  assert.doesNotMatch(safeFileName, /toLowerCase\(\)/);
});
