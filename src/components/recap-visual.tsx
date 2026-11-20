"use client";

import type { CSSProperties } from "react";
import type { Project } from "@/lib/projects/types";
import { factNumber, lifecycleSummary } from "@/lib/outcomes/client-report-data";
import { scoreHipaaAssessment } from "@/lib/hipaa/engine";
import { farPriorityStatus, farTopPriorities, priorityActionSummary, FAR_PRIORITY_STATUSES } from "@/lib/far/far-priorities";
import styles from "./recap-visual.module.css";

/** A readable THR presentation close. Detailed evidence remains on its own slides. */
export function RecapVisual({ project }: { project: Project }) {
  const devices = lifecycleSummary(project);
  const questions = project.hipaa.enabled ? scoreHipaaAssessment(project.hipaa) : null;
  const priorities = farTopPriorities(project);
  const total = Math.max(0, devices.inventoryTotal);
  const healthy = Math.max(0, devices.current);
  const soon = Math.max(0, devices.dueSoon);
  const overdue = Math.max(0, devices.overdue);
  const amount = (count: number) => total > 0 ? Math.min(100, Math.max(0, (count / total) * 100)) : 0;
  const ringStyle = {
    "--recap-current": amount(healthy) + "%",
    "--recap-planning": Math.min(100, amount(healthy + soon)) + "%",
    "--recap-replacement": Math.min(100, amount(healthy + soon + overdue)) + "%",
  } as CSSProperties;

  const incidentsReported = project.intelligence.facts.some((item) => item.key === "huntress.incidentsReported");
  const incidents = Math.max(0, factNumber(project, "huntress.incidentsReported"));
  const securityState = incidentsReported ? incidents > 0 ? "training" : "healthy" : "unknown";
  const answered = questions?.assessedQuestionCount ?? 0;
  const applicable = questions?.applicableQuestionCount ?? 0;
  const pending = questions?.notYetAssessedCount ?? 0;
  const answerPercentage = applicable ? Math.min(100, Math.max(0, (answered / applicable) * 100)) : 0;

  return <section className={styles.root} aria-label="Technology review outcomes at a glance">
    <div className={styles.grid}>
      <article className={styles.panel + " " + styles.health} aria-label="Equipment health outcome">
        <div className={styles.eyebrow}>EQUIPMENT HEALTH</div>
        <div className={styles.healthBody}>
          <div className={styles.healthRing} style={ringStyle} role="img"
            aria-label={total ? `${healthy} healthy, ${soon} planning, ${overdue} replacement age out of ${total} recorded assets` : "Equipment inventory not yet available"}>
            <div className={styles.ringCenter}>
              <strong>{total ? overdue > 0 ? "Plan upgrades" : soon > 0 ? "Plan ahead" : "Healthy" : "Pending"}</strong>
            </div>
          </div>
          <div className={styles.legend}>
            <span><i className={styles.dotHealthy} aria-hidden="true" />In service <strong>{healthy}</strong></span>
            <span><i className={styles.dotPlanning} aria-hidden="true" />Plan ahead <strong>{soon}</strong></span>
            <span><i className={styles.dotReplace} aria-hidden="true" />Replacement age <strong>{overdue}</strong></span>
          </div>
        </div>
      </article>

      <article className={styles.panel + " " + styles.security} data-status={securityState} aria-label="Cybersecurity outcome">
        <div className={styles.eyebrow}>CYBERSECURITY</div>
        <div className={styles.securityHero}>
          <span className={styles.securityIcon} aria-hidden="true">◇</span>
          <div>
            <strong className={styles.status}>{securityState === "training" ? "Cybersecurity Training Advised" : securityState === "healthy" ? "Healthy" : "Report pending"}</strong>
            <p className={styles.detail}>{securityState === "healthy" ? "No incidents reported." : securityState === "training" ? "A staff training conversation is recommended." : "Incident totals have not been verified."}</p>
          </div>
        </div>
        {securityState === "training" && <span className={styles.incidentPill} role="status" aria-label={`${incidents} security incidents reported; cybersecurity training advised`}>
          <span aria-hidden="true">⚠</span> {incidents} incident{incidents === 1 ? "" : "s"} reported
        </span>}
      </article>

      <article className={styles.panel + " " + styles.questions} aria-label="Security question outcomes">
        <div className={styles.eyebrow}>SECURITY QUESTIONS</div>
        <strong className={styles.status}>{!questions ? "Not included" : pending ? `${pending} to confirm` : "Review complete"}</strong>
        <p className={styles.detail}>{!questions ? "No security conversation recorded." : pending ? "A few answers need follow-up." : "Responses are recorded."}</p>
        {questions && <div className={styles.progressRow}>
          <div className={styles.questionTrack} role="progressbar" aria-label="Security questions recorded" aria-valuemin={0} aria-valuemax={applicable} aria-valuenow={answered}>
            <span style={{ width: answerPercentage + "%" }} />
          </div>
          <span>{answered}/{applicable}</span>
        </div>}
      </article>
    </div>

    {priorities.length > 0 && <section className={styles.priorities} aria-label="FAR assessment priorities">
      <div className={styles.prioritiesHeading}>
        <span className={styles.eyebrow}>FAR OUTCOMES</span>
        <span className={styles.prioritiesHint}>Select a priority for its next step</span>
      </div>
      <div className={styles.priorityGrid}>
        {priorities.map((item, index) => {
          const status = farPriorityStatus(item);
          const label = FAR_PRIORITY_STATUSES.find((row) => row.value === status)?.label ?? "Needs verification";
          return <details className={styles.priorityCard} data-status={status} key={item.id}>
            <summary>
              <span className={styles.priorityIndex}>{String(index + 1).padStart(2, "0")}</span>
              <span className={styles.priorityTitle}>{item.clientText}</span>
              <span className={styles.priorityStatus}>{label}</span>
              <span className={styles.chevron} aria-hidden="true">⌄</span>
            </summary>
            <div className={styles.priorityDetail}>
              <p>{priorityActionSummary(item)}</p>
              {(status === "plan" || status === "verify") && <small>{item.priorityOwner === "client" ? "Your team" : "Advantage"} to follow up</small>}
            </div>
          </details>;
        })}
      </div>
    </section>}
  </section>;
}
