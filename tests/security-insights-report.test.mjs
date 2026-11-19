import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const parserSource = read("../src/lib/intelligence/browser/security-insights-report.ts");
const adapter = read("../src/lib/intelligence/browser/report-adapters.ts");
const browser = read("../src/lib/intelligence/browser/analyze-file.ts");
const slides = read("../src/components/outcome-experience.tsx");
const page = read("../src/components/security-insights-presentation.tsx");
const pdf = read("../src/lib/outcomes/export-html.ts");

async function parser() {
  const ts = (await import("typescript")).default;
  const js = ts.transpileModule(parserSource, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  } }).outputText;
  return import("data:text/javascript;charset=utf-8," + encodeURIComponent(js));
}

const NEW_REPORT = [
  "[[PAGE 1]]",
  "Example Client\nSecurity Insights Report\n10/1 - 10/31/2026",
  "[[PAGE 2]]",
  "Security Insights Report\nExecutive Summary\nThis period we resolved\n0 Incidents",
  "SOC Analysis Breakdown\n6.11M Events Across All Your Environments",
  "36 Filtered for Suspicious Activity\n0 Investigations\n0 Incidents Resolved\nActive EDR\n36 Endpoints",
  "[[PAGE 3]]",
  "Endpoint Detection and Response through Managed EDR",
  "36 Protected Endpoints",
  "Our cybersecurity platform analyzed 6,107,555 events across 36 endpoints.",
  "Our AI-Centric SOC opened 0 investigations. Those resulted in 0 incidents that required remediation.",
  "6,107,555 Events\n0 Investigations\n0 Incidents Resolved",
  "[[PAGE 4]]",
  "Managed EDR\nDetection Capabilities",
  "564 Canary Files Placed\n103 Protected User Profiles\n0 Ransomware Incidents",
  "36,015 Autorun Events Analyzed\n0 Autorun Investigations\n0 Autorun Incidents",
  "6,070,902 Process Events Analyzed\n0 Process Investigations\n0 Process Incidents",
  "[[PAGE 5]]",
  "Managed Antivirus\n380 Defender Exclusions",
  "35 Hosts Running Defender\nDefender Event Summary\n2 0 0\nEvents Investigations Incidents",
  "Exclusion Risk Breakdown\n364\n16\nRisky Normal\nDefender Exclusions are settings",
  "35 Hosts with real-time protection enabled\n35 Hosts with signatures up to date",
  "5 Hosts with Tamper Protection disabled\n35 Hosts with scans within past week",
  "[[PAGE 6]]",
  "Firewall Status Monitoring\nFirewall Status Reporting by Eligible Agents",
  "0 Hosts with firewall enabled\n36 Hosts with firewall disabled",
  "0 Hosts with firewall enabled with a policy conflict",
  "0 Hosts with firewall disabled with a policy conflict",
  "[[PAGE 7]]",
  "External Recon\n65 Analyzed Services\nScan Results",
  "36 External IP Addresses\n65 Externally Available Ports",
  "65\n0\nRisky Normal",
  "Sample of Analyzed Services on Network Ports\nHTTPS-SIMPLE-NEW IKE IKE-NAT-T",
].join("\n");

function allFacts(result) {
  return Object.fromEntries(result.facts.map((item) => [item.key, item.value]));
}

test("new monthly Security Insights is detected and preserves exact event totals", async () => {
  const {isSecurityInsightsReport,parseSecurityInsightsReport} = await parser();
  assert.equal(isSecurityInsightsReport(NEW_REPORT), true);
  assert.equal(isSecurityInsightsReport("Huntress Threat Report\n1,000 events"), false);
  const result = parseSecurityInsightsReport(NEW_REPORT,"source-example","monthly.pdf");
  const facts = allFacts(result);
  assert.equal(result.sourceType,"huntress");
  assert.equal(result.confidence,"high");
  assert.equal(facts["huntress.reportFormat"],"security-insights");
  assert.equal(facts["huntress.reportPeriod"],"10/1 - 10/31/2026");
  assert.equal(facts["huntress.eventsAnalyzed"],6107555);
  assert.equal(facts["huntress.entitiesProtected"],36);
  assert.equal(facts["huntress.signalsDetected"],36);
  assert.equal(facts["huntress.filteredActivity"],36);
  assert.equal(facts["huntress.signalsInvestigated"],0);
  assert.equal(facts["huntress.incidentsReported"],0);
  assert.ok(result.facts.every((item) => item.sourceFileId === "source-example" && item.evidence));
});

test("canary, autorun, process and Defender data don't create fictitious malware blocks", async () => {
  const {parseSecurityInsightsReport} = await parser();
  const facts = allFacts(parseSecurityInsightsReport(NEW_REPORT,"source-example","monthly.pdf"));
  for(const [key,expected] of Object.entries({
    "huntress.canaryFiles":564,
    "huntress.protectedProfiles":103,
    "huntress.ransomwareIncidents":0,
    "huntress.autorunEvents":36015,
    "huntress.autorunSignalsInvestigated":0,
    "huntress.processEvents":6070902,
    "huntress.processSignalsInvestigated":0,
    "huntress.defenderHosts":35,
    "huntress.antivirusEvents":2,
    "huntress.antivirusSignalsInvestigated":0,
    "huntress.antivirusIncidents":0,
    "huntress.defenderRealtimeHosts":35,
    "huntress.defenderSignatureCurrentHosts":35,
    "huntress.defenderRecentScanHosts":35,
    "huntress.defenderTamperDisabledHosts":5,
    "huntress.defenderExclusions":380,
  })) assert.equal(facts[key],expected,key);
  assert.equal(Object.hasOwn(facts,"huntress.malwareFilesBlocked"),false);
  assert.equal(Object.hasOwn(facts,"huntress.autorunSignals"),false);
});

test("multi-column PDF rows preserve ransomware canaries, profiles, autoruns and process metrics", async () => {
  const { parseSecurityInsightsReport } = await parser();
  // The browser groups separate columns sharing a baseline into one text row.
  // This anonymized layout matches the new eight-page styled Huntress report.
  const multiColumn = NEW_REPORT.replace(
    /(\[\[PAGE 4\]\])[\s\S]*?(\[\[PAGE 5\]\])/,
    [
      "[[PAGE 4]]",
      "Managed EDR Detection Capabilities",
      "Ransomware Canaries Persistent Footholds Process Insights",
      "564 Canary Files Placed 36,015 Autorun Events Analyzed 6,070,902 Process Events Analyzed",
      "103 Protected User Profiles 0 Autorun Investigations 0 Process Investigations",
      "0 Ransomware Incidents 0 Autorun Incidents 0 Process Incidents",
      "[[PAGE 5]]",
    ].join("\n"),
  );
  const output = parseSecurityInsightsReport(multiColumn, "anonymized-source", "report.pdf");
  const facts = allFacts(output);
  assert.equal(facts["huntress.canaryFiles"], 564);
  assert.equal(facts["huntress.protectedProfiles"], 103);
  assert.equal(facts["huntress.ransomwareIncidents"], 0);
  assert.equal(facts["huntress.autorunEvents"], 36015);
  assert.equal(facts["huntress.autorunSignalsInvestigated"], 0);
  assert.equal(facts["huntress.footholdIncidents"], 0);
  assert.equal(facts["huntress.processEvents"], 6070902);
  assert.equal(facts["huntress.processSignalsInvestigated"], 0);
  assert.equal(facts["huntress.processIncidents"], 0);
  assert.ok(output.warnings.every((warning) => !/SOC events do not reconcile/i.test(warning)));
});

test("multi-column matching cannot mistake a firewall policy-conflict row for enabled host coverage", async () => {
  const { parseSecurityInsightsReport } = await parser();
  const missingEnabledCount = NEW_REPORT.replace("0 Hosts with firewall enabled\n", "");
  const output = parseSecurityInsightsReport(missingEnabledCount, "anonymized-source", "report.pdf");
  const facts = allFacts(output);
  assert.equal(Object.hasOwn(facts, "huntress.firewallEnabledHosts"), false);
  assert.equal(facts["huntress.firewallEnabledConflicts"], 0);
  assert.equal(facts["huntress.firewallDisabledHosts"], 36);
});

test("firewall and recon findings remain separate from incident counts", async () => {
  const {parseSecurityInsightsReport} = await parser();
  const result = parseSecurityInsightsReport(NEW_REPORT,"source-example","monthly.pdf");
  const facts = allFacts(result);
  assert.equal(facts["huntress.firewallDisabledHosts"],36);
  assert.equal(facts["huntress.firewallEnabledHosts"],0);
  assert.equal(facts["huntress.firewallEnabledConflicts"],0);
  assert.equal(facts["huntress.firewallDisabledConflicts"],0);
  assert.equal(facts["huntress.externalIpAddresses"],36);
  assert.equal(facts["huntress.externallyAvailablePorts"],65);
  assert.equal(facts["huntress.externalServicesAnalyzed"],65);
  assert.ok(result.findingCandidates.some((item) => /firewall/i.test(item.title) && item.severity === "attention"));
  assert.ok(result.findingCandidates.some((item) => /tamper/i.test(item.title)));
  assert.ok(result.findingCandidates.some((item) => item.severity === "healthy" && /No security incidents/i.test(item.title)));
  assert.ok(result.findingCandidates.every((item) => !/Sample Client|Example Client/i.test(item.clientSummary)));
});

test("chart numbers never become a misleading Risky/Normal assignment", async () => {
  const {parseSecurityInsightsReport} = await parser();
  const facts = allFacts(parseSecurityInsightsReport(NEW_REPORT, "source-example", "monthly.pdf"));
  assert.equal(facts["huntress.defenderExclusions"], 380);
  assert.equal(facts["huntress.externalServicesAnalyzed"], 65);
  assert.equal(Object.hasOwn(facts, "huntress.defenderRiskyExclusions"), false);
  assert.equal(Object.hasOwn(facts, "huntress.defenderNormalExclusions"), false);
  assert.equal(Object.hasOwn(facts, "huntress.externalRiskyServices"), false);
  assert.equal(Object.hasOwn(facts, "huntress.externalNormalServices"), false);

  // Explicitly labeled category numbers with a matching total are reliable.
  const labeled = NEW_REPORT
    .replace("364\n16\nRisky Normal", "16 Risky\n364 Normal")
    .replace("65\n0\nRisky Normal", "0 Risky\n65 Normal");
  const known = allFacts(parseSecurityInsightsReport(labeled, "source-example", "monthly.pdf"));
  assert.equal(known["huntress.defenderRiskyExclusions"], 16);
  assert.equal(known["huntress.defenderNormalExclusions"], 364);
  assert.equal(known["huntress.externalRiskyServices"], 0);
  assert.equal(known["huntress.externalNormalServices"], 65);
});

test("impossible host numbers are rejected rather than shown to clients", async () => {
  const {parseSecurityInsightsReport} = await parser();
  const wrong = NEW_REPORT
    .replace("36 Protected Endpoints", "61 Protected Endpoints")
    .replace("events across 36 endpoints", "events across 61 endpoints")
    .replace("35 Hosts Running Defender", "1,921 Hosts Running Defender");
  const parsed = parseSecurityInsightsReport(wrong, "source-example", "monthly.pdf");
  const facts = allFacts(parsed);
  assert.equal(facts["huntress.entitiesProtected"], 61);
  assert.equal(Object.hasOwn(facts, "huntress.defenderHosts"), false);
  assert.match(parsed.warnings.join(" "), /Defender host count.*exceeds 61 protected endpoints/);
  assert.equal(facts["huntress.defenderRealtimeHosts"], 35);
  assert.equal(facts["huntress.incidentsReported"], 0);
});

test("split styled report labels and contradictory counts are handled conservatively", async () => {
  const {parseSecurityInsightsReport} = await parser();
  const split = NEW_REPORT
    .replace("35 Hosts Running Defender", "35\nHosts Running Defender")
    .replace("36 External IP Addresses", "36\nExternal IP Addresses");
  const exact = allFacts(parseSecurityInsightsReport(split, "source-example", "monthly.pdf"));
  assert.equal(exact["huntress.defenderHosts"], 35);
  assert.equal(exact["huntress.externalIpAddresses"], 36);

  const contradictory = NEW_REPORT
    .replace("0 Hosts with firewall enabled", "12 Hosts with firewall enabled")
    .replace("36 Hosts with firewall disabled", "36 Hosts with firewall disabled")
    .replace("65 Externally Available Ports", "0 Externally Available Ports");
  const parsed = parseSecurityInsightsReport(contradictory, "source-example", "monthly.pdf");
  const facts = allFacts(parsed);
  assert.equal(Object.hasOwn(facts, "huntress.firewallEnabledHosts"), false);
  assert.equal(Object.hasOwn(facts, "huntress.firewallDisabledHosts"), false);
  assert.equal(Object.hasOwn(facts, "huntress.externallyAvailablePorts"), false);
  assert.match(parsed.warnings.join(" "), /Host firewall status counts exceed|Port count is zero/);
});

test("SOC volumes are not inflated or mislabeled when category totals disagree", async () => {
  const {parseSecurityInsightsReport} = await parser();
  const wrong = NEW_REPORT.replaceAll("6,107,555", "62,000,000");
  const parsed = parseSecurityInsightsReport(wrong, "source-example", "monthly.pdf");
  const facts = allFacts(parsed);
  assert.equal(Object.hasOwn(facts, "huntress.eventsAnalyzed"), false);
  assert.match(parsed.warnings.join(" "), /SOC events do not reconcile/);
});

test("rounded chart totals stay explicitly marked approximate when exact count is unavailable", async () => {
  const {parseSecurityInsightsReport} = await parser();
  const chartOnly = NEW_REPORT
    .replace("Our cybersecurity platform analyzed 6,107,555 events across 36 endpoints.", "Our platform monitored activity across 36 endpoints.")
    .replace("6,107,555 Events", "");
  const parsed = parseSecurityInsightsReport(chartOnly, "source-example", "monthly.pdf");
  const facts = allFacts(parsed);
  assert.equal(facts["huntress.eventsAnalyzed"], 6110000);
  assert.equal(facts["huntress.eventsPrecision"], "rounded");
  assert.match(parsed.summary, /Approximately 6,110,000 events/);
});

test("client security slide cannot borrow metrics from another Huntress report", () => {
  assert.match(page, /item\.key === key && item\.sourceFileId === source/);
  assert.match(page, /source \? project\.intelligence\.facts\.find/);
  assert.match(page, /Source total needs verification/);
  assert.match(page, /Rounded count in source report/);
  assert.match(page, /validatedEvents/);
});

test("new reports route to the new parser, old reports remain supported", () => {
  assert.match(adapter,/if \(isSecurityInsightsReport\(text\)\) return parseSecurityInsightsReport\(text, fileId, fileName\)/);
  assert.match(adapter,/analyzed\\s\+\(\[\\d,\]\+\)\\s\+events\\s\+from/);
  assert.match(browser,/security insights report/);
  assert.doesNotMatch(slides, /security-posture|SecurityInsightsPosture|Protection details/);
  assert.match(slides,/if \(hasSecurityInsights\(project\)\) return <SecurityInsightsOverview/);
  assert.match(page,/Filtered for review/);
  assert.doesNotMatch(page, /SecurityInsightsPosture|Host firewalls/);
  assert.doesNotMatch(pdf, /securityInsightsPdfPage|printSecurityInsights/);
  assert.match(page, /telemetry records/);
  assert.doesNotMatch(page,/malware files automatically blocked/i);
});
