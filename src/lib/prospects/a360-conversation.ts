import { a360PriorityLabel, emptyA360Prospect, preliminaryA360Estimate, priorityStory } from "@/lib/prospects/a360";
import type { A360ConversationRecord, A360ConversationReportCopy, PlanningAppointment, Project } from "@/lib/projects/types";
import type { A360ProspectDiscovery, ProspectEstimate } from "@/lib/prospects/a360";
import { createId, createProject } from "@/lib/projects/factory";
import { formatPlanningAppointment } from "@/lib/outcomes/planning-appointment";

function normalizedPriorities(items: string[]): string[] {
  return items.map(a360PriorityLabel);
}

function sentenceList(items: string[]): string {
  const clean = normalizedPriorities(items).map((item) => item.trim()).filter(Boolean);
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

export function isA360AppointmentScheduled(value: unknown): value is PlanningAppointment {
  if (!value || typeof value !== "object") return false;
  const appointment = value as Partial<PlanningAppointment>;
  if (appointment.status !== "scheduled" || typeof appointment.date !== "string" || typeof appointment.time !== "string"
    || typeof appointment.timeZone !== "string" || !appointment.timeZone.trim()
    || typeof appointment.consultantName !== "string" || !appointment.consultantName.trim()
    || typeof appointment.scheduledAt !== "string" || !Number.isFinite(Date.parse(appointment.scheduledAt))) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(appointment.time)) return false;
  const date = new Date(`${appointment.date}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== appointment.date) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: appointment.timeZone }).format(date); } catch { return false; }
  return true;
}

export function defaultA360ConversationReport(discovery: A360ProspectDiscovery, appointment: PlanningAppointment | null): A360ConversationReportCopy {
  const org = discovery.organizationName.trim() || discovery.contactName.trim() || "Your organization";
  const priorities = sentenceList(discovery.priorities.slice(0, 4));
  const primary = a360PriorityLabel(discovery.priorities[0] || "Better support");
  const story = priorityStory(primary, discovery.organizationLanguage);
  return {
    title: `Advantage 360 Conversation Recap — ${org}`,
    executiveSummary: `Thank you for taking the time to talk through what matters most to ${org} and what an Advantage 360 relationship could look like. The strongest themes in our conversation were ${priorities}. This recap brings together the conversation details captured so far, the starting picture you shared, and the preliminary pricing based on those details.${appointment ? " The onsite technology assessment is already scheduled as the next step." : " An onsite technology assessment can help confirm the starting picture; a date has not been scheduled yet."}`,
    conversationSummary: `${story.body} You also gave us a helpful starting picture of the ${discovery.organizationLanguage}: ${environmentSentence(discovery)}. That gives your Technology Consultant a head start before the onsite visit. When we’re there, we’ll see how the technology fits together, ask any follow-up questions, and keep the conversation centered on what matters most to your team.`,
    nextStepSummary: appointment
      ? `Your onsite technology assessment is already scheduled for ${formatPlanningAppointment(appointment)} with ${appointment.consultantName}. We’ll walk through the environment together, confirm the starting picture, understand the software and workflow, and use what we learn to tailor the Advantage 360 plan from there.`
      : "An onsite technology assessment has not been scheduled yet. When you are ready, we can agree on a date to walk through the environment together, confirm the starting picture, and understand your software and workflow before tailoring the Advantage 360 plan.",
  };
}

export function buildA360ConversationRecord(input: {
  handoffId: string;
  discovery: A360ProspectDiscovery;
  estimate: ProspectEstimate;
  appointment: PlanningAppointment | null;
  contactEmail: string;
  contactPhone: string;
}): A360ConversationRecord {
  const discovery: A360ProspectDiscovery = { ...input.discovery, priorities: normalizedPriorities(input.discovery.priorities) };
  return {
    kind: "a360-conversation",
    handoffId: input.handoffId,
    discovery,
    estimate: { ...input.estimate, assumptions: [...input.estimate.assumptions] },
    estimateCaptured: true,
    appointment: input.appointment ? { ...input.appointment } : null,
    contactEmail: input.contactEmail.trim(),
    contactPhone: input.contactPhone.trim(),
    capturedAt: new Date().toISOString(),
    report: defaultA360ConversationReport(discovery, input.appointment),
    presentationIndex: 0,
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
    painPoints: normalizedPriorities(record.discovery.priorities).join("\n"),
  });
  return {
    ...project,
    status: record.completedAt ? "published" : "draft",
    sources: [],
    client: { ...project.client, industry: record.discovery.industry },
    planningAppointment: record.appointment ?? undefined,
    pricing: { ...project.pricing, monthly: record.estimate.high },
    presentation: {
      ...project.presentation,
      title: record.report.title,
      executiveSummary: record.report.executiveSummary,
      publishedAt: record.completedAt ?? "",
    },
    a360Conversation: {
      ...record,
      discovery: { ...record.discovery, priorities: normalizedPriorities(record.discovery.priorities) },
    },
  };
}

/** Optional fields migrate in place; previously saved conversations keep their IDs and report copy. */
export function normalizeA360ConversationProject(project: Project): Project {
  const original = project.a360Conversation;
  if (!original || original.kind !== "a360-conversation") return project;
  const defaults = emptyA360Prospect();
  const raw = original.discovery && typeof original.discovery === "object" ? original.discovery : defaults;
  const text = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
  const count = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) && value >= fallback ? Math.trunc(value) : fallback;
  const discovery: A360ProspectDiscovery = {
    ...defaults,
    contactName: text(raw.contactName), organizationName: text(raw.organizationName, project.client?.name || ""),
    organizationLanguage: (["practice", "firm", "business", "organization"] as string[]).includes(raw.organizationLanguage) ? raw.organizationLanguage : defaults.organizationLanguage,
    industry: (["Dental", "Medical", "Legal", "Accounting", "Other"] as string[]).includes(raw.industry) ? raw.industry : "Other",
    priorities: normalizedPriorities(Array.isArray(raw.priorities) ? raw.priorities.filter((item) => typeof item === "string") : []),
    workstations: count(raw.workstations, 0), locations: count(raw.locations, 1),
    server: (["yes", "no", "not-sure"] as string[]).includes(raw.server) ? raw.server : "not-sure",
    managementSoftware: text(raw.managementSoftware), imagingSoftware: text(raw.imagingSoftware), otherSoftware: text(raw.otherSoftware),
    imagingEnvironment: (["2D", "2D + 3D", "Not sure", ""] as string[]).includes(raw.imagingEnvironment) ? raw.imagingEnvironment : "",
  };
  const appointment = isA360AppointmentScheduled(original.appointment)
    ? original.appointment
    : isA360AppointmentScheduled(project.planningAppointment) ? project.planningAppointment : null;
  const validEstimate = original.estimate && typeof original.estimate.low === "number" && Number.isFinite(original.estimate.low)
    && typeof original.estimate.high === "number" && Number.isFinite(original.estimate.high)
    && original.estimate.low >= 0 && original.estimate.high >= original.estimate.low;
  const estimateCaptured = Boolean(validEstimate && original.estimateCaptured !== false);
  const report = defaultA360ConversationReport(discovery, appointment);
  for (const key of Object.keys(report) as Array<keyof A360ConversationReportCopy>) {
    if (original.report && typeof original.report[key] === "string") report[key] = original.report[key];
  }
  const record: A360ConversationRecord = {
    ...original,
    discovery,
    appointment,
    estimate: validEstimate ? { ...original.estimate, assumptions: Array.isArray(original.estimate.assumptions) ? original.estimate.assumptions.filter((item) => typeof item === "string") : [] }
      : { low: 0, high: 0, assumptions: ["Estimate not captured in this saved record. Confirm pricing before sharing."] },
    estimateCaptured,
    ...(!validEstimate && original.estimate !== undefined ? { recoveryEstimate: original.estimate } : {}),
    contactEmail: typeof original.contactEmail === "string" ? original.contactEmail : "",
    contactPhone: typeof original.contactPhone === "string" ? original.contactPhone : "",
    presentationIndex: Math.max(0, Math.min(7, Math.trunc(Number(original.presentationIndex) || 0))),
    report,
  };
  return { ...project, a360Conversation: record, planningAppointment: appointment ?? undefined, pricing: { ...project.pricing, monthly: estimateCaptured ? record.estimate.high : 0 } };
}

export type A360ConversationUpdate = Partial<Pick<A360ConversationRecord, "discovery" | "appointment" | "contactEmail" | "contactPhone" | "presentationIndex" | "completedAt">>;

/** Refresh generated fields while preserving each field of manually tailored report copy. */
export function updateA360ConversationProject(project: Project, update: A360ConversationUpdate): Project {
  const current = normalizeA360ConversationProject(project);
  const previous = current.a360Conversation;
  if (!previous) throw new Error("This workspace does not contain an A360 conversation.");
  if (update.appointment && !isA360AppointmentScheduled(update.appointment)) throw new Error("The appointment details are incomplete. Choose a valid date, time, time zone, and consultant.");
  const discovery = update.discovery ? { ...update.discovery, priorities: normalizedPriorities(update.discovery.priorities) } : previous.discovery;
  const appointment = update.appointment === undefined ? previous.appointment : update.appointment;
  const before = defaultA360ConversationReport(previous.discovery, previous.appointment);
  const after = defaultA360ConversationReport(discovery, appointment);
  const priceChanged = Boolean(update.discovery && (discovery.workstations !== previous.discovery.workstations || discovery.locations !== previous.discovery.locations || discovery.server !== previous.discovery.server));
  const report = { ...previous.report };
  for (const key of Object.keys(after) as Array<keyof A360ConversationReportCopy>) {
    if (!report[key] || report[key] === before[key]) report[key] = after[key];
  }
  const record: A360ConversationRecord = {
    ...previous, ...update, discovery, appointment, report,
    estimate: priceChanged ? preliminaryA360Estimate(discovery) : previous.estimate,
    estimateCaptured: priceChanged ? true : previous.estimateCaptured,
    presentationIndex: Math.max(0, Math.min(7, Math.trunc(Number(update.presentationIndex ?? previous.presentationIndex) || 0))),
  };
  const contacts = [...current.client.contacts];
  const contactIndex = contacts.findIndex((contact) => contact.primary);
  const contact = {
    ...(contactIndex >= 0 ? contacts[contactIndex] : { id: createId("contact"), role: "", primary: true }),
    name: discovery.contactName.trim(), email: record.contactEmail.trim(), phone: record.contactPhone.trim(),
  };
  if (contactIndex >= 0) contacts[contactIndex] = contact; else contacts.push(contact);
  const org = discovery.organizationName.trim() || discovery.contactName.trim() || "Potential client";
  return {
    ...current,
    name: `${org} — A360 Conversation`,
    status: record.completedAt ? "published" : current.status,
    client: { ...current.client, name: org, industry: discovery.industry, organizationTerm: discovery.organizationLanguage, contacts },
    painPoints: [...discovery.priorities],
    planningAppointment: appointment ?? undefined,
    pricing: { ...current.pricing, monthly: record.estimate.high },
    presentation: { ...current.presentation, title: report.title, executiveSummary: report.executiveSummary, publishedAt: record.completedAt ?? current.presentation.publishedAt },
    a360Conversation: record,
  };
}

export function buildA360TailoredReportPrompt(record: A360ConversationRecord): string {
  const d = record.discovery;
  const priorities = normalizedPriorities(d.priorities);
  return `You are helping polish a client-facing Advantage Technologies A360 conversation recap for a prospective organization before its first onsite technology assessment.

This document captures the introductory A360/pricing conversation before an onsite visit. ${record.appointment ? "The onsite assessment is already scheduled and is the confirmed next step." : "No onsite assessment is scheduled yet. Do not imply that a date, consultant, or next step has been confirmed."}

Write directly to the prospective customer in a confident, warm, practical tone. Use “you” and “your team” naturally. Summarize what was discussed, what matters to them, what Advantage 360 is designed to provide, the preliminary monthly pricing discussed, and what the scheduled onsite visit will accomplish.

Strict framing rules:
- Treat environment and software details as the starting picture the customer shared, not as evidence or findings.
- Keep the language conversational and customer-friendly. Prefer phrases like “what you shared,” “what we discussed,” “starting picture,” and “we’ll confirm the details together onsite.”
- Do not use audit, evidence, or internal-reporting language such as “reported,” “technically verified,” “validation,” “findings,” “prescribed,” “scope,” “risk posture,” or “evidence.”
- Do not imply Advantage has already analyzed, inspected, tested, or confirmed the network, equipment, backups, security, performance, or one-time project needs.
- Do not present replacement work, migrations, backup changes, or other projects as recommended or approved work before the onsite visit.
- Do not use the word “maintenance”; use monitoring, protection, planning, ownership, or support language instead.
- ${record.appointment ? "Do not ask whether they are ready to move forward. They already moved forward to the scheduled onsite assessment." : "Describe scheduling an onsite assessment as a possible next step, without claiming that it is booked."}
- Do not include authorization, approval, signature, decision, or “approve the plan” language.
- Do not mention Captain's Log, Client Compass, CRM fields, handoffs, internal sales activity, or internal workflow.

Organization: ${d.organizationName || d.contactName}
Contact: ${d.contactName || "Not provided"}
Industry: ${d.industry}
Organization language: ${d.organizationLanguage}
Priorities, in order: ${priorities.join(" | ") || "Not explicitly ranked"}
Workstations discussed: ${d.workstations || "Not provided"}
Server discussed: ${d.server}
Locations discussed: ${d.locations}
Management software discussed: ${d.managementSoftware || "Not provided"}
Imaging software discussed: ${d.imagingSoftware || "Not provided"}
Imaging environment discussed: ${d.imagingEnvironment || "Not provided"}
Other software discussed: ${d.otherSoftware || "Not provided"}
Preliminary Advantage 360 monthly estimate discussed: ${record.estimateCaptured === false ? "Not captured. Do not invent a price." : `$${record.estimate.low.toLocaleString()}-${record.estimate.high.toLocaleString()} per month`}
Scheduled onsite assessment: ${record.appointment ? `${formatPlanningAppointment(record.appointment)} with ${record.appointment.consultantName}` : "Not scheduled"}

Return exactly these four labeled sections, with no markdown bullets or extra commentary:
REPORT TITLE: a concise Advantage 360 conversation recap title; never call it a technology review, findings report, authorization, or network analysis
EXECUTIVE SUMMARY: 90-140 words summarizing the conversation details captured so far, priorities, preliminary pricing, and the actual scheduling status
CONVERSATION SUMMARY: 120-190 words connecting the priorities, starting picture, software discussed, and what Advantage 360 could mean for the customer in a warm conversational voice
NEXT STEP: 60-100 words accurately stating ${record.appointment ? "that the onsite assessment is already scheduled" : "that an onsite assessment is not yet scheduled"}, what the team can walk through together, and how what we learn will help tailor the plan afterward`;
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
