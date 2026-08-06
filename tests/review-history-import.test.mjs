import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { transpileTestModule } from "./test-transpile-helper.mjs";

async function runtime() {
  return transpileTestModule("../src/lib/compass/review-history.ts", import.meta.url, { prefix: "client-compass-review-history" });
}

async function parserRuntime() {
  const stub = join(tmpdir(), `client-compass-xlsx-stub-${process.pid}.mjs`);
  writeFileSync(stub, `export const SSF = { parse_date_code(value) { const date = new Date(Date.UTC(1899, 11, 30 + value)); return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() }; } }; export function read() { return { SheetNames: [], Sheets: {} }; } export const utils = { sheet_to_json() { return []; } };`);
  return transpileTestModule("../src/lib/compass/review-history-import.ts", import.meta.url, {
    prefix: "client-compass-review-history-parser",
    replacements: { 'from "xlsx"': `from ${JSON.stringify(pathToFileURL(stub).href)}` },
  });
}

function outcome(reviewedAt = "") {
  return {
    status: reviewedAt ? "confirmed" : "not-reviewed",
    reviewedAt,
    meetingSummary: "",
    agreedNextStep: "",
    reportTitle: "Technology Review",
    executiveSummary: "",
    items: [],
    lastUpdatedAt: "",
  };
}

function client(id, name, aliases = [], overrides = {}) {
  return {
    id,
    name,
    aliases,
    primaryContact: "",
    primaryContactRole: "",
    primaryContactEmail: "",
    primaryContactPhone: "",
    assignedOwner: "Patric",
    lastAccountReview: "",
    lastSalesInteraction: "2026-07-10",
    lastQuoteDate: "",
    quoted: false,
    nextFollowUp: "",
    workflowStatus: "",
    internalNote: "",
    reviewOutcome: outcome(),
    lastDataRefresh: "2026-08-05",
    ...overrides,
  };
}

function dataset(clients) {
  return {
    schemaVersion: 1,
    clients,
    locations: [],
    devices: [],
    findings: [],
    summaries: [],
    importedAt: "2026-08-05T12:00:00.000Z",
    sourceName: "ninja.xlsx",
  };
}

test("review-date parser accepts spreadsheet serials and common date formats", async () => {
  const { parseReviewDate } = await parserRuntime();
  assert.equal(parseReviewDate("2026-08-05"), "2026-08-05");
  assert.equal(parseReviewDate("8/5/2026"), "2026-08-05");
  assert.equal(parseReviewDate("08/05/26"), "2026-08-05");
  assert.equal(parseReviewDate(46239), "2026-08-05");
  assert.equal(parseReviewDate("not a date"), "");
});

test("review-history normalization handles common practice-name variations", async () => {
  const { normalizeReviewOrganization, reviewOrganizationSimilarity } = await runtime();
  assert.equal(normalizeReviewOrganization("Dr. Jane Smith, D.D.S., P.C."), "jane smith");
  assert.equal(normalizeReviewOrganization("Tosa Dental Associates, LLC"), "tosa dental associate");
  assert.equal(normalizeReviewOrganization("Northwest OMS"), "northwest oral maxillofacial surgery");
  assert.ok(reviewOrganizationSimilarity("Tosa Dental Associates", "Tosa Dental") >= 0.84);
  assert.ok(reviewOrganizationSimilarity("Northwest OMS", "Southwest Pediatrics") < 0.67);
});

test("review-history matching resolves exact names, aliases, and confident smart matches in bulk", async () => {
  const { buildReviewHistoryPreview } = await runtime();
  const source = dataset([
    client("tosa", "Tosa Dental"),
    client("northwest", "Northwest Oral & Maxillofacial Surgery Associates", ["Northwest OMS"]),
    client("river", "Riverpoint Family Dental"),
  ]);
  const preview = buildReviewHistoryPreview([
    { rowNumber: 2, companyName: "Tosa Dental, LLC", lastAccountReview: "2026-08-05" },
    { rowNumber: 3, companyName: "Northwest OMS", lastAccountReview: "2026-07-25" },
    { rowNumber: 4, companyName: "Riverpoint Family Dentistry", lastAccountReview: "2026-07-18" },
  ], source);

  assert.equal(preview.autoMatchedCount, 3);
  assert.equal(preview.ambiguousCount, 0);
  assert.equal(preview.unmatchedCount, 0);
  assert.equal(preview.updateCount, 3);
});

test("review-history matching leaves genuine collisions as one compact exception", async () => {
  const { buildReviewHistoryPreview } = await runtime();
  const source = dataset([
    client("smith-family", "Smith Family Dental"),
    client("smith-care", "Smith Dental Care"),
  ]);
  const preview = buildReviewHistoryPreview([
    { rowNumber: 2, companyName: "Smith Dental", lastAccountReview: "2026-08-01" },
  ], source);
  assert.equal(preview.autoMatchedCount, 0);
  assert.equal(preview.ambiguousCount, 1);
  assert.equal(preview.matches[0].suggestions.length, 2);
});

test("review-history import consolidates duplicates and only applies newer review dates", async () => {
  const { buildReviewHistoryPreview, applyReviewHistoryPreview } = await runtime();
  const source = dataset([
    client("tosa", "Tosa Dental", [], { lastAccountReview: "2026-07-01", quoted: true, lastQuoteDate: "2026-07-03", workflowStatus: "Needs Review" }),
    client("river", "Riverpoint Family Dental", [], { lastAccountReview: "2026-08-02", lastSalesInteraction: "2026-08-03" }),
  ]);
  const preview = buildReviewHistoryPreview([
    { rowNumber: 2, companyName: "Tosa Dental", lastAccountReview: "2026-07-20" },
    { rowNumber: 3, companyName: "Tosa Dental LLC", lastAccountReview: "2026-08-05" },
    { rowNumber: 4, companyName: "Riverpoint Family Dental", lastAccountReview: "2026-07-18" },
  ], source);
  assert.equal(preview.duplicateRowsConsolidated, 1);
  assert.equal(preview.updateCount, 1);
  assert.equal(preview.olderIgnoredCount, 1);

  const updated = applyReviewHistoryPreview(source, preview);
  const tosa = updated.clients.find((item) => item.id === "tosa");
  const river = updated.clients.find((item) => item.id === "river");
  assert.equal(tosa.lastAccountReview, "2026-08-05");
  assert.equal(tosa.quoted, true, "quote history is preserved");
  assert.equal(tosa.lastQuoteDate, "2026-07-03");
  assert.equal(tosa.workflowStatus, "Review Completed", "a newly imported review date clears an obsolete needs-review status");
  assert.equal(river.lastAccountReview, "2026-08-02", "older imported dates do not overwrite newer history");
  assert.equal(river.lastSalesInteraction, "2026-08-03", "sales history is untouched");
});

test("one-time review-date tool is tucked under Customize and does not alter the technical importer", () => {
  const home = readFileSync("src/components/compass-home.tsx", "utf8");
  const dialog = readFileSync("src/components/compass-review-history-dialog.tsx", "utf8");
  const technicalImport = readFileSync("src/components/compass-data-dialog.tsx", "utf8");
  assert.match(home, /Import account review dates/);
  assert.match(home, /One-time client-history enrichment tool/);
  assert.match(dialog, /Company Name and Last Account Review Date/);
  assert.match(dialog, /Only true exceptions/);
  assert.match(dialog, /Download client-name template/);
  assert.match(dialog, /Quote and sales fields remain unchanged/);
  assert.doesNotMatch(technicalImport, /review-history|Review History/);
});
