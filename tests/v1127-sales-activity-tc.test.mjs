import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("client records support imported Last Sales Activity and TC", () => {
  const types = readFileSync("src/lib/compass/types.ts", "utf8");
  const importer = readFileSync("src/lib/compass/client-enrichment-import.ts", "utf8");
  const enrichment = readFileSync("src/lib/compass/client-enrichment.ts", "utf8");
  assert.match(types, /technicalConsultant\?: string/);
  assert.match(types, /lastSalesInteraction: string/);
  assert.match(importer, /latest sales activity/);
  assert.match(importer, /technical consultant/);
  assert.match(importer, /"tc"/);
  assert.match(enrichment, /Last sales activity/);
  assert.match(enrichment, /mergeConsultants/);
});

test("Workbench always exposes sortable Last Sales Activity and TC columns", () => {
  const model = readFileSync("src/components/workbench-v102-model.ts", "utf8");
  const list = readFileSync("src/components/workbench-v102-list.tsx", "utf8");
  const page = readFileSync("src/components/workbench-page-v102.tsx", "utf8");
  assert.match(model, /"salesActivity"/);
  assert.match(model, /"technicalConsultant"/);
  assert.match(list, /Last sales activity/);
  assert.match(list, /technicalConsultant/);
  assert.match(list, /Always shown/);
  assert.match(page, /sortKey === "salesActivity"/);
  assert.match(page, /sortKey === "technicalConsultant"/);
});

test("Segment Manager and Project Coverage show sortable sales coverage columns", () => {
  const segmentTypes = readFileSync("src/lib/segments/types.ts", "utf8");
  const segmentEngine = readFileSync("src/lib/segments/engine.ts", "utf8");
  const segmentDetail = readFileSync("src/components/segment-detail-page.tsx", "utf8");
  const coverage = readFileSync("src/components/project-coverage-client-list.tsx", "utf8");
  assert.match(segmentTypes, /salesActivityAgeDays/);
  assert.match(segmentTypes, /technicalConsultant/);
  assert.match(segmentEngine, /Time since sales activity/);
  assert.match(segmentEngine, /Technical consultant \(TC\)/);
  assert.match(segmentDetail, /Last sales activity/);
  assert.match(segmentDetail, /sortButton\("tc", "TC"\)/);
  assert.match(coverage, /sortButton\("salesActivity", "Last sales activity"\)/);
  assert.match(coverage, /sortButton\("tc", "TC"\)/);
});

test("Map client lists receive sortable sales coverage columns", () => {
  const runtime = readFileSync("src/components/map-sales-activity-runtime.tsx", "utf8");
  const rootRuntime = readFileSync("src/components/client-compass-runtime.tsx", "utf8");
  assert.match(runtime, /Last sales activity/);
  assert.match(runtime, /technicalConsultant/);
  assert.match(runtime, /sortKey === "salesActivity"/);
  assert.match(runtime, /sortKey === "tc"/);
  assert.match(rootRuntime, /MapSalesActivityRuntime/);
});

test("Company Details clearly separates Sales Activity from Captain's Log and removes duplicate history lists", () => {
  const activity = readFileSync("src/components/client-activity-runtime.tsx", "utf8");
  const styles = readFileSync("src/app/sales-activity-v1127.css", "utf8");
  assert.match(activity, /client-review-sales-activity-v1127/);
  assert.match(activity, /Last sales activity/);
  assert.match(activity, /Captain&apos;s Log · Next/);
  assert.match(activity, /Company notes/);
  assert.doesNotMatch(activity, />Upcoming</);
  assert.doesNotMatch(activity, />Recent history</);
  assert.match(styles, /client-review-notes-only-v1127/);
});
