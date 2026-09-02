from pathlib import Path
import re


inventory = Path("src/lib/outcomes/pdf-inventory-sync.ts")
text = inventory.read_text()

lifecycle_detail = r'''function lifecycleDetail(status: InventoryStatus, age: string, warranty: string): string {
  const ageMissing = status === "unknown"
    || /^0(?:\.0+)?\s+years?\s+old$/i.test(age)
    || /\bage (?:not listed|not reported|unknown)\b/i.test(age);
  const warrantyMissing = /\bwarranty (?:unknown|not reported|not listed)\b/i.test(warranty)
    || /\bdate not listed\b/i.test(warranty);

  if (ageMissing) {
    return warrantyMissing
      ? "Original ship date not listed · Warranty details not listed"
      : `Original ship date not listed · ${warranty}`;
  }
  if (warrantyMissing) return `${age} · Warranty details not listed`;

  return `${age} · ${warranty}`;
}

function inventoryCard'''
text, count = re.subn(
    r"function lifecycleDetail\(status: InventoryStatus, age: string, warranty: string\): string \{[\s\S]*?\n\}\n\nfunction inventoryCard",
    lambda _match: lifecycle_detail,
    text,
    count=1,
)
if count != 1:
    raise SystemExit(f"Expected one lifecycleDetail block, found {count}")

inventory_summary = r'''function inventorySummary(cards: InventoryDeviceCard[]): string {
  const counts = cards.reduce((result, card) => {
    result[card.status] += 1;
    return result;
  }, { current: 0, "due-soon": 0, overdue: 0, unknown: 0 } as Record<InventoryStatus, number>);
  const osConcerns = cards.filter((card) => card.osConcern).length;

  const usefulItems: InventorySummaryItem[] = [
    { key: "current", count: counts.current, label: "Systems in good shape", tone: "healthy", icon: "check" },
    ...(counts.overdue > 0 ? [{ key: "overdue" as const, count: counts.overdue, label: "Lifecycle priorities", tone: "priority" as const, icon: "computer" as const }] : []),
    ...(counts["due-soon"] > 0 ? [{ key: "due-soon" as const, count: counts["due-soon"], label: "Approaching lifecycle", tone: "attention" as const, icon: "computer" as const }] : []),
    ...(osConcerns > 0 ? [{ key: "os" as const, count: osConcerns, label: "OS concerns", tone: "attention" as const, icon: "activity" as const }] : []),
    ...(counts.unknown > 0 ? [{ key: "unknown" as const, count: counts.unknown, label: "Lifecycle to verify", icon: "activity" as const }] : []),
  ];

  const zeroFillers: InventorySummaryItem[] = [
    { key: "overdue", count: 0, label: "Lifecycle priorities", tone: "priority", icon: "computer" },
    { key: "due-soon", count: 0, label: "Approaching lifecycle", tone: "attention", icon: "computer" },
    { key: "unknown", count: 0, label: "Lifecycle to verify", icon: "activity" },
  ];
  const presentKeys = new Set(usefulItems.map((item) => item.key));
  const items = [...usefulItems, ...zeroFillers.filter((item) => !presentKeys.has(item.key))].slice(0, 4);

  return items.map((item) => `<article${item.tone ? ` class="${item.tone}"` : ""}>${reportIcon(item.icon)}<span><strong>${item.count}</strong><small>${item.label}</small></span></article>`).join("");
}

function inventoryPages'''
text, count = re.subn(
    r"function inventorySummary\(cards: InventoryDeviceCard\[\]\): string \{[\s\S]*?\n\}\n\nfunction inventoryPages",
    lambda _match: inventory_summary,
    text,
    count=1,
)
if count != 1:
    raise SystemExit(f"Expected one inventorySummary block, found {count}")
inventory.write_text(text)

budget_path = Path("src/lib/outcomes/technology-budget-outlook.ts")
budget = budget_path.read_text()
if 'osSupportStatus } from "./client-report-data";' not in budget:
    budget = budget.replace(
        'import { compassLocationSnapshots, inventoryReportDevices } from "./client-report-data";',
        'import { compassLocationSnapshots, inventoryReportDevices, osSupportStatus } from "./client-report-data";',
        1,
    )
if "  osConcerns: number;" not in budget:
    budget = budget.replace(
        "  windows10: number;\n  concernSignals: number;",
        "  windows10: number;\n  osConcerns: number;\n  concernSignals: number;",
        1,
    )

location_block = r'''  const locations = compassLocationSnapshots(project)
    .map((location) => {
      const ids = new Set(location.deviceIds);
      const matched = devices.filter((device) =>
        (device.sourceDeviceId && ids.has(device.sourceDeviceId))
        || (device.sourceDeviceName && ids.has(device.sourceDeviceName))
        || ids.has(device.name)
        || (device.location && device.location === location.name)
      );
      const windows10 = matched.length
        ? matched.filter((device) => /Windows\s*10/i.test(device.os || "")).length
        : location.windows10;
      const osConcerns = matched.filter((device) => {
        const status = osSupportStatus(device);
        return status === "unsupported" || status === "ending-soon";
      }).length;
      return {
        name: location.name || "Location not specified",
        replaceNow: location.replaceNow,
        planSoon: location.planSoon,
        windows10,
        osConcerns,
        concernSignals: location.replaceNow + location.planSoon + osConcerns,
      };
    })
    .filter((location) => location.concernSignals > 0)
    .sort((a, b) => b.concernSignals - a.concernSignals || b.replaceNow - a.replaceNow || b.osConcerns - a.osConcerns || b.windows10 - a.windows10 || a.name.localeCompare(b.name))
    .slice(0, 3);'''
budget, count = re.subn(
    r"  const locations = compassLocationSnapshots\(project\)[\s\S]*?    \.slice\(0, 3\);",
    lambda _match: location_block,
    budget,
    count=1,
)
if count != 1:
    raise SystemExit(f"Expected one budget location block, found {count}")

budget = budget.replace(
    "${location.replaceNow} replace now · ${location.planSoon} plan soon · ${location.windows10} Windows 10",
    '${location.replaceNow} replace now · ${location.planSoon} plan soon · ${location.osConcerns} OS concerns${location.windows10 ? ` · ${location.windows10} Windows 10` : ""}',
)
budget = budget.replace(
    "This is not financing or a payment plan.",
    "This is not financing, a payment plan, or a formal quote.",
)
budget_path.write_text(budget)

ui_path = Path("src/components/technology-budget-outlook.tsx")
ui = ui_path.read_text()
ui = ui.replace(
    "{location.replaceNow} replace now · {location.planSoon} plan soon · {location.windows10} Windows 10",
    '{location.replaceNow} replace now · {location.planSoon} plan soon · {location.osConcerns} OS concerns{location.windows10 ? ` · ${location.windows10} Windows 10` : ""}',
    1,
)
ui = ui.replace(
    "This is not financing or a payment plan.",
    "This is not financing, a payment plan, or a formal quote.",
    1,
)
ui_path.write_text(ui)

Path("tests/v1278-report-clarity-budget.test.mjs").write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const outcome = fs.readFileSync("src/components/outcome-experience.tsx", "utf8");
const inventory = fs.readFileSync("src/lib/outcomes/pdf-inventory-sync.ts", "utf8");
const budget = fs.readFileSync("src/lib/outcomes/technology-budget-outlook.ts", "utf8");
const budgetUi = fs.readFileSync("src/components/technology-budget-outlook.tsx", "utf8");
const pdf = fs.readFileSync("src/lib/outcomes/export-html.ts", "utf8");

test("budget outlook toggle controls both Present and Download", () => {
  assert.match(outcome, /includeTechnologyBudgetOutlook, setIncludeTechnologyBudgetOutlook\] = useState\(false\)/);
  assert.match(outcome, /TechnologyBudgetOutlookToggle/);
  assert.match(outcome, /sectionsFor\(project, includeTechnologyBudgetOutlook\)/);
  assert.match(outcome, /section === "budget"/);
  assert.match(outcome, /downloadOutcomePdf\(project, \{ includeTechnologyBudgetOutlook \}\)/);
  assert.match(pdf, /injectTechnologyBudgetOutlookPdf/);
});

test("budget outlook is immediately before Recap", () => {
  assert.match(outcome, /return \[\.\.\.beginning, \.\.\.hipaa, "plan", \.\.\.budget, "recap"\]/);
  assert.match(budget, /const index = html\.lastIndexOf\(marker\)/);
  assert.match(budget, /html\.slice\(0, index\).*page.*html\.slice\(index\)/s);
});

test("quarterly example uses the same total range divided by four and full disclaimer", () => {
  assert.match(budget, /quarterlyRangeLow = roundPlanningValue\(planningRangeLow \/ 4\)/);
  assert.match(budget, /quarterlyRangeHigh = roundPlanningValue\(planningRangeHigh \/ 4\)/);
  assert.match(budgetUi, /not financing, a payment plan, or a formal quote/i);
  assert.match(budget, /not financing, a payment plan, or a formal quote/i);
});

test("budget outlook surfaces Windows 10 and broader location OS concerns", () => {
  assert.match(budget, /windows10Systems/);
  assert.match(budget, /osConcerns/);
  assert.match(budget, /status === "unsupported" \|\| status === "ending-soon"/);
  assert.match(budgetUi, /OS concerns/);
  assert.match(budgetUi, /Windows 10 systems to review/);
  assert.match(budget, /incomplete age data/);
});

test("inventory prioritizes useful OS concerns over zero-value filler", () => {
  assert.match(inventory, /data-os=/);
  assert.match(inventory, /explicit === "unsupported" \|\| explicit === "ending-soon"/);
  assert.match(inventory, /const osConcerns = cards\.filter\(\(card\) => card\.osConcern\)\.length/);
  assert.match(inventory, /label: "OS concerns"/);
  assert.match(inventory, /const usefulItems/);
  assert.match(inventory, /const zeroFillers/);
  assert.match(inventory, /\.slice\(0, 4\)/);
});

test("unknown age never presents zero years and warranty wording is clean", () => {
  assert.match(inventory, /Original ship date not listed/);
  assert.match(inventory, /Warranty details not listed/);
  assert.match(inventory, /\^0\(\?:\\\.0\+\)\?\\s\+years\?/);
  assert.match(pdf, /value <= 0\) return "Original ship date not listed"/);
});

test("location grouping remains intact", () => {
  assert.match(inventory, /function groupedInventoryCards/);
  assert.match(inventory, /if \(\/\^remote\$\/i\.test\(value\)\) return 1/);
  assert.match(inventory, /if \(value === UNASSIGNED_LOCATION\) return 2/);
  assert.match(inventory, /groupedInventoryCards\(cards\)\.flatMap/);
  assert.match(inventory, /data-inventory-location=/);
});

test("release is v1.2.78", () => {
  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\.2\.78"/);
  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\.2\.78/);
});
''')
