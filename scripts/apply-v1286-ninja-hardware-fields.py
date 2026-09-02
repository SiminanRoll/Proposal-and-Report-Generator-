from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing expected snippet in {path}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1))


# Version
replace_once("package.json", '"version": "1.2.85"', '"version": "1.2.86"')
replace_once("src/lib/app-version.ts", '1.2.85', '1.2.86')

# Ninja header aliases. Preserve useful factual fields that are present in the current
# Ninja master export instead of dropping them before Client Compass sees the row.
path = Path("src/lib/compass/headers.ts")
text = path.read_text()
replace_map = {
    '  videoCard: ["Video Card", "Graphics Card", "Display Adapter"],': '  processor: ["Processor", "CPU", "Processor Name", "CPU Model"],\n  videoCard: ["Video Card", "Graphics Card", "Display Adapter"],',
    '  warrantyEnd: ["Warranty End Date_formatted", "Warranty End Date", "Warranty Expiration", "Warranty Expiry"],': '  warrantyEnd: ["Warranty End Date_formatted", "Warranty Expiration Date_formatted", "Warranty End Date", "Warranty Expiration Date", "Warranty Expiration", "Warranty Expiry"],',
    '  deviceModel: ["Device Model", "System Model", "Computer Model", "Model"],': '  sourceDeviceType: ["Device Type", "Ninja Device Type", "Asset Type"],\n  deviceModel: ["Device Model", "System Model", "Computer Model", "Model"],\n  purchaseDate: ["Purchase Date", "Purchased Date", "Acquisition Date"],',
}
for old, new in replace_map.items():
    if old not in text:
        raise SystemExit(f"missing expected headers snippet: {old}")
    text = text.replace(old, new, 1)
path.write_text(text)

# Parser rows.
path = Path("src/lib/compass/import.ts")
text = path.read_text()
old = '''        lastUptime: cell(row, headerMap.lastUptime),
        videoCard: cell(row, headerMap.videoCard),
        warrantyStart: cell(row, headerMap.warrantyStart),'''
new = '''        lastUptime: cell(row, headerMap.lastUptime),
        processor: cell(row, headerMap.processor),
        videoCard: cell(row, headerMap.videoCard),
        warrantyStart: cell(row, headerMap.warrantyStart),'''
if old not in text:
    raise SystemExit("parser processor insertion point not found")
text = text.replace(old, new, 1)
old = '''        diskVolumeUsage: cell(row, headerMap.diskVolumeUsage),
        deviceModel: cell(row, headerMap.deviceModel),
      };'''
new = '''        diskVolumeUsage: cell(row, headerMap.diskVolumeUsage),
        sourceDeviceType: cell(row, headerMap.sourceDeviceType),
        deviceModel: cell(row, headerMap.deviceModel),
        purchaseDate: cell(row, headerMap.purchaseDate),
      };'''
if old not in text:
    raise SystemExit("parser source type/purchase insertion point not found")
text = text.replace(old, new, 1)
path.write_text(text)

# Types. Raw rows always expose strings; committed device fields are optional for backward
# compatibility with existing browser-local snapshots created before v1.2.86.
path = Path("src/lib/compass/types.ts")
text = path.read_text()
old = '''  stableId: string;
  lastUptime: string;
  videoCard: string;
  warrantyStart: string;'''
new = '''  stableId: string;
  lastUptime: string;
  processor: string;
  videoCard: string;
  warrantyStart: string;'''
if old not in text:
    raise SystemExit("RawCompassRow processor insertion point not found")
text = text.replace(old, new, 1)
old = '''  deviceStatus: string;
  diskVolumeUsage: string;
  deviceModel: string;
}'''
new = '''  deviceStatus: string;
  diskVolumeUsage: string;
  sourceDeviceType: string;
  deviceModel: string;
  purchaseDate: string;
}'''
if old not in text:
    raise SystemExit("RawCompassRow additional fields insertion point not found")
text = text.replace(old, new, 1)
old = '''  model: string;
  videoCard: string;
  osName: string;
  status: string;
  memoryGiB: number | null;'''
new = '''  model: string;
  processor?: string;
  videoCard: string;
  osName: string;
  status: string;
  memoryGiB: number | null;
  sourceDeviceType?: string;
  purchaseDate?: string;'''
if old not in text:
    raise SystemExit("CompassDevice hardware insertion point not found")
text = text.replace(old, new, 1)
path.write_text(text)

# Engine: prefer richer rows, fill missing facts from a compatible duplicate, and commit
# the new Ninja fields into the factual device snapshot.
path = Path("src/lib/compass/engine.ts")
text = path.read_text()
old = '''function rawRowCompleteness(row: RawCompassRow): number {
  return [row.stableId, row.location, row.lastUptime, row.videoCard, row.warrantyStart, row.warrantyEnd, row.lastLogin, row.memoryGiB, row.osName, row.deviceStatus, row.diskVolumeUsage, row.deviceModel].filter((value) => clean(value)).length;
}'''
new = '''function rawRowCompleteness(row: RawCompassRow): number {
  return [row.stableId, row.location, row.lastUptime, row.processor, row.videoCard, row.warrantyStart, row.warrantyEnd, row.lastLogin, row.memoryGiB, row.osName, row.deviceStatus, row.diskVolumeUsage, row.sourceDeviceType, row.deviceModel, row.purchaseDate].filter((value) => clean(value)).length;
}'''
if old not in text:
    raise SystemExit("rawRowCompleteness not found")
text = text.replace(old, new, 1)
old = '''function mergeCompatibleRawRows(first: RawCompassRow, second: RawCompassRow): RawCompassRow {
  const preferred = preferredRawRow(first, second);
  return { ...preferred, stableId: clean(first.stableId) || clean(second.stableId) };
}'''
new = '''function mergeCompatibleRawRows(first: RawCompassRow, second: RawCompassRow): RawCompassRow {
  const preferred = preferredRawRow(first, second);
  const alternate = preferred === first ? second : first;
  return {
    ...preferred,
    stableId: clean(preferred.stableId) || clean(alternate.stableId),
    location: clean(preferred.location) || clean(alternate.location),
    lastUptime: clean(preferred.lastUptime) || clean(alternate.lastUptime),
    processor: clean(preferred.processor) || clean(alternate.processor),
    videoCard: clean(preferred.videoCard) || clean(alternate.videoCard),
    warrantyStart: clean(preferred.warrantyStart) || clean(alternate.warrantyStart),
    warrantyEnd: clean(preferred.warrantyEnd) || clean(alternate.warrantyEnd),
    lastLogin: clean(preferred.lastLogin) || clean(alternate.lastLogin),
    memoryGiB: clean(preferred.memoryGiB) || clean(alternate.memoryGiB),
    osName: clean(preferred.osName) || clean(alternate.osName),
    deviceStatus: clean(preferred.deviceStatus) || clean(alternate.deviceStatus),
    diskVolumeUsage: clean(preferred.diskVolumeUsage) || clean(alternate.diskVolumeUsage),
    sourceDeviceType: clean(preferred.sourceDeviceType) || clean(alternate.sourceDeviceType),
    deviceModel: clean(preferred.deviceModel) || clean(alternate.deviceModel),
    purchaseDate: clean(preferred.purchaseDate) || clean(alternate.purchaseDate),
  };
}'''
if old not in text:
    raise SystemExit("mergeCompatibleRawRows not found")
text = text.replace(old, new, 1)
old = '''      virtualizationPlatform: classification.virtualizationPlatform,
      model: clean(row.deviceModel),
      videoCard: clean(row.videoCard),
      osName: clean(row.osName),'''
new = '''      virtualizationPlatform: classification.virtualizationPlatform,
      model: clean(row.deviceModel),
      processor: clean(row.processor),
      videoCard: clean(row.videoCard),
      osName: clean(row.osName),'''
if old not in text:
    raise SystemExit("device processor mapping insertion point not found")
text = text.replace(old, new, 1)
old = '''      status: clean(row.deviceStatus),
      memoryGiB: Number.isFinite(Number(row.memoryGiB)) ? Number(row.memoryGiB) : null,
      diskVolumeSource: clean(row.diskVolumeUsage),'''
new = '''      status: clean(row.deviceStatus),
      memoryGiB: Number.isFinite(Number(row.memoryGiB)) ? Number(row.memoryGiB) : null,
      sourceDeviceType: clean(row.sourceDeviceType),
      purchaseDate: isoDate(row.purchaseDate),
      diskVolumeSource: clean(row.diskVolumeUsage),'''
if old not in text:
    raise SystemExit("device source type/purchase mapping insertion point not found")
text = text.replace(old, new, 1)
path.write_text(text)

# Report bridge: stop deliberately blanking CPU. Prefer Ninja's actual purchase date for
# the Purchased field, but keep the established warranty-start fallback for old data.
path = Path("src/lib/compass/generator-bridge.ts")
text = path.read_text()
old = '''    age: technicalAgeYears(device.warrantyStart, now) ?? 0,
    purchased: dateOnly(device.warrantyStart),
    warrantyExpires: dateOnly(device.warrantyEnd),
    ram: device.memoryGiB === null ? "" : `${device.memoryGiB} GB`,
    cpu: "",'''
new = '''    age: technicalAgeYears(device.warrantyStart, now) ?? 0,
    purchased: dateOnly(device.purchaseDate || device.warrantyStart),
    warrantyExpires: dateOnly(device.warrantyEnd),
    ram: device.memoryGiB === null ? "" : `${device.memoryGiB} GB`,
    cpu: device.processor ?? "",'''
if old not in text:
    raise SystemExit("generator bridge CPU/purchase block not found")
text = text.replace(old, new, 1)
path.write_text(text)

# Focused regression coverage mirrors the headers observed in the supplied Ninja workbook.
Path("tests/v1286-ninja-hardware-fields.test.mjs").write_text(r'''import test from "node:test";
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
  assert.match(importer, /processor: cell\(row, headerMap\.processor\)/);
  assert.match(importer, /sourceDeviceType: cell\(row, headerMap\.sourceDeviceType\)/);
  assert.match(importer, /purchaseDate: cell\(row, headerMap\.purchaseDate\)/);
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
''')
