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
const currentCss = fs.readFileSync(new URL("../src/app/v10926-polish.css", import.meta.url), "utf8");
const groupBridge = fs.readFileSync(new URL("../src/components/map-selection-group-bridge.tsx", import.meta.url), "utf8");
const geometry = fs.readFileSync(new URL("../src/lib/compass/service-area-map.ts", import.meta.url), "utf8");

async function runtime() {
  return transpileTestModule("../src/lib/compass/territory-map.ts", import.meta.url, { prefix: "territory-map" });
}

test("Client Compass 1.0.9.29 keeps Map above managed segments in primary navigation", () => {
  assert.equal(pkg.version, "1.0.9.29");
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
  assert.match(page, /splitAt: 451/);
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

test("intentional TC state groups illuminate together and the donut shares those groups", () => {
  assert.match(groupBridge, /\["TN", "KY", "AL"\]/);
  assert.match(groupBridge, /\["IN", "OH"\]/);
  assert.match(groupBridge, /geographicGroupForState/);
  assert.match(groupBridge, /lastExactRegionRef\.current === key/);
  assert.match(groupBridge, /states: group/);
  assert.match(page, /statesShareSelectionGroup/);
  assert.match(page, /focusSelectionGroup/);
  assert.match(currentCss, /territory-donut\.has-active/);
});

test("split-state clicks focus the whole state first and drill into the selected section next", () => {
  assert.match(page, /if \(pinnedState !== region\.state\)/);
  assert.match(page, /setPinnedState\(region\.state\)/);
  assert.match(page, /setPinnedRegionId\(""\)/);
  assert.match(page, /setPinnedRegionId\(region\.id\)/);
  assert.doesNotMatch(page, /territory-map-hint/);
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

test("map need criteria supports value server and server-plus-workstation qualification", () => {
  assert.match(page, /needBasis === "value"/);
  assert.match(page, /needBasis === "server"/);
  assert.match(page, /needBasis === "server-workstations"/);
  assert.match(page, /Server \+ 5\+ workstations/);
  assert.match(page, /Srv \+ 5 WS/);
  assert.match(currentCss, /territory-map-settings-basis/);
});

test("map client review is a compact sortable list with the shared Open and Report actions", () => {
  assert.match(page, /MapClientList/);
  assert.match(page, /territory-client-review-head/);
  assert.match(page, /sortButton\("health", "Need"\)/);
  assert.match(page, /sortButton\("review", "Last review"\)/);
  assert.match(page, /sortButton\("value", "Value"\)/);
  assert.match(page, /buildSegmentClientMetrics/);
  assert.match(page, /formatDate\(metrics\.lastAccountReview\)/);
  assert.match(page, /compactMoney\(metrics\.estimatedValue\)/);
  assert.match(page, /territory-client-review-actions/);
  assert.match(page, />Report<\/Link>/);
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
      { clientId: "a", lifecycle: "replace-now", isVirtual: false, deviceType: "physical-workstation" },
      { clientId: "b", lifecycle: "plan-soon", isVirtual: false, deviceType: "physical-workstation" },
      { clientId: "c", lifecycle: "current", isVirtual: false, deviceType: "physical-workstation" },
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
      { clientId: "a", lifecycle: "replace-now", isVirtual: false, deviceType: "physical-workstation" },
      { clientId: "b", lifecycle: "plan-soon", isVirtual: false, deviceType: "physical-workstation" },
    ],
    findings: [],
    summaries: [
      { clientId: "a", totalEstimatedValue: 50000, opportunities: [] },
      { clientId: "b", totalEstimatedValue: 10000, opportunities: [] },
    ],
  };
  const snapshot = buildTerritoryMapSnapshot(dataset, { includeReplaceNow: true, includePlanSoon: false, minimumEstimatedValue: 20000, valueFollowsNeed: true, needBasis: "value" });
  assert.equal(snapshot.totals.clients, 2);
  assert.equal(snapshot.totals.clientsInNeed, 1);
  assert.equal(snapshot.totals.estimatedValue, 50000);
});

test("server and workstation map criteria use project/server signals and five-workstation size", async () => {
  const { buildTerritoryMapSnapshot } = await runtime();
  const workstationDevices = Array.from({ length: 5 }, (_, index) => ({ clientId: "ws", lifecycle: "plan-soon", isVirtual: false, deviceType: "physical-workstation", id: `ws-${index}` }));
  const dataset = {
    clients: [
      { id: "server", name: "Server Client", city: "Columbus", state: "OH", market: "OH" },
      { id: "ws", name: "Workstation Client", city: "Indianapolis", state: "IN", market: "IN" },
      { id: "small", name: "Small Client", city: "Madison", state: "WI", market: "WI" },
    ],
    devices: [
      { clientId: "server", lifecycle: "replace-now", isVirtual: false, deviceType: "physical-server", id: "server-1" },
      ...workstationDevices,
      { clientId: "small", lifecycle: "plan-soon", isVirtual: false, deviceType: "physical-workstation", id: "small-1" },
    ],
    findings: [],
    summaries: [
      { clientId: "server", totalEstimatedValue: 30000, opportunities: [{ cardCategory: "critical-server", estimatedValue: 30000 }] },
      { clientId: "ws", totalEstimatedValue: 15000, opportunities: [] },
      { clientId: "small", totalEstimatedValue: 5000, opportunities: [] },
    ],
  };
  const serverOnly = buildTerritoryMapSnapshot(dataset, { includeReplaceNow: true, includePlanSoon: true, minimumEstimatedValue: 0, valueFollowsNeed: false, needBasis: "server" });
  assert.equal(serverOnly.totals.clientsInNeed, 1);
  const serverAndWs = buildTerritoryMapSnapshot(dataset, { includeReplaceNow: true, includePlanSoon: true, minimumEstimatedValue: 0, valueFollowsNeed: false, needBasis: "server-workstations" });
  assert.equal(serverAndWs.totals.clientsInNeed, 2);
});
