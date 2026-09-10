import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const types = fs.readFileSync(new URL("../src/lib/review-outcomes/types.ts", import.meta.url), "utf8");
const model = fs.readFileSync(new URL("../src/lib/review-outcomes/model.ts", import.meta.url), "utf8");
const editor = fs.readFileSync(new URL("../src/components/review-outcome-editor.tsx", import.meta.url), "utf8");
const pdfOverrides = fs.readFileSync(new URL("../src/lib/outcomes/pdf-report-overrides.ts", import.meta.url), "utf8");
const fillablePdf = fs.readFileSync(new URL("../src/lib/outcomes/fillable-pdf.ts", import.meta.url), "utf8");
const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

test("review outcomes persist client-report text overrides while older datasets remain valid", () => {
  assert.match(types, /ClientReportEditableSectionId/);
  assert.match(types, /reportTextOverrides\?: ClientReportTextOverrides/);
  assert.match(model, /normalizeReportTextOverrides/);
  assert.match(model, /reportTextOverrides: normalizeReportTextOverrides/);
});

test("Tailor report exposes a per-section PDF editor with resets", () => {
  assert.match(editor, /PDF editor/);
  assert.match(editor, /Fine-tune section headings and text before download/);
  for (const id of ["overview", "review-focus", "hipaa", "planning", "inventory", "recap"]) {
    assert.match(editor, new RegExp(`id: "${id}"`));
  }
  assert.match(editor, /resetReportOverride/);
  assert.match(editor, /resetAllReportOverrides/);
  assert.match(editor, /Inventory, scores, security activity, HIPAA answers, lifecycle status/);
});

test("save handoff closes promptly instead of waiting on Compass snapshot sync", () => {
  assert.match(editor, /const savePromise = Promise\.resolve\(onSave\(payload\)\)/);
  assert.match(editor, /onClose\(\);/);
  assert.match(editor, /background sync failed after the local report save/);
  assert.match(editor, /busy \? "Saving…" : "Save review outcome"/);
});

test("downloaded PDFs apply tailored headings as the final copy pass", () => {
  assert.match(fillablePdf, /prepareReportTextOverridesHtml/);
  assert.match(fillablePdf, /const inventoryHtml = ensurePdfDeviceInventory\(preparedHtml\)/);
  assert.match(fillablePdf, /const sanitizedHtml = sanitizeClientPdfCopy\(layoutHtml\)/);
  assert.match(fillablePdf, /const tailoredHtml = prepareReportTextOverridesHtml\(sanitizedHtml, documentTitle\)/);
  assert.match(pdfOverrides, /getProjectsSnapshot/);
  assert.match(pdfOverrides, /\.pdf-overview-page/);
  assert.match(pdfOverrides, /\.pdf-tailored-focus-page/);
  assert.match(pdfOverrides, /\.pdf-hipaa-review/);
  assert.match(pdfOverrides, /\.pdf-action-page/);
  assert.match(pdfOverrides, /\.pdf-inventory-page/);
  assert.match(pdfOverrides, /\.pdf-client-success-page/);
});

test("release version advances to v1.2.93", () => {
  assert.match(version, /1\.2\.93/);
});
