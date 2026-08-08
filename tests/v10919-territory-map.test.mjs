import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const nav = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../src/components/territory-map-page.tsx", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../src/app/map/page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10919-territory-map.css", import.meta.url), "utf8");

async function runtime() {
  return transpileTestModule("../src/lib/compass/territory-map.ts", import.meta.url, { prefix: "territory-map" });
}

test("Client Compass 1.0.9.19 adds Map above managed segments in primary navigation", () => {
  assert.equal(pkg.version, "1.0.9.19");
  assert.match(nav, /href="\/map\/"/);
  assert.match(nav, /RailIcon name="map"/);
  assert.ok(nav.indexOf('href="/map/"') < nav.indexOf("Segment Manager"));
  assert.match(route, /TerritoryMapPage/);
});

test("territory map stays consolidated, local, and synchronized with donut health detail", () => {
  assert.match(page, /STATE_TILE_POSITIONS/);
  assert.match(page, /territory-service-grid/);
  assert.match(page, /territory-map-marker/);
  assert.match(page, /territory-donut-slice/);
  assert.match(page, />Value<\/button>/);
  assert.match(page, />Clients in need<\/button>/);
  assert.match(page, /Replace now/);
  assert.match(page, /Plan soon/);
  assert.match(page, /Healthy/);
  assert.doesNotMatch(page, /\bfetch\s*\(/);
  assert.doesNotMatch(page, /https?:\/\//);
  assert.match(css, /territory-map-layout/);
  assert.match(css, /territory-state-tile/);
  assert.match(css, /territory-donut-slice\.is-active/);
  assert.doesNotMatch(page, /<table/);
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
