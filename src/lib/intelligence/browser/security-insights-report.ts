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
function metric(text: string, label: string): number | null {
  const safe = label.replace(/[^a-zA-Z0-9 ]/g, "").replace(/ +/g, "\\s+");
  return grab(text,
    new RegExp("\\b([\\d,]+)\\s+" + safe + "\\b", "i"),
    new RegExp("\\b" + safe + "\\s*[:\\-]?\\s+([\\d,]+)\\b", "i"));
}
function record(key: string, label: string, value: string | number | string[], fileId: string, evidence: string): ExtractedFact {
  return { id: "insights_" + key.replace(/[^a-z0-9]/gi, "_"), key, label, value, sourceFileId: fileId, category: "security", confidence: "high", evidence };
}
function finding(fileId: string, title: string, text: string, severity: "healthy" | "attention" | "priority", evidence: string): FindingCandidate {
  return { id: "insights_" + title.toLowerCase().replace(/[^a-z0-9]/g, "_"), category: "security", title, clientSummary: text, severity, sourceFileId: fileId, evidence };
}
function defenderSummary(text: string): { events: number | null; investigations: number | null; incidents: number | null } {
  const row = text.match(/Defender Event Summary[\s\S]{0,550}?\b([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*(?:\n|\s+)Events\s+Investigations\s+Incidents/i);
  return { events: number(row?.[1]), investigations: number(row?.[2]), incidents: number(row?.[3]) };
}

/**
 * Charts may separate numeric bar labels from category names. Only parse a
 * numeric risk split when both numbers are corroborated by a printed total.
 * Otherwise leave risk counts unverified instead of assigning values by size.
 */
function riskBreakdown(text: string, heading: string, total: number | null): { risky: number | null; normal: number | null } {
  const start = text.search(new RegExp(heading, "i"));
  if (start < 0 || total === null) return { risky: null, normal: null };
  const region = text.slice(start, start + 1300);
  if (!/\bRisky\b[\s\S]{0,100}\bNormal\b/i.test(region)) return { risky: null, normal: null };
  let risky = metric(region, "Risky");
  if (risky === null) {
    const axis = region.match(/(?:^|\n)\s*([\d,]+)\s*(?:\n[^\n]{0,160}){0,2}\n\s*Risky\s+Normal\b/im)
      ?? region.match(/\b([\d,]+)\s+Risky\s+Normal\b/i);
    risky = number(axis?.[1]);
  }
  if (risky === null || risky > total) return { risky: null, normal: null };
  const normal = total - risky;
  const otherPrinted = new RegExp("(?:^|\\D)" + normal.toLocaleString("en-US").replace(/,/g, ",?") + "(?:\\D|$)").test(region);
  return otherPrinted ? { risky, normal } : { risky: null, normal: null };
}

export function isSecurityInsightsReport(text: string): boolean {
  return /Security Insights Report/i.test(text)
    && /Endpoint Detection and Response through Managed EDR|SOC Analysis Breakdown/i.test(text);
}

export function parseSecurityInsightsReport(text: string, fileId: string, fileName: string): FileAnalysis {
  const [p1, p2, p3, p4, p5, p6, p7] = [1,2,3,4,5,6,7].map(n => page(text, n));
  const range = (p1 + "\n" + p2).match(/\b(\d{1,2}\/\d{1,2})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/20\d{2})/);
  const period = range ? range[1] + " - " + range[2] : "";
  const events = grab(p3, /analyzed\s+([\d,]+)\s+events\s+across/i, /([\d,]+)\s+Events\b/i)
    ?? grab(p2, /([\d,.]+[MK]?)\s+Events Across All Your Environments/i);
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
  const defenderHosts = metric(p5, "Hosts Running Defender");
  const realTime = metric(p5, "Hosts with real-time protection enabled");
  const signatures = metric(p5, "Hosts with signatures up to date");
  const scans = metric(p5, "Hosts with scans within past week");
  const tamperOff = metric(p5, "Hosts with Tamper Protection disabled");
  const exclusionsTotal = metric(p5, "Defender Exclusions");
  const exclusions = riskBreakdown(p5, "Exclusion Risk Breakdown", exclusionsTotal);
  const firewallEnabled = metric(p6, "Hosts with firewall enabled");
  const firewallDisabled = metric(p6, "Hosts with firewall disabled");
  const firewallEnabledConflicts = metric(p6, "Hosts with firewall enabled with a policy conflict");
  const firewallDisabledConflicts = metric(p6, "Hosts with firewall disabled with a policy conflict");
  const externalIps = metric(p7, "External IP Addresses");
  const ports = metric(p7, "Externally Available Ports");
  const analyzedServices = metric(p7, "Analyzed Services");
  const recon = riskBreakdown(p7, "External Recon", analyzedServices);
  const snippet = p7.match(/Sample of Analyzed Services on Network Ports([\s\S]{0,220})/i)?.[1] ?? "";
  const serviceNames = ["HTTPS-SIMPLE-NEW","IKE","IKE-NAT-T"].filter(s => snippet.includes(s));

  const facts: ExtractedFact[] = [record("huntress.reportFormat","Huntress report format","security-insights",fileId,"Security Insights Report header")];
  if (period) facts.push(record("huntress.reportPeriod","Reporting period",period,fileId,"Page 1 · Cover"));
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

  const warnings: string[] = [];
  if (events === null || endpoints === null || incidents === null) warnings.push("One or more core SOC metrics could not be verified from the report. Review pages 2–3.");
  if (exclusionsTotal !== null && exclusions.risky === null) warnings.push("Defender risk chart could not be assigned confidently; verify page 5 before reporting risky/normal counts.");
  if (analyzedServices !== null && recon.risky === null) warnings.push("External recon risk chart could not be assigned confidently; verify page 7 before reporting risky/normal counts.");
  return {
    sourceType:"huntress",
    confidence:events !== null && endpoints !== null && incidents !== null ? "high" : "medium",
    title:fileName,
    summary:(events === null ? "Security activity" : events.toLocaleString("en-US")+" events")+" across "+(endpoints ?? "unverified")+" protected endpoints; "+(investigations ?? "unverified")+" investigations and "+(incidents ?? "unverified")+" reported incidents.",
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
