import type { Project } from "@/lib/projects/types";
import { factNumber, factText, factStrings } from "./client-report-data";

function escape(value: string): string {
  return value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}
function value(project: Project, key: string): string {
  const fact = project.intelligence.facts.find((item) => item.key === key);
  if (!fact || typeof fact.value !== "number") return "—";
  return fact.value.toLocaleString("en-US");
}
function group(project: Project, label: string, items: Array<[string,string]>, detail: string): string {
  return '<article style="background:#f6fbff;border:1px solid #d2e4ef;border-radius:13px;padding:17px 19px;break-inside:avoid">'
    + '<h3 style="font-size:17px;letter-spacing:-.025em;color:#16446b;margin:0 0 12px">' + escape(label) + '</h3>'
    + '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">'
    + items.map(([key,title]) => '<div style="border:1px solid #dceaf2;border-radius:10px;padding:10px;background:white"><strong style="display:block;color:#0c4772;font-size:21px;line-height:1.1">' + escape(value(project,key)) + '</strong><span style="display:block;color:#517087;font-size:10px;line-height:1.2;margin-top:5px">' + escape(title) + '</span></div>').join("")
    + '</div><p style="color:#506e84;font-size:10px;line-height:1.38;margin:11px 0 0">' + escape(detail) + '</p></article>';
}

/** A compact source-backed appendix, not the original Huntress PDF reproduced. */
export function securityInsightsPdfPage(project: Project, footer = ""): string {
  if (factText(project,"huntress.reportFormat") !== "security-insights") return "";
  const period = factText(project,"huntress.reportPeriod");
  const sampleServices = factStrings(project,"huntress.externalSampleServices").slice(0,6);
  const tamper = factNumber(project,"huntress.defenderTamperDisabledHosts");
  const firewall = factNumber(project,"huntress.firewallDisabledHosts");
  const riskyExclusions = factNumber(project,"huntress.defenderRiskyExclusions");
  const flagged: string[] = [];
  if (tamper > 0) flagged.push(tamper+" hosts with tamper protection disabled");
  if (riskyExclusions > 0) flagged.push(riskyExclusions+" Defender exclusions flagged risky");
  if (firewall > 0) flagged.push(firewall+" eligible hosts with Windows firewall reported off");
  const status = flagged.length ? "Settings to verify with Support: " + flagged.join("; ") + "." : "The report contains no identified configuration exception in these categories, or the relevant detail was unavailable.";
  return '<section class="pdf-page pdf-security-insights" data-pdf-page="true">'
    + '<header class="pdf-section-header"><span class="kicker">Security Insights' + (period ? " · "+escape(period) : "") + '</span><h2>Managed protection and exposure</h2>'
    + '<p>Selected Huntress metrics and settings that deserve a closer look.</p></header>'
    + '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0">'
    + [
      ["huntress.entitiesProtected","Protected endpoints"],
      ["huntress.eventsAnalyzed","Events analyzed"],
      ["huntress.filteredActivity","Filtered activity"],
      ["huntress.incidentsReported","Incidents reported"],
    ].map(([key,title])=>'<article style="background:#0b3258;border-radius:12px;color:white;padding:13px"><strong style="font-size:24px;display:block;line-height:1.1">'+escape(value(project,key))+'</strong><span style="font-size:10px;color:#d2e6f8">'+escape(title)+'</span></article>').join("")
    + '</div>'
    + '<div style="display:grid;gap:12px">'
    + group(project,"Managed Microsoft Defender",[
      ["huntress.defenderHosts","Defender hosts"],
      ["huntress.defenderRealtimeHosts","Real-time enabled"],
      ["huntress.defenderExclusions","Total exclusions"],
      ["huntress.defenderRiskyExclusions","Flagged risky"],
    ],"Defender events are monitoring activity, not automatically blocked malware. Verify risky exclusions and tamper settings against the intended policy.")
    + group(project,"Host firewall status",[
      ["huntress.firewallEnabledHosts","Enabled"],
      ["huntress.firewallDisabledHosts","Disabled"],
      ["huntress.firewallEnabledConflicts","Enabled conflicts"],
      ["huntress.firewallDisabledConflicts","Disabled conflicts"],
    ],"Figures describe eligible monitored endpoints. Support should verify whether disabled local firewalls are expected and which other controls apply.")
    + group(project,"External reconnaissance",[
      ["huntress.externalIpAddresses","External IP addresses"],
      ["huntress.externallyAvailablePorts","Available ports"],
      ["huntress.externalRiskyServices","Flagged risky"],
      ["huntress.externalNormalServices","Marked normal"],
    ],"Normal classification does not establish that an exposed service is risk-free."+(sampleServices.length?" Sample observed services: "+sampleServices.join(", ")+".":""))
    + '</div>'
    + '<div style="font-size:10px;line-height:1.4;color:#6b4c21;background:#fff7e7;border:1px solid #f2d8a4;border-radius:11px;padding:12px 15px;margin-top:13px">'+escape(status)+'</div>'
    + '<small style="display:block;margin-top:8px;color:#56748a;font-size:9px">Source: uploaded Huntress Security Insights Report. Point-in-time observations; not a regulatory compliance certification.</small>'
    + footer + '</section>';
}
