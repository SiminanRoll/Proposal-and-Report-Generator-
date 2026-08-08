import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const nav = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../src/components/territory-map-page.tsx", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../src/app/map/page.tsx", import.meta.url), "utf8");
const baseCss = fs.readFileSync(new URL("../src/app/v10919-territory-map.css", import.meta.url), "utf8");
const polishCss = fs.readFileSync(new URL("../src/app/v10922-territory-map-polish.css", import.meta.url), "utf8");
const geometry = fs.readFileSync(new URL("../src/lib/compass/service-area-map.ts", import.meta.url), "utf8");

async function runtime() {
  return transpileTestModule("../src/lib/compass/territory-map.ts", import.meta.url, { prefix: "territory-map" });
}

test("Client Compass 1.0.9.22 keeps Map above managed segments in primary navigation", () => {
  assert.equal(pkg.version, "1.0.9.22");
  assert.match(nav, /href="\/map\/"/);
  assert.match(nav, /RailIcon name="map"/);
  assert.ok(nav.indexOf('href="/map/"') < nav.indexOf('href="/segments/"'));
  assert.match(route, /TerritoryMapPage/);
});

test("territory map keeps accurate local outlines but uses compact labels and a dark visual stage", () => {
  assert.match(page, /SERVICE_STATE_GEOMETRIES/);
  assert.match(page, /territory-regional-map/);
  assert.match(page, /territory-map-marker-dot/);
  assert.match(page, /territory-donut-slice/);
  assert.match(page, />Clients<\/button>/);
  assert.match(page, />Need<\/button>/);
  assert.match(page, />Value<\/button>/);
  assert.match(page, /Map criteria settings/);
  assert.match(page, /territory-map-zoom/);
  assert.match(page, /Click once to focus/);
  for (const state of ["WI", "MI", "IL", "IN", "OH", "KY", "TN", "AL", "GA", "FL"]) assert.match(geometry, new RegExp(`\\b${state}: \\{ path:`));
  assert.doesNotMatch(page, /const STATE_GEOMETRIES|territoryRegions|splitVertical|splitHorizontal|territory-map-region/);
  assert.doesNotMatch(page, /\bfetch\s*\(/);
  assert.doesNotMatch(page, /https?:\/\//);
  assert.match(baseCss, /territory-map-state-outline/);
  assert.match(polishCss, /#0d1c2b/);
  assert.match(polishCss, /territory-map-marker-halo/);
  assert.match(polishCss, /territory-map-settings/);
});

test("map editing is secondary to selection and can still persist state or territory corrections", () => {
  assert.match(page, /MapClientEditor/);
  assert.match(page, /Click the same state or territory again for actions/);
  assert.match(page, /Review client records/);
  assert.match(page, /Apply one territory to this list/);
  assert.match(page, /Save changes/);
  assert.match(page, /saveCompassDataset\(next\)/);
  assert.match(page, /client\.state = draft\.state\.trim\(\)\.toUpperCase\(\)/);
  assert.match(page, /client\.market = normalizedTerritory/);
  assert.match(baseCss, /territory-editor-backdrop/);
  assert.match(baseCss, /territory-editor-row/);
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
  assert.equal(east.shortName, "FL CE");
  assert.equal(west.shortName, "FL CW");
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
  assert.equal(georgia.inferredClientCount, 2);
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
