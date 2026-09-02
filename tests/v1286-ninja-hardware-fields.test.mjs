import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const headers = fs.readFileSync("src/lib/compass/headers.ts", "utf8");
const importer = fs.readFileSync("src/lib/compass/import.ts", "utf8");
const companyCorrection = fs.readFileSync("src/lib/compass/company-inventory-correction.ts", "utf8");
const types = fs.readFileSync("src/lib/compass/types.ts", "utf8");
const engine = fs.readFileSync("src/lib/compass/engine.ts", "utf8");
const bridge = fs.readFileSync("src/lib/compass/generator-bridge.ts", "utf8");
const pdfInventorySync = fs.readFileSync("src/lib/outcomes/pdf-inventory-sync.ts", "utf8");

test("Ninja hardware headers retain Processor Device Type Purchase Date and warranty expiration", () => {
  assert.match(headers, /processor:\s*\["Processors Name", "Processor", "CPU", "Processor Name", "CPU Model"\]/);
  assert.match(headers, /sourceDeviceType:\s*\["Device Type", "Ninja Device Type", "Asset Type"\]/);
  assert.match(headers, /purchaseDate:\s*\["Purchase Date", "Purchased Date", "Acquisition Date"\]/);
  assert.match(headers, /Warranty Expiration Date/);
});

test("Ninja master parser reads the supplied hardware fields into raw rows", () => {
  assert.match(importer, /processor: cell\(row, best\?\.map\.processor\)/);
  assert.match(importer, /sourceDeviceType: cell\(row, best\?\.map\.sourceDeviceType\)/);
  assert.match(importer, /purchaseDate: cell\(row, best\?\.map\.purchaseDate\)/);
  assert.match(types, /processor: string/);
  assert.match(types, /sourceDeviceType: string/);
  assert.match(types, /purchaseDate: string/);
});

test("company-level Ninja correction parser retains the same hardware fields", () => {
  assert.match(companyCorrection, /processor: cell\(row, best\?\.map\.processor\)/);
  assert.match(companyCorrection, /sourceDeviceType: cell\(row, best\?\.map\.sourceDeviceType\)/);
  assert.match(companyCorrection, /purchaseDate: cell\(row, best\?\.map\.purchaseDate\)/);
  assert.match(companyCorrection, /processor: device\.processor \?\? ""/);
  assert.match(companyCorrection, /sourceDeviceType: device\.sourceDeviceType \?\? ""/);
  assert.match(companyCorrection, /purchaseDate: device\.purchaseDate \?\? ""/);
});

test("committed Client Compass devices preserve Ninja hardware facts", () => {
  assert.match(engine, /processor: clean\(row\.processor\)/);
  assert.match(engine, /sourceDeviceType: clean\(row\.sourceDeviceType\)/);
  assert.match(engine, /purchaseDate: isoDate\(row\.purchaseDate\)/);
  assert.match(engine, /row\.processor/);
  assert.match(engine, /row\.sourceDeviceType/);
  assert.match(engine, /row\.purchaseDate/);
});

test("compatible duplicate Ninja rows fill missing hardware facts instead of dropping them", () => {
  assert.match(engine, /processor: clean\(preferred\.processor\) \|\| clean\(alternate\.processor\)/);
  assert.match(engine, /sourceDeviceType: clean\(preferred\.sourceDeviceType\) \|\| clean\(alternate\.sourceDeviceType\)/);
  assert.match(engine, /purchaseDate: clean\(preferred\.purchaseDate\) \|\| clean\(alternate\.purchaseDate\)/);
});

test("report bridge sends actual Ninja CPU graphics and purchase date", () => {
  assert.match(bridge, /cpu: device\.processor \?\? ""/);
  assert.match(bridge, /graphics: device\.graphics \?\? ""/);
  assert.match(bridge, /purchased: dateOnly\(device\.purchaseDate \|\| device\.warrantyStart\)/);
  assert.doesNotMatch(bridge, /cpu: ""/);
});

test("PDF inventory renders compact CPU and GPU columns from the retained hardware data", () => {
  assert.ok(pdfInventorySync.includes('function compactCpuValue(value: string): string'));
  assert.ok(pdfInventorySync.includes('function compactGpuValue(value: string): string'));
  assert.ok(pdfInventorySync.includes('const cpu = compactCpuValue(rowAttribute(row, "cpu"));'));
  assert.ok(pdfInventorySync.includes('const gpu = compactGpuValue(textOnly(cells[3]));'));
  assert.ok(pdfInventorySync.includes('<span>CPU</span><span>GPU</span><span>Memory</span><span>Storage</span><span>Needs attention</span>'));
  assert.ok(pdfInventorySync.includes('NVIDIA\\s+GeForce'));
  assert.ok(pdfInventorySync.includes('Intel\\s+Core'));
});
