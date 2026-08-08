import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const nav = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../src/components/territory-map-page.tsx", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../src/app/map/page.tsx", import.meta.url), "utf8");
const baseCss = fs.readFileSync(new URL("../src/app/v10919-territory-map.css", import.meta.url), "utf8");
const refineCss = fs.readFileSync(new URL("../src/app/v10923-territory-map-refine.css", import.meta.url), "utf8");
const polishCss = fs.readFileSync(new URL("../src/app/v10924-polish.css", import.meta.url), "utf8");
const geometry = fs.readFileSync(new URL("../src/lib/compass/service-area-map.ts", import.meta.url), "utf8");

async function runtime() {
  return transpileTestModule("../src/lib/compass/territory-map.ts", import.meta.url, { prefix: "territory-map" });
}

test("Client Compass 1.0.9.24 keeps Map above managed segments in primary navigation", () => {
  assert.equal(pkg.version, "1.0.9.24");
  assert.match(nav, /href="\/map\/"/);
  assert.match(nav, /RailIcon name="map"/);
  assert.ok(nav.indexOf('href="/map/"') < nav.indexOf('href="/segments/"'));
  assert.match(route, /TerritoryMapPage/);
});

test("territory map uses accurate state outlines with simple clipped territory sections", () => {
  assert.match(page, /SERVICE_STATE_GEOMETRIES/);
  assert.match(page, /territory-map-region-fill/);
  assert.match(page, /territory-map-split-line/);
  assert.match(page, /clipPath id=\{`territory-clip-/);
  assert.match(page, /FL N/);
  assert.match(page, /FL C/);
  assert.match(page, /FL S/);
  assert.match(page, /IL N/);
  assert.match(page, /IL S/);
  assert.match(page, /MI W/);
  assert.match(page, /MI E/);
  assert.doesNotMatch(page, /territory-map-marker-dot|territory-map-marker-halo/);
  for (const state of ["WI", "MI", "IL", "IN", "OH", "KY", "TN", "AL", "GA", "FL"]) assert.match(geometry, new RegExp(`\\b${state}: \\{ path:`));
  assert.doesNotMatch(page, /\bfetch\s*\(/);
  assert.doesNotMatch(page, /https?:\/\//);
  assert.match(baseCss, /territory-map-state-outline/);
  assert.match(refineCss, /backdrop-filter:blur\(18px\)/);
  assert.match(refineCss, /territory-map-region-fill/);
});

test("single-state and split-state hit testing is limited to the painted clipped geometry", () => {
  assert.match(polishCss, /\.territory-map-region\{[^}]*pointer-events:none/s);
  assert.match(polishCss, /\.territory-map-region-fill\{[^}]*pointer-events:visiblePainted/s);
  assert.match(polishCss, /\.territory-map-state-base\{[^}]*pointer-events:none/s);
  assert.match(polishCss, /\.territory-map-region-label\{[^}]*pointer-events:none/s);
  assert.match(polishCss, /\.territory-map-state-outline\{[^}]*pointer-events:none/s);
  assert.match(polishCss, /\.territory-map-split-line\{[^}]*pointer-events:none/s);
  for (const state of ["IN", "OH", "KY", "TN"]) assert.match(page, new RegExp(`\\b${state}: \\\"#`));
});

test("split-state clicks focus the whole state first and drill into the selected section next", () => {
  assert.match(page, /if \(pinnedState !== region\.state\)/);
  assert.match(page, /setPinnedState\(region\.state\)/);
  assert.match(page, /setPinnedRegionId\(""\)/);
  assert.match(page, /setPinnedRegionId\(region\.id\)/);
  assert.match(page, /Click once for the state\. Click a section again to drill in\. Click empty map space to clear\./);
});

test("pie selection glows without a browser focus box and supports Clients Need and Value modes", () => {
  assert.match(page, />Clients<\/button>/);
  assert.match(page, />Need<\/button>/);
  assert.match(page, />Value<\/button>/);
  assert.match(page, /Map criteria settings/);
  assert.match(refineCss, /territory-donut-slice:focus/);
  assert.match(refineCss, /outline:none!important/);
  assert.match(refineCss, /drop-shadow\(0 0 8px/);
});

test("map client review is a compact sortable list instead of inline territory editing", () => {
  assert.match(page, /MapClientList/);
  assert.match(page, /territory-client-review-head/);
  assert.match(page, /sortButton\("health", "Need"\)/);
  assert.match(page, /sortButton\("review", "Last review"\)/);
  assert.match(page, /sortButton\("value", "Value"\)/);
  assert.match(page, /buildSegmentClientMetrics/);
  assert.match(page, /formatDate\(metrics\.lastAccountReview\)/);
  assert.match(page, /compactMoney\(metrics\.estimatedValue\)/);
  assert.doesNotMatch(page, /Apply one territory to this list|Save changes|normalizedTerritory/);
  assert.match(refineCss, /territory-client-review-table/);
});

test("territory aggregation uses client Territory values rather than whole-state buckets", async () => {
  const { buildTerritoryMapSnapshot } = await runtime();
  const dataset = {
    clients: [
      { id: "a", name: "A Dental", city: "Orlando", state: "FL", market: "FL - Central East" },
      { id: "b", name: "B Dental", city: "Tampa", state: "FL", market: "FL - Central West" },
      { id: "c", name: "C Dental", city: "Orlando", state: "FL", market: "FL - Central East" },
    ],
    devices: [
      { clientId: "a", lifecycle: "replace-now", isVirtual: false },
      { clientId: "b", lifecycle: "plan-soon", isVirtual: false },
      { clientId: "c", lifecycle: "current", isVirtual: false },
    ],
    findings: [],
    summaries: [
      { clientId: "a", totalEstimatedValue: 40000, opportunities: [] },
      { clientId: "b", totalEstimatedValue: 25000, opportunities: [] },
      { clientId: "c", totalEstimatedValue: 0, opportunities: [] },
    ],
  };
  const snapshot = buildTerritoryMapSnapshot(dataset);
  assert.equal(snapshot.territories.length, 2);
  const east = snapshot.territories.find((territory) => territory.name === "FL - Central East");
  const west = snapshot.territories.find((territory) => territory.name === "FL - Central West");
  assert.ok(east);
  assert.ok(west);
  assert.equal(east.clientCount, 2);
  assert.equal(east.replaceNow, 1);
  assert.equal(east.healthy, 1);
  assert.equal(east.estimatedValue, 40000);
  assert.equal(west.planSoon, 1);
  assert.equal(snapshot.totals.clientsInNeed, 2);
  assert.equal(snapshot.totals.estimatedValue, 65000);
});

test("bad or blank labels are folded into normal territory groups instead of a Needs review category", async () => {
  const { buildTerritoryMapSnapshot } = await runtime();
  const dataset = {
    clients: [
      { id: "ga", name: "Georgia Client", city: "Atlanta", state: "GA", market: "GA - Central" },
      { id: "bad", name: "Bad Georgia Label", city: "Atlanta", state: "GA", market: "Advantage Technologies" },
      { id: "blank", name: "Blank Georgia Label", city: "Macon", state: "GA", market: "" },
      { id: "al", name: "Alabama Client", city: "Birmingham", state: "AL", market: "AL - Central" },
      { id: "tn", name: "Tennessee Client", city: "Nashville", state: "TN", market: "TN" },
    ],
    devices: [],
    findings: [],
    summaries: [
      { clientId: "ga", totalEstimatedValue: 10000, opportunities: [] },
      { clientId: "bad", totalEstimatedValue: 0, opportunities: [] },
      { clientId: "blank", totalEstimatedValue: 0, opportunities: [] },
      { clientId: "al", totalEstimatedValue: 12000, opportunities: [] },
      { clientId: "tn", totalEstimatedValue: 8000, opportunities: [] },
    ],
  };
  const snapshot = buildTerritoryMapSnapshot(dataset);
  assert.equal(snapshot.territories.some((territory) => /Needs review/i.test(territory.name)), false);
  const georgia = snapshot.territories.find((territory) => territory.name === "GA - Central");
  assert.ok(georgia);
  assert.equal(georgia.clientCount, 3);
  assert.equal(snapshot.totals.inferredClientCount, 2);
});

test("Need and Value criteria can be tuned without changing the client-base count", async () => {
  const { buildTerritoryMapSnapshot } = await runtime();
  const dataset = {
    clients: [
      { id: "a", name: "A", city: "Orlando", state: "FL", market: "FL - Central East" },
      { id: "b", name: "B", city: "Orlando", state: "FL", market: "FL - Central East" },
    ],
    devices: [
      { clientId: "a", lifecycle: "replace-now", isVirtual: false },
      { clientId: "b", lifecycle: "plan-soon", isVirtual: false },
    ],
    findings: [],
    summaries: [
      { clientId: "a", totalEstimatedValue: 50000, opportunities: [] },
      { clientId: "b", totalEstimatedValue: 10000, opportunities: [] },
    ],
  };
  const snapshot = buildTerritoryMapSnapshot(dataset, { includeReplaceNow: true, includePlanSoon: false, minimumEstimatedValue: 20000, valueFollowsNeed: true });
  assert.equal(snapshot.totals.clients, 2);
  assert.equal(snapshot.totals.clientsInNeed, 1);
  assert.equal(snapshot.totals.estimatedValue, 50000);
});
