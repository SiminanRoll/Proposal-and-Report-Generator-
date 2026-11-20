"use client";

import type { CSSProperties } from "react";
import type { Project } from "@/lib/projects/types";
import { factNumber, lifecycleSummary, osSupportSummary } from "@/lib/outcomes/client-report-data";
import { clientReportScores, scoreLabel, scoreTone } from "@/lib/outcomes/client-report-score";
import { scoreHipaaAssessment } from "@/lib/hipaa/engine";
import { farPriorityStatus, farTopPriorities, priorityActionSummary, FAR_PRIORITY_STATUSES } from "@/lib/far/far-priorities";
import styles from "./recap-visual.module.css";

function countLabel(count: number, singular: string, plural = singular + "s"): string {
  return count + " " + (count === 1 ? singular : plural);
}

/** A client-facing visual summary, not a second score or a new source of truth. */
export function RecapVisual({ project }: { project: Project }) {
  const lifecycle = lifecycleSummary(project);
  const os = osSupportSummary(project);
  const scores = clientReportScores(project);
  const questions = project.hipaa.enabled ? scoreHipaaAssessment(project.hipaa) : null;
  const priorities = farTopPriorities(project);
  const total = Math.max(0, lifecycle.inventoryTotal);
  const current = Math.max(0, lifecycle.current);
  const dueSoon = Math.max(0, lifecycle.dueSoon);
  const overdue = Math.max(0, lifecycle.overdue);
  const other = Math.max(0, total - current - dueSoon - overdue);
  const fraction = (value: number) => total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;
  const currentStop = fraction(current);
  const planningStop = Math.min(100, currentStop + fraction(dueSoon));
  const replacementStop = Math.min(100, planningStop + fraction(overdue));
  const ringStyle = {
    "--recap-current": currentStop + "%",
    "--recap-planning": planningStop + "%",
    "--recap-replacement": replacementStop + "%",
  } as CSSProperties;
  const hasSecurityEvidence = project.intelligence.facts.some((fact) => fact.key === "huntress.eventsAnalyzed" || fact.key === "huntress.entitiesProtected");
  const hasIncidentEvidence = project.intelligence.facts.some((fact) => fact.key === "huntress.incidentsReported");
  const incidents = factNumber(project, "huntress.incidentsReported");
  const securityTone = hasSecurityEvidence ? scoreTone(scores.security) : "unverified";
  const outstanding = questions?.notYetAssessedCount ?? 0;
  const needingAttention = questions ? questions.counts.no + questions.counts.partially : 0;
  const answered = questions?.assessedQuestionCount ?? 0;
  const applicable = questions?.applicableQuestionCount ?? 0;
  const answeredPercent = applicable > 0 ? Math.max(0, Math.min(100, (answered / applicable) * 100)) : 0;

  return <section className={styles.root} aria-label="Review outcomes at a glance">
    <div className={styles.grid}>
      <article className={styles.panel + " " + styles.health}>
        <div className={styles.panelHeading}>
          <span className={styles.eyebrow}>ENVIRONMENT HEALTH</span>
          <span className={styles.panelGlyph} aria-hidden="true">✦</span>
        </div>
        <div className={styles.healthBody}>
          <div className={styles.healthRing} style={ringStyle} role="img"
            aria-label={total > 0
              ? [countLabel(current, "healthy asset"), countLabel(dueSoon, "asset to plan", "assets to plan"), countLabel(overdue, "asset due for replacement", "assets due for replacement"), countLabel(other, "unclassified asset")].join(", ")
              : "No lifecycle inventory available"}>
            <div className={styles.ringCenter}>
              <span>Technology health</span>
              <strong>{total > 0 ? scoreLabel(scores.overall) : "Pending"}</strong>
              <small>{scores.provisional ? "Review still in progress" : total > 0 ? "Current assessment" : "Inventory needed"}</small>
            </div>
          </div>
          <div className={styles.legend}>
            <div><i className={styles.dotHealthy} aria-hidden="true" /><span>In service</span><strong>{current}</strong></div>
            <div><i className={styles.dotPlanning} aria-hidden="true" /><span>Plan ahead</span><strong>{dueSoon}</strong></div>
            <div><i className={styles.dotReplace} aria-hidden="true" /><span>Replacement age</span><strong>{overdue}</strong></div>
            {other > 0 && <div><i className={styles.dotUnknown} aria-hidden="true" /><span>Not classified</span><strong>{other}</strong></div>}
          </div>
        </div>
        <p className={styles.microNote}>{total > 0 ? countLabel(total, "managed asset") + " assessed" : "No device totals available"}{os.attention > 0 ? " · " + countLabel(os.attention, "OS concern") + " to review" : ""}</p>
      </article>

      <article className={styles.panel + " " + styles.security} data-tone={securityTone}>
        <div className={styles.panelHeading}>
          <span className={styles.eyebrow}>SECURITY PROTECTION</span>
          <span className={styles.shield} aria-hidden="true"><svg viewBox="0 0 40 42" fill="none"><path d="M20 3 35 9v11c0 10-6 16-15 20C11 36 5 30 5 20V9L20 3Z" stroke="currentColor" strokeWidth="2.5"/><path d="m13 21 5 5 10-11" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
        </div>
        <strong className={styles.status}>{hasSecurityEvidence ? scoreLabel(scores.security) : "Evidence pending"}</strong>
        <p className={styles.description}>{hasSecurityEvidence ? "Current security monitoring and response indicators." : "A security monitoring report is needed to complete this view."}</p>
        <div className={styles.securityTrack} aria-hidden="true"><span data-tone={securityTone} /></div>
        <p className={styles.detail}>{hasIncidentEvidence
          ? incidents > 0 ? countLabel(incidents, "reported incident") + " · see response details" : "No incidents in the supplied security report"
          : "Incident reporting has not been verified"}</p>
      </article>

      <article className={styles.panel + " " + styles.questions} data-tone={!questions || outstanding ? "attention" : "complete"}>
        <div className={styles.panelHeading}>
          <span className={styles.eyebrow}>SECURITY CONVERSATION</span>
          <span className={styles.questionIcon} aria-hidden="true">✓</span>
        </div>
        <strong className={styles.status}>{!questions ? "Not included" : outstanding > 0 ? "Follow-up needed" : "Answers recorded"}</strong>
        <p className={styles.description}>{!questions ? "No security questionnaire was included in this review." : outstanding > 0 ? countLabel(outstanding, "question") + " still needs a response." : "All applicable questions have recorded responses."}</p>
        {questions ? <>
          <div className={styles.questionTrack} role="progressbar" aria-label="Questions reviewed" aria-valuemin={0} aria-valuemax={applicable} aria-valuenow={answered}>
            <span style={{ width: answeredPercent + "%" }} />
          </div>
          <p className={styles.detail}>{answered} of {applicable} reviewed{needingAttention ? " · " + countLabel(needingAttention, "response") + " to discuss" : ""}</p>
        </> : <p className={styles.detail}>A conversation summary can be added when needed.</p>}
        <small className={styles.caveat}>A technology discussion, not a compliance certification.</small>
      </article>
    </div>

    {priorities.length > 0 && <div className={styles.priorities}>
      <div className={styles.prioritiesHeading}><div><span className={styles.eyebrow}>FULL ASSESSMENT REPORT</span><h3>Decisions that move us forward</h3></div><span className={styles.priorityBadge}>Top priorities</span></div>
      <div className={styles.priorityGrid}>
        {priorities.map((item, index) => {
          const status = farPriorityStatus(item);
          const statusLabel = FAR_PRIORITY_STATUSES.find((row) => row.value === status)?.label ?? "Needs verification";
          return <article className={styles.priorityCard} data-status={status} key={item.id}>
            <div className={styles.priorityTop}><span className={styles.priorityIndex}>{String(index + 1).padStart(2, "0")}</span><span className={styles.priorityStatus}>{statusLabel}</span></div>
            <strong>{item.clientText}</strong>
            <p>{priorityActionSummary(item)}</p>
            {(status === "plan" || status === "verify") && <small>{item.priorityOwner === "client" ? "Your team" : "Advantage"} to follow up</small>}
          </article>;
        })}
      </div>
    </div>}
  </section>;
}
