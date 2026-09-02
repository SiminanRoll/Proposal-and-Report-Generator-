import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const headers = fs.readFileSync("src/lib/compass/headers.ts", "utf8");
const importer = fs.readFileSync("src/lib/compass/import.ts", "utf8");
const types = fs.readFileSync("src/lib/compass/types.ts", "utf8");
const engine = fs.readFileSync("src/lib/compass/engine.ts", "utf8");
const bridge = fs.readFileSync("src/lib/compass/generator-bridge.ts", "utf8");

test("Ninja hardware headers retain Processor Device Type Purchase Date and warranty expiration", () => {
  assert.match(headers, /processor:\s*\["Processor", "CPU", "Processor Name", "CPU Model"\]/);
  assert.match(headers, /sourceDeviceType:\s*\["Device Type", "Ninja Device Type", "Asset Type"\]/);
  assert.match(headers, /purchaseDate:\s*\["Purchase Date", "Purchased Date", "Acquisition Date"\]/);
  assert.match(headers, /Warranty Expiration Date/);
});

test("Ninja parser reads the supplied hardware fields into raw rows", () => {
  assert.match(importer, /processor: cell\(row, best\?\.map\.processor\)/);
  assert.match(importer, /sourceDeviceType: cell\(row, best\?\.map\.sourceDeviceType\)/);
  assert.match(importer, /purchaseDate: cell\(row, best\?\.map\.purchaseDate\)/);
  assert.match(types, /processor: string/);
  assert.match(types, /sourceDeviceType: string/);
  assert.match(types, /purchaseDate: string/);
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

test("report bridge sends actual Ninja CPU and purchase date", () => {
  assert.match(bridge, /cpu: device\.processor \?\? ""/);
  assert.match(bridge, /purchased: dateOnly\(device\.purchaseDate \|\| device\.warrantyStart\)/);
  assert.doesNotMatch(bridge, /cpu: ""/);
});

test("Ninja hardware parser release is v1.2.86", () => {
  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\.2\.86"/);
  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\.2\.86/);
});
