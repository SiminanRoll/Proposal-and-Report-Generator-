import { priorityStory } from "@/lib/prospects/a360";
import type { A360ConversationRecord, A360ConversationReportCopy, PlanningAppointment, Project } from "@/lib/projects/types";
import type { A360ProspectDiscovery, ProspectEstimate } from "@/lib/prospects/a360";
import { createProject } from "@/lib/projects/factory";
import { formatPlanningAppointment } from "@/lib/outcomes/planning-appointment";

function sentenceList(items: string[]): string {
  const clean = items.map((item) => item.trim()).filter(Boolean);
  if (!clean.length) return "the priorities discussed during the conversation";
  if (clean.length === 1) return clean[0].toLowerCase();
  if (clean.length === 2) return `${clean[0].toLowerCase()} and ${clean[1].toLowerCase()}`;
  return `${clean.slice(0, -1).map((item) => item.toLowerCase()).join(", ")}, and ${clean[clean.length - 1].toLowerCase()}`;
}

function environmentSentence(discovery: A360ProspectDiscovery): string {
  const pieces: string[] = [];
  if (discovery.workstations > 0) pieces.push(`approximately ${discovery.workstations} workstation${discovery.workstations === 1 ? "" : "s"}`);
  pieces.push(`${Math.max(1, discovery.locations)} location${Math.max(1, discovery.locations) === 1 ? "" : "s"}`);
  pieces.push(discovery.server === "yes" ? "an onsite server" : discovery.server === "no" ? "no onsite server" : "server details we’ll confirm during the visit");
  if (discovery.managementSoftware.trim()) pieces.push(discovery.managementSoftware.trim());
  if (discovery.imagingSoftware.trim()) pieces.push(discovery.imagingSoftware.trim());
  return pieces.join(", ");
}

export function defaultA360ConversationReport(discovery: A360ProspectDiscovery, appointment: PlanningAppointment): A360ConversationReportCopy {
  const org = discovery.organizationName.trim() || discovery.contactName.trim() || "Your organization";
  const priorities = sentenceList(discovery.priorities.slice(0, 4));
  const primary = discovery.priorities[0] || "Better support";
  const story = priorityStory(primary, discovery.organizationLanguage);
  return {
    title: `Advantage 360 Conversation Recap — ${org}`,
    executiveSummary: `Thank you for taking the time to talk through what matters most to ${org} and what an Advantage 360 relationship could look like. The strongest themes in our conversation were ${priorities}. This recap brings together what we discussed, the starting picture you shared, the preliminary pricing we reviewed, and the onsite technology assessment that is already scheduled as the next step.`,
    conversationSummary: `${story.body} You also gave us a helpful starting picture of the ${discovery.organizationLanguage}: ${environmentSentence(discovery)}. That gives your Technology Consultant a head start before the onsite visit. When we’re there, we’ll see how the technology fits together, ask any follow-up questions, and keep the conversation centered on what matters most to your team.`,
    nextStepSummary: `Your onsite technology assessment is already scheduled for ${formatPlanningAppointment(appointment)} with ${appointment.consultantName}. We’ll walk through the environment together, confirm the starting picture, understand the software and workflow, and use what we learn to tailor the Advantage 360 plan from there.`,
  };
}

export function buildA360ConversationRecord(input: {
  handoffId: string;
  discovery: A360ProspectDiscovery;
  estimate: ProspectEstimate;
  appointment: PlanningAppointment;
  contactEmail: string;
  contactPhone: string;
}): A360ConversationRecord {
  return {
    kind: "a360-conversation",
    handoffId: input.handoffId,
    discovery: { ...input.discovery, priorities: [...input.discovery.priorities] },
    estimate: { ...input.estimate, assumptions: [...input.estimate.assumptions] },
    appointment: { ...input.appointment },
    contactEmail: input.contactEmail.trim(),
    contactPhone: input.contactPhone.trim(),
    capturedAt: new Date().toISOString(),
    report: defaultA360ConversationReport(input.discovery, input.appointment),
  };
}

export function createA360ConversationProject(record: A360ConversationRecord): Project {
  const org = record.discovery.organizationName.trim() || record.discovery.contactName.trim() || "Potential client";
  const project = createProject({
    type: "prospect-proposal",
    clientName: org,
    organizationTerm: record.discovery.organizationLanguage,
    projectName: `${org} — A360 Conversation`,
    contactName: record.discovery.contactName,
    contactEmail: record.contactEmail,
    contactPhone: record.contactPhone,
    painPoints: record.discovery.priorities.join("\n"),
  });
  return {
    ...project,
    status: "published",
    sources: [],
    client: { ...project.client, industry: record.discovery.industry },
    planningAppointment: record.appointment,
    pricing: { ...project.pricing, monthly: record.estimate.high },
    presentation: {
      ...project.presentation,
      title: record.report.title,
      executiveSummary: record.report.executiveSummary,
      publishedAt: record.capturedAt,
    },
    a360Conversation: record,
  };
}

export function buildA360TailoredReportPrompt(record: A360ConversationRecord): string {
  const d = record.discovery;
  return `You are helping polish a client-facing Advantage Technologies A360 conversation recap for a prospective organization before its first onsite technology assessment.

This document sits after the introductory A360/pricing conversation and before the onsite visit. The onsite assessment is already scheduled and is the confirmed next step.

Write directly to the prospective customer in a confident, warm, practical tone. Use “you” and “your team” naturally. Summarize what was discussed, what matters to them, what Advantage 360 is designed to provide, the preliminary monthly pricing discussed, and what the scheduled onsite visit will accomplish.

Strict framing rules:
- Treat environment and software details as the starting picture the customer shared, not as evidence or findings.
- Keep the language conversational and customer-friendly. Prefer phrases like “what you shared,” “what we discussed,” “starting picture,” and “we’ll confirm the details together onsite.”
- Do not use audit, evidence, or internal-reporting language such as “reported,” “technically verified,” “validation,” “findings,” “prescribed,” “scope,” “risk posture,” or “evidence.”
- Do not imply Advantage has already analyzed, inspected, tested, or confirmed the network, equipment, backups, security, performance, or one-time project needs.
- Do not present replacement work, migrations, backup changes, or other projects as recommended or approved work before the onsite visit.
- Do not use the word “maintenance”; use monitoring, protection, planning, ownership, or support language instead.
- Do not ask whether they are ready to move forward. They already moved forward to the scheduled onsite assessment.
- Do not include authorization, approval, signature, decision, or “approve the plan” language.
- Do not mention Captain's Log, Client Compass, CRM fields, handoffs, internal sales activity, or internal workflow.

Organization: ${d.organizationName || d.contactName}
Contact: ${d.contactName || "Not provided"}
Industry: ${d.industry}
Organization language: ${d.organizationLanguage}
Priorities, in order: ${d.priorities.join(" | ") || "Not explicitly ranked"}
Workstations discussed: ${d.workstations || "Not provided"}
Server discussed: ${d.server}
Locations discussed: ${d.locations}
Management software discussed: ${d.managementSoftware || "Not provided"}
Imaging software discussed: ${d.imagingSoftware || "Not provided"}
Imaging environment discussed: ${d.imagingEnvironment || "Not provided"}
Other software discussed: ${d.otherSoftware || "Not provided"}
Preliminary Advantage 360 monthly estimate discussed: $${record.estimate.low.toLocaleString()}-${record.estimate.high.toLocaleString()} per month
Scheduled onsite assessment: ${formatPlanningAppointment(record.appointment)} with ${record.appointment.consultantName}

Return exactly these four labeled sections, with no markdown bullets or extra commentary:
REPORT TITLE: a concise Advantage 360 conversation recap title; never call it a technology review, findings report, authorization, or network analysis
EXECUTIVE SUMMARY: 90-140 words summarizing the conversation, priorities, pricing discussed, and the already-scheduled onsite next step
CONVERSATION SUMMARY: 120-190 words connecting the priorities, starting picture, software discussed, and what Advantage 360 could mean for the customer in a warm conversational voice
NEXT STEP: 60-100 words stating that the onsite assessment is already scheduled, what the team will walk through together, and how what we learn will help tailor the plan afterward`;
}

function section(text: string, label: string, nextLabels: string[]): string {
  const start = text.toUpperCase().indexOf(`${label}:`);
  if (start < 0) return "";
  const bodyStart = start + label.length + 1;
  const tail = text.slice(bodyStart);
  const next = nextLabels
    .map((item) => tail.toUpperCase().indexOf(`${item}:`))
    .filter((value) => value >= 0)
    .sort((a, b) => a - b)[0];
  return (next === undefined ? tail : tail.slice(0, next)).trim();
}

export function parseA360TailoredReport(text: string, fallback: A360ConversationReportCopy): A360ConversationReportCopy {
  return {
    title: section(text, "REPORT TITLE", ["EXECUTIVE SUMMARY", "CONVERSATION SUMMARY", "NEXT STEP"]) || fallback.title,
    executiveSummary: section(text, "EXECUTIVE SUMMARY", ["CONVERSATION SUMMARY", "NEXT STEP"]) || fallback.executiveSummary,
    conversationSummary: section(text, "CONVERSATION SUMMARY", ["NEXT STEP"]) || fallback.conversationSummary,
    nextStepSummary: section(text, "NEXT STEP", []) || fallback.nextStepSummary,
  };
}
