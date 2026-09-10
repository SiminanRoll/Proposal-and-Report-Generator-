import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const types = fs.readFileSync(new URL("../src/lib/review-outcomes/types.ts", import.meta.url), "utf8");
const model = fs.readFileSync(new URL("../src/lib/review-outcomes/model.ts", import.meta.url), "utf8");
const tailorEditor = fs.readFileSync(new URL("../src/components/review-outcome-editor.tsx", import.meta.url), "utf8");
const pdfEditor = fs.readFileSync(new URL("../src/components/project-pdf-editor-page-client.tsx", import.meta.url), "utf8");
const pdfLauncher = fs.readFileSync(new URL("../src/components/pdf-editor-global.tsx", import.meta.url), "utf8");
const pdfRoute = fs.readFileSync(new URL("../src/app/project/pdf-editor/page.tsx", import.meta.url), "utf8");
const pdfCss = fs.readFileSync(new URL("../src/app/pdf-editor-v1294.css", import.meta.url), "utf8");
const preview = fs.readFileSync(new URL("../src/lib/outcomes/pdf-editor-preview.ts", import.meta.url), "utf8");
const pdfOverrides = fs.readFileSync(new URL("../src/lib/outcomes/pdf-report-overrides.ts", import.meta.url), "utf8");
const fillablePdf = fs.readFileSync(new URL("../src/lib/outcomes/fillable-pdf.ts", import.meta.url), "utf8");
const appShell = fs.readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

test("review outcomes keep PDF copy overrides backward compatible and support location-specific inline edits", () => {
  assert.match(types, /reportTextOverrides\?: ClientReportTextOverrides/);
  assert.match(types, /locations\?: Record<string, ClientReportSectionLocationOverride>/);
  assert.match(model, /normalizeReportTextOverrides/);
  assert.match(model, /raw\.locations/);
  assert.match(pdfOverrides, /INVENTORY_UNASSIGNED_OVERRIDE_KEY/);
  assert.match(pdfOverrides, /override\.locations\?\.\[key\]/);
});

test("Tailor Report keeps the responsive save fix but no longer displays the embedded PDF form editor", () => {
  assert.match(tailorEditor, /const savePromise = Promise\.resolve\(onSave\(payload\)\)/);
  assert.match(tailorEditor, /onClose\(\);/);
  assert.match(tailorEditor, /background sync failed after the local report save/);
  assert.match(pdfCss, /\.review-outcome-section\.report-copy-editor\{display:none!important\}/);
});

test("PDF editing opens as a dedicated screen from a client report", () => {
  assert.match(pdfRoute, /ProjectPdfEditorPageClient/);
  assert.match(pdfLauncher, /\/project\/pdf-editor\?id=/);
  assert.match(appShell, /<PdfEditorGlobal \/>/);
  assert.match(pdfEditor, /className="pdf-editor-screen"/);
  assert.match(pdfEditor, /← Back to report/);
});

test("editor preview is built from the same final HTML pipeline and capture page dimensions as PDF output", () => {
  assert.match(pdfEditor, /prepareFillableClientPdfHtml\(outcomeHtml\(project\), title, overrides\)/);
  assert.match(pdfEditor, /preparePdfEditorPreviewHtml\(finalPdfHtml, project\)/);
  assert.match(fillablePdf, /export function prepareFillableClientPdfHtml/);
  assert.match(fillablePdf, /downloadCorePdf\(prepareFillableClientPdfHtml\(html, documentTitle\), documentTitle\)/);
  assert.match(preview, /captureWidth: 816, captureHeight: 1056/);
  assert.match(preview, /page\.dataset\.pdfCapturePage = "true"/);
  assert.match(preview, /\.print-report\{display:block!important;width:\$\{layout\.captureWidth\}px!important/);
});

test("editable narrative is changed inline on the displayed PDF rather than in detached fields", () => {
  assert.match(pdfEditor, /element\.contentEditable = "plaintext-only"/);
  assert.match(pdfEditor, /data.*pdfInlineEdit|dataset\.pdfInlineEdit/);
  assert.match(pdfEditor, /header\.querySelector<HTMLElement>\("h2"\)/);
  assert.match(pdfEditor, /header\.querySelector<HTMLElement>\("p"\)/);
  assert.match(pdfEditor, /Click highlighted report text to edit it in place/);
  assert.match(pdfEditor, /Scores, inventory facts, security activity, HIPAA answers, dates, and other source data remain locked/);
});

test("Reset to default restores generated report copy and Save changes persists the result", () => {
  assert.match(pdfEditor, /Reset to default/);
  assert.match(pdfEditor, /setDraftOverrides\(\{\}\)/);
  assert.match(pdfEditor, /setPreviewHtml\(buildPdfPreview\(project, \{\}\)\)/);
  assert.match(pdfEditor, /Save changes/);
  assert.match(pdfEditor, /saveProject\(nextProject\)/);
  assert.match(pdfEditor, /saveCompassDataset/);
  assert.match(pdfEditor, /reportTextOverrides: cleaned/);
});

test("release version advances to v1.2.94", () => {
  assert.match(version, /1\.2\.94/);
});
