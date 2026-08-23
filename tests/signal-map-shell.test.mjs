import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dashboard = path.join(root, "public", "captains-log-dashboard");
const read = (name) => readFileSync(path.join(dashboard, name), "utf8");
const html = read("index.html");
const script = read("dashboard-signal-map.js");
const styles = read("dashboard-signal-map.css");
const mapStart = html.indexOf('<section class="signal-map-entry"');
const mapEnd = html.indexOf('<div class="detail-dashboard"', mapStart);
const mapMarkup = html.slice(mapStart, mapEnd);

test("the Phase 4 shell exposes exactly six stable source lanes", () => {
  const ids = [...mapMarkup.matchAll(/data-source-id="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, [
    "facebook_groups",
    "reddit_groups",
    "linkedin_groups",
    "company_page_engagement",
    "permit_offices",
    "npi_new_practice",
  ]);
  assert.match(mapMarkup, />LinkedIn Groups</);
  assert.match(mapMarkup, />Company Pages</);
  assert.doesNotMatch(mapMarkup, /one_stop_social|reddit_atom/);
});

test("the central engine reads as one compact network-map hub", () => {
  assert.match(mapMarkup, /<svg class="map-network-lines" viewBox="0 0 1400 600"/);
  assert.equal((mapMarkup.match(/<path d="M265/g) || []).length, 6);
  assert.match(mapMarkup, /class="map-network-output"/);
  assert.match(mapMarkup, /class="map-engine-hub"/);
  for (const stage of ["Collect", "Filter", "Score", "Enrich", "Surface"]) assert.match(mapMarkup, new RegExp(`>${stage}<`));
  assert.match(mapMarkup, />Noise filtered</);
});

test("the destination shell is honest while protected data loads", () => {
  for (const slot of ["data-map-total", "data-map-hot", "data-map-warm", "data-map-producing"]) assert.match(mapMarkup, new RegExp(slot));
  assert.match(mapMarkup, />surfaced leads</);
  assert.doesNotMatch(mapMarkup, /LATEST OPPORTUNITIES|Waiting for live opportunity data/);
  assert.doesNotMatch(mapMarkup, /\b(?:186|1426|23 monitored|92)\b/i);
});

test("the map removes redundant perspectives and keeps state ephemeral", () => {
  assert.doesNotMatch(mapMarkup, /data-map-layer|map-layer-control/);
  assert.match(script, /const mapState=\{/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|service_role|runner_secret/i);
});

test("the map shell reflows for tablet and mobile and keeps reduced-motion support", () => {
  assert.match(styles, /grid-template-columns:\s*270px minmax\(340px, 1fr\) 250px/);
  assert.match(styles, /height:\s*clamp\(470px, calc\(100dvh - 220px\), 650px\)/);
  assert.match(styles, /@media \(max-width: 1100px\)/);
  assert.match(styles, /@media \(max-width: 680px\)/);
  assert.match(styles, /grid-template:\s*repeat\(3, 62px\) \/ repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /shimmer/i);
});
