from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing patch anchor: {label}")
    return text.replace(old, new, 1)


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
outcome_path.write_text(text)

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
export_path.write_text(text)

package_path = Path("package.json")
package_text = package_path.read_text()
package_text = replace_once(package_text, '"version": "1.2.76"', '"version": "1.2.77"', "package version")
package_path.write_text(package_text)

Path("src/lib/app-version.ts").write_text('export const APP_VERSION = "1.2.77";')

lock_path = Path("package-lock.json")
lock_text = lock_path.read_text()
lock_text = lock_text.replace('"version": "1.1.73"', '"version": "1.2.77"', 2)
lock_path.write_text(lock_text)

Path("tests/v1277-technology-budget-outlook.test.mjs").write_text('''import test from "node:test";\nimport assert from "node:assert/strict";\nimport fs from "node:fs";\n\nconst outcome = fs.readFileSync("src/components/outcome-experience.tsx", "utf8");\nconst budget = fs.readFileSync("src/lib/outcomes/technology-budget-outlook.ts", "utf8");\nconst budgetUi = fs.readFileSync("src/components/technology-budget-outlook.tsx", "utf8");\nconst pdf = fs.readFileSync("src/lib/outcomes/export-html.ts", "utf8");\n\ntest("technology budget outlook is optional and shared by presentation and PDF", () => {\n  assert.match(outcome, /includeTechnologyBudgetOutlook/);\n  assert.match(outcome, /TechnologyBudgetOutlookToggle/);\n  assert.match(outcome, /section === "budget"/);\n  assert.match(outcome, /downloadOutcomePdf\\(project, \\{ includeTechnologyBudgetOutlook \\}\\)/);\n  assert.match(pdf, /injectTechnologyBudgetOutlookPdf/);\n  assert.match(pdf, /includeTechnologyBudgetOutlook/);\n});\n\ntest("budget calculation uses report truth and current workstation planning values", () => {\n  assert.match(budget, /inventoryReportDevices\\(project\\)/);\n  assert.match(budget, /compassLocationSnapshots\\(project\\)/);\n  assert.match(budget, /standardWorkstationModernization \\+ config\\.value\\.workstationDeploymentAllowance/);\n  assert.match(budget, /planningContingencyPercent/);\n  assert.match(budget, /Windows\\\\s\\*10/);\n  assert.match(budget, /lifecycleStatus === "unknown"/);\n});\n\ntest("client copy labels estimates as planning guidance and shows quarterly example", () => {\n  assert.match(budgetUi, /What should we plan to budget for soon\\?/);\n  assert.match(budgetUi, /Rough near-term workstation planning range/);\n  assert.match(budgetUi, /Example four-quarter budget pace/);\n  assert.match(budgetUi, /not a formal quote/i);\n  assert.match(budgetUi, /not financing or a payment plan/i);\n  assert.match(budget, /Locations with the most OS & lifecycle concerns/);\n});\n''')
