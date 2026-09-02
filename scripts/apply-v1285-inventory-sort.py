from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing expected snippet in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


replace_once("package.json", '"version": "1.2.84"', '"version": "1.2.85"')
replace_once("src/lib/app-version.ts", '1.2.84', '1.2.85')

path = Path("src/lib/outcomes/pdf-inventory-sync.ts")
text = path.read_text()

old_interface = '''interface InventoryDeviceCard {
  status: InventoryStatus;
  location: string;
  osConcern: boolean;
  fivePlus: boolean;
  ageToVerify: boolean;
  html: string;
}'''
new_interface = '''interface InventoryDeviceCard {
  status: InventoryStatus;
  location: string;
  osConcern: boolean;
  fivePlus: boolean;
  ageToVerify: boolean;
  ageYears: number | null;
  deviceName: string;
  html: string;
}'''
if old_interface not in text:
    raise SystemExit("InventoryDeviceCard shape not found")
text = text.replace(old_interface, new_interface, 1)

old_return = '''    osConcern,
    fivePlus,
    ageToVerify,
    html: `<article class="pdf-device-list-row ${rowTone}">'''
new_return = '''    osConcern,
    fivePlus,
    ageToVerify,
    ageYears,
    deviceName: device,
    html: `<article class="pdf-device-list-row ${rowTone}">'''
if old_return not in text:
    raise SystemExit("inventory return block not found")
text = text.replace(old_return, new_return, 1)

sort_helpers = '''function inventoryNeedRank(card: InventoryDeviceCard): number {
  // Known 5+ year systems are the clearest replacement-age priority and always lead.
  if (card.fivePlus) return 0;
  // Other red items, such as OS concerns or an explicit overdue lifecycle status, follow.
  if (card.osConcern || card.status === "overdue") return 1;
  // Yellow items remain above healthy systems.
  if (card.ageToVerify || card.status === "due-soon") return 2;
  return 3;
}

function sortedInventoryCards(cards: InventoryDeviceCard[]): InventoryDeviceCard[] {
  return cards.slice().sort((left, right) => {
    const needRank = inventoryNeedRank(left) - inventoryNeedRank(right);
    if (needRank !== 0) return needRank;
    const leftAge = left.ageYears ?? -1;
    const rightAge = right.ageYears ?? -1;
    if (leftAge !== rightAge) return rightAge - leftAge;
    return left.deviceName.localeCompare(right.deviceName, undefined, { sensitivity: "base" });
  });
}

'''
needle = 'function inventorySummary(cards: InventoryDeviceCard[]): string {'
if needle not in text:
    raise SystemExit("inventorySummary marker not found")
text = text.replace(needle, sort_helpers + needle, 1)

old_chunks = '''    const chunks: InventoryDeviceCard[][] = [];
    for (let index = 0; index < locationCards.length; index += pageSize) chunks.push(locationCards.slice(index, index + pageSize));
    const summary = inventorySummary(locationCards);'''
new_chunks = '''    const sortedCards = sortedInventoryCards(locationCards);
    const chunks: InventoryDeviceCard[][] = [];
    for (let index = 0; index < sortedCards.length; index += pageSize) chunks.push(sortedCards.slice(index, index + pageSize));
    const summary = inventorySummary(locationCards);'''
if old_chunks not in text:
    raise SystemExit("inventory chunking block not found")
text = text.replace(old_chunks, new_chunks, 1)

path.write_text(text)

Path("tests/v1285-inventory-sort.test.mjs").write_text('''import test from "node:test";\nimport assert from "node:assert/strict";\nimport fs from "node:fs";\n\nconst pdf = fs.readFileSync("src/lib/outcomes/pdf-inventory-sync.ts", "utf8");\n\ntest("location inventory sorts 5+ year red items first", () => {\n  assert.match(pdf, /if \(card\\.fivePlus\) return 0/);\n  assert.match(pdf, /if \(card\\.osConcern \\|\\| card\\.status === "overdue"\) return 1/);\n  assert.match(pdf, /if \(card\\.ageToVerify \\|\\| card\\.status === "due-soon"\) return 2/);\n});\n\ntest("each priority group sorts oldest known age first", () => {\n  assert.match(pdf, /const leftAge = left\\.ageYears \\?\\? -1/);\n  assert.match(pdf, /const rightAge = right\\.ageYears \\?\\? -1/);\n  assert.match(pdf, /return rightAge - leftAge/);\n});\n\ntest("sorting is applied before each location is paginated", () => {\n  assert.match(pdf, /const sortedCards = sortedInventoryCards\(locationCards\)/);\n  assert.match(pdf, /sortedCards\\.slice\(index, index \+ pageSize\)/);\n});\n\ntest("inventory sorting release is version 1.2.85", () => {\n  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\\.2\\.85"/);\n  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\\.2\\.85/);\n});\n''')
