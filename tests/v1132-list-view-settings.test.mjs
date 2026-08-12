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
  assert.match(shared, /pointermove/);
  assert.match(shared, /ListViewSettings/);
  assert.match(shared, /ListColumnResizeHandle/);
});

test("shared column ranking crosses the drop target and is draggable inline", () => {
  const shared = readFileSync("src/components/list-view-settings.tsx", "utf8");
  const css = readFileSync("src/app/list-view-settings.css", "utf8");
  assert.match(shared, /insertAfterTarget = sourceIndex < targetIndex/);
  assert.match(shared, /list-view-column-drag-handle/);
  assert.match(shared, /title={`Drag \$\{meta\?\.label \?\? column\} to reorder columns`}/);
  assert.match(shared, /view\.move\(view\.dragged, column\)/);
  assert.match(css, /\.list-view-column-drag-handle/);
  assert.match(css, /\.list-view-grid>\*\{order:0!important;grid-row:auto!important\}/);
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

test("Map client lists use the shared view system without reparenting React grid cells", () => {
  const map = readFileSync("src/components/territory-map-page.tsx", "utf8");
  const workbenchRuntime = readFileSync("src/components/workbench-runtime.tsx", "utf8");
  assert.match(map, /useListViewPreferences\("map-clients"/);
  assert.match(map, /ListViewSettings/);
  assert.match(map, /ListColumnResizeHandle/);
  assert.match(map, /Last sales activity/);
  assert.match(map, /Last quote/);
  assert.match(map, /Assets/);
  assert.match(map, /Captain's Log/);
  assert.match(workbenchRuntime, /legacyWrapper\.replaceWith\(legacyButton\)/);
  assert.match(workbenchRuntime, /nameButton\.insertBefore\(selector, nameButton\.firstChild\)/);
  assert.doesNotMatch(workbenchRuntime, /wrapper\.append\(label, nameButton\)/);
});

test("Workbench retains adjustable inline reorderable column preferences", () => {
  const workbench = readFileSync("src/components/workbench-v102-list.tsx", "utf8");
  assert.match(workbench, /WORKBENCH_COLUMN_STORAGE_KEY/);
  assert.match(workbench, /resizeColumn/);
  assert.match(workbench, /moveColumn/);
  assert.match(workbench, /insertAfterTarget = sourceIndex < targetIndex/);
  assert.match(workbench, /workbench-column-grip/);
  assert.match(workbench, /toggleColumn/);
  assert.match(workbench, /Customize columns/);
});
