import type { A360ProspectDiscovery } from "./a360";

/**
 * Conversation-based technology health, never a scan or technical audit.
 * Responses are client-reported; a "good" answer is not verified evidence.
 */
export type ThrAnswer = "positive" | "partial" | "concern" | "unknown";
export type ThrStatus = "reported-positive" | "potential-concern" | "reported-problem" | "needs-verification" | "not-discussed";

export interface ThrQuestion {
  id: string;
  category: string;
  question: string;
  options: [string, string, string, string];
  verification: string;
}

export interface ThrObservation {
  id: string;
  category: string;
  question: string;
  answer: string;
  status: ThrStatus;
  note: string;
  verification: string;
}

export interface ProspectThrAnswers {
  responses: Record<string, ThrAnswer>;
  notes: Record<string, string>;
}

export interface ProspectThrSession {
  discovery: A360ProspectDiscovery;
  conversationContext: string;
  health: ProspectThrAnswers;
  hipaaEnabled: boolean;
  hipaa: ProspectThrAnswers;
}

export const THR_QUESTIONS: ThrQuestion[] = [
  {
    id: "reliability", category: "Everyday technology",
    question: "How often do technology problems interrupt your team's work?",
    options: ["Rarely", "Occasionally", "Frequently", "Not sure"],
    verification: "Review recurring service issues, event history and workstation reliability.",
  },
  {
    id: "equipment", category: "Everyday technology",
    question: "Are any computers or servers getting slow or unreliable?",
    options: ["No issues reported", "A few", "Several / major issues", "Not sure"],
    verification: "Inventory models, equipment age, warranties, CPU, memory, storage and operating-system support.",
  },
  {
    id: "network", category: "Everyday technology",
    question: "Are network or internet problems affecting daily work?",
    options: ["No issues reported", "Occasionally", "Frequently", "Not sure"],
    verification: "Identify network equipment, firewall make/model, firmware, internet connections and wireless coverage.",
  },
  {
    id: "software", category: "Everyday technology",
    question: "Are your important applications or imaging systems working reliably?",
    options: ["Generally yes", "Some issues", "Regular problems", "Not sure"],
    verification: "Check practice software, imaging, dependencies, vendor requirements and compatibility.",
  },
  {
    id: "security", category: "Protection and planning",
    question: "Do you know who monitors your computers for security threats?",
    options: ["Yes, someone does", "Some coverage", "No monitoring known", "Not sure"],
    verification: "Confirm endpoint protection deployment, AV/EDR status, alert monitoring and security response ownership.",
  },
  {
    id: "backup", category: "Protection and planning",
    question: "Do you know whether someone has tested restoring your backups?",
    options: ["Yes, a recent test", "Testing may be overdue", "No test known", "Not sure"],
    verification: "Inspect backup jobs, alerting, retention, protected systems and evidence of successful recovery testing.",
  },
  {
    id: "planning", category: "Protection and planning",
    question: "Do you have a plan for replacing aging technology?",
    options: ["Yes, a current plan", "Partially", "No plan", "Not sure"],
    verification: "Build a device lifecycle baseline with replacement priorities, budget and software compatibility.",
  },
  {
    id: "support", category: "Protection and planning",
    question: "Are you satisfied with how your IT concerns are handled?",
    options: ["Yes", "Somewhat", "No", "Not sure"],
    verification: "Clarify expectations, escalation process, response needs, current provider and vendor coordination.",
  },
];

export const THR_HIPAA_QUESTIONS: ThrQuestion[] = [
  {
    id: "risk-analysis", category: "HIPAA readiness",
    question: "Has your practice completed a documented HIPAA security risk analysis?",
    options: ["Yes, current", "Possibly outdated", "No / none known", "Not sure"],
    verification: "Ask the practice and its HIPAA adviser to confirm the risk analysis and open remediation plan.",
  },
  {
    id: "security-owner", category: "HIPAA readiness",
    question: "Is someone responsible for HIPAA security and related policies?",
    options: ["Yes, clearly assigned", "Somewhat", "No one identified", "Not sure"],
    verification: "Confirm the responsible person and how written policies are maintained.",
  },
  {
    id: "training", category: "HIPAA readiness",
    question: "Does your team receive ongoing HIPAA and security awareness training?",
    options: ["Yes, regularly", "Occasionally", "No training known", "Not sure"],
    verification: "Confirm the training approach and consult the qualified HIPAA adviser as appropriate.",
  },
  {
    id: "downtime", category: "HIPAA readiness",
    question: "Does your team know what to do if important systems go down?",
    options: ["Yes, documented", "Partially", "No plan known", "Not sure"],
    verification: "Review downtime procedures, communication, backups and continuity practices.",
  },
  {
    id: "advisor", category: "HIPAA readiness",
    question: "Do you have a qualified resource guiding your HIPAA compliance work?",
    options: ["Yes", "Occasionally", "No", "Not sure"],
    verification: "Confirm independent HIPAA guidance; Advantage's technology review is not a compliance determination.",
  },
];

const ANSWER_ORDER: ThrAnswer[] = ["positive", "partial", "concern", "unknown"];

export function thrStatus(answer?: ThrAnswer): ThrStatus {
  if (!answer) return "not-discussed";
  if (answer === "positive") return "reported-positive";
  if (answer === "partial") return "potential-concern";
  if (answer === "concern") return "reported-problem";
  return "needs-verification";
}

export const THR_STATUS_LABELS: Record<ThrStatus, string> = {
  "reported-positive": "Reported positive",
  "potential-concern": "Potential concern",
  "reported-problem": "Reported problem",
  "needs-verification": "Needs verification",
  "not-discussed": "Not discussed",
};

export function observationsFor(questions: ThrQuestion[], answers: ProspectThrAnswers): ThrObservation[] {
  return questions.map((question) => {
    const answer = answers.responses[question.id];
    return {
      id: question.id,
      category: question.category,
      question: question.question,
      answer: answer ? question.options[ANSWER_ORDER.indexOf(answer)] : "Not discussed",
      status: thrStatus(answer),
      note: answers.notes[question.id]?.trim() ?? "",
      verification: question.verification,
    };
  });
}

export function prospectThrObservations(session: ProspectThrSession): ThrObservation[] {
  return observationsFor(THR_QUESTIONS, session.health);
}

export function prospectThrHipaaObservations(session: ProspectThrSession): ThrObservation[] {
  return session.hipaaEnabled ? observationsFor(THR_HIPAA_QUESTIONS, session.hipaa) : [];
}

export function prospectThrOpenItems(session: ProspectThrSession): ThrObservation[] {
  return [...prospectThrObservations(session), ...prospectThrHipaaObservations(session)]
    .filter((item) => item.status !== "reported-positive");
}

export function prospectThrSummary(session: ProspectThrSession): string {
  const d = session.discovery;
  const subject = d.organizationName.trim() || "The organization";
  const priorities = d.priorities.slice(0, 3);
  const flagged = prospectThrOpenItems(session).filter((item) => item.status === "reported-problem" || item.status === "potential-concern");
  const result = [
    subject + " participated in a conversation-based Technology Health Review.",
    priorities.length ? "The stated priorities were " + priorities.join(", ") + "." : "The discussion focused on current technology and future planning.",
    flagged.length ? "The conversation surfaced items to examine further around " + flagged.slice(0, 3).map((item) => item.category.toLowerCase() + " (" + item.answer.toLowerCase() + ")").join("; ") + "." : "No specific technical issue was verified during this conversation.",
    "All observations are client-reported or unanswered; technical condition and security coverage require independent verification.",
  ];
  return result.join(" ");
}

export function prospectThrEnvironment(session: ProspectThrSession): Array<[string, string]> {
  const d = session.discovery;
  return [
    ["Approximate workstations", d.workstations > 0 ? String(d.workstations) : "Not yet confirmed"],
    ["Locations", String(d.locations || 1)],
    ["Server", d.server === "yes" ? "Reported onsite server" : d.server === "no" ? "No server reported" : "Not sure"],
    ["Primary software", d.managementSoftware.trim() || "Not confirmed"],
    ...(d.industry === "Dental" ? [["Imaging", [d.imagingSoftware, d.imagingEnvironment].filter(Boolean).join(" · ") || "Not confirmed"] as [string, string]] : []),
    ["Other software", d.otherSoftware.trim() || "Not confirmed"],
  ];
}

export function prospectThrConsultantChecklist(session: ProspectThrSession): string[] {
  const focused = prospectThrOpenItems(session).map((item) => item.verification);
  return Array.from(new Set([
    "Confirm computer and server counts, make/model, age, CPU, RAM, storage and supported OS versions.",
    "Identify firewall/network model and condition; verify endpoint protection and AV/EDR status.",
    "Verify backup monitoring, scope and documented ability to restore critical systems.",
    ...focused,
  ]));
}

export function prospectThrConsultantBrief(session: ProspectThrSession, appointment?: {
  date: string; time: string; timeZone: string; consultantName: string;
} | null): string {
  const d = session.discovery;
  const focus = prospectThrOpenItems(session);
  return [
    "PROSPECT TECHNOLOGY HEALTH REVIEW - OTA BRIEF",
    "Company: " + (d.organizationName || "Not provided"),
    "Contact: " + (d.contactName || "Not provided"),
    "Industry: " + d.industry,
    appointment ? "OTA: " + appointment.date + " " + appointment.time + " " + appointment.timeZone + " with " + appointment.consultantName : "OTA: Not yet agreed",
    "",
    "CONVERSATION CONTEXT",
    session.conversationContext.trim() || prospectThrSummary(session),
    "",
    "CLIENT-REPORTED PRIORITIES",
    ...(d.priorities.length ? d.priorities.map((priority) => "• " + priority) : ["• Not recorded"]),
    "",
    "OBSERVATIONS REQUIRING FOLLOW-UP",
    ...(focus.length ? focus.map((item) => "• " + item.category + ": " + item.answer + (item.note ? " - " + item.note : "")) : ["• No specific items flagged; complete technical verification onsite"]),
    "",
    "TECHNICAL VERIFICATION CHECKLIST",
    ...prospectThrConsultantChecklist(session).map((item) => "• " + item),
    "",
    "This briefing summarizes unverified conversation responses, not confirmed findings, an approved estimate or a scheduled GHL/Outlook invitation.",
  ].join("\n");
}

export const PROSPECT_THR_HIPAA_DISCLAIMER =
  "This is a preliminary conversation about technology and HIPAA security readiness. It is not a formal risk analysis, audit, certification, legal opinion or determination of HIPAA compliance. Qualified HIPAA guidance and technical verification may be required.";
