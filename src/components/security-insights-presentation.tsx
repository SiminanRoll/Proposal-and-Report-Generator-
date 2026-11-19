import type { Project } from "@/lib/projects/types";
import { factNumber, factText, factStrings, formatMetric } from "@/lib/outcomes/client-report-data";
import styles from "./security-insights-presentation.module.css";

export function hasSecurityInsights(project: Project): boolean {
  return factText(project, "huntress.reportFormat") === "security-insights";
}
function has(project: Project, key: string): boolean {
  return project.intelligence.facts.some((fact) => fact.key === key && fact.value !== "");
}
function value(project: Project, key: string): string {
  return has(project, key) ? factNumber(project, key).toLocaleString("en-US") : "—";
}
function metric(project: Project, key: string, label: string, description?: string) {
  return <article className={styles.metric} key={key}><strong>{value(project, key)}</strong><span>{label}</span>{description && <small>{description}</small>}</article>;
}
function attention(project: Project, key: string): boolean {
  return has(project, key) && factNumber(project, key) > 0;
}

export function SecurityInsightsOverview({ project }: { project: Project }) {
  const events = has(project,"huntress.eventsAnalyzed") ? formatMetric(factNumber(project,"huntress.eventsAnalyzed")) : "—";
  const period = factText(project,"huntress.reportPeriod");
  return <section className={styles.root} aria-label="Security monitoring overview">
    <header className={styles.header}>
      <span className={styles.kicker}>MANAGED SECURITY · {period || "CURRENT REPORT"}</span>
      <h2>Security monitoring at a glance</h2>
      <p>Continuous monitoring, reviewed activity and endpoint protection.</p>
    </header>
    <div className={styles.funnel}>
      <article><strong>{events}</strong><span>Events analyzed</span><small>Across monitored endpoints</small></article>
      <i aria-hidden="true">›</i>
      <article><strong>{value(project,"huntress.filteredActivity")}</strong><span>Filtered for review</span><small>Not confirmed attacks</small></article>
      <i aria-hidden="true">›</i>
      <article><strong>{value(project,"huntress.signalsInvestigated")}</strong><span>Investigations</span><small>Opened by the SOC</small></article>
      <i aria-hidden="true">›</i>
      <article className={styles.incident}><strong>{value(project,"huntress.incidentsReported")}</strong><span>Incidents resolved</span><small>During this reporting period</small></article>
    </div>
    <div className={styles.summaryCards}>
      <article><span className={styles.groupTitle}>Endpoint protection</span>
        <div className={styles.bigMetric}><strong>{value(project,"huntress.entitiesProtected")}</strong><span>Protected endpoints</span></div>
        <small>EDR coverage reported in Huntress</small>
      </article>
      <article><span className={styles.groupTitle}>Ransomware early warning</span>
        <div className={styles.inlineStats}>
          <div><strong>{value(project,"huntress.canaryFiles")}</strong><small>Canary files</small></div>
          <div><strong>{value(project,"huntress.protectedProfiles")}</strong><small>Protected profiles</small></div>
          <div><strong>{value(project,"huntress.ransomwareIncidents")}</strong><small>Incidents</small></div>
        </div>
      </article>
    </div>
    <div className={styles.eventStrip}>
      <span><strong>{value(project,"huntress.autorunEvents")}</strong> Autorun events <small>{value(project,"huntress.autorunSignalsInvestigated")} investigations</small></span>
      <span><strong>{value(project,"huntress.processEvents")}</strong> Process events <small>{value(project,"huntress.processSignalsInvestigated")} investigations</small></span>
    </div>
  </section>;
}

export function SecurityInsightsPosture({ project }: { project: Project }) {
  const services = factStrings(project,"huntress.externalSampleServices");
  const riskyExcluded = attention(project,"huntress.defenderRiskyExclusions");
  const tamperOff = attention(project,"huntress.defenderTamperDisabledHosts");
  const disabled = attention(project,"huntress.firewallDisabledHosts");
  return <section className={styles.root} aria-label="Endpoint security details">
    <header className={styles.header}>
      <span className={styles.kicker}>SECURITY INSIGHTS</span>
      <h2>Protection details</h2>
      <p>What the report confirms and what should be reviewed.</p>
    </header>
    <div className={styles.postureGrid}>
      <article className={styles.postureCard}>
        <div className={styles.postureHeading}><span>01</span><h3>Microsoft Defender</h3></div>
        <div className={styles.postureStats}>
          {metric(project,"huntress.defenderHosts","Hosts running Defender")}
          {metric(project,"huntress.defenderRealtimeHosts","Real-time enabled")}
          {metric(project,"huntress.defenderSignatureCurrentHosts","Signatures current")}
          {metric(project,"huntress.defenderRecentScanHosts","Scanned this week")}
        </div>
        <p className={styles.serviceNote}>Defender activity: {value(project,"huntress.antivirusEvents")} events · {value(project,"huntress.antivirusSignalsInvestigated")} investigations · {value(project,"huntress.antivirusIncidents")} incidents</p>
        <div className={styles.followups}>
          <p className={tamperOff ? styles.flag : ""}><strong>{value(project,"huntress.defenderTamperDisabledHosts")}</strong> hosts with tamper protection off</p>
          <p className={riskyExcluded ? styles.flag : ""}><strong>{value(project,"huntress.defenderRiskyExclusions")}</strong> risky exclusions · {value(project,"huntress.defenderExclusions")} total</p>
        </div>
      </article>
      <article className={styles.postureCard}>
        <div className={styles.postureHeading}><span>02</span><h3>Host firewalls</h3></div>
        <div className={styles.postureStats}>
          {metric(project,"huntress.firewallEnabledHosts","Reported enabled")}
          {metric(project,"huntress.firewallDisabledHosts","Reported disabled")}
          {metric(project,"huntress.firewallEnabledConflicts","Enabled conflicts")}
          {metric(project,"huntress.firewallDisabledConflicts","Disabled conflicts")}
        </div>
        <p className={disabled ? styles.flag : styles.note}>Support should verify firewall policy and any approved alternative controls.</p>
      </article>
      <article className={styles.postureCard}>
        <div className={styles.postureHeading}><span>03</span><h3>External exposure</h3></div>
        <div className={styles.postureStats}>
          {metric(project,"huntress.externalIpAddresses","External IP addresses")}
          {metric(project,"huntress.externallyAvailablePorts","Available ports")}
          {metric(project,"huntress.externalRiskyServices","Flagged risky")}
          {metric(project,"huntress.externalNormalServices","Marked normal")}
        </div>
        {services.length > 0 && <p className={styles.serviceNote}>Examples: {services.join(" · ")}</p>}
        <p className={styles.note}>A normal classification does not guarantee that an exposed service is safe.</p>
      </article>
    </div>
    <div className={styles.footer}>Source: Huntress monthly Security Insights Report. Settings requiring attention should be confirmed by Support before changes are made.</div>
  </section>;
}
