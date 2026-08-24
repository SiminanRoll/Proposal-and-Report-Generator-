import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => readFileSync(path.join(root, ...parts), "utf8");

const mapCss = read("src", "app", "signal-geography-map", "signal-geography-map.module.css");
const mapLayout = read("src", "app", "signal-geography-map", "layout.tsx");
const dashboardGeoCss = read("public", "captains-log-dashboard", "dashboard-signal-geography.css");
const phase2 = read("public", "captains-log-dashboard", "dashboard-signal-map-phase2.js");

test("embedded geography route cannot inherit the light Client Compass canvas", () => {
  assert.match(mapCss, /background:\s*transparent\s*!important/);
  assert.match(mapLayout, /background:\s*transparent\s*!important/);
  assert.match(mapLayout, /background-color:\s*transparent\s*!important/);
  assert.match(phase2, /signal-map-transparent-canvas/);
  assert.match(phase2, /allowtransparency/);
});

test("geography assets and iframe are cache-busted for the transparent release", () => {
  assert.match(phase2, /dashboard-signal-geography\.css\?v=1\.2\.84/);
  assert.match(phase2, /dashboard-signal-geography\.js\?v=1\.2\.84/);
  assert.match(phase2, /signal-geography-map\/\?v=1\.2\.84/);
});

test("laptop-height layouts compact the source rail before the detail shelf", () => {
  assert.match(dashboardGeoCss, /@media \(max-height: 900px\) and \(min-width: 901px\)/);
  assert.match(dashboardGeoCss, /\.map-source-node\s*\{[\s\S]*?min-height:\s*42px/);
  assert.match(dashboardGeoCss, /\.map-overview-plane\s*\{[\s\S]*?height:\s*64%/);
  assert.match(dashboardGeoCss, /\.map-detail-shelf\s*\{[\s\S]*?height:\s*36%/);
});
