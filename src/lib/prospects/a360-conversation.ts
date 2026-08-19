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
  pieces.push(discovery.server === "yes" ? "an onsite server" : discovery.server === "no" ? "no onsite server reported" : "server status still to be confirmed");
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
    title: `Technology Conversation Recap — ${org}`,
    executiveSummary: `Our conversation focused on what matters most to ${org} before any recommendations are finalized. The strongest themes were ${priorities}. The information below reflects what was shared during our first conversation and gives the onsite assessment a clear place to start.`,
    conversationSummary: `${story.body} We also captured a preliminary picture of the environment — ${environmentSentence(discovery)}. These details are intentionally treated as a starting point rather than a completed technical assessment.`,
    nextStepSummary: `The next step is the onsite technology assessment scheduled for ${formatPlanningAppointment(appointment)} with ${appointment.consultantName}. The visit will give Advantage a chance to see the environment firsthand, validate the priorities discussed, understand the software and workflow, and build recommendations around what the ${discovery.organizationLanguage} actually needs.`,
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
  return `You are helping polish a client-facing Advantage Technologies A360 conversation recap for a potential client we have not yet assessed onsite.

Write with a confident, warm, practical tone. This is not a sales proposal and must not imply that Advantage has verified the environment, confirmed risks, completed a security review, or already supports this organization. Do not mention Captain's Log, Client Compass, CRM fields, handoffs, internal sales activity, or internal workflow. Treat all technical details as information reported during the conversation and subject to onsite validation.

Potential client: ${d.organizationName || d.contactName}
Contact: ${d.contactName || "Not provided"}
Industry: ${d.industry}
Organization language: ${d.organizationLanguage}
Priorities, in order: ${d.priorities.join(" | ") || "Not explicitly ranked"}
Reported workstations: ${d.workstations || "Not provided"}
Reported server: ${d.server}
Reported locations: ${d.locations}
Management software: ${d.managementSoftware || "Not provided"}
Imaging software: ${d.imagingSoftware || "Not provided"}
Imaging environment: ${d.imagingEnvironment || "Not provided"}
Other software: ${d.otherSoftware || "Not provided"}
Preliminary A360 planning range: $${record.estimate.low.toLocaleString()}-$${record.estimate.high.toLocaleString()} per month
Onsite assessment: ${formatPlanningAppointment(record.appointment)} with ${record.appointment.consultantName}

Return exactly these four labeled sections, with no markdown bullets or extra commentary:
REPORT TITLE: one concise title
EXECUTIVE SUMMARY: 90-140 words summarizing what mattered in the conversation and positioning the onsite visit as validation
CONVERSATION SUMMARY: 120-190 words connecting their priorities, reported environment, software, and how Advantage 360 may fit without making unverified claims
NEXT STEP: 60-100 words explaining what the onsite assessment will accomplish and why it matters`;
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
