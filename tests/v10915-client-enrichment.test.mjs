import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { transpileTestModule } from "./test-transpile-helper.mjs";

async function parserRuntime(tableRows = []) {
  const stub = join(tmpdir(), `client-enrichment-xlsx-${process.pid}-${Math.random().toString(16).slice(2)}.mjs`);
  writeFileSync(stub, `const rows = ${JSON.stringify(tableRows)}; export const SSF = { parse_date_code(value) { const date = new Date(Date.UTC(1899, 11, 30 + value)); return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() }; } }; export function read() { return { SheetNames: ["Client Enrichment"], Sheets: { "Client Enrichment": { rows } } }; } export const utils = { sheet_to_json(sheet) { return sheet?.rows ?? []; } };`);
  return transpileTestModule("../src/lib/compass/client-enrichment-import.ts", import.meta.url, {
    prefix: "client-enrichment-parser",
    replacements: { 'from "xlsx"': `from ${JSON.stringify(pathToFileURL(stub).href)}` },
  });
}

async function enrichmentRuntime() {
  const shim = join(tmpdir(), `review-shim-${process.pid}-${Math.random().toString(16).slice(2)}.mjs`);
  writeFileSync(shim, `
    function clean(value) { return String(value ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim(); }
    export function normalizeReviewOrganization(value) {
      const ignored = new Set(["llc","pllc","plc","pc","pa","inc","corp","corporation","company","co","ltd","limited","dds","dmd","md","dr","doctor"]);
      return clean(value).split(/\\s+/).filter(Boolean).filter((token) => !ignored.has(token)).join(" ");
    }
    export function reviewOrganizationSimilarity(left, right) {
      const a = normalizeReviewOrganization(left); const b = normalizeReviewOrganization(right);
      if (!a || !b) return 0; if (a === b) return 1;
      const at = new Set(a.split(" ")); const bt = new Set(b.split(" "));
      let common = 0; for (const token of at) if (bt.has(token)) common += 1;
      return common / Math.max(at.size, bt.size);
    }
  `);
  return transpileTestModule("../src/lib/compass/client-enrichment.ts", import.meta.url, {
    prefix: "client-enrichment-core",
    replacements: { 'from "./review-history"': `from ${JSON.stringify(pathToFileURL(shim).href)}` },
  });
}

function client(id, name, overrides = {}) {
  return {
    id, name, aliases: [], city: "", state: "", market: "", industry: "", tags: [],
    primaryContact: "", primaryContactRole: "", primaryContactEmail: "", primaryContactPhone: "", assignedOwner: "",
    lastAccountReview: "", lastSalesInteraction: "", lastQuoteDate: "", quoted: false, nextFollowUp: "", workflowStatus: "Needs Review", internalNote: "",
    reviewOutcome: { status: "not-reviewed", reviewedAt: "", meetingSummary: "", agreedNextStep: "", reportTitle: "Technology Review", executiveSummary: "", items: [], lastUpdatedAt: "" },
    lastDataRefresh: "2026-08-07", ...overrides,
  };
}

function dataset(clients) { return { schemaVersion: 1, clients, locations: [], devices: [], findings: [], summaries: [], importedAt: "2026-08-07", importSourceName: "ninja.xlsx", importSummary: {} }; }

test("client record enricher recognizes the friendly spreadsheet headers", async () => {
  const { parseClientEnrichmentSpreadsheet } = await parserRuntime([
    ["Company Name", "City", "State", "Market", "Industry", "Client Tags", "Primary Contact", "Primary Contact Email", "Last Account Review Date", "Last Quote Date"],
    ["Tosa Dental", "Wauwatosa", "WI", "Wisconsin", "Dental", "Client, Premier", "Tiffany", "tiffany@example.com", "8/7/2026", "7/30/2026"],
  ]);
  const parsed = await parseClientEnrichmentSpreadsheet({ name: "client-enrichment.xlsx", async arrayBuffer() { return new ArrayBuffer(0); } });
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].state, "WI");
  assert.equal(parsed.rows[0].market, "Wisconsin");
  assert.deepEqual(parsed.rows[0].tags, ["Client", "Premier"]);
  assert.equal(parsed.rows[0].lastAccountReview, "2026-08-07");
  assert.equal(parsed.rows[0].lastQuoteDate, "2026-07-30");
});

test("client record enrichment adds segmentation fields and preserves newer dates", async () => {
  const { buildClientEnrichmentPreview, applyClientEnrichmentPreview } = await enrichmentRuntime();
  const source = dataset([client("tosa", "Tosa Dental", { lastAccountReview: "2026-08-07", lastQuoteDate: "2026-08-01", tags: ["Client"] })]);
  const preview = buildClientEnrichmentPreview([{
    rowNumber: 2, companyName: "Tosa Dental, LLC", city: "Wauwatosa", state: "WI", market: "Wisconsin", industry: "Dental", tags: ["Premier"],
    primaryContact: "Tiffany", primaryContactRole: "Office Manager", primaryContactEmail: "tiffany@example.com", primaryContactPhone: "555-0100", assignedOwner: "Patric",
    lastAccountReview: "2026-07-01", lastQuoteDate: "2026-08-05", nextFollowUp: "2026-08-20", workflowStatus: "Review Completed", internalNote: "Key account",
  }], source);
  assert.equal(preview.updateCount, 1);
  const updated = applyClientEnrichmentPreview(source, preview).clients[0];
  assert.equal(updated.city, "Wauwatosa");
  assert.equal(updated.state, "WI");
  assert.equal(updated.market, "Wisconsin");
  assert.deepEqual(updated.tags, ["Client", "Premier"]);
  assert.equal(updated.lastAccountReview, "2026-08-07", "older review date is ignored");
  assert.equal(updated.lastQuoteDate, "2026-08-05");
  assert.equal(updated.quoted, true);
});

test("Data Tools visibly separates hardware and client-record enrichment", () => {
  const dataTools = readFileSync("src/components/compass-data-tools-page.tsx", "utf8");
  const dialog = readFileSync("src/components/compass-client-enrichment-dialog.tsx", "utf8");
  const segmentEngine = readFileSync("src/lib/segments/engine.ts", "utf8");
  assert.match(dataTools, /Hardware & inventory/);
  assert.match(dataTools, /Client records & contacts/);
  assert.match(dataTools, /Import client details/);
  assert.match(dialog, /"City", "State", "Territory", "Industry", "Client Tags"/);
  for (const field of ["city", "state", "market", "industry", "client-tags"]) assert.match(segmentEngine, new RegExp(`id: "${field}"`));
});
