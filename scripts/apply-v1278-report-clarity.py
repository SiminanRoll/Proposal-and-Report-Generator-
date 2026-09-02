from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"Missing patch anchor: {label}")
    return text.replace(old, new, 1)


def replace_visible(text: str, replacements: list[tuple[str, str]]) -> str:
    for old, new in replacements:
        text = text.replace(old, new)
    return text


# -----------------------------
# Presentation / report workspace
# -----------------------------
outcome_path = Path("src/components/outcome-experience.tsx")
text = outcome_path.read_text()
text = replace_once(
    text,
    'import { BackupRecoveryPresentation } from "./backup-recovery-presentation";\n',
    'import { BackupRecoveryPresentation } from "./backup-recovery-presentation";\nimport { TechnologyBudgetOutlookPresentation, TechnologyBudgetOutlookToggle } from "./technology-budget-outlook";\n',
    "budget component import",
)
text = replace_once(
    text,
    'type PresentationSection = (typeof CLIENT_REPORT_SECTIONS)[number] | (typeof STANDARD_SECTIONS)[number] | "advantage" | "investment" | "authorization" | "hipaa";',
    'type PresentationSection = (typeof CLIENT_REPORT_SECTIONS)[number] | (typeof STANDARD_SECTIONS)[number] | "advantage" | "investment" | "authorization" | "hipaa" | "budget";',
    "presentation section type",
)
text = replace_once(
    text,
    "function sectionsFor(project: Project): PresentationSection[] {",
    "function sectionsFor(project: Project, includeTechnologyBudgetOutlook = false): PresentationSection[] {",
    "sectionsFor signature",
)
text = replace_once(
    text,
    '    return [...beginning, ...hipaa, "plan", "recap"];',
    '    const budget: PresentationSection[] = includeTechnologyBudgetOutlook ? ["budget"] : [];\n    return [...beginning, ...hipaa, "plan", ...budget, "recap"];',
    "client report section order",
)
text = replace_once(
    text,
    '  if (value === "hipaa") return "HIPAA review";\n  if (value === "recap") return "Recap";',
    '  if (value === "hipaa") return "HIPAA review";\n  if (value === "budget") return "Budget outlook";\n  if (value === "recap") return "Recap";',
    "budget section label",
)
text = replace_once(
    text,
    'function ClientPresentation({ project, onUpdate, onClose, onDownloadPdf, pdfBusy }: { project: Project; onUpdate: (project: Project) => void; onClose: () => void; onDownloadPdf: () => Promise<void>; pdfBusy: boolean }) {\n  const sections = useMemo(() => sectionsFor(project), [project]);',
    'function ClientPresentation({ project, onUpdate, onClose, onDownloadPdf, pdfBusy, includeTechnologyBudgetOutlook }: { project: Project; onUpdate: (project: Project) => void; onClose: () => void; onDownloadPdf: () => Promise<void>; pdfBusy: boolean; includeTechnologyBudgetOutlook: boolean }) {\n  const sections = useMemo(() => sectionsFor(project, includeTechnologyBudgetOutlook), [project, includeTechnologyBudgetOutlook]);',
    "ClientPresentation budget prop",
)
text = replace_once(
    text,
    '    {section === "authorization" && <ProposalAuthorizationPresentation project={project} onUpdate={onUpdate} />}\n    {section === "recap" && <RecapPresentation project={project} onUpdate={onUpdate} />}',
    '    {section === "authorization" && <ProposalAuthorizationPresentation project={project} onUpdate={onUpdate} />}\n    {section === "budget" && <TechnologyBudgetOutlookPresentation project={project} />}\n    {section === "recap" && <RecapPresentation project={project} onUpdate={onUpdate} />}',
    "budget presentation renderer",
)
text = replace_once(
    text,
    '  const [pdfBusy, setPdfBusy] = useState(false);\n',
    '  const [pdfBusy, setPdfBusy] = useState(false);\n  const [includeTechnologyBudgetOutlook, setIncludeTechnologyBudgetOutlook] = useState(false);\n',
    "budget toggle state",
)
text = replace_once(
    text,
    "    try { await downloadOutcomePdf(project); } finally { setPdfBusy(false); }",
    "    try { await downloadOutcomePdf(project, { includeTechnologyBudgetOutlook }); } finally { setPdfBusy(false); }",
    "download budget option",
)
text = replace_once(
    text,
    '        <div className="report-workspace-primary-actions">\n          <button className="button secondary report-present-button"',
    '        <div className="report-workspace-primary-actions">\n          <TechnologyBudgetOutlookToggle checked={includeTechnologyBudgetOutlook} onChange={setIncludeTechnologyBudgetOutlook} />\n          <button className="button secondary report-present-button"',
    "toolbar budget toggle",
)
text = replace_once(
    text,
    '{presenting && <ClientPresentation project={project} onUpdate={onUpdate} onClose={() => setPresenting(false)} onDownloadPdf={downloadFinishedPdf} pdfBusy={pdfBusy} />}',
    '{presenting && <ClientPresentation project={project} onUpdate={onUpdate} onClose={() => setPresenting(false)} onDownloadPdf={downloadFinishedPdf} pdfBusy={pdfBusy} includeTechnologyBudgetOutlook={includeTechnologyBudgetOutlook} />}',
    "presentation budget option",
)

# Windows 10 should visually read as a concern; Windows 11 should read healthy.
text = replace_once(
    text,
    'function OsSupportBadge({ device }: { device: ReturnType<typeof inventoryReportDevices>[number] }) {\n  const status = osSupportStatus(device);\n  return <span className={`os-support-status os-support-status-${status}`}><b>{device.os || "Not reported"}</b><small>{osSupportStatusLabel(status)} · {osSupportReason(device)}</small></span>;\n}',
    'function OsSupportBadge({ device }: { device: ReturnType<typeof inventoryReportDevices>[number] }) {\n  const status = osSupportStatus(device);\n  const visualStatus = /Windows\\s*10/i.test(device.os || "") ? "unsupported" : /Windows\\s*11/i.test(device.os || "") ? "supported" : status;\n  return <span className={`os-support-status os-support-status-${visualStatus}`}><b>{device.os || "Not reported"}</b><small>{osSupportStatusLabel(status)} · {osSupportReason(device)}</small></span>;\n}',
    "OS visual tone",
)

text = replace_visible(text, [
    ("Security, lifecycle, HIPAA readiness, and next-step priorities.", "Security, equipment age, HIPAA readiness, and next-step priorities."),
    ("Security, lifecycle, infrastructure health, and next-step priorities.", "Security, equipment age, infrastructure health, and next-step priorities."),
    ("A combined view of security protection, lifecycle health, and readiness findings.", "A combined view of security protection, equipment age, and readiness findings."),
    ('label="Network & lifecycle"', 'label="Network & equipment age"'),
    ("Network health & lifecycle", "Network health & equipment age"),
    ("lifecycle-assessed physical assets", "age-assessed physical assets"),
    ("need lifecycle data", "need age data"),
    ("Lifecycle unknown", "Age to verify"),
    ("need lifecycle planning", "need age-based planning"),
    ("Next in the lifecycle", "Plan soon by age"),
    ("assets needing lifecycle data", "assets needing age data"),
    ("Storage pressure is tracked separately from lifecycle replacement", "Storage pressure is tracked separately from age-based replacement planning"),
    ('aria-label="Filter hardware inventory by lifecycle status"', 'aria-label="Filter hardware inventory by age status"'),
    ("<th>Lifecycle</th>", "<th>Age status</th>"),
    ("Host hardware determines lifecycle", "Host hardware determines age planning"),
    ("Virtual machines remain visible and are identified separately because their lifecycle depends on the physical host.", "Virtual machines remain visible and are identified separately because their age planning follows the physical host."),
    ("server, workstation, lifecycle, operating-system", "server, workstation, equipment-age, operating-system"),
    ("No lifecycle action required", "No age-based action required"),
    ("normal lifecycle.", "normal age-planning range."),
    ("Lifecycle priorities", "Age priorities"),
    ('device.warrantyExpires || "Date not listed"', 'device.warrantyExpires || "Warranty date not listed"'),
    ('device.age ? `${device.age} years old` : "Age not listed"', 'device.age && device.age > 0 ? `${device.age} years old` : "Original ship date not listed"'),
    ('device.age || "—"', 'device.age && device.age > 0 ? `${device.age} years` : "Original ship date not listed"'),
    ('device.age ? `${device.age} yr` : "—"', 'device.age && device.age > 0 ? `${device.age} yr` : "Original ship date not listed"'),
])
outcome_path.write_text(text)


# -----------------------------
# PDF inventory appendix
# -----------------------------
inventory_path = Path("src/lib/outcomes/pdf-inventory-sync.ts")
text = inventory_path.read_text()
text = replace_once(
    text,
    '  osConcern: boolean;\n  html: string;',
    '  osConcern: boolean;\n  windows10: boolean;\n  windows11: boolean;\n  html: string;',
    "inventory Windows flags",
)
text = text.replace('key: InventoryStatus | "os";', 'key: InventoryStatus | "windows10";')
text = replace_once(
    text,
    'function operatingSystemConcern(row: string, os: string): boolean {\n  const explicit = row.match(/data-os="([^\"]+)"/i)?.[1]?.toLowerCase();\n  if (explicit === "unsupported" || explicit === "ending-soon") return true;\n  return /\\bwindows\\s*10\\b/i.test(os) || /\\bend of support\\b|\\bunsupported\\b/i.test(os);\n}\n',
    'function operatingSystemConcern(row: string, os: string): boolean {\n  const explicit = row.match(/data-os="([^\"]+)"/i)?.[1]?.toLowerCase();\n  if (explicit === "unsupported" || explicit === "ending-soon") return true;\n  return /\\bwindows\\s*10\\b/i.test(os) || /\\bend of support\\b|\\bunsupported\\b/i.test(os);\n}\n\nfunction isWindows10(os: string): boolean {\n  return /\\bwindows\\s*10\\b/i.test(os);\n}\n\nfunction isWindows11(os: string): boolean {\n  return /\\bwindows\\s*11\\b/i.test(os);\n}\n\nfunction operatingSystemTone(os: string, osConcern: boolean, status: InventoryStatus): InventoryTone {\n  if (isWindows10(os)) return "priority";\n  if (isWindows11(os)) return "healthy";\n  if (osConcern) return "attention";\n  return status === "current" ? "healthy" : "attention";\n}\n',
    "inventory OS helpers",
)
text = replace_once(
    text,
    '  const osConcern = operatingSystemConcern(row, os);\n  const lifecycleContext = lifecycleDetail(status, age, warranty);',
    '  const osConcern = operatingSystemConcern(row, os);\n  const windows10 = isWindows10(os);\n  const windows11 = isWindows11(os);\n  const osTone = operatingSystemTone(os, osConcern, status);\n  const lifecycleContext = lifecycleDetail(status, age, warranty);',
    "inventory OS classification",
)
text = replace_visible(text, [
    ('? "Lifecycle priority"', '? "Replace now by age"'),
    (': "Planning window"', ': "Plan soon by age"'),
    (': "Current system"', ': "Within age range"'),
    (': "Lifecycle to verify";', ': "Age to verify";'),
])
text = replace_once(
    text,
    '    osConcern,\n    html:',
    '    osConcern,\n    windows10,\n    windows11,\n    html:',
    "inventory card Windows values",
)
text = replace_once(
    text,
    '<div class="${osConcern ? "attention" : status === "current" ? "healthy" : "attention"}">${reportIcon("activity")}<span><strong>Operating system</strong><small>${os}</small></span></div>',
    '<div class="${osTone}">${reportIcon("activity")}<span><strong>Operating system</strong><small>${os}</small></span></div>',
    "inventory OS row tone",
)
text = replace_once(
    text,
    '  const osConcerns = cards.filter((card) => card.osConcern).length;',
    '  const windows10Systems = cards.filter((card) => card.windows10).length;',
    "inventory Windows 10 count",
)
text = replace_visible(text, [
    ('label: "Approaching lifecycle"', 'label: "Plan soon by age"'),
    ('label: "Lifecycle priorities"', 'label: "Replace now by age"'),
    ('label: "Lifecycle to verify"', 'label: "Age to verify"'),
])
text = replace_once(
    text,
    '  if (osConcerns > 0) {\n    const zeroValuePriority: InventoryStatus[] = ["overdue", "due-soon", "unknown", "current"];\n    const replaceKey = zeroValuePriority.find((key) => counts[key] === 0);\n    const replaceIndex = replaceKey ? items.findIndex((item) => item.key === replaceKey) : -1;\n    if (replaceIndex >= 0) {\n      items[replaceIndex] = { key: "os", count: osConcerns, label: "OS concerns", tone: "attention", icon: "activity" };\n    }\n  }',
    '  if (windows10Systems > 0) {\n    const zeroValuePriority: InventoryStatus[] = ["overdue", "due-soon", "unknown", "current"];\n    const replaceKey = zeroValuePriority.find((key) => counts[key] === 0);\n    const replaceIndex = replaceKey ? items.findIndex((item) => item.key === replaceKey) : -1;\n    if (replaceIndex >= 0) {\n      items[replaceIndex] = { key: "windows10", count: windows10Systems, label: "Windows 10 systems", tone: "priority", icon: "activity" };\n    }\n  }',
    "inventory Windows 10 summary substitution",
)
text = text.replace("with lifecycle, operating-system, and check-in details.", "with age, operating-system, and check-in details.")
inventory_path.write_text(text)


# -----------------------------
# Budget calculation / slide copy
# -----------------------------
budget_path = Path("src/lib/outcomes/technology-budget-outlook.ts")
text = budget_path.read_text()
text = replace_visible(text, [
    ("workstation lifecycle or Windows 10 concerns by office", "workstation age or Windows 10 concerns by office"),
    ("incomplete lifecycle data", "incomplete age data"),
    ("Lifecycle data is complete for the workstations included in this planning view.", "Age data is complete for the workstations included in this planning view."),
    ("workstation lifecycle and operating-system information", "workstation age and operating-system information"),
    ("Locations with the most OS & lifecycle concerns", "Locations with the most OS & age concerns"),
])
budget_path.write_text(text)

budget_ui_path = Path("src/components/technology-budget-outlook.tsx")
text = budget_ui_path.read_text()
text = replace_visible(text, [
    ("workstation lifecycle and operating-system information", "workstation age and operating-system information"),
    ("Locations with the most OS & lifecycle concerns", "Locations with the most OS & age concerns"),
    ("incomplete lifecycle data", "incomplete age data"),
    ("Lifecycle data is complete for the workstations in this planning view.", "Age data is complete for the workstations in this planning view."),
    ("workstation lifecycle or Windows 10 concern", "workstation age or Windows 10 concern"),
])
budget_ui_path.write_text(text)


# -----------------------------
# PDF generator + broad client-facing age language
# -----------------------------
export_path = Path("src/lib/outcomes/export-html.ts")
text = export_path.read_text()
text = replace_once(
    text,
    'import { hasAgreedReviewPlan } from "@/lib/review-outcomes/model";\n',
    'import { hasAgreedReviewPlan } from "@/lib/review-outcomes/model";\nimport { injectTechnologyBudgetOutlookPdf } from "./technology-budget-outlook";\n',
    "pdf budget import",
)
text = replace_once(
    text,
    "type OutcomeHtmlOptions = { autoPrint?: boolean };",
    "type OutcomeHtmlOptions = { autoPrint?: boolean; includeTechnologyBudgetOutlook?: boolean };",
    "outcome html options",
)
text = replace_once(
    text,
    '  const html = project.type === "client-report" && clientReportAvailable(project)\n    ? clientReportHtml(project)\n    : project.type !== "client-report"\n      ? prospectProposalHtml(project)\n      : standardOutcomeHtml(project);\n  return options.autoPrint ? html.replace("</body>", `${autoPrintScript()}</body>`) : html;',
    '  let html = project.type === "client-report" && clientReportAvailable(project)\n    ? clientReportHtml(project)\n    : project.type !== "client-report"\n      ? prospectProposalHtml(project)\n      : standardOutcomeHtml(project);\n  if (options.includeTechnologyBudgetOutlook && project.type === "client-report" && clientReportAvailable(project)) html = injectTechnologyBudgetOutlookPdf(html, project);\n  return options.autoPrint ? html.replace("</body>", `${autoPrintScript()}</body>`) : html;',
    "inject budget pdf page",
)
text = replace_once(
    text,
    "function openPrintFallback(project: Project): void {",
    'function openPrintFallback(project: Project, options: Pick<OutcomeHtmlOptions, "includeTechnologyBudgetOutlook"> = {}): void {',
    "print fallback signature",
)
text = replace_once(
    text,
    '  printWindow.document.write(outcomeHtml(project, { autoPrint: true }));',
    '  printWindow.document.write(outcomeHtml(project, { ...options, autoPrint: true }));',
    "print fallback budget option",
)
text = replace_once(
    text,
    "export async function downloadOutcomePdf(project: Project): Promise<void> {",
    'export async function downloadOutcomePdf(project: Project, options: Pick<OutcomeHtmlOptions, "includeTechnologyBudgetOutlook"> = {}): Promise<void> {',
    "download signature",
)
text = replace_once(
    text,
    "    await downloadFillableClientPdf(outcomeHtml(project), clientFacingDocumentTitle(project));",
    "    await downloadFillableClientPdf(outcomeHtml(project, options), clientFacingDocumentTitle(project));",
    "download html budget option",
)
text = replace_once(
    text,
    "    openPrintFallback(project);",
    "    openPrintFallback(project, options);",
    "fallback budget option",
)
text = replace_once(
    text,
    'function formatReportAge(value?: number): string {\n  if (typeof value !== "number" || !Number.isFinite(value)) return "Age not listed";\n  const rounded = value >= 10 ? Math.round(value).toString() : value.toFixed(1).replace(/\\.0$/, "");\n  return `${rounded} years old`;\n}',
    'function formatReportAge(value?: number): string {\n  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "Original ship date not listed";\n  const rounded = value >= 10 ? Math.round(value).toString() : value.toFixed(1).replace(/\\.0$/, "");\n  return `${rounded} years old`;\n}',
    "report age formatter",
)
text = replace_visible(text, [
    ("Network health & lifecycle", "Network health & equipment age"),
    ("Network Health & Lifecycle", "Network Health & Equipment Age"),
    ("network health & lifecycle", "network health & equipment age"),
    ("lifecycle health", "equipment age health"),
    ("Lifecycle health", "Equipment age health"),
    ("lifecycle-assessed", "age-assessed"),
    ("Lifecycle unknown", "Age to verify"),
    ("lifecycle to verify", "age to verify"),
    ("Lifecycle to verify", "Age to verify"),
    ("Lifecycle priorities", "Replace now by age"),
    ("Approaching lifecycle", "Plan soon by age"),
    ("lifecycle planning", "age-based planning"),
    ("Lifecycle planning", "Age-based planning"),
    ("lifecycle replacement", "age-based replacement"),
    ("Lifecycle replacement", "Age-based replacement"),
    ("<th>Lifecycle</th>", "<th>Age status</th>"),
    ("Host hardware determines lifecycle", "Host hardware determines age planning"),
    ("Age not listed", "Original ship date not listed"),
    ('device.warrantyExpires || "Date not listed"', 'device.warrantyExpires || "Warranty date not listed"'),
])
export_path.write_text(text)


# -----------------------------
# Version + regression coverage
# -----------------------------
package_path = Path("package.json")
package_text = package_path.read_text()
package_text = replace_once(package_text, '"version": "1.2.77"', '"version": "1.2.78"', "package version")
package_path.write_text(package_text)
Path("src/lib/app-version.ts").write_text('export const APP_VERSION = "1.2.78";')

Path("tests/v1278-report-clarity-budget.test.mjs").write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const outcome = fs.readFileSync("src/components/outcome-experience.tsx", "utf8");
const inventory = fs.readFileSync("src/lib/outcomes/pdf-inventory-sync.ts", "utf8");
const budget = fs.readFileSync("src/lib/outcomes/technology-budget-outlook.ts", "utf8");
const budgetUi = fs.readFileSync("src/components/technology-budget-outlook.tsx", "utf8");
const pdf = fs.readFileSync("src/lib/outcomes/export-html.ts", "utf8");

test("budget outlook is actually wired to both Present and Download", () => {
  assert.match(outcome, /TechnologyBudgetOutlookToggle/);
  assert.match(outcome, /includeTechnologyBudgetOutlook/);
  assert.match(outcome, /section === "budget"/);
  assert.match(outcome, /downloadOutcomePdf\(project, \{ includeTechnologyBudgetOutlook \}\)/);
  assert.match(pdf, /injectTechnologyBudgetOutlookPdf/);
  assert.match(pdf, /includeTechnologyBudgetOutlook/);
  assert.match(budgetUi, /Example four-quarter budget pace/);
  assert.match(budgetUi, /not financing or a payment plan/i);
});

test("inventory summary prioritizes useful Windows 10 information", () => {
  assert.match(inventory, /windows10Systems/);
  assert.match(inventory, /label: "Windows 10 systems"/);
  assert.match(inventory, /tone: "priority"/);
  assert.match(inventory, /zeroValuePriority/);
  assert.doesNotMatch(inventory, /label: "OS concerns"/);
});

test("inventory uses client-friendly age wording", () => {
  assert.match(inventory, /Plan soon by age/);
  assert.match(inventory, /Replace now by age/);
  assert.match(inventory, /Age to verify/);
  assert.match(inventory, /Original ship date not listed/);
  assert.doesNotMatch(inventory, /label: "Approaching lifecycle"/);
  assert.doesNotMatch(inventory, /label: "Lifecycle priorities"/);
  assert.doesNotMatch(inventory, /label: "Lifecycle to verify"/);
});

test("Windows 10 is red and Windows 11 is green in inventory visuals", () => {
  assert.match(inventory, /if \(isWindows10\(os\)\) return "priority"/);
  assert.match(inventory, /if \(isWindows11\(os\)\) return "healthy"/);
  assert.match(outcome, /Windows\\s\*10/);
  assert.match(outcome, /Windows\\s\*11/);
});

test("budget outlook uses age language in client copy", () => {
  assert.match(budget, /Locations with the most OS & age concerns/);
  assert.match(budgetUi, /Locations with the most OS & age concerns/);
  assert.doesNotMatch(budgetUi, /OS & lifecycle concerns/);
  assert.match(budget, /incomplete age data/);
});

test("release is v1.2.78", () => {
  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\.2\.78"/);
  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\.2\.78/);
});
''')
