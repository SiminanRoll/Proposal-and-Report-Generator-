import type { ExtractedFact, FileAnalysis, FindingCandidate } from "@/lib/projects/types";

/** PDF-specific Huntress Security Insights Report, separate from older Threat Reports. */
function page(text: string, n: number): string {
  const marker = "[[PAGE " + n + "]]";
  const start = text.indexOf(marker);
  if (start < 0) return n === 1 ? text : "";
  const end = text.indexOf("[[PAGE ", start + marker.length);
  return text.slice(start + marker.length, end < 0 ? undefined : end);
}
function number(raw?: string): number | null {
  if (!raw) return null;
  const match = raw.replace(/,/g, "").trim().match(/^(\d+(?:\.\d+)?)([MK])?$/i);
  if (!match) return null;
  const factor = match[2]?.toUpperCase() === "M" ? 1e6 : match[2]?.toUpperCase() === "K" ? 1e3 : 1;
  const value = Math.round(Number(match[1]) * factor);
  return Number.isSafeInteger(value) ? value : null;
}
function grab(text: string, ...patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const value = number(text.match(re)?.[1]);
    if (value !== null) return value;
  }
  return null;
}
/**
 * Styled PDF counters may wrap onto a neighboring line. Only take a number
 * on its label line or an isolated number immediately beside that full label.
 * Never bridge unrelated headings, paragraphs, or chart values.
 */
function metric(text: string, label: string): number | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim().replace(/\s+/g, " ")).filter(Boolean);
  const pattern = label.trim().replace(/\s+/g, "\\s+");
  // Browser PDF extraction groups text at the same vertical position into ONE
  // line, including separate columns. Example:
  // "564 Canary Files Placed 36,015 Autorun Events Analyzed 6,070,902 Process Events Analyzed".
  // Match a complete number/label pair within that line. Require the following
  // token to be another count (or the end) so a shorter label cannot match the
  // start of a longer heading, such as "Hosts with firewall enabled with ...".
  const endOfMetric = "(?=$|\\s+[\\d,]+(?:\\s|$))";
  const before = new RegExp("(?:^|\\s)([\\d,]+)\\s+" + pattern + endOfMetric, "i");
  const after = new RegExp("(?:^|\\s)" + pattern + "\\s*[:\\-]?\\s+([\\d,]+)" + endOfMetric, "i");
  const exact = new RegExp("^" + pattern + "\\s*[.:]?$", "i");
  for (const line of lines) {
    const count = number(line.match(before)?.[1] ?? line.match(after)?.[1]);
    if (count !== null) return count;
  }
  // Keep support for exports where a single numeric line sits directly above
  // or below the full label. Never infer counts from unlabeled chart bars.
  for (let i = 0; i < lines.length; i += 1) {
    if (!exact.test(lines[i])) continue;
    const prior = i > 0 && /^[\d,]+$/.test(lines[i - 1]) ? number(lines[i - 1]) : null;
    if (prior !== null) return prior;
    const next = i + 1 < lines.length && /^[\d,]+$/.test(lines[i + 1]) ? number(lines[i + 1]) : null;
    if (next !== null) return next;
  }
  return null;
}
function record(key: string, label: string, value: string | number | string[], fileId: string, evidence: string): ExtractedFact {
  return { id: "insights_" + key.replace(/[^a-z0-9]/gi, "_"), key, label, value, sourceFileId: fileId, category: "security", confidence: "high", evidence };
}
function finding(fileId: string, title: string, text: string, severity: "healthy" | "attention" | "priority", evidence: string): FindingCandidate {
  return { id: "insights_" + title.toLowerCase().replace(/[^a-z0-9]/g, "_"), category: "security", title, clientSummary: text, severity, sourceFileId: fileId, evidence };
}
function defenderSummary(text: string): { events: number | null; investigations: number | null; incidents: number | null } {
  const start = text.search(/Defender Event Summary/i);
  const end = text.search(/Defender Host System Status/i);
  const region = start >= 0 ? text.slice(start, end > start ? end : start + 500) : "";
  const row = region.match(/\b([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+Events\s+Investigations\s+Incidents\b/i);
  if (row) return { events: number(row[1]), investigations: number(row[2]), incidents: number(row[3]) };
  return {
    events: metric(region, "Events"),
    investigations: metric(region, "Investigations"),
    incidents: metric(region, "Incidents"),
  };
}

/** Never infer which unpaired chart number belongs to Risky or Normal. */
function riskBreakdown(text: string, heading: string, total: number | null): { risky: number | null; normal: number | null } {
  const start = text.search(new RegExp(heading, "i"));
  if (start < 0 || total === null) return { risky: null, normal: null };
  const region = text.slice(start, start + 700);
  const risky = metric(region, "Risky");
  const normal = metric(region, "Normal");
  if (risky === null || normal === null || risky + normal !== total) return { risky: null, normal: null };
  return { risky, normal };
}

export function isSecurityInsightsReport(text: string): boolean {
  return /Security Insights Report/i.test(text)
    && /Endpoint Detection and Response through Managed EDR|SOC Analysis Breakdown/i.test(text);
}

export function parseSecurityInsightsReport(text: string, fileId: string, fileName: string): FileAnalysis {
  const [p1, p2, p3, p4, p5, p6, p7] = [1,2,3,4,5,6,7].map(n => page(text, n));
  const range = (p1 + "\n" + p2).match(/\b(\d{1,2}\/\d{1,2})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/20\d{2})/);
  const period = range ? range[1] + " - " + range[2] : "";
  const explicitEvents = grab(p3, /analyzed\s+([\d,]+)\s+events\s+across/i, /([\d,]+)\s+Events\b/i);
  const roundedEvents = p2.match(/([\d,.]+[MK])\s+Events Across All Your Environments/i);
  let events = explicitEvents ?? number(roundedEvents?.[1]);
  const eventsAreRounded = explicitEvents === null && events !== null && Boolean(roundedEvents);
  const endpoints = grab(p3, /([\d,]+)\s+Protected Endpoints/i, /events across\s+([\d,]+)\s+endpoints/i)
    ?? grab(p2, /EDR\s+([\d,]+)\s+Endpoints/i);
  const filtered = grab(p2, /([\d,]+)\s+Filtered for Suspicious Activity/i);
  const investigations = grab(p3, /opened\s+([\d,]+)\s+investigations/i, /([\d,]+)\s+Investigations/i)
    ?? grab(p2, /([\d,]+)\s+Investigations/i);
  const incidents = grab(p3, /([\d,]+)\s+Incidents Resolved/i, /resulted in\s+([\d,]+)\s+incidents/i)
    ?? grab(p2, /([\d,]+)\s+Incidents Resolved/i, /([\d,]+)\s+Incidents/i);
  const canaries = metric(p4, "Canary Files Placed");
  const profiles = metric(p4, "Protected User Profiles");
  const ransomware = metric(p4, "Ransomware Incidents");
  const autorun = metric(p4, "Autorun Events Analyzed");
  const autorunInvestigations = metric(p4, "Autorun Investigations");
  const autorunIncidents = metric(p4, "Autorun Incidents");
  const process = metric(p4, "Process Events Analyzed");
  const processInvestigations = metric(p4, "Process Investigations");
  const processIncidents = metric(p4, "Process Incidents");
  const defender = defenderSummary(p5);
  let defenderHosts = metric(p5, "Hosts Running Defender");
  let realTime = metric(p5, "Hosts with real-time protection enabled");
  let signatures = metric(p5, "Hosts with signatures up to date");
  let scans = metric(p5, "Hosts with scans within past week");
  let tamperOff = metric(p5, "Hosts with Tamper Protection disabled");
  const exclusionsTotal = metric(p5, "Defender Exclusions");
  const exclusions = riskBreakdown(p5, "Exclusion Risk Breakdown", exclusionsTotal);
  let firewallEnabled = metric(p6, "Hosts with firewall enabled");
  let firewallDisabled = metric(p6, "Hosts with firewall disabled");
  let firewallEnabledConflicts = metric(p6, "Hosts with firewall enabled with a policy conflict");
  let firewallDisabledConflicts = metric(p6, "Hosts with firewall disabled with a policy conflict");
  const externalIps = metric(p7, "External IP Addresses");
  let ports = metric(p7, "Externally Available Ports");
  const analyzedServices = metric(p7, "Analyzed Services");
  const recon = riskBreakdown(p7, "External Recon", analyzedServices);
  const snippet = p7.match(/Sample of Analyzed Services on Network Ports([\s\S]{0,320})/i)?.[1] ?? "";
  const sampleLine = snippet.split(/\r?\n/).map((line) => line.trim()).find((line) => /^[A-Z0-9][A-Z0-9 -]{3,180}$/.test(line)) ?? "";
  const serviceNames = [...new Set((sampleLine.match(/\b[A-Z][A-Z0-9-]{2,31}\b/g) ?? []))].slice(0, 8);


  const warnings: string[] = [];
  // SOC events represent telemetry, not attacks. Cross-check against detailed
  // Process and Autorun volumes when both are present to catch layout errors.
  if (events !== null && process !== null && autorun !== null && process + autorun > 1000
    && (events < (process + autorun) * 0.7 || events > (process + autorun) * 1.3)) {
    warnings.push("SOC events do not reconcile with the event categories in this report. Total events require source verification.");
    events = null;
  }
  // All host-specific status counters are subsets of EDR protected endpoints.
  // If styled extraction puts a chart value next to a host label (e.g. 1,921
  // Defender hosts against 61 endpoints), reject it instead of publishing it.
  function verifyHostCount(value: number | null, label: string): number | null {
    if (value === null || endpoints === null || value <= endpoints) return value;
    warnings.push(label + " (" + value.toLocaleString("en-US") + ") exceeds "
      + endpoints + " protected endpoints; omitted pending source review.");
    return null;
  }
  defenderHosts = verifyHostCount(defenderHosts, "Defender host count");
  realTime = verifyHostCount(realTime, "Defender real-time protection count");
  signatures = verifyHostCount(signatures, "Defender signature count");
  scans = verifyHostCount(scans, "Defender recent scan count");
  tamperOff = verifyHostCount(tamperOff, "Defender tamper-protection count");
  firewallEnabled = verifyHostCount(firewallEnabled, "Enabled firewall host count");
  firewallDisabled = verifyHostCount(firewallDisabled, "Disabled firewall host count");
  firewallEnabledConflicts = verifyHostCount(firewallEnabledConflicts, "Enabled firewall conflicts");
  firewallDisabledConflicts = verifyHostCount(firewallDisabledConflicts, "Disabled firewall conflicts");
  if (endpoints !== null && firewallEnabled !== null && firewallDisabled !== null
      && firewallEnabled + firewallDisabled > endpoints) {
    warnings.push("Host firewall status counts exceed EDR endpoint coverage; check the original firewall page.");
    firewallEnabled = null;
    firewallDisabled = null;
    firewallEnabledConflicts = null;
    firewallDisabledConflicts = null;
  }
  if (firewallEnabled !== null && firewallEnabledConflicts !== null && firewallEnabledConflicts > firewallEnabled)
    firewallEnabledConflicts = null;
  if (firewallDisabled !== null && firewallDisabledConflicts !== null && firewallDisabledConflicts > firewallDisabled)
    firewallDisabledConflicts = null;
  if (ports === 0 && analyzedServices !== null && analyzedServices > 0) {
    warnings.push("Port count is zero despite services being analyzed; verify page 7 before reporting the count.");
    ports = null;
  }
  const facts: ExtractedFact[] = [record("huntress.reportFormat","Huntress report format","security-insights",fileId,"Security Insights Report header")];
  if (period) facts.push(record("huntress.reportPeriod","Reporting period",period,fileId,"Page 1 · Cover"));
  if (eventsAreRounded) facts.push(record("huntress.eventsPrecision","Event total precision","rounded",fileId,"Page 2 · Rounded SOC chart label"));
  const metrics: Array<[string,string,number | null,string]> = [
    ["huntress.eventsAnalyzed","SOC events analyzed",events,"Page 3 · Endpoint Security Activity"],
    ["huntress.entitiesProtected","Protected endpoints",endpoints,"Page 3 · Protected Endpoints"],
    ["huntress.signalsDetected","Activity filtered for review",filtered,"Page 2 · SOC Analysis Breakdown"],
    ["huntress.filteredActivity","Filtered for suspicious activity",filtered,"Page 2 · SOC Analysis Breakdown"],
    ["huntress.signalsInvestigated","SOC investigations",investigations,"Page 3 · Incident and Investigation Breakdown"],
    ["huntress.incidentsReported","Resolved incidents",incidents,"Page 3 · Incident and Investigation Breakdown"],
    ["huntress.canaryFiles","Ransomware canary files",canaries,"Page 4 · Detection Capabilities"],
    ["huntress.protectedProfiles","Protected user profiles",profiles,"Page 4 · Ransomware Canaries"],
    ["huntress.ransomwareIncidents","Ransomware incidents",ransomware,"Page 4 · Ransomware Canaries"],
    ["huntress.autorunEvents","Autorun events analyzed",autorun,"Page 4 · Persistent Footholds"],
    ["huntress.autorunSignalsInvestigated","Autorun investigations",autorunInvestigations,"Page 4 · Persistent Footholds"],
    ["huntress.footholdIncidents","Autorun incidents",autorunIncidents,"Page 4 · Persistent Footholds"],
    ["huntress.processEvents","Process events analyzed",process,"Page 4 · Process Insights"],
    ["huntress.processSignalsInvestigated","Process investigations",processInvestigations,"Page 4 · Process Insights"],
    ["huntress.processIncidents","Process incidents",processIncidents,"Page 4 · Process Insights"],
    ["huntress.defenderHosts","Hosts running Defender",defenderHosts,"Page 5 · Managed Antivirus"],
    ["huntress.antivirusEvents","Defender events",defender.events,"Page 5 · Defender Event Summary"],
    ["huntress.antivirusSignalsInvestigated","Defender investigations",defender.investigations,"Page 5 · Defender Event Summary"],
    ["huntress.antivirusIncidents","Defender incidents",defender.incidents,"Page 5 · Defender Event Summary"],
    ["huntress.defenderRealtimeHosts","Real-time protection enabled",realTime,"Page 5 · Defender Host System Status"],
    ["huntress.defenderSignatureCurrentHosts","Signatures up to date",signatures,"Page 5 · Defender Host System Status"],
    ["huntress.defenderRecentScanHosts","Scanned within past week",scans,"Page 5 · Defender Host System Status"],
    ["huntress.defenderTamperDisabledHosts","Tamper protection disabled",tamperOff,"Page 5 · Defender Host System Status"],
    ["huntress.defenderExclusions","Defender exclusions",exclusionsTotal,"Page 5 · Exclusion Risk Breakdown"],
    ["huntress.defenderRiskyExclusions","Risky Defender exclusions",exclusions.risky,"Page 5 · Exclusion Risk Breakdown"],
    ["huntress.defenderNormalExclusions","Normal Defender exclusions",exclusions.normal,"Page 5 · Exclusion Risk Breakdown"],
    ["huntress.firewallEnabledHosts","Firewall enabled hosts",firewallEnabled,"Page 6 · Firewall Status Monitoring"],
    ["huntress.firewallDisabledHosts","Firewall disabled hosts",firewallDisabled,"Page 6 · Firewall Status Monitoring"],
    ["huntress.firewallEnabledConflicts","Enabled firewall policy conflicts",firewallEnabledConflicts,"Page 6 · Firewall Status Monitoring"],
    ["huntress.firewallDisabledConflicts","Disabled firewall policy conflicts",firewallDisabledConflicts,"Page 6 · Firewall Status Monitoring"],
    ["huntress.externalIpAddresses","External IP addresses",externalIps,"Page 7 · External Recon"],
    ["huntress.externallyAvailablePorts","Externally available ports",ports,"Page 7 · External Recon"],
    ["huntress.externalServicesAnalyzed","Analyzed external services",analyzedServices,"Page 7 · External Recon"],
    ["huntress.externalRiskyServices","Risky external services",recon.risky,"Page 7 · External Recon"],
    ["huntress.externalNormalServices","Normal external services",recon.normal,"Page 7 · External Recon"],
  ];
  for (const [key,label,value,evidence] of metrics) if (value !== null) facts.push(record(key,label,value,fileId,evidence));
  if (serviceNames.length) facts.push(record("huntress.externalSampleServices","Sample externally visible services",serviceNames,fileId,"Page 7 · Sample of Analyzed Services"));

  const findings: FindingCandidate[] = [];
  if (incidents === 0 && investigations === 0 && events !== null)
    findings.push(finding(fileId,"No security incidents reported",events.toLocaleString("en-US")+" events analyzed; no investigations or incidents were reported during this period.","healthy","Pages 2–3 · SOC summary"));
  else if ((incidents ?? 0) > 0)
    findings.push(finding(fileId,"Security incidents to review",incidents+" incidents were listed as resolved. Confirm response details with Support.","attention","Page 3 · Incident Breakdown"));
  if ((firewallDisabled ?? 0) > 0)
    findings.push(finding(fileId,"Endpoint firewall configuration needs review",firewallDisabled+" eligible endpoints were reported with the host firewall disabled. Support should verify the intended policy and compensating controls.","attention","Page 6 · Firewall Status Monitoring"));
  if ((exclusions.risky ?? 0) > 0)
    findings.push(finding(fileId,"Defender exclusions need review",exclusions.risky+" exclusions were marked risky. Confirm application requirements before changing policy.","attention","Page 5 · Exclusion Risk Breakdown"));
  if ((tamperOff ?? 0) > 0)
    findings.push(finding(fileId,"Tamper protection needs review",tamperOff+" hosts were reported with Defender tamper protection disabled. Verify the managed policy.","attention","Page 5 · Defender Host System Status"));
  if ((recon.risky ?? 0) > 0)
    findings.push(finding(fileId,"External services need review",recon.risky+" externally observed services were marked risky. Confirm what is actually exposed.","attention","Page 7 · External Recon"));

  if (events === null || endpoints === null || incidents === null) warnings.push("One or more core SOC metrics could not be verified from the report. Review pages 2–3.");
  if (exclusionsTotal !== null && exclusions.risky === null) warnings.push("Defender risk chart could not be assigned confidently; verify page 5 before reporting risky/normal counts.");
  if (analyzedServices !== null && recon.risky === null) warnings.push("External recon risk chart could not be assigned confidently; verify page 7 before reporting risky/normal counts.");
  return {
    sourceType:"huntress",
    confidence:events !== null && endpoints !== null && incidents !== null ? "high" : "medium",
    title:fileName,
    summary:(events === null ? "Security activity" : (eventsAreRounded ? "Approximately " : "") + events.toLocaleString("en-US")+" events")+" across "+(endpoints ?? "unverified")+" protected endpoints; "+(investigations ?? "unverified")+" investigations and "+(incidents ?? "unverified")+" reported incidents.",
    facts, findingCandidates:findings,
    highlights:[
      ...(endpoints !== null ? [endpoints+" protected endpoints"] : []),
      ...(events !== null ? [events.toLocaleString("en-US")+" events analyzed"] : []),
      ...(canaries !== null ? [canaries+" ransomware canary files"] : []),
      ...(firewallDisabled !== null ? [firewallDisabled+" hosts with host firewalls disabled"] : []),
    ],
    warnings,
    rawTextPreview:text.split(/\r?\n/).filter(Boolean).slice(0,80).join("\n").slice(0,8000),
    analyzedAt:new Date().toISOString(),
  };
}
