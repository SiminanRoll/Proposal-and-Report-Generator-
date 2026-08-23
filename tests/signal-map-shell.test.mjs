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
  assert.match(mapMarkup, />Adv-Tech Company Page Engagement</);
  assert.doesNotMatch(mapMarkup, /one_stop_social|reddit_atom/);
});

test("the central engine is a responsive, labeled SVG flow", () => {
  assert.match(mapMarkup, /<svg class="map-engine-svg map-engine-svg-desktop" viewBox="0 0 760 430" preserveAspectRatio="xMidYMid meet"/);
  assert.match(mapMarkup, /<svg class="map-engine-svg map-engine-svg-mobile" viewBox="0 0 320 700" preserveAspectRatio="xMidYMid meet"/);
  for (const id of ["source-connectors", "flow-paths", "engine", "particles", "labels", "interaction-hitboxes"]) {
    assert.match(mapMarkup, new RegExp(`id="${id}"`));
  }
  const stages = [...mapMarkup.matchAll(/data-stage="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(stages, ["collect", "filter", "score", "enrich", "surface"]);
  const mobileStages = [...mapMarkup.matchAll(/data-mobile-stage="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(mobileStages, stages);
  assert.match(mapMarkup, /NOISE \/ SUPPRESSED/);
  assert.match(mapMarkup, /Removed before sales/);
});

test("the destination shell is honest while protected data loads", () => {
  for (const label of ["SURFACED", "HOT", "WARM", "PRODUCING SOURCES", "LATEST OPPORTUNITIES"]) {
    assert.match(mapMarkup, new RegExp(label));
  }
  assert.match(mapMarkup, /Waiting for live opportunity data/);
  assert.match(mapMarkup, /<b>—<\/b>/);
  assert.doesNotMatch(mapMarkup, /\b(?:186|1426|23 monitored|92)\b/i);
});

test("visual perspectives are state-driven without storing or inventing data", () => {
  for (const layer of ["overview", "social", "structured", "scoring", "opportunities"]) {
    assert.match(mapMarkup, new RegExp(`data-map-layer="${layer}"`));
  }
  assert.match(script, /const mapState=\{/);
  assert.match(script, /selectedSource:null/);
  assert.match(script, /selectedStage:null/);
  assert.match(script, /selectedOpportunity:null/);
  assert.match(script, /setAttribute\('aria-pressed',String\(active\)\)/);
  assert.match(script, /new CustomEvent\('signal-map:layer'/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|service_role|runner_secret/i);
});

test("the map shell reflows for tablet and mobile and keeps reduced-motion support", () => {
  assert.match(styles, /grid-template-columns:\s*280px minmax\(490px, 1fr\) 310px/);
  assert.match(styles, /@media \(max-width: 1180px\)/);
  assert.match(styles, /@media \(max-width: 680px\)/);
  assert.match(styles, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /shimmer/i);
});
