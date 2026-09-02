from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing expected snippet in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


# Version
replace_once("package.json", '"version": "1.2.83"', '"version": "1.2.84"')
replace_once("src/lib/app-version.ts", '1.2.83', '1.2.84')

# Preserve CPU / RAM / storage details in the source inventory rows so the compact PDF
# inventory renderer can consume the authoritative imported values without changing the
# screen inventory table layout.
replace_once(
    "src/lib/outcomes/export-html.ts",
    'data-lifecycle="${device.lifecycleStatus}" data-storage="${storageValue}" data-os="${osValue}"><td>',
    'data-lifecycle="${device.lifecycleStatus}" data-storage="${storageValue}" data-os="${osValue}" data-cpu="${escapeHtml(device.cpu || "")}" data-memory="${escapeHtml(device.ram || "")}" data-storage-detail="${escapeHtml(device.storage || storageDetail || "")}"><td>',
)

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

old_text_only = '''function textOnly(value: string): string {
  return value
    .replace(/<br\\s*\\/?>/gi, " · ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\\s+/g, " ")
    .trim();
}'''
new_text_only = old_text_only + '''

function rowAttribute(row: string, name: string): string {
  const match = row.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match?.[1]?.trim() ?? "";
}'''
if old_text_only not in text:
    raise SystemExit("textOnly helper not found")
text = text.replace(old_text_only, new_text_only, 1)

old_os = '  const os = textOnly(cells[5]) || "Operating system not reported";'
new_os = '  const os = textOnly(cells[5].match(/<b\\b[^>]*>([\\s\\S]*?)<\\/b>/i)?.[1] ?? cells[5]) || "Operating system not reported";'
if old_os not in text:
    raise SystemExit("OS extraction line not found")
text = text.replace(old_os, new_os, 1)

old_attention = '''  const attention = attentionText(status, fivePlus, osConcern, ageToVerify);
  const rowTone = attention.tone;

  return {
    status,
    location,
    osConcern,
    fivePlus,
    ageToVerify,
    html: `<article class="pdf-device-list-row ${rowTone}">
      <div class="pdf-device-list-identity"><strong>${device}</strong><small>${type} · ${model}</small></div>
      <div class="pdf-device-list-fact ${fivePlus ? "priority" : ageToVerify ? "attention" : ""}"><span>Age</span><strong>${displayAge(age, ageYears)}</strong></div>
      <div class="pdf-device-list-fact ${osConcern ? "priority" : ""}"><span>Operating system</span><strong>${os}</strong></div>
      <div class="pdf-device-list-action ${attention.tone}"><span>What needs attention</span><strong>${attention.text}</strong></div>
    </article>`,
  };'''
new_attention = '''  const attention = attentionText(status, fivePlus, osConcern, ageToVerify);
  const rowTone = attention.tone;
  const cpu = rowAttribute(row, "data-cpu") || "—";
  const memory = rowAttribute(row, "data-memory") || "—";
  const storage = rowAttribute(row, "data-storage-detail") || "—";

  return {
    status,
    location,
    osConcern,
    fivePlus,
    ageToVerify,
    ageYears,
    deviceName: device,
    html: `<article class="pdf-device-list-row ${rowTone}">
      <div class="pdf-device-list-identity"><strong>${device}</strong><small>${type} · ${model}</small></div>
      <div class="pdf-device-list-fact ${fivePlus ? "priority" : ageToVerify ? "attention" : ""}"><strong>${displayAge(age, ageYears)}</strong></div>
      <div class="pdf-device-list-fact ${osConcern ? "priority" : ""}"><strong>${os}</strong></div>
      <div class="pdf-device-list-fact pdf-device-list-cpu"><strong>${cpu}</strong></div>
      <div class="pdf-device-list-fact pdf-device-list-memory"><strong>${memory}</strong></div>
      <div class="pdf-device-list-fact pdf-device-list-storage"><strong>${storage}</strong></div>
      <div class="pdf-device-list-action ${attention.tone}"><strong>${attention.text}</strong></div>
    </article>`,
  };'''
if old_attention not in text:
    raise SystemExit("inventory row renderer block not found")
text = text.replace(old_attention, new_attention, 1)

sort_helpers = '''function inventoryNeedRank(card: InventoryDeviceCard): number {
  if (card.fivePlus) return 0;
  if (card.osConcern || card.status === "overdue") return 1;
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

old_header = '<div class="pdf-device-list-header"><span>Device</span><span>Age</span><span>Operating system</span><span>What needs attention</span></div>'
new_header = '<div class="pdf-device-list-header"><span>Device</span><span>Age</span><span>Operating system</span><span>CPU</span><span>Memory</span><span>Storage</span><span>Needs attention</span></div>'
if old_header not in text:
    raise SystemExit("inventory table header not found")
text = text.replace(old_header, new_header, 1)

replacements = {
    '.pdf-inventory-page .pdf-device-list-header{display:grid;grid-template-columns:2.15fr .72fr 1.45fr 1.45fr;gap:0;padding:5px 8px;border:1px solid #d7e1ec;border-bottom:0;border-radius:9px 9px 0 0;background:#eef3f8;color:#52677e;font-size:5.6px;font-weight:850;letter-spacing:.06em;text-transform:uppercase}': '.pdf-inventory-page .pdf-device-list-header{display:grid;grid-template-columns:1.72fr .55fr 1.18fr 1.18fr .58fr .72fr 1.35fr;gap:0;padding:5px 6px;border:1px solid #d7e1ec;border-bottom:0;border-radius:9px 9px 0 0;background:#eef3f8;color:#52677e;font-size:5px;font-weight:850;letter-spacing:.045em;text-transform:uppercase}',
    '.pdf-inventory-page .pdf-device-list-row{display:grid;grid-template-columns:2.15fr .72fr 1.45fr 1.45fr;gap:0;align-items:center;min-height:27px;padding:4px 8px;border:0;border-bottom:1px solid #e4ebf2;background:#fff;break-inside:avoid}': '.pdf-inventory-page .pdf-device-list-row{display:grid;grid-template-columns:1.72fr .55fr 1.18fr 1.18fr .58fr .72fr 1.35fr;gap:0;align-items:center;min-height:25px;padding:3.5px 6px;border:0;border-bottom:1px solid #e4ebf2;background:#fff;break-inside:avoid}',
    '.pdf-inventory-page .pdf-device-list-row>div{min-width:0;padding-right:7px}': '.pdf-inventory-page .pdf-device-list-row>div{min-width:0;padding-right:5px}',
    '.pdf-inventory-page .pdf-device-list-identity strong{font-size:6.7px;line-height:1.12;color:#152a43;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}': '.pdf-inventory-page .pdf-device-list-identity strong{font-size:6.25px;line-height:1.1;color:#152a43;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pdf-inventory-page .pdf-device-list-identity small{margin-top:1px;color:#748397;font-size:5.2px;line-height:1.08;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}': '.pdf-inventory-page .pdf-device-list-identity small{margin-top:1px;color:#748397;font-size:4.7px;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pdf-inventory-page .pdf-device-list-fact strong,.pdf-inventory-page .pdf-device-list-action strong{margin-top:2px;color:#31475f;font-size:5.8px;line-height:1.08;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}': '.pdf-inventory-page .pdf-device-list-fact strong,.pdf-inventory-page .pdf-device-list-action strong{margin-top:0;color:#31475f;font-size:5.25px;line-height:1.08;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"missing CSS rule: {old[:100]}")
    text = text.replace(old, new, 1)

path.write_text(text)

# Focused regression coverage.
Path("tests/v1284-inventory-specs.test.mjs").write_text('''import test from "node:test";\nimport assert from "node:assert/strict";\nimport fs from "node:fs";\n\nconst pdf = fs.readFileSync("src/lib/outcomes/pdf-inventory-sync.ts", "utf8");\nconst exportHtml = fs.readFileSync("src/lib/outcomes/export-html.ts", "utf8");\n\ntest("PDF inventory carries CPU memory and storage from source rows", () => {\n  assert.match(exportHtml, /data-cpu=/);\n  assert.match(exportHtml, /data-memory=/);\n  assert.match(exportHtml, /data-storage-detail=/);\n  assert.match(pdf, /<span>CPU<\\/span><span>Memory<\\/span><span>Storage<\\/span>/);\n});\n\ntest("PDF inventory keeps seven compact columns", () => {\n  assert.match(pdf, /grid-template-columns:1\\.72fr \\.55fr 1\\.18fr 1\\.18fr \\.58fr \\.72fr 1\\.35fr/);\n});\n\ntest("red age items sort first and oldest first inside each location", () => {\n  assert.match(pdf, /if \(card\\.fivePlus\) return 0/);\n  assert.match(pdf, /if \(card\\.osConcern \\|\\| card\\.status === "overdue"\) return 1/);\n  assert.match(pdf, /return rightAge - leftAge/);\n  assert.match(pdf, /const sortedCards = sortedInventoryCards\(locationCards\)/);\n});\n\ntest("compact OS column uses the OS name rather than the duplicated support sentence", () => {\n  assert.match(pdf, /cells\\[5\\]\\.match\(\\/<b/);\n});\n\ntest("inventory spec release is version 1.2.84", () => {\n  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\\.2\\.84"/);\n  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\\.2\\.84/);\n});\n''')
