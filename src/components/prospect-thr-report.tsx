"use client";

import type { PlanningAppointment } from "@/lib/projects/types";
import { formatPlanningAppointment } from "@/lib/outcomes/planning-appointment";
import {
  THR_STATUS_LABELS,
  PROSPECT_THR_HIPAA_DISCLAIMER,
  prospectThrEnvironment,
  prospectThrHipaaObservations,
  prospectThrObservations,
  type ProspectThrSession,
  type ThrObservation,
} from "@/lib/prospects/technology-health";
import { prospectThrStory, type ProspectThrFinding } from "@/lib/prospects/technology-health-narrative";

function DateSummary({ appointment }: { appointment: PlanningAppointment }) {
  return <><strong>{formatPlanningAppointment(appointment)}</strong><span>With {appointment.consultantName}</span></>;
}

function Status({ item }: { item: ThrObservation }) {
  return <span className={"thr-status-tone tone-" + item.status}>{THR_STATUS_LABELS[item.status]}</span>;
}

function ReportHeader({ session }: { session: ProspectThrSession }) {
  return <header className="thr-report-header">
    <div className="thr-report-mark">
      <img src="/advantage-mark.png" alt="" />
      <span>ADVANTAGE <small>TECHNOLOGIES</small></span>
    </div>
    <span className="thr-report-edition">TECHNOLOGY HEALTH REVIEW · PROSPECT EDITION</span>
    <h1>Technology<br/>Health Report</h1>
    <p>Prepared for <b>{session.discovery.organizationName || "Your organization"}</b></p>
    <div className="thr-report-cover-meta">
      <span>Prepared {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
      <span>{session.discovery.contactName || "Practice contact"}</span>
      <span>Conversation-based review</span>
    </div>
  </header>;
}

function FindingRow({ item }: { item: ProspectThrFinding }) {
  return <article className={"thr-report-finding tone-" + item.status}>
    <div className="thr-report-finding-heading"><div><strong>{item.title}</strong><span>{item.answer}{item.note ? " · " + item.note : ""}</span></div><Status item={item}/></div>
    <p>{item.businessImpact}</p>
    <div className="thr-report-approach"><span>How we can help</span><p>{item.advantageApproach}</p></div>
  </article>;
}

export function ProspectThrSnapshot({ session }: { session: ProspectThrSession }) {
  const story = prospectThrStory(session);
  const displayed = story.findings.filter((x) => x.status !== "not-discussed").slice(0, 5);
  return <section className="thr-narrative-snapshot">
    <span className="prospect-kicker">What we learned together</span>
    <h2>Here’s what stands out.</h2>
    <p className="thr-story-opening">{story.opening}</p>
    <div className="thr-story-explanation">
      <section><span>Why it matters</span><p>{story.businessMeaning}</p></section>
      <section><span>How Advantage can help</span><p>{story.advantageApproach}</p></section>
    </div>
    {!!displayed.length && <div className="thr-story-tags"><span>Focus for the onsite visit</span><div>
      {displayed.map((item) => <span className={"thr-story-tag tone-" + item.status} key={item.id}>{item.title} <small>· {THR_STATUS_LABELS[item.status]}</small></span>)}
    </div></div>}
    <p className="thr-story-footnote">This is based on your answers, not on a technical scan. We’ll verify the details before making final recommendations.</p>
  </section>;
}

export function ProspectThrReportPreview({ session }: { session: ProspectThrSession }) {
  const story = prospectThrStory(session);
  const focus = story.findings.slice(0, 3);
  return <div className="thr-report-teaser">
    <div className="thr-teaser-copy">
      <span className="prospect-kicker">Your report to keep</span>
      <h2>A clear record of what we discussed.</h2>
      <p>We'll capture your priorities, the answers you shared, and the items worth confirming. It's yours whether or not you move forward with us.</p>
      <div className="thr-teaser-includes">
        <span><i/>Technology health overview</span>
        <span><i/>Priority areas and what they mean</span>
        <span><i/>Reported strengths and unanswered questions</span>
        <span><i/>Next steps for onsite verification</span>
      </div>
    </div>
    <div className="thr-teaser-sheet" role="img" aria-label="Illustrative first-page preview of the Technology Health Report with colored health priorities">
      <div className="thr-teaser-sheet-bar"><img src="/advantage-mark.png" alt="" /><span>ADVANTAGE TECHNOLOGIES</span></div>
      <small>TECHNOLOGY HEALTH REPORT</small>
      <strong>{session.discovery.organizationName || "Your practice"}</strong>
      <div className="thr-teaser-rule"/>
      <p>Key technology priorities</p>
      {(focus.length ? focus : [{ id: "pending", title: "Your technology environment", status: "needs-verification" as const }, { id: "backup", title: "Backup and recovery", status: "needs-verification" as const }, { id: "planning", title: "Technology planning", status: "needs-verification" as const }]).map((item) =>
        <div className={"thr-teaser-line tone-" + item.status} key={item.id}><span>{item.title}</span><i/></div>)}
      <div className="thr-teaser-rule"/>
      <p>Next step</p>
      <div className="thr-teaser-next">Onsite technology assessment</div>
      <div className="thr-teaser-sheet-foot">CLIENT COPY · TECHNOLOGY REVIEW</div>
    </div>
  </div>;
}

export function ProspectThrReport({ session, appointment }: { session: ProspectThrSession; appointment: PlanningAppointment | null }) {
  const story = prospectThrStory(session);
  const core = prospectThrObservations(session);
  const hipaa = prospectThrHipaaObservations(session);
  const focus = story.findings;
  const notDiscussed = [...core, ...hipaa].filter((item) => item.status === "not-discussed");
  const requested = session.discovery.priorities.slice(0, 5);

  return <article className="thr-complete-report" aria-label="Technology Health Report">
    <ReportHeader session={session}/>
    <div className="thr-report-body">
      <section className="thr-report-summary">
        <div className="thr-report-kicker">01 / YOUR TECHNOLOGY HEALTH</div>
        <h2>The big picture.</h2>
        <p className="thr-report-lede">{story.opening}</p>
        {session.conversationContext.trim() && <p className="thr-report-context-copy">{session.conversationContext.trim()}</p>}
        <div className="thr-report-insights">
          <div><span>Why this matters</span><p>{story.businessMeaning}</p></div>
          <div><span>Our recommended approach</span><p>{story.advantageApproach}</p></div>
        </div>
        <div className="thr-report-metrics">
          <span className="needs-attention"><strong>{story.concernCount}</strong> reported areas of concern</span>
          <span className="needs-verification"><strong>{story.pendingCount}</strong> questions needing verification</span>
          <span className="reported-positive"><strong>{story.positives.length}</strong> reported positives</span>
        </div>
        <p className="thr-report-caution">This is a conversation-based review. All responses are client-reported and have not been independently verified; they are not technical findings or a formal risk assessment.</p>
      </section>

      <section className="thr-report-section">
        <div className="thr-report-kicker">02 / WHAT MATTERS TO YOU</div>
        <h2>Your priorities and environment.</h2>
        {!!requested.length && <div className="thr-report-priority-list">{requested.map((priority, i) => <div key={priority}><span>{String(i + 1).padStart(2, "0")}</span>{priority}</div>)}</div>}
        <div className="thr-report-environment-grid">{prospectThrEnvironment(session).map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
      </section>

      <section className="thr-report-section">
        <div className="thr-report-kicker">03 / TECHNOLOGY HEALTH PRIORITIES</div>
        <h2>What deserves a closer look.</h2>
        <p>These are areas brought up during the conversation, organized by what may need attention or verification. They are not confirmed vulnerabilities or system failures.</p>
        {focus.length ? <div className="thr-report-findings">{focus.map((item) => <FindingRow item={item} key={item.id} />)}</div> :
          <p>No particular concerns were reported. The onsite assessment can still verify coverage, equipment condition and opportunities for future planning.</p>}
      </section>

      {(story.positives.length > 0 || notDiscussed.length > 0) && <section className="thr-report-section">
        <div className="thr-report-kicker">04 / THE REST OF THE PICTURE</div>
        <h2>What's working, and what's still unknown.</h2>
        {!!story.positives.length && <>
          <h3>Positive practices reported</h3>
          <p className="thr-report-positive-intro">These answers are encouraging, but still need validation where appropriate.</p>
          <div className="thr-report-status-list">{story.positives.map((item) => <div key={item.id}><Status item={item}/><strong>{item.title}</strong><span>{item.answer}</span></div>)}</div>
        </>}
        {!!notDiscussed.length && <>
          <h3>Not discussed during this review</h3>
          <div className="thr-report-status-list">{notDiscussed.map((item) => <div key={item.id}><Status item={item}/><strong>{item.category}</strong><span>{item.question}</span></div>)}</div>
        </>}
      </section>}

      {session.hipaaEnabled && <section className="thr-report-section thr-report-hipaa-note">
        <div className="thr-report-kicker">HIPAA TECHNICAL READINESS</div>
        <h2>Planning with the right safeguards.</h2>
        <p>{PROSPECT_THR_HIPAA_DISCLAIMER}</p>
      </section>}

      <section className="thr-report-next-step">
        <div className="thr-report-kicker">YOUR NEXT STEP</div>
        <h2>Let's see your technology firsthand.</h2>
        <p>A complimentary onsite technology assessment is the practical next step. A Technology Consultant can verify the environment, answer the open questions and help put together an accurate plan and formal proposal, if you want one.</p>
        {appointment ? <div className="thr-report-confirmed">
          <span>ON-SITE VISIT · DATE AND TIME AGREED</span>
          <DateSummary appointment={appointment} />
          <small>Your Advantage Technologies contact will coordinate the formal appointment invitation and follow-up details.</small>
        </div> : <div className="thr-report-invite">
          <strong>Let's choose your onsite assessment date.</strong>
          <span>Ask your Advantage Technologies contact to confirm an available date and time with you during the review.</span>
        </div>}
        <div className="thr-report-footer-line"><span>ADVANTAGE TECHNOLOGIES</span><span>Technology Health Review</span></div>
      </section>
    </div>
  </article>;
}
