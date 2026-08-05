import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadStoreWithFakeBrowser() {
  let ts;
  try { ts = await import("typescript"); }
  catch { ts = await import("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js"); }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "client-compass-store-"));
  const reactStub = path.join(directory, "react-stub.mjs");
  const configStub = path.join(directory, "config-stub.mjs");
  const storeModule = path.join(directory, "store.mjs");
  fs.writeFileSync(reactStub, "export const useCallback=(fn)=>fn; export const useEffect=()=>{}; export const useState=(value)=>[value,()=>{}];\n");
  fs.writeFileSync(configStub, "export const DEFAULT_COMPASS_CONFIG={score:{},value:{},thresholds:{}}; export const normalizeCompassConfig=(value)=>value || DEFAULT_COMPASS_CONFIG;\n");

  const source = fs.readFileSync(new URL("../src/lib/compass/store.ts", import.meta.url), "utf8");
  let output = ts.default.transpileModule(source, {
    compilerOptions: {
      target: ts.default.ScriptTarget.ES2022,
      module: ts.default.ModuleKind.ESNext,
      verbatimModuleSyntax: true,
    },
  }).outputText;
  output = output
    .replace('from "react"', `from ${JSON.stringify(pathToFileURL(reactStub).href)}`)
    .replace('from "./config"', `from ${JSON.stringify(pathToFileURL(configStub).href)}`);
  fs.writeFileSync(storeModule, output);

  const records = new Map();
  const stores = new Set();
  class FakeDatabase {
    objectStoreNames = { contains: (name) => stores.has(name) };
    onversionchange = null;
    createObjectStore(name) { stores.add(name); return {}; }
    close() {}
    transaction(storeName, mode) {
      assert.equal(storeName, "current-state");
      const transaction = { error: null, oncomplete: null, onerror: null, onabort: null, mode };
      transaction.objectStore = () => ({
        get(key) {
          const request = { result: undefined, error: null, onsuccess: null, onerror: null };
          queueMicrotask(() => { request.result = records.get(key); request.onsuccess?.(); });
          return request;
        },
        put(value, key) {
          records.set(key, value);
          queueMicrotask(() => transaction.oncomplete?.());
        },
      });
      return transaction;
    }
  }
  const database = new FakeDatabase();
  const indexedDB = {
    open(name, version) {
      assert.equal(name, "client-compass");
      assert.equal(version, 1);
      const request = { result: database, error: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };
      queueMicrotask(() => {
        if (!stores.has("current-state")) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
  const localValues = new Map();
  const localStorage = {
    getItem: (key) => localValues.get(key) ?? null,
    setItem: (key, value) => localValues.set(key, value),
    removeItem: (key) => localValues.delete(key),
  };
  const events = [];
  globalThis.window = { indexedDB, localStorage, dispatchEvent: (event) => events.push(event.type), addEventListener() {}, removeEventListener() {} };

  return {
    module: await import(`${pathToFileURL(storeModule).href}?v=${Date.now()}`),
    records,
    localValues,
    events,
  };
}

function largeDataset() {
  return {
    schemaVersion: 1,
    clients: [{ id: "client-1", name: "Large Dental Group" }],
    locations: [],
    devices: Array.from({ length: 10718 }, (_, index) => ({
      id: `device-${index}`,
      clientId: "client-1",
      name: `DEVICE-${index}`,
      osName: "Microsoft Windows 11 Pro",
      model: "Dell OptiPlex 7010",
      diskVolumes: [{ label: "C:", usedPercent: 62, state: "healthy" }],
    })),
    findings: [],
    summaries: [],
    importedAt: "2026-08-04T23:00:00.000Z",
    importSourceName: "NinjaOne.xlsx",
    importSummary: {},
  };
}

test("large first imports commit through IndexedDB and load back intact", async () => {
  const runtime = await loadStoreWithFakeBrowser();
  const dataset = largeDataset();
  await runtime.module.saveCompassDataset(dataset);
  const loaded = await runtime.module.loadCompassDataset();
  assert.equal(runtime.records.get("current-dataset").devices.length, 10718);
  assert.equal(loaded.devices.length, 10718);
  assert.equal(loaded.devices[10717].name, "DEVICE-10717");
  assert.deepEqual(runtime.events, ["client-compass-data-changed"]);
  assert.equal(runtime.localValues.has("client-compass.current-dataset.v1"), false);
});

test("configuration and recalculated snapshot publish as one browser-local update", async () => {
  const runtime = await loadStoreWithFakeBrowser();
  const dataset = { ...largeDataset(), calculationFingerprint: "cfg-test", calculatedAt: "2026-08-05T13:00:00.000Z" };
  const config = { score: { server2012First: 55 }, value: { standardServerReplacement: 50000 }, thresholds: { staleDeviceMonths: 6 }, cards: [] };
  await runtime.module.saveCompassConfigAndDataset(config, dataset);
  assert.equal(runtime.records.get("current-dataset").calculationFingerprint, "cfg-test");
  assert.deepEqual(JSON.parse(runtime.localValues.get("client-compass.configuration.v1")), config);
  assert.deepEqual(runtime.events, ["client-compass-data-changed"]);
});
