import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const nav = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../src/components/territory-map-page.tsx", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../src/app/map/page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10919-territory-map.css", import.meta.url), "utf8");
const geometry = fs.readFileSync(new URL("../src/lib/compass/service-area-map.ts", import.meta.url), "utf8");

async function runtime() {
  return transpileTestModule("../src/lib/compass/territory-map.ts", import.meta.url, { prefix: "territory-map" });
}

test("Client Compass 1.0.9.21 keeps Map above managed segments in primary navigation", () => {
  assert.equal(pkg.version, "1.0.9.21");
  assert.match(nav, /href="\/map\/"/);
  assert.match(nav, /RailIcon name="map"/);
  assert.ok(nav.indexOf('href="/map/"') < nav.indexOf('href="/segments/"'));
  assert.match(route, /TerritoryMapPage/);
});

test("territory map uses accurate local state outlines and territory markers instead of invented region cuts", () => {
  assert.match(page, /SERVICE_STATE_GEOMETRIES/);
  assert.match(page, /territory-regional-map/);
  assert.match(page, /territory-map-marker/);
  assert.match(page, /territory-donut-slice/);
  assert.match(page, />Value<\/button>/);
  assert.match(page, />Clients in need<\/button>/);
  assert.match(page, /Replace now/);
  assert.match(page, /Plan soon/);
  assert.match(page, /Healthy/);
  for (const state of ["WI", "MI", "IL", "IN", "OH", "KY", "TN", "AL", "GA", "FL"]) assert.match(geometry, new RegExp(`\\b${state}: \\{ path:`));
  assert.doesNotMatch(page, /STATE_GEOMETRIES|territoryRegions|splitVertical|splitHorizontal|territory-map-region/);
  assert.doesNotMatch(page, /\bfetch\s*\(/);
  assert.doesNotMatch(page, /https?:\/\//);
  assert.match(css, /territory-map-state-outline/);
  assert.match(css, /territory-map-marker\.is-active/);
  assert.match(css, /territory-donut-slice\.is-active/);
});

test("every territory can open a compact client repair list and persist corrections", () => {
  assert.match(page, /TerritoryEditor/);
  assert.match(page, /Click any territory marker to review and correct its client list/);
  assert.match(page, /Fix territory records/);
  assert.match(page, /Review territory clients/);
  assert.match(page, /Apply one territory to this list/);
  assert.match(page, /Save territory changes/);
  assert.match(page, /saveCompassDataset\(next\)/);
  assert.match(page, /client\.state = draft\.state\.trim\(\)\.toUpperCase\(\)/);
  assert.match(page, /client\.market = normalizedTerritory/);
  assert.match(css, /territory-editor-backdrop/);
  assert.match(css, /territory-editor-row/);
});

test("territory aggregation uses client Territory values rather than whole-state buckets", async () => {
  const { buildTerritoryMapSnapshot } = await runtime();
  const dataset = {
    clients: [
      { id: "a", name: "A Dental", state: "FL", market: "FL - Central East" },
      { id: "b", name: "B Dental", state: "FL", market: "FL - Central West" },
      { id: "c", name: "C Dental", state: "FL", market: "FL - Central East" },
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

test("invalid and blank territory values are consolidated into a state-qualified Needs review list", async () => {
  const { buildTerritoryMapSnapshot } = await runtime();
  const dataset = {
    clients: [
      { id: "ga", name: "Georgia Client", state: "GA", market: "GA - Central" },
      { id: "bad", name: "Bad Georgia Label", state: "GA", market: "Advantage Technologies" },
      { id: "blank", name: "Blank Georgia Label", state: "GA", market: "" },
      { id: "al", name: "Alabama Client", state: "AL", market: "AL - Central" },
      { id: "tn", name: "Tennessee Client", state: "TN", market: "TN" },
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
  assert.ok(snapshot.territories.some((territory) => territory.id.startsWith("GA|") && territory.name === "GA - Central"));
  assert.ok(snapshot.territories.some((territory) => territory.id.startsWith("AL|") && territory.name === "AL - Central"));
  assert.ok(snapshot.territories.some((territory) => territory.id.startsWith("TN|") && territory.name === "TN"));
  const review = snapshot.territories.find((territory) => territory.name === "GA - Needs review");
  assert.equal(review?.unassigned, true);
  assert.equal(review?.clientCount, 2);
});
