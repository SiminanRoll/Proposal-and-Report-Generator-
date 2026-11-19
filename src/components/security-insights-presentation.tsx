import type { Project } from "@/lib/projects/types";
import { formatMetric } from "@/lib/outcomes/client-report-data";
import styles from "./security-insights-presentation.module.css";

/** Security counters must all come from the SAME uploaded Huntress report. */
function reportFact(project: Project, key: string) {
  const source = project.intelligence.facts.find((item) =>
    item.key === "huntress.reportFormat" && item.value === "security-insights")?.sourceFileId;
  return source ? project.intelligence.facts.find((item) =>
    item.key === key && item.sourceFileId === source) : undefined;
}
function measured(project: Project, key: string): number | null {
  const fact = reportFact(project, key);
  return typeof fact?.value === "number" && Number.isSafeInteger(fact.value) && fact.value >= 0
    ? fact.value : null;
}
export function hasSecurityInsights(project: Project): boolean {
  return Boolean(reportFact(project, "huntress.reportFormat"));
}
function value(project: Project, key: string): string {
  const count = measured(project, key);
  return count === null ? "—" : count.toLocaleString("en-US");
}
export function SecurityInsightsOverview({ project }: { project: Project }) {
  const total = measured(project, "huntress.eventsAnalyzed");
  const process = measured(project, "huntress.processEvents");
  const autorun = measured(project, "huntress.autorunEvents");
  const consistent = total === null || process === null || autorun === null || process + autorun < 1000
    || (total >= (process + autorun) * 0.7 && total <= (process + autorun) * 1.3);
  const validatedEvents = consistent ? total : null;
  const precision = reportFact(project, "huntress.eventsPrecision")?.value === "rounded";
  const events = validatedEvents === null ? "—"
    : (precision ? "≈" : "") + formatMetric(validatedEvents);
  const periodValue = reportFact(project, "huntress.reportPeriod")?.value;
  const period = typeof periodValue === "string" ? periodValue : "";
  const filtered = measured(project, "huntress.filteredActivity");
  const filteredDisplay = validatedEvents !== null && filtered !== null && filtered > validatedEvents
    ? "—" : value(project, "huntress.filteredActivity");
  return <section className={styles.root} aria-label="Security monitoring overview">
    <header className={styles.header}>
      <span className={styles.kicker}>MANAGED SECURITY · {period || "CURRENT REPORT"}</span>
      <h2>Security monitoring at a glance</h2>
      <p>Continuous monitoring, reviewed activity and endpoint protection.</p>
    </header>
    <div className={styles.funnel}>
      <article><strong>{events}</strong><span>Events analyzed</span><small>{validatedEvents === null ? "Source total needs verification" : precision ? "Rounded count in source report" : validatedEvents.toLocaleString("en-US") + " telemetry records"}</small></article>
      <i aria-hidden="true">›</i>
      <article><strong>{filteredDisplay}</strong><span>Filtered for review</span><small>Not confirmed attacks</small></article>
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
