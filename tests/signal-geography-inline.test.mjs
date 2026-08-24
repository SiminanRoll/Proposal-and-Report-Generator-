import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dashboard = path.join(root, "public", "captains-log-dashboard");
const geoPage = readFileSync(path.join(root, "src", "app", "signal-geography-map", "page.tsx"), "utf8");
const geoCss = readFileSync(path.join(root, "src", "app", "signal-geography-map", "signal-geography-map.module.css"), "utf8");
const parentJs = readFileSync(path.join(dashboard, "dashboard-signal-geography.js"), "utf8");
const parentCss = readFileSync(path.join(dashboard, "dashboard-signal-geography.css"), "utf8");
const phase2 = readFileSync(path.join(dashboard, "dashboard-signal-map-phase2.js"), "utf8");

test("geographic mode is map-only with explicit zoom controls", () => {
  assert.match(geoPage, /Map zoom controls/);
  assert.match(geoPage, /Zoom out/);
  assert.match(geoPage, /Zoom in/);
  assert.match(geoPage, /Reset map zoom/);
  assert.doesNotMatch(geoPage, /intelligencePanel/);
  assert.doesNotMatch(geoPage, /summaryGrid/);
  assert.match(geoCss, /overflow:\s*hidden/);
});

test("geographic map occupies the existing primary center field", () => {
  assert.match(parentCss, /\.signal-geography-pane\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/s);
  assert.match(parentCss, /border:\s*0/);
  assert.match(parentCss, /background:\s*transparent/);
  assert.match(parentJs, /scrolling=\"no\"/);
});

test("state hover and pin detail is rendered in the lower entity shelf", () => {
  assert.match(geoPage, /signal-geography:state/);
  assert.match(parentJs, /data-entity-list/);
  assert.match(parentJs, /geo-inline-state-card/);
  assert.match(parentJs, /Hover a state · click to pin/);
  assert.match(parentJs, /Pinned state · click again to unpin/);
  assert.match(phase2, /SignalMapContributorPanel/);
  assert.match(phase2, /signalCenterView==='geo'/);
});

test("inline geography release is cache-busted", () => {
  assert.match(parentJs, /signal-geography-map\/\?v=1\.2\.82/);
  assert.match(phase2, /dashboard-signal-geography\.css\?v=1\.2\.82/);
  assert.match(phase2, /dashboard-signal-geography\.js\?v=1\.2\.82/);
});
