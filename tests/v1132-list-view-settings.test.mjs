import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("shared list view preferences persist visibility order and widths per scope", () => {
  const shared = readFileSync("src/components/list-view-settings.tsx", "utf8");
  assert.match(shared, /client-compass\.list-view\.v1\./);
  assert.match(shared, /useListViewPreferences/);
  assert.match(shared, /setVisible/);
  assert.match(shared, /setOrder/);
  assert.match(shared, /setWidths/);
  assert.match(shared, /draggable/);
  assert.match(shared, /pointermove/);
  assert.match(shared, /ListViewSettings/);
  assert.match(shared, /ListColumnResizeHandle/);
});

test("Project Coverage uses its own configurable list preference", () => {
  const coverage = readFileSync("src/components/project-coverage-client-list.tsx", "utf8");
  assert.match(coverage, /useListViewPreferences\("project-coverage"/);
  assert.match(coverage, /ListViewSettings/);
  assert.match(coverage, /ListColumnResizeHandle/);
  assert.match(coverage, /Project need/);
  assert.match(coverage, /Last sales activity/);
  assert.match(coverage, /Captain's Log/);
});

test("each Segment can retain an independent configurable client list", () => {
  const segment = readFileSync("src/components/segment-detail-page.tsx", "utf8");
  assert.match(segment, /useListViewPreferences\(`segment-\$\{segmentId/);
  assert.match(segment, /ListViewSettings/);
  assert.match(segment, /ListColumnResizeHandle/);
  assert.match(segment, /Latest TC sales activity/);
});

test("Map client lists use the shared view system with expandable columns", () => {
  const map = readFileSync("src/components/map-sales-activity-runtime.tsx", "utf8");
  assert.match(map, /useListViewPreferences\("map-clients"/);
  assert.match(map, /ListViewSettings/);
  assert.match(map, /Last sales activity/);
  assert.match(map, /Last quote/);
  assert.match(map, /Assets/);
  assert.match(map, /Captain's Log/);
  assert.match(map, /RuntimeSortKey/);
});

test("Workbench retains adjustable reorderable column preferences", () => {
  const workbench = readFileSync("src/components/workbench-v102-list.tsx", "utf8");
  assert.match(workbench, /WORKBENCH_COLUMN_STORAGE_KEY/);
  assert.match(workbench, /resizeColumn/);
  assert.match(workbench, /moveColumn/);
  assert.match(workbench, /toggleColumn/);
  assert.match(workbench, /Customize columns/);
});
