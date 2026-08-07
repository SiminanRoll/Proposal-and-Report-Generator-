import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard = fs.readFileSync(new URL("../src/components/home-dashboard.tsx", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/project-workspace.tsx", import.meta.url), "utf8");
const experience = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const hipaa = fs.readFileSync(new URL("../src/components/hipaa-presentation.tsx", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("redundant generation prompt and homepage helper copy are removed", () => {
  assert.doesNotMatch(workspace, /Generate now|Generate the package|next-action-card/);
  assert.doesNotMatch(dashboard, /Three focused paths\. One shared report and proposal engine\./);
});

test("client report presentation follows the full guided story", () => {
  const intro = experience.indexOf('["overview", "security", "lifecycle", "details"]');
  const hipaaReview = experience.indexOf('project.hipaa.enabled ? ["hipaa"] : []');
  const completeFlow = experience.indexOf('return [...beginning, ...hipaa, "plan", "recap"]');
  assert.ok(intro >= 0);
  assert.ok(hipaaReview > intro);
  assert.ok(completeFlow > hipaaReview);
  assert.doesNotMatch(experience, /HIPAA readiness";/);
  for (const phrase of ["Technology overview", "Security protection", "Network health & lifecycle", "Hardware inventory", "Planning", "Final recap"]) {
    assert.match(experience, new RegExp(phrase));
  }
});

test("presentation includes infographic treatments for security lifecycle HIPAA and recap", () => {
  for (const className of ["security-funnel-visual", "lifecycle-segmented-bar", "environment-count-strip", "recap-score-grid"]) {
    assert.match(experience, new RegExp(className));
    assert.match(css, new RegExp(`\\.${className}`));
  }
  assert.match(hipaa, /hipaa-answer-bar/);
  assert.match(hipaa, /hipaa-results-metrics three-up/);
  assert.match(hipaa, /hipaa-readiness-meaning/);
  assert.doesNotMatch(hipaa, /hipaa-results-categories/);
  assert.match(hipaa, /Not sure|unanswered/);
});

test("hardware inventory cannot silently render as an empty area", () => {
  assert.match(experience, /presentation-device-table/);
  assert.match(experience, /hardware-empty-state/);
  assert.match(exportHtml, /Detailed device rows were not available/);
  assert.match(exportHtml, /ScalePad PDF or supported device spreadsheet/);
});

test("downloaded client package preserves intro-to-recap ordering", () => {
  const clientPackageStart = exportHtml.indexOf("Technology, security & compliance review");
  const security = exportHtml.indexOf('<span class="kicker">Security protection', clientPackageStart);
  const network = exportHtml.indexOf('<span class="kicker">Network health & lifecycle', security);
  const hardware = exportHtml.indexOf('<span class="kicker">Hardware inventory', network);
  const hipaaResults = exportHtml.indexOf("${hipaaSummaryHtml(project)}", hardware);
  const planning = exportHtml.indexOf('<span class="kicker">Planning', hipaaResults);
  const recap = exportHtml.indexOf('<span class="kicker">Final recap', planning);
  assert.ok(clientPackageStart >= 0);
  assert.ok(security > clientPackageStart);
  assert.ok(network > security);
  assert.ok(hardware > network);
  assert.ok(hipaaResults > hardware);
  assert.ok(planning > hipaaResults);
  assert.ok(recap > planning);
});

test("existing browser-cached reports can be reprocessed after parser upgrades", () => {
  assert.match(workspace, /getLocalSourceFile/);
  assert.match(workspace, /reprocessCachedSources/);
  assert.match(workspace, /Reprocess cached sources/);
  assert.match(workspace, /projectWithRebuiltIntelligence/);
});

test("cover uses the widescreen score-led layout and conditionally includes HIPAA", () => {
  assert.match(experience, /Technology<br \/>Health Review/);
  assert.match(experience, /Overall technology health|Provisional score/);
  for (const label of ["Security protection", "Network & lifecycle", "HIPAA readiness", "Aging Systems"]) {
    assert.match(experience, new RegExp(label.replace(/[&]/g, "\\&")));
  }
  assert.match(experience, /health-cover-main/);
  assert.match(experience, /project\.hipaa\.enabled && <HealthStatusCard/);
  assert.match(experience, /health-evidence-strip/);
  assert.match(exportHtml, /class="health-cover"/);
  assert.match(exportHtml, /class="overall-score/);
});

test("replacement machines are grouped before inventory and inventory is priority sorted", () => {
  assert.match(experience, /replacement-overview/);
  assert.match(experience, /replacement-device-grid/);
  assert.match(experience, /sortLifecycleDevicesByPriority\(inventoryReportDevices\(project\)\)/);
  assert.match(exportHtml, /replacement-grid/);
  assert.match(exportHtml, /Priority systems|Health priority details/);
  assert.match(exportHtml, /sortLifecycleDevicesByPriority\(inventoryReportDevices\(project\)\)/);
});

test("planning is generated from replacement HIPAA and security evidence", () => {
  assert.match(experience, /clientReportPlanActions\(project\)/);
  assert.match(experience, /Technology Consultant team/);
  assert.match(experience, /planning-context-strip/);
  assert.match(exportHtml, /clientReportPlanActions\(project\)/);
  assert.match(exportHtml, /Meet with your Technology Consultant/);
});


test("cover uses one prepared-date pill and lifecycle heading stays compact", () => {
  assert.match(experience, /preparedDate\(project\)/);
  assert.doesNotMatch(experience, /Lifecycle: \{lifecyclePeriod\}|Security: \{securityPeriod\}/);
  assert.match(experience, /networkPresentationMessage\(project\)/);
});

test("hardware inventory uses a restrained glass treatment", () => {
  assert.match(css, /presentation-device-table-wrap\{border:1px solid rgba\(255,255,255,\.34\)/);
  assert.match(css, /backdrop-filter:blur\(18px\) saturate\(1\.08\)/);
  assert.match(exportHtml, /device-table-wrap\{overflow-x:hidden;overflow-y:auto;scrollbar-width:thin/);
});


test("cover keeps health priorities neutral and removes early replacement sales language", () => {
  assert.match(experience, /health priorities/);
  assert.doesNotMatch(experience, /> under review<|Under review<|under review<|under review\}/i);
  assert.doesNotMatch(experience, /health-cover-replacements/);
  assert.doesNotMatch(exportHtml, /replacements\.length \? `<div class="replacement-strip"/);
});

test("planning and recap use consultant-led client language", () => {
  assert.match(experience, /What should happen next/);
  assert.match(experience, /Meet with your Technology Consultant/);
  assert.match(experience, /Schedule a Technology Consultant session/);
  assert.match(experience, /Today&apos;s takeaways/);
  assert.match(css, /planning-consultation-banner/);
  assert.match(css, /recap-roadmap/);
  assert.match(exportHtml, /Today&#39;s takeaways/);
});

test("recap HIPAA language is conditional when the module is disabled", () => {
  assert.match(experience, /project\.hipaa\.enabled && <div className=\{`recap-hipaa-status/);
  assert.doesNotMatch(experience, /with skipped HIPAA questions revisited/);
  assert.match(exportHtml, /project\.hipaa\.enabled \? `<div class="recap-hipaa/);
});


test("planning language does not force a phased rollout", () => {
  const plan = fs.readFileSync(new URL("../src/lib/outcomes/client-report-plan.ts", import.meta.url), "utf8");
  assert.doesNotMatch(`${experience}\n${plan}\n${exportHtml}`, /phased/i);
  assert.match(`${experience}\n${plan}\n${exportHtml}`, /technology roadmap|transition plan|replacement plan|action plan/i);
});


test("client-facing report excludes under-review assets and supports a clean-report path", () => {
  const plan = fs.readFileSync(new URL("../src/lib/outcomes/client-report-plan.ts", import.meta.url), "utf8");
  assert.match(experience, /reportableLifecycleDevices/);
  assert.doesNotMatch(experience, /<span><strong>\{lifecycle\.unknown\}<\/strong> under review<\/span>/i);
  assert.match(plan, /No immediate replacement or corrective action is recommended/);
  assert.match(plan, /Keep the healthy environment on track/);
  assert.match(experience, /Today&apos;s takeaways/);
});

test("presentation navigation includes a gradient progress rail and inventory uses slim scrollbars", () => {
  assert.match(experience, /presentation-progress-nav/);
  assert.match(experience, /--presentation-progress/);
  assert.match(css, /linear-gradient\(90deg,#37d3b1/);
  assert.match(css, /presentation-device-table-wrap::-webkit-scrollbar/);
});


test("network lifecycle scoring weights business-critical servers and planning is centered", () => {
  const score = fs.readFileSync(new URL("../src/lib/outcomes/client-report-score.ts", import.meta.url), "utf8");
  assert.match(score, /businessImpactWeight = \{ workstation: 1, server: 5, "backup-server": 4\.5, vm: 2, network: 2\.5 \}/);
  assert.match(score, /overdueServer[\s\S]*Math\.min\(lifecycleAndOsBase, 79\)/);
  assert.match(experience, /AgingSystemsCard/);
  assert.doesNotMatch(experience, /Action readiness/);
  assert.match(experience, /critical systems weighted/);
  assert.match(css, /\.presentation-stage\.presentation-stage-plan\{display:flex;align-items:center;justify-content:center\}/);
});


test("security and network headlines are dynamic client-result messages", () => {
  const messaging = fs.readFileSync(new URL("../src/lib/outcomes/client-report-messaging.ts", import.meta.url), "utf8");
  assert.match(experience, /securityPresentationMessage\(project\)/);
  assert.match(experience, /networkPresentationMessage\(project\)/);
  assert.match(messaging, /Your security protections are active, with no incidents reported/);
  assert.match(messaging, /Security activity was identified\./);
  assert.match(messaging, /A critical system needs planning attention/);
  assert.match(messaging, /Your technology is in a healthy position/);
  assert.match(exportHtml, /securityMessage\.title/);
  assert.match(exportHtml, /networkMessage\.title/);
});



test("reported security incidents are presented calmly with device, threat, and completed response details", () => {
  const messaging = fs.readFileSync(new URL("../src/lib/outcomes/client-report-messaging.ts", import.meta.url), "utf8");
  assert.match(messaging, /Advantage's security team is aware of the concern/);
  assert.match(messaging, /isolated the computer, cleaned the affected file, and deleted the malicious file/);
  assert.match(experience, /securityIncidentResponseMessage\(project\)/);
  assert.match(experience, /security-incident-response/);
  assert.match(experience, /Affected computer/);
  assert.match(experience, /Threat identified/);
  assert.match(exportHtml, /incident-response-card/);
  assert.match(exportHtml, /pdf-incident-response/);
  assert.doesNotMatch(`${experience}
${exportHtml}`, /Follow-up remains open/);
  assert.match(css, /\.security-incident-response/);
});



test("security response layout separates the outcome headline from technical details", () => {
  const messaging = fs.readFileSync(new URL("../src/lib/outcomes/client-report-messaging.ts", import.meta.url), "utf8");
  assert.match(messaging, /Threat contained and removed/);
  assert.match(experience, /security-response-details/);
  assert.match(experience, /security-response-actions/);
  assert.match(exportHtml, /feature-metric-pair/);
  assert.match(exportHtml, /incident-response-details/);
  assert.match(exportHtml, /CLIENT_REPORT_REFINEMENTS_CSS/);
});

test("operating-system support concerns are filterable and included in planning and PDF packets", () => {
  const data = fs.readFileSync(new URL("../src/lib/outcomes/client-report-data.ts", import.meta.url), "utf8");
  const plan = fs.readFileSync(new URL("../src/lib/outcomes/client-report-plan.ts", import.meta.url), "utf8");
  assert.match(data, /Windows[\s\S]*10/);
  assert.match(data, /Server[\s\S]*2012/);
  assert.match(data, /Server[\s\S]*2016/);
  assert.match(data, /Windows[\s\S]*11/);
  assert.match(experience, /setFilter\("os"\)/);
  assert.match(experience, /os-support-panel/);
  assert.match(experience, /OS support concerns/);
  assert.match(exportHtml, /pdf-device-focus-grid/);
  assert.match(exportHtml, /Operating system/);
  assert.match(exportHtml, /reportIconHtml\("windows"\)/);
  assert.doesNotMatch(exportHtml, /pdf-site-os/);
  assert.match(plan, /operating-system-support/);
});

test("planning status replaces the artificial action-readiness score", () => {
  const score = fs.readFileSync(new URL("../src/lib/outcomes/client-report-score.ts", import.meta.url), "utf8");
  const messaging = fs.readFileSync(new URL("../src/lib/outcomes/client-report-messaging.ts", import.meta.url), "utf8");
  assert.doesNotMatch(score, /planning:/);
  assert.doesNotMatch(score, /recommendationCoverage|lifecycleExecution|hipaaFollowThrough/);
  assert.match(score, /security \* 0\.5/);
  assert.match(score, /network \* 0\.5/);
  assert.match(messaging, /Consultation recommended/);
  assert.match(messaging, /Routine monitoring/);
});

test("presentation sections animate with direction, stagger, and reduced-motion support", () => {
  assert.match(experience, /presentation-slide-motion/);
  assert.match(experience, /motion-\$\{direction\}/);
  assert.match(experience, /navigateTo\(item\)/);
  assert.match(css, /@keyframes presentationSlideForward/);
  assert.match(css, /@keyframes presentationRise/);
  assert.match(css, /presentationBarReveal/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("presentation metrics count up and infographic motion stays guided", () => {
  const animatedNumber = fs.readFileSync(new URL("../src/components/animated-number.tsx", import.meta.url), "utf8");
  assert.match(animatedNumber, /requestAnimationFrame/);
  assert.match(animatedNumber, /prefers-reduced-motion: reduce/);
  assert.match(experience, /AnimatedNumber/);
  assert.match(hipaa, /AnimatedNumber/);
  assert.match(css, /presentationScoreSweep/);
  assert.match(css, /securityArrowFlow/);
  assert.match(css, /inventoryRowReveal/);
  assert.match(css, /planningPathReveal/);
  assert.match(css, /hipaaMeterReveal/);
  assert.match(css, /activeProgressDot/);
});

test("presentation uses a client-facing tab title and offers a print-ready PDF handoff", () => {
  assert.match(experience, /clientFacingDocumentTitle/);
  assert.match(experience, /document\.title = presentationDocumentTitle/);
  assert.match(experience, /Download PDF/);
  assert.match(experience, /downloadOutcomePdf\(project\)/);
  assert.match(exportHtml, /export function clientFacingDocumentTitle/);
  assert.match(exportHtml, /Technology Health Review/);
  assert.match(exportHtml, /export async function downloadOutcomePdf/);
  assert.match(exportHtml, /window\.print\(\)/);
  assert.match(exportHtml, /@page\{size:landscape/);
  assert.match(css, /\.presentation-topbar-actions/);
  assert.match(css, /\.presentation-pdf/);
});

test("planning connectors stay in card gaps and presentation stats retain readable scale", () => {
  assert.match(css, /\.action-plan-grid::before\{[\s\S]*display:none/);
  assert.match(css, /\.action-plan-grid article:not\(:last-child\)::after/);
  assert.match(css, /right:-17px/);
  assert.match(css, /\.planning-context-strip strong,[\s\S]*font-size:clamp\(30px,2vw,36px\)/);
  assert.match(css, /\.recap-score-grid strong\{[\s\S]*font-size:clamp\(40px,2\.7vw,48px\)/);
  assert.match(css, /@media\(max-width:1180px\)[\s\S]*article:not\(:last-child\)::after\{display:none\}/);
});

test("client report sections retain presentation-distance metric sizing", () => {
  assert.match(experience, /presentation-stage presentation-stage-\$\{section\}/);
  assert.match(css, /\.health-score-card\.status-only>strong\{[\s\S]*font-size:clamp\(28px,2vw,38px\)/);
  assert.match(css, /\.health-evidence-strip strong,[\s\S]*font-size:clamp\(39px,2\.55vw,48px\)/);
  assert.match(css, /\.security-funnel-step strong\{[\s\S]*font-size:clamp\(56px,3\.85vw,68px\)/);
  assert.match(css, /\.environment-count-strip strong\{[\s\S]*font-size:clamp\(39px,2\.55vw,48px\)/);
  assert.match(css, /\.lifecycle-metric-grid strong\{[\s\S]*font-size:clamp\(58px,3\.65vw,68px\)/);
  assert.match(css, /\.hardware-summary-ribbon strong\{[\s\S]*font-size:clamp\(39px,2\.55vw,48px\)/);
  assert.match(css, /\.planning-context-strip strong\{[\s\S]*font-size:clamp\(39px,2\.55vw,48px\)/);
  assert.match(css, /\.recap-score-grid strong\{[\s\S]*font-size:clamp\(53px,3\.35vw,62px\)/);
});

test("PDF handoff uses a separate document layout that can flow without fixed-height clipping", () => {
  assert.match(exportHtml, /class="print-report"/);
  assert.match(exportHtml, /@media screen\{\.print-report\{display:none!important\}/);
  assert.match(exportHtml, /@media print\{/);
  assert.match(exportHtml, /\.screen-report,\.toolbar\{display:none!important\}/);
  assert.match(exportHtml, /\.pdf-page,\.pdf-flow-page\{min-height:0;display:block;break-inside:auto/);
  assert.match(exportHtml, /\.pdf-cover\{min-height:7\.55in;display:flex;flex-direction:column\}/);
  assert.match(exportHtml, /\.print-report thead\{display:table-header-group\}/);
  assert.match(exportHtml, /\.pdf-device-table tbody\{break-inside:auto/);
  assert.doesNotMatch(exportHtml, /\.pdf-page\{min-height:7\.68in;display:flex/);
});

test("animated metrics inherit their numeric parent and HIPAA planning score stays unified", () => {
  assert.match(css, /\.presentation-overlay \.animated-number\{[\s\S]*font-size:inherit!important/);
  assert.match(css, /\.presentation-overlay \.animated-number::after\{[\s\S]*content:none!important/);
  assert.match(css, /\.security-funnel-step>strong\{font-size:clamp\(60px,4\.15vw,76px\)/);
  assert.match(css, /\.recap-score-grid article>strong\{font-size:clamp\(58px,3\.7vw,70px\)/);
  assert.match(css, /\.hipaa-results-metrics article>strong\{font-size:clamp\(42px,2\.75vw,52px\)/);
  assert.match(experience, /className="planning-context-value"/);
  assert.match(experience, /<em>\/100<\/em>/);
  assert.doesNotMatch(experience, /<AnimatedNumber value=\{hipaa\.overall\} delay=\{580\} \/>\/100/);
});


test("server planning uses plain client language without device names in narrative copy", () => {
  const data = fs.readFileSync(new URL("../src/lib/outcomes/client-report-data.ts", import.meta.url), "utf8");
  const plan = fs.readFileSync(new URL("../src/lib/outcomes/client-report-plan.ts", import.meta.url), "utf8");
  const messaging = fs.readFileSync(new URL("../src/lib/outcomes/client-report-messaging.ts", import.meta.url), "utf8");
  assert.match(data, /server: 0,[\s\S]*"backup-server": 1,[\s\S]*workstation: 2/);
  assert.match(data, /CP\[\\s_-\]\?BDR/);
  assert.match(data, /CPBR/);
  assert.match(data, /EQUUS/);
  assert.match(data, /if \(type === "server"\) return "Primary server"/);
  assert.match(data, /if \(type === "backup-server"\) return "Cloud Plus backup server"/);
  assert.match(experience, /device\.type === "server" \? "Primary server"/);
  assert.match(experience, /device\.type === "backup-server" \? "Cloud Plus backup server"/);
  assert.match(plan, /"Plan the server's next step"/);
  assert.match(plan, /replaced, migrated, or safely retired/i);
  assert.match(plan, /selectedTitle = remote[\s\S]*Schedule a consultation call with your Technology Consultant[\s\S]*Schedule an onsite project-planning review/);
  assert.match(plan, /actionTitle: "Determine the direction"/);
  assert.match(plan, /actionDetail: primaryServer[\s\S]*Confirm whether the server should be replaced, migrated, or safely retired/);
  assert.match(plan, /An onsite project-planning review will confirm the \${applicationPlanningCopy\(project\)}, connected equipment, and timing/);
  assert.match(plan, /When you are ready, our team can help confirm the right business-class computer/);
  assert.match(plan, /title: approach\.hasServerProject \? "Build the transition plan" : "Build the project plan"/);
  assert.match(plan, /detail: "Prepare the scope, estimated cost, responsibilities, and timing\."/);
  assert.doesNotMatch(plan, /Use the onsite findings to confirm the entire replacement scope/);
  assert.doesNotMatch(plan, /primaryServer\.name|backupServer\.name|serverNames|names\(priorities/);
  assert.match(messaging, /title: "Both servers need a next-step plan\."/);
  assert.match(messaging, /title: "The server needs a next-step plan\."/);
  assert.match(messaging, /planning window[\s\S]*replaced, migrated, or safely retired/i);
  assert.doesNotMatch(messaging, /priorityPrimaryServer\.name|priorityBackupServer\.name/);
  assert.doesNotMatch(exportHtml, /No pressure - just a clear plan/);
  assert.match(exportHtml, /const actionLabel = isServerClassDevice\(device\) \? "Plan next step" : device\.lifecycleStatus === "overdue" \? "Replace when ready" : "Plan ahead"/);
  assert.match(experience, /label=\{isServerClassDevice\(device\) \? "Plan next step" : undefined\}/);
  assert.doesNotMatch(exportHtml, /Cloud Plus BDR · backup emergency server|Primary server · most critical/);
  assert.doesNotMatch(plan, /replace the server first|workstations later|remaining systems later/i);
});

test("primary server and Cloud Plus backup server carry equal visual urgency", () => {
  assert.match(css, /\.replacement-device-grid article\.priority-server,\s*\.replacement-device-grid article\.priority-backup-server\{/);
  assert.match(css, /border-color:rgba\(239,128,98,\.78\)!important/);
  assert.match(css, /\.environment-count-strip\.server-first \.backup-server-count\{[\s\S]*background:linear-gradient\(145deg,rgba\(21,72,139,\.96\),rgba\(12,41,82,\.98\)\)/);
  assert.match(css, /device-row-overdue\.device-row-type-server[\s\S]*device-row-overdue\.device-row-type-backup-server[\s\S]*#ef8062/);
  assert.match(exportHtml, /priority-server,\.replacement-grid article\.priority-backup-server\{border-color:#ef8062/);
  assert.match(exportHtml, /device-overdue\.device-type-server[\s\S]*device-overdue\.device-type-backup-server[\s\S]*var\(--red\)/);
});

test("security close explains managed protection in clear client language", () => {
  const messaging = fs.readFileSync(new URL("../src/lib/outcomes/client-report-messaging.ts", import.meta.url), "utf8");
  for (const phrase of ["protected 24/7", "anti-malware", "anti-ransomware", "advanced threat detection and response", "ready to act", "before connecting a new or replacement computer", "protected from day one", "No security solution can eliminate every risk"]) {
    assert.match(messaging, new RegExp(phrase, "i"));
  }
  assert.doesNotMatch(messaging, /onboarded system|detection events within the scope/i);
  assert.match(experience, /Keeping your protection complete/);
  assert.match(experience, /security-protection-statement/);
  assert.match(exportHtml, /Keeping your protection complete/);
  assert.match(exportHtml, /pdf-security-statement/);
  assert.match(exportHtml, /security-protection-statement/);
});

test("standalone warranty summaries are removed while device-level warranty evidence remains", () => {
  const data = fs.readFileSync(new URL("../src/lib/outcomes/client-report-data.ts", import.meta.url), "utf8");
  assert.match(data, /export type WarrantyStatus/);
  const technicalTruth = fs.readFileSync(new URL("../src/lib/technical-truth/index.ts", import.meta.url), "utf8");
  assert.match(data, /classifyTechnicalWarranty/);
  assert.match(technicalTruth, /warrantyPlanningMonths: 12/);
  assert.match(experience, /WarrantyStatusBadge/);
  assert.match(experience, /<th>Warranty status<\/th>/);
  assert.doesNotMatch(experience, /support-health-grid|inventory-warranty-ribbon/);
  assert.doesNotMatch(exportHtml, /pdf-warranty-line|pdf-inventory-warranty|class="support-lines"|class="inventory-warranty"/);
  assert.match(exportHtml, /warrantyStatusLabel/);
  assert.match(css, /support-health-grid,[\s\S]*inventory-warranty-ribbon\{[\s\S]*display:none!important/);
  assert.match(css, /warranty-status-out-of-warranty/);
});

test("physical asset totals and priority cards use one consistent policy", () => {
  const data = fs.readFileSync(new URL("../src/lib/outcomes/client-report-data.ts", import.meta.url), "utf8");
  const adapters = fs.readFileSync(new URL("../src/lib/intelligence/browser/report-adapters.ts", import.meta.url), "utf8");
  assert.match(data, /export function physicalAssetCounts/);
  assert.match(data, /const assessed = current \+ dueSoon \+ overdue/);
  assert.match(data, /inventoryTotal/);
  assert.match(data, /lifecycleStatus: "current" \| "due-soon" \| "overdue" \| "unknown"/);
  assert.match(data, /normalizedLifecycleStatus/);
  assert.match(data, /virtual machine/i);
  const technicalTruth = fs.readFileSync(new URL("../src/lib/technical-truth/index.ts", import.meta.url), "utf8");
  assert.match(adapters, /classifyTechnicalLifecycle/);
  assert.match(technicalTruth, /workstationReplaceNowYears: 7/);
  assert.match(technicalTruth, /workstationPlanSoonYears: 5/);
  assert.match(technicalTruth, /serverCriticalYears: 7/);
  assert.match(technicalTruth, /serverExpiredWarrantyCriticalYears: 6/);
  assert.doesNotMatch(adapters, /index < overdueCount/);
  assert.match(css, /replacement-device-grid article\.priority-server[\s\S]*background:linear-gradient[\s\S]*important/);
  assert.match(exportHtml, /replacement-grid article\{[\s\S]*background:linear-gradient\(145deg,#183b68,#0a2346\)/);
});


test("client report presentations and exports hide raw CPBDR hostnames", () => {
  const data = fs.readFileSync(new URL("../src/lib/outcomes/client-report-data.ts", import.meta.url), "utf8");
  const plan = fs.readFileSync(new URL("../src/lib/outcomes/client-report-plan.ts", import.meta.url), "utf8");
  assert.match(data, /clientDeviceDisplayName[\s\S]*CloudPlusBDR/);
  assert.match(experience, /clientDeviceDisplayName\(device\)/);
  assert.match(exportHtml, /clientDeviceDisplayName\(device\)/);
  assert.doesNotMatch(plan, /device\.name|device\.serial|clientDeviceDisplayName\(device\)/);
});

test("client PDF uses a compact upright ink-conscious layout", () => {
  assert.match(exportHtml, /meta name="adv-pdf-layout" content="portrait"/);
  assert.match(exportHtml, /@page\{size:Letter portrait/);
  assert.match(exportHtml, /Security and technology health/);
  assert.match(exportHtml, /const locationGroups = locationLabels\.map/);
  assert.match(exportHtml, /pdf-focus-page/);
  assert.match(exportHtml, /What to keep on your radar/);
  assert.match(exportHtml, /Most of the environment is in good shape/);
  assert.match(exportHtml, /const byDevice = new Map/);
  assert.match(exportHtml, /for \(let index = 0; index < cards\.length; index \+= 6\)/);
  assert.doesNotMatch(exportHtml, /Virtual systems at this location/);
  assert.match(exportHtml, /for \(let index = 0; index < outstanding\.length; index \+= 2\)/);
  assert.match(exportHtml, /pdf-response-completion/);
});

test("onsite scheduling is self-explanatory without click-hint copy", () => {
  const scheduler = fs.readFileSync(new URL("../src/components/onsite-planning-scheduler.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(scheduler, /Click to choose a date/i);
  assert.doesNotMatch(css, /planning-schedule-hint/);
});

test("planning and recap metric cards are compact and share one large number scale", () => {
  assert.match(css, /\.planning-context-strip>span\{[\s\S]*?min-height:88px/);
  assert.match(css, /\.planning-context-strip>span>strong,[\s\S]*?font-size:clamp\(62px,3\.7vw,70px\)/);
  assert.match(css, /\.recap-score-grid article\{[\s\S]*?min-height:112px/);
});

test("hardware inventory shows device model and video card as separate details", () => {
  assert.match(experience, /<th>Device model<\/th><th>Video card<\/th>/);
  assert.match(experience, /graphicsSummary\(device\.graphics\)/);
  assert.match(exportHtml, /<th>Device model<\/th><th>Video card<\/th><th>Storage<\/th>/);
  assert.match(exportHtml, /graphicsSummary\(device\.graphics\)/);
});

test("hardware inventory cards filter interactively and storage stays separate from lifecycle", () => {
  assert.match(experience, /aria-pressed=\{filter === card\.key\}/);
  assert.match(experience, /onClick=\{\(\) => setFilter\(card\.key\)\}/);
  assert.match(experience, /filter === "storage"/);
  assert.match(experience, /setFilter\("storage"\)/);
  assert.match(css, /hardware-summary-ribbon button:hover/);
  assert.match(css, /hardware-summary-ribbon button\.active/);
  assert.match(exportHtml, /data-inventory-filter="all"/);
  assert.match(exportHtml, /querySelectorAll\('\[data-inventory-filter\]'\)/);
  assert.match(exportHtml, /data-inventory-filter="storage"/);
  assert.match(exportHtml, /storage==='watch'\|\|storage==='critical'/);
  assert.match(experience, /Storage pressure is tracked separately from lifecycle replacement/);
  assert.match(exportHtml, /Disk volume usage:/);
  assert.match(exportHtml, /What this means for you/);
});

test("client report accepts either a ScalePad PDF or a device spreadsheet export", () => {
  const templates = fs.readFileSync(new URL("../src/lib/projects/templates.ts", import.meta.url), "utf8");
  assert.match(templates, /ScalePad report or device export/);
  for (const extension of [".pdf", ".csv", ".xlsx", ".xls"]) assert.match(templates, new RegExp(`\\${extension}`));
  assert.match(experience, /ScalePad PDF or supported device spreadsheet/);
  assert.match(exportHtml, /ScalePad PDF or supported device spreadsheet/);
});
