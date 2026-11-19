import type { Project } from "@/lib/projects/types";
import { factNumber, factText, formatMetric } from "@/lib/outcomes/client-report-data";
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
      <article><strong>{events}</strong><span>Events analyzed</span><small>{has(project,"huntress.eventsAnalyzed") ? factNumber(project,"huntress.eventsAnalyzed").toLocaleString("en-US") + " telemetry records" : "Total unverified"}</small></article>
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
