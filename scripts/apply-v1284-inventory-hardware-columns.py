from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


# Carry compact hardware values through the generated screen inventory rows so
# the portrait PDF inventory sync can use them without expanding the screen table.
export_path = "src/lib/outcomes/export-html.ts"
old_row = 'return `<tr class="device-${device.lifecycleStatus} device-type-${device.type} device-os-${osValue}" data-lifecycle="${device.lifecycleStatus}" data-storage="${storageValue}" data-os="${osValue}"><td><strong>${escapeHtml(clientDeviceDisplayName(device))}</strong><small>${escapeHtml(identityDetail)}</small></td>'
new_row = 'return `<tr class="device-${device.lifecycleStatus} device-type-${device.type} device-os-${osValue}" data-lifecycle="${device.lifecycleStatus}" data-storage="${storageValue}" data-os="${osValue}" data-os-name="${escapeHtml(device.os || "")}" data-cpu="${escapeHtml(device.cpu || "")}" data-memory="${escapeHtml(device.ram || "")}" data-storage-capacity="${escapeHtml(device.storage || storageDetail || "")}"><td><strong>${escapeHtml(clientDeviceDisplayName(device))}</strong><small>${escapeHtml(identityDetail)}</small></td>'
replace_once(export_path, old_row, new_row)

sync_path = "src/lib/outcomes/pdf-inventory-sync.ts"
sync = Path(sync_path).read_text()

needle = '''function textOnly(value: string): string {
  return value
    .replace(/<br\\s*\\/?>/gi, " · ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\\s+/g, " ")
    .trim();
}
'''
replacement = '''function textOnly(value: string): string {
  return value
    .replace(/<br\\s*\\/?>/gi, " · ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\\s+/g, " ")
    .trim();
}

function decodeAttribute(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .trim();
}

function rowAttribute(row: string, name: string): string {
  const match = row.match(new RegExp(`data-${name}="([^"]*)"`, "i"));
  return decodeAttribute(match?.[1] ?? "");
}

function compactOperatingSystem(value: string): string {
  return value
    .replace(/^Microsoft\\s+/i, "")
    .replace(/\\s+Edition\\b/gi, "")
    .replace(/\\s+/g, " ")
    .trim();
}

function compactHardwareValue(value: string): string {
  const cleaned = value
    .replace(/\\(R\\)|\\(TM\\)/gi, "")
    .replace(/\\s+/g, " ")
    .trim();
  return cleaned || "—";
}
'''
if needle not in sync:
    raise SystemExit("textOnly block not found")
sync = sync.replace(needle, replacement, 1)

old_extract = '''  const os = textOnly(cells[5]) || "Operating system not reported";
  const age = textOnly(cells[6]) || "Age not reported";
  const osConcern = operatingSystemConcern(row, os);
'''
new_extract = '''  const os = rowAttribute(row, "os-name") || textOnly(cells[5]) || "Operating system not reported";
  const cpu = compactHardwareValue(rowAttribute(row, "cpu"));
  const memory = compactHardwareValue(rowAttribute(row, "memory"));
  const storage = compactHardwareValue(rowAttribute(row, "storage-capacity"));
  const age = textOnly(cells[6]) || "Age not reported";
  const osConcern = operatingSystemConcern(row, os);
'''
if old_extract not in sync:
    raise SystemExit("inventory extraction block not found")
sync = sync.replace(old_extract, new_extract, 1)

old_html = '''    html: `<article class="pdf-device-list-row ${rowTone}">
      <div class="pdf-device-list-identity"><strong>${device}</strong><small>${type} · ${model}</small></div>
      <div class="pdf-device-list-fact ${fivePlus ? "priority" : ageToVerify ? "attention" : ""}"><span>Age</span><strong>${displayAge(age, ageYears)}</strong></div>
      <div class="pdf-device-list-fact ${osConcern ? "priority" : ""}"><span>Operating system</span><strong>${os}</strong></div>
      <div class="pdf-device-list-action ${attention.tone}"><span>What needs attention</span><strong>${attention.text}</strong></div>
    </article>`,
'''
new_html = '''    html: `<article class="pdf-device-list-row ${rowTone}">
      <div class="pdf-device-list-identity"><strong>${device}</strong><small>${type} · ${model}</small></div>
      <div class="pdf-device-list-fact ${fivePlus ? "priority" : ageToVerify ? "attention" : ""}"><strong>${displayAge(age, ageYears)}</strong></div>
      <div class="pdf-device-list-fact pdf-device-list-os ${osConcern ? "priority" : ""}"><strong>${compactOperatingSystem(os)}</strong></div>
      <div class="pdf-device-list-fact pdf-device-list-cpu"><strong>${cpu}</strong></div>
      <div class="pdf-device-list-fact"><strong>${memory}</strong></div>
      <div class="pdf-device-list-fact"><strong>${storage}</strong></div>
      <div class="pdf-device-list-action ${attention.tone}"><strong>${attention.text}</strong></div>
    </article>`,
'''
if old_html not in sync:
    raise SystemExit("inventory row HTML block not found")
sync = sync.replace(old_html, new_html, 1)

old_header = '<div class="pdf-device-list-header"><span>Device</span><span>Age</span><span>Operating system</span><span>What needs attention</span></div>'
new_header = '<div class="pdf-device-list-header"><span>Device</span><span>Age</span><span>Operating system</span><span>CPU</span><span>Memory</span><span>Storage</span><span>Needs attention</span></div>'
if old_header not in sync:
    raise SystemExit("inventory header not found")
sync = sync.replace(old_header, new_header, 1)

old_css = '''.pdf-inventory-page .pdf-device-list-header{display:grid;grid-template-columns:2.15fr .72fr 1.45fr 1.45fr;gap:0;padding:5px 8px;border:1px solid #d7e1ec;border-bottom:0;border-radius:9px 9px 0 0;background:#eef3f8;color:#52677e;font-size:5.6px;font-weight:850;letter-spacing:.06em;text-transform:uppercase}
.pdf-inventory-page .pdf-device-focus-grid{display:grid!important;grid-template-columns:1fr!important;gap:0!important;border:1px solid #d7e1ec;border-radius:0 0 9px 9px;overflow:hidden;background:#fff}
.pdf-inventory-page .pdf-device-list-row{display:grid;grid-template-columns:2.15fr .72fr 1.45fr 1.45fr;gap:0;align-items:center;min-height:27px;padding:4px 8px;border:0;border-bottom:1px solid #e4ebf2;background:#fff;break-inside:avoid}
'''
new_css = '''.pdf-inventory-page .pdf-device-list-header{display:grid;grid-template-columns:1.72fr .58fr 1.08fr 1.28fr .62fr .78fr 1.22fr;gap:0;padding:5px 8px;border:1px solid #d7e1ec;border-bottom:0;border-radius:9px 9px 0 0;background:#eef3f8;color:#52677e;font-size:5.1px;font-weight:850;letter-spacing:.045em;text-transform:uppercase}
.pdf-inventory-page .pdf-device-focus-grid{display:grid!important;grid-template-columns:1fr!important;gap:0!important;border:1px solid #d7e1ec;border-radius:0 0 9px 9px;overflow:hidden;background:#fff}
.pdf-inventory-page .pdf-device-list-row{display:grid;grid-template-columns:1.72fr .58fr 1.08fr 1.28fr .62fr .78fr 1.22fr;gap:0;align-items:center;min-height:27px;padding:4px 8px;border:0;border-bottom:1px solid #e4ebf2;background:#fff;break-inside:avoid}
'''
if old_css not in sync:
    raise SystemExit("inventory grid CSS not found")
sync = sync.replace(old_css, new_css, 1)

old_facts = '''.pdf-inventory-page .pdf-device-list-identity strong,.pdf-inventory-page .pdf-device-list-identity small,.pdf-inventory-page .pdf-device-list-fact span,.pdf-inventory-page .pdf-device-list-fact strong,.pdf-inventory-page .pdf-device-list-action span,.pdf-inventory-page .pdf-device-list-action strong{display:block}
.pdf-inventory-page .pdf-device-list-identity strong{font-size:6.7px;line-height:1.12;color:#152a43;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pdf-inventory-page .pdf-device-list-identity small{margin-top:1px;color:#748397;font-size:5.2px;line-height:1.08;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pdf-inventory-page .pdf-device-list-fact span,.pdf-inventory-page .pdf-device-list-action span{color:#8490a0;font-size:4.8px;font-weight:800;line-height:1;text-transform:uppercase}
.pdf-inventory-page .pdf-device-list-fact strong,.pdf-inventory-page .pdf-device-list-action strong{margin-top:2px;color:#31475f;font-size:5.8px;line-height:1.08;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
'''
new_facts = '''.pdf-inventory-page .pdf-device-list-identity strong,.pdf-inventory-page .pdf-device-list-identity small,.pdf-inventory-page .pdf-device-list-fact strong,.pdf-inventory-page .pdf-device-list-action strong{display:block}
.pdf-inventory-page .pdf-device-list-identity strong{font-size:6.5px;line-height:1.12;color:#152a43;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pdf-inventory-page .pdf-device-list-identity small{margin-top:1px;color:#748397;font-size:4.9px;line-height:1.08;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pdf-inventory-page .pdf-device-list-fact strong,.pdf-inventory-page .pdf-device-list-action strong{margin:0;color:#31475f;font-size:5.35px;line-height:1.08;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pdf-inventory-page .pdf-device-list-cpu strong,.pdf-inventory-page .pdf-device-list-os strong{white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;max-height:2.16em;overflow:hidden}
'''
if old_facts not in sync:
    raise SystemExit("inventory fact CSS not found")
sync = sync.replace(old_facts, new_facts, 1)

Path(sync_path).write_text(sync)

replace_once("package.json", '"version": "1.2.83"', '"version": "1.2.84"')
replace_once("src/lib/app-version.ts", 'APP_VERSION = "1.2.83"', 'APP_VERSION = "1.2.84"')

# Focused source-level regression coverage for the compact portrait inventory.
test_path = Path("tests/v1284-inventory-hardware-columns.test.mjs")
test_path.write_text('''import test from "node:test";\nimport assert from "node:assert/strict";\nimport fs from "node:fs";\n\nconst sync = fs.readFileSync("src/lib/outcomes/pdf-inventory-sync.ts", "utf8");\nconst exportHtml = fs.readFileSync("src/lib/outcomes/export-html.ts", "utf8");\n\ntest("portrait inventory carries CPU memory storage and clean OS values from source rows", () => {\n  assert.match(exportHtml, /data-os-name=/);\n  assert.match(exportHtml, /data-cpu=/);\n  assert.match(exportHtml, /data-memory=/);\n  assert.match(exportHtml, /data-storage-capacity=/);\n  assert.match(sync, /rowAttribute\\(row, "cpu"\\)/);\n  assert.match(sync, /rowAttribute\\(row, "memory"\\)/);\n  assert.match(sync, /rowAttribute\\(row, "storage-capacity"\\)/);\n});\n\ntest("portrait inventory has seven compact columns without repeated per-row labels", () => {\n  assert.match(sync, /<span>CPU<\\/span><span>Memory<\\/span><span>Storage<\\/span><span>Needs attention<\\/span>/);\n  assert.match(sync, /grid-template-columns:1\\.72fr \\.58fr 1\\.08fr 1\\.28fr \\.62fr \\.78fr 1\\.22fr/);\n  assert.doesNotMatch(sync, /<span>What needs attention<\\/span><strong>\\$\\{attention\\.text\\}<\\/strong>/);\n});\n\ntest("CPU and OS values can wrap to two lines while rows stay compact", () => {\n  assert.match(sync, /pdf-device-list-cpu strong/);\n  assert.match(sync, /-webkit-line-clamp:2/);\n  assert.match(sync, /min-height:27px/);\n  assert.match(sync, /const pageSize = 24/);\n});\n\ntest("inventory hardware column release is version 1.2.84", () => {\n  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\\.2\\.84"/);\n  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\\.2\\.84/);\n});\n''')
