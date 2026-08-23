import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dashboard = path.join(root, "public", "captains-log-dashboard");
const read = (name) => readFileSync(path.join(dashboard, name), "utf8");
const html = read("index.html");
const entry = read("dashboard-signal-map.js");
const styles = read("dashboard-signal-map.css");
const core = read("premium_core.js");
const app = read("premium_app.js");
const polish = read("dashboard-polish.js");

test("Signal Map is the default authenticated surface", () => {
  assert.match(html, /<title>Signal Intelligence Map<\/title>/);
  assert.match(html, /data-signal-surface="map"/);
  assert.match(html, /id="signalMapView"[^>]+aria-busy="true"/);
  assert.match(html, /id="detailDashboard"[^>]+hidden/);
  assert.match(html, /data-signal-surface-target="map"[^>]*>Signal Map<\/button>/);
  assert.match(html, /data-signal-surface-target="detail"[^>]*>Detail Dashboard<\/button>/);
  assert.doesNotMatch(html, /A live view of how monitored signals become surfaced sales opportunities\./);
});

test("the map entry point uses dedicated versioned assets and sales-facing copy", () => {
  assert.match(html, /dashboard-signal-map\.css\?v=1\.2\.76/);
  assert.match(html, /dashboard-signal-map\.js\?v=1\.2\.76/);
  const mapStart = html.indexOf('<section class="signal-map-entry"');
  const mapEnd = html.indexOf('<div class="detail-dashboard"', mapStart);
  const mapMarkup = html.slice(mapStart, mapEnd);
  assert.doesNotMatch(mapMarkup, /Captain(?:'|’)?s Log/i);
  assert.match(mapMarkup, />Sources</);
  assert.match(mapMarkup, /class="map-flow-track"/);
  assert.match(mapMarkup, /id="mapDestinationHeading" data-outcome-source-label/);
  assert.match(mapMarkup, /href="#icon-landmark"/);
  assert.doesNotMatch(mapMarkup, /class="map-engine-hub"/);
  assert.doesNotMatch(mapMarkup, /map-layer-controls/);
  assert.doesNotMatch(styles, /shimmer/i);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
});

test("all existing Detail Dashboard views remain mounted", () => {
  const detailStart = html.indexOf('id="detailDashboard"');
  const detailEnd = html.indexOf('<div class="error" id="error">');
  assert.ok(detailStart >= 0 && detailEnd > detailStart);
  const detailMarkup = html.slice(detailStart, detailEnd);
  for (const id of ["overview", "opportunities", "social", "permits", "npi", "intent", "runs"]) {
    assert.match(detailMarkup, new RegExp(`id="${id}"`));
  }
  for (const days of [1, 7, 30, 90, 365]) assert.match(html, new RegExp(`data-days="${days}"`));
});

test("the surface switch is accessible and does not override the required default", () => {
  assert.match(html, /role="tablist"/);
  assert.match(entry, /aria-selected/);
  assert.match(entry, /ArrowRight/);
  assert.match(entry, /ArrowLeft/);
  assert.match(entry, /requestAnimationFrame\(\(\)=>window\.dispatchEvent\(new Event\('resize'\)\)\)/);
  assert.doesNotMatch(entry, /localStorage|sessionStorage/);
  assert.match(entry, /setSurface\(body\.dataset\.signalSurface\|\|'map'\)/);
});

test("normalized map data is handed off without changing authentication", () => {
  assert.match(app, /new CustomEvent\('signal-map:data',\{detail:d\.signal_map\|\|null\}\)/);
  assert.match(app, /new CustomEvent\('signal-map:error'/);
  assert.match(entry, /window\.addEventListener\('signal-map:data'/);
  assert.match(entry, /source\.availability==='available'/);
  assert.doesNotMatch(entry, /service_role|SERVICE_ROLE|runner_secret|webhook_secret/i);
});

test("legacy scripts no longer force the Detail title over Map mode", () => {
  assert.doesNotMatch(core, /document\.title='Signal Intelligence Dashboard'/);
  assert.doesNotMatch(core, /heroTitle\.textContent='Signal Intelligence Dashboard'/);
  assert.match(polish, /document\.body\.dataset\.signalSurface==='detail'/);
});
