import {
  prospectThrHipaaObservations,
  prospectThrObservations,
  type ProspectThrSession,
  type ThrObservation,
  type ThrStatus,
} from "./technology-health";

export type ProspectThrFinding = ThrObservation & {
  title: string;
  businessImpact: string;
  advantageApproach: string;
};

export interface ProspectThrStory {
  opening: string;
  businessMeaning: string;
  advantageApproach: string;
  findings: ProspectThrFinding[];
  positives: ProspectThrFinding[];
  pendingCount: number;
  concernCount: number;
}

const STORIES: Record<string, { title: string; businessImpact: string; advantageApproach: string }> = {
  reliability: {
    title: "Day-to-day reliability",
    businessImpact: "Repeated technology interruptions can slow appointments, interrupt staff workflows and make busy days harder than they need to be.",
    advantageApproach: "We can review recurring issues, the systems involved and how support is being handled, then plan sensible improvements.",
  },
  equipment: {
    title: "Computers and server performance",
    businessImpact: "Slow or unreliable equipment can affect imaging, scheduling and the team's ability to work efficiently.",
    advantageApproach: "Our Technology Consultant can check device age, performance, operating-system support and replacement priorities firsthand.",
  },
  network: {
    title: "Network reliability",
    businessImpact: "Connectivity problems can interrupt access to shared software, imaging, cloud applications and daily communication.",
    advantageApproach: "We can review the firewall, network equipment, internet connections and any recurring connectivity concerns.",
  },
  software: {
    title: "Practice software and imaging",
    businessImpact: "When key applications do not work smoothly, even small delays can ripple through patient care and office operations.",
    advantageApproach: "We can review software dependencies, hardware compatibility and vendor requirements before recommending changes.",
  },
  security: {
    title: "Security monitoring",
    businessImpact: "Without clear ownership and visibility, important security alerts may not receive the attention they need.",
    advantageApproach: "We can confirm which systems are protected, how alerts are monitored and where managed security coverage may help.",
  },
  backup: {
    title: "Backup and recovery readiness",
    businessImpact: "A backup is most useful when the business knows critical information can actually be restored after an outage or failure.",
    advantageApproach: "We can verify backup monitoring, what is protected and whether a successful recovery test has been documented.",
  },
  planning: {
    title: "Technology replacement planning",
    businessImpact: "Without a replacement plan, aging computers and servers can lead to unexpected downtime and unplanned spending.",
    advantageApproach: "We can establish an equipment lifecycle baseline and develop priorities that fit your operations and budget.",
  },
  support: {
    title: "IT support experience",
    businessImpact: "Unclear support ownership or slow follow-through can leave staff dealing with the same problems repeatedly.",
    advantageApproach: "We can discuss service expectations and show how a consistent managed support relationship could make things easier.",
  },
  "risk-analysis": {
    title: "Documented HIPAA security risk analysis",
    businessImpact: "A current, documented risk analysis helps the practice and its qualified adviser understand which safeguards need attention.",
    advantageApproach: "We can help identify technology items to verify and coordinate with a qualified HIPAA adviser for formal compliance work.",
  },
  "security-owner": {
    title: "HIPAA security ownership",
    businessImpact: "Clear responsibility for security decisions helps ensure policies, training and follow-up are not overlooked.",
    advantageApproach: "We can clarify responsibility for technical safeguards and coordinate with the practice's HIPAA resource.",
  },
  training: {
    title: "Staff security awareness",
    businessImpact: "Employees make day-to-day decisions that affect the safety of business and patient information.",
    advantageApproach: "We can discuss security awareness and technology-related practices while a qualified HIPAA adviser addresses compliance requirements.",
  },
  downtime: {
    title: "Downtime preparedness",
    businessImpact: "A clear response plan can help staff keep essential operations moving when systems are unavailable.",
    advantageApproach: "We can review technical recovery dependencies, backups and continuity planning during the onsite visit.",
  },
  advisor: {
    title: "Qualified HIPAA guidance",
    businessImpact: "Technology controls are only one part of HIPAA compliance; policies, documentation and qualified guidance matter too.",
    advantageApproach: "Advantage can address technology safeguards and work alongside your qualified HIPAA consultant rather than certify compliance.",
  },
};

const URGENCY: Record<ThrStatus, number> = {
  "reported-problem": 0,
  "potential-concern": 1,
  "needs-verification": 2,
  "not-discussed": 3,
  "reported-positive": 4,
};

function enriched(item: ThrObservation): ProspectThrFinding {
  const content = STORIES[item.id] || {
    title: item.category,
    businessImpact: "Clear information helps the business plan technology with fewer surprises.",
    advantageApproach: item.verification,
  };
  return { ...item, ...content };
}

export function prospectThrFindings(session: ProspectThrSession): ProspectThrFinding[] {
  return [...prospectThrObservations(session), ...prospectThrHipaaObservations(session)]
    .filter((item) => item.status !== "not-discussed")
    .map(enriched)
    .sort((a, b) => URGENCY[a.status] - URGENCY[b.status]);
}

export function prospectThrStory(session: ProspectThrSession): ProspectThrStory {
  const all = prospectThrFindings(session);
  const focus = all.filter((item) => item.status !== "reported-positive");
  const priority = session.discovery.priorities.slice(0, 3);
  const concern = focus.filter((item) => item.status === "reported-problem" || item.status === "potential-concern");
  const uncertain = focus.filter((item) => item.status === "needs-verification");
  const opening = priority.length
    ? "You told us that " + priority.join(", ").toLowerCase() + " " + (priority.length === 1 ? "is" : "are") + " important to your business. This review helps connect those priorities to the technology you rely on each day."
    : "This review gives us a starting picture of the technology your team relies on, including areas that may deserve more attention.";
  const businessMeaning = concern.length
    ? "From what you shared, " + concern.slice(0, 2).map((item) => item.title.toLowerCase()).join(" and ") + " deserve a closer look. " + concern[0].businessImpact +
      (uncertain.length ? " We also have details to confirm, including " + uncertain.slice(0, 2).map((item) => item.title.toLowerCase()).join(" and ") + "." : "")
    : uncertain.length
      ? "Some important details are still unknown, including " + uncertain.slice(0, 2).map((item) => item.title.toLowerCase()).join(" and ") + ". That does not mean anything is wrong; it means those areas deserve verification before anyone makes recommendations."
      : "You did not describe a specific urgent technology issue during this conversation. Those positive reports are encouraging, although we have not yet independently verified the environment.";
  const help = concern[0] || uncertain[0];
  const advantageApproach = help
    ? help.advantageApproach + " A complimentary onsite technology assessment lets us confirm the details before recommending a solution or preparing a formal proposal."
    : "An onsite assessment can confirm the environment, highlight practical planning opportunities and help us tailor recommendations to your business.";
  return {
    opening,
    businessMeaning,
    advantageApproach,
    findings: focus,
    positives: all.filter((item) => item.status === "reported-positive"),
    pendingCount: uncertain.length,
    concernCount: concern.length,
  };
}

export const THR_OTR_INTRO = "The next step is a complimentary onsite technology assessment. A Technology Consultant will see your environment firsthand, verify the questions we discussed and help us prepare an accurate plan. We can choose a date and time together before we finish.";
