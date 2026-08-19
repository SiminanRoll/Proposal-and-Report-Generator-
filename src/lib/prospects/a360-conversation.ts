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
  pieces.push(discovery.server === "yes" ? "an onsite server was reported" : discovery.server === "no" ? "no onsite server was reported" : "server status is still to be confirmed");
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
    executiveSummary: `Thank you for taking the time to talk through what matters most to ${org} and what an Advantage 360 relationship could look like. The strongest themes in our conversation were ${priorities}. This recap summarizes what we discussed, the starting information shared with us, and the onsite technology assessment that is already scheduled as the next step.`,
    conversationSummary: `${story.body} During the conversation, you also shared a starting picture that included ${environmentSentence(discovery)}. That information gives our Technology Consultant useful context for the scheduled onsite visit, but it has not yet been technically assessed or verified.`,
    nextStepSummary: `Your onsite technology assessment is already scheduled for ${formatPlanningAppointment(appointment)} with ${appointment.consultantName}. That visit is the next step forward: Advantage will see the environment firsthand, confirm the starting information discussed, understand the software and workflow, and then use verified onsite information to shape the right scope and recommendations afterward.`,
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

This document sits after the introductory A360/pricing conversation and before any technical assessment. The onsite assessment is already scheduled and is the confirmed next step.

Write with a confident, warm, practical tone. Summarize what was discussed, what matters to the organization, what Advantage 360 is designed to provide, the preliminary monthly pricing discussed, and what the scheduled onsite visit will accomplish.

Strict framing rules:
- Treat every environment and software detail as information shared during the conversation, not as a technical finding.
- Do not imply Advantage analyzed, inspected, assessed, tested, validated, or confirmed the network, equipment condition, backups, security posture, risks, performance, or project scope.
- Do not use formal assessment language such as “the review,” “what we found,” “findings,” “identified issues,” “needs attention now,” “in good shape,” or health/risk scoring.
- Do not present replacement work, migrations, backup changes, or other projects as recommended or approved work before the onsite assessment.
- Do not ask whether they are ready to move forward. They already moved forward to the scheduled onsite assessment.
- Do not include authorization, approval, signature, decision, or “approve the plan” language.
- Do not mention Captain's Log, Client Compass, CRM fields, handoffs, internal sales activity, or internal workflow.

Organization: ${d.organizationName || d.contactName}
Contact: ${d.contactName || "Not provided"}
Industry: ${d.industry}
Organization language: ${d.organizationLanguage}
Priorities, in order: ${d.priorities.join(" | ") || "Not explicitly ranked"}
Reported workstations: ${d.workstations || "Not provided"}
Reported server: ${d.server}
Reported locations: ${d.locations}
Management software discussed: ${d.managementSoftware || "Not provided"}
Imaging software discussed: ${d.imagingSoftware || "Not provided"}
Imaging environment: ${d.imagingEnvironment || "Not provided"}
Other software discussed: ${d.otherSoftware || "Not provided"}
Preliminary Advantage 360 monthly estimate discussed: $${record.estimate.low.toLocaleString()}-${record.estimate.high.toLocaleString()} per month
Scheduled onsite assessment: ${formatPlanningAppointment(record.appointment)} with ${record.appointment.consultantName}

Return exactly these four labeled sections, with no markdown bullets or extra commentary:
REPORT TITLE: a concise Advantage 360 conversation recap title; never call it a technology review, assessment, findings report, or authorization
EXECUTIVE SUMMARY: 90-140 words summarizing the conversation, priorities, and the already-scheduled onsite next step
CONVERSATION SUMMARY: 120-190 words connecting the priorities, reported starting information, software discussed, and what Advantage 360 could mean for the organization without making technical claims
NEXT STEP: 60-100 words stating that the onsite assessment is already scheduled, what it will help confirm, and that any final scope or recommendations come afterward`;
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
