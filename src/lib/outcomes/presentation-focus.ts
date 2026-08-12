import type { Project } from "@/lib/projects/types";
import type { PresentationConcernId, PresentationConcernSelection } from "@/lib/review-outcomes/types";
import { scoreHipaaAssessment } from "@/lib/hipaa/engine";
import { factNumber, isServerClassDevice, osSupportStatus, reportableLifecycleDevices, storageStatus } from "./client-report-data";

export type PresentationFocusRole = "primary" | "secondary" | "supporting";

export interface PresentationConcernDefinition {
  id: PresentationConcernId;
  label: string;
  shortLabel: string;
  description: string;
}

export interface PresentationFocusNarrative {
  id: PresentationConcernId;
  label: string;
  role: PresentationFocusRole;
  headline: string;
  introduction: string;
  education: Array<{ title: string; detail: string }>;
  evidenceTitle: string;
  evidenceDetail: string;
  planningTitle: string;
  planningDetail: string;
  recapTitle: string;
  recapDetail: string;
}

export interface PresentationFocusStory {
  selections: PresentationConcernSelection[];
  narratives: PresentationFocusNarrative[];
  clientConcern: string;
  primary: PresentationFocusNarrative | null;
  secondary: PresentationFocusNarrative | null;
  supporting: PresentationFocusNarrative | null;
  planningHeadline: string;
  planningIntroduction: string;
  recapHeadline: string;
  recapIntroduction: string;
}

export const PRESENTATION_CONCERN_CATALOG: PresentationConcernDefinition[] = [
  { id: "server-lifecycle", label: "Server lifecycle & continuity", shortLabel: "Server continuity", description: "Aging server hardware, downtime exposure, dependencies, and proactive transition planning." },
  { id: "workstation-lifecycle", label: "Workstation performance & lifecycle", shortLabel: "Workstation performance", description: "Daily performance, reliability, staff experience, and a practical replacement cycle." },
  { id: "os-support", label: "Operating system support", shortLabel: "OS support", description: "Vendor support, security updates, compatibility, and the path away from unsupported systems." },
  { id: "backup-recovery", label: "Backup & disaster recovery", shortLabel: "Backup & recovery", description: "Recovery readiness, business continuity, testing, and recovery expectations." },
  { id: "storage-capacity", label: "Storage capacity", shortLabel: "Storage", description: "Capacity pressure, performance impact, growth, and avoiding emergency cleanup or expansion." },
  { id: "network-reliability", label: "Network reliability", shortLabel: "Network reliability", description: "Connectivity, shared services, cloud access, Wi-Fi, and disruption to normal workflows." },
  { id: "cybersecurity", label: "Cybersecurity", shortLabel: "Cybersecurity", description: "Protection activity, incident prevention, layered controls, and the value of active monitoring." },
  { id: "hipaa-readiness", label: "HIPAA readiness", shortLabel: "HIPAA readiness", description: "Open readiness questions, documentation, client-confirmed controls, and follow-up work." },
  { id: "practice-growth", label: "Practice growth & expansion", shortLabel: "Growth planning", description: "Technology capacity, standardization, new rooms or locations, and planning ahead for growth." },
  { id: "other", label: "Other client concern", shortLabel: "Client concern", description: "A custom concern that should shape the client conversation without changing technical facts." },
];

export function presentationConcernDefinition(id: PresentationConcernId): PresentationConcernDefinition {
  return PRESENTATION_CONCERN_CATALOG.find((item) => item.id === id) ?? PRESENTATION_CONCERN_CATALOG.at(-1)!;
}

function attentionCounts(project: Project) {
  const devices = reportableLifecycleDevices(project);
  const attention = devices.filter((device) => device.lifecycleStatus === "overdue" || device.lifecycleStatus === "due-soon");
  return {
    servers: attention.filter(isServerClassDevice).length,
    workstations: attention.filter((device) => device.type === "workstation").length,
    os: devices.filter((device) => ["unsupported", "ending-soon"].includes(osSupportStatus(device))).length,
    storage: devices.filter((device) => ["watch", "critical"].includes(storageStatus(device))).length,
  };
}

function roleFor(index: number): PresentationFocusRole {
  return index === 0 ? "primary" : index === 1 ? "secondary" : "supporting";
}

function base(
  selection: PresentationConcernSelection,
  role: PresentationFocusRole,
  values: Omit<PresentationFocusNarrative, "id" | "label" | "role">,
): PresentationFocusNarrative {
  const label = selection.id === "other" ? selection.customLabel?.trim() || "Client concern" : presentationConcernDefinition(selection.id).label;
  return { id: selection.id, label, role, ...values };
}

function narrativeFor(project: Project, selection: PresentationConcernSelection, role: PresentationFocusRole): PresentationFocusNarrative {
  const counts = attentionCounts(project);
  const hipaa = scoreHipaaAssessment(project.hipaa);
  const incidents = factNumber(project, "huntress.incidentsReported");

  switch (selection.id) {
    case "server-lifecycle":
      return base(selection, role, {
        headline: "Keep the server decision proactive.",
        introduction: "Server planning is less about replacing hardware on a date and more about preventing an unexpected failure from choosing the timing for the practice.",
        education: [
          { title: "Downtime exposure", detail: "When important applications or shared data depend on a server, an unexpected hardware problem can interrupt normal work until the environment is restored or replaced." },
          { title: "Control the timing", detail: "Planning before a failure gives the practice time to confirm dependencies, choose the right path, budget appropriately, and schedule around operations." },
          { title: "Avoid emergency choices", detail: "A planned transition preserves options. An emergency response can force faster equipment, scheduling, and migration decisions." },
        ],
        evidenceTitle: counts.servers ? `${counts.servers} server${counts.servers === 1 ? " is" : "s are"} in the lifecycle planning group` : "Server continuity is a selected planning priority",
        evidenceDetail: counts.servers ? "The lifecycle findings identify server hardware that deserves a deliberate next-step decision." : "Confirm the specific server dependency before presenting it as a technical finding.",
        planningTitle: "Build the server transition plan",
        planningDetail: "Confirm software and device dependencies, determine whether the right path is replacement, migration, or retirement, validate recovery requirements, and agree on timing.",
        recapTitle: "Make the server decision while there is still flexibility",
        recapDetail: "The objective is a controlled transition plan rather than waiting for reliability to force the decision.",
      });
    case "workstation-lifecycle":
      return base(selection, role, {
        headline: "Improve the technology experience the team uses every day.",
        introduction: "Aging workstations affect the speed, reliability, and consistency of the everyday user experience rather than creating the same kind of shared-system risk as a server.",
        education: [
          { title: "Performance", detail: "Older systems can take longer to start, open applications, multitask, process imaging, or complete routine workflows as software demands increase." },
          { title: "Reliability", detail: "Freezes, storage pressure, component failures, and inconsistent behavior become more disruptive when a large part of the fleet reaches the same lifecycle stage." },
          { title: "What newer equipment changes", detail: "Modern processors, solid-state storage, current memory standards, supported operating systems, and fresh warranty coverage provide a stronger foundation for current applications." },
        ],
        evidenceTitle: counts.workstations ? `${counts.workstations} workstation${counts.workstations === 1 ? " needs" : "s need"} lifecycle attention` : "Workstation performance is a selected planning priority",
        evidenceDetail: counts.workstations ? "The goal is to identify which systems should be handled first instead of treating every workstation as one immediate project." : "Use observed symptoms or validated device findings to decide which systems should enter the plan.",
        planningTitle: "Create a practical workstation refresh cycle",
        planningDetail: "Prioritize the highest-risk systems, confirm application and peripheral requirements, group replacements logically, and schedule the work around the practice.",
        recapTitle: "Turn workstation aging into a manageable replacement cycle",
        recapDetail: "Address the systems that matter most first, then phase the remaining fleet on an agreed timeline.",
      });
    case "os-support":
      return base(selection, role, {
        headline: "Keep the environment on supported operating systems.",
        introduction: "Operating-system lifecycle is a support and compatibility issue, not simply a version-number issue.",
        education: [
          { title: "Vendor support", detail: "Once an operating system reaches end of support, routine security and reliability updates may no longer be available from the vendor." },
          { title: "Compatibility", detail: "Practice applications, imaging software, browsers, security tools, and peripherals increasingly target current supported operating systems." },
          { title: "Plan hardware and software together", detail: "Some systems can be upgraded in place; others need newer hardware. Reviewing both prevents an OS project from becoming a series of surprises." },
        ],
        evidenceTitle: counts.os ? `${counts.os} system${counts.os === 1 ? " has" : "s have"} an OS support concern` : "OS support is a selected planning priority",
        evidenceDetail: counts.os ? "The inventory identifies systems that are unsupported or already inside a support-planning window." : "Confirm the affected systems before presenting an OS issue as a current technical finding.",
        planningTitle: "Map the supported-OS path",
        planningDetail: "Separate systems that can be upgraded from systems that require replacement, then coordinate application and peripheral compatibility before deployment.",
        recapTitle: "Move unsupported systems forward deliberately",
        recapDetail: "Treat operating-system support as part of the hardware and application plan rather than as an isolated update task.",
      });
    case "backup-recovery":
      return base(selection, role, {
        headline: "Recovery matters as much as backup completion.",
        introduction: "A backup strategy is most useful when the practice understands what can be restored, how recovery will work, and what systems matter first.",
        education: [
          { title: "Backup is the copy", detail: "Successful backup jobs protect data, but they are only one part of continuity planning." },
          { title: "Recovery is the outcome", detail: "Recovery planning defines which systems return first, what dependencies are involved, and what the practice should expect during an interruption." },
          { title: "Test before it is urgent", detail: "Documented and tested recovery expectations reduce uncertainty when an actual outage or hardware failure occurs." },
        ],
        evidenceTitle: "Backup and recovery are part of the continuity conversation",
        evidenceDetail: "Use validated backup findings and recovery documentation; do not infer recovery times that are not supported by source data.",
        planningTitle: "Confirm the recovery plan",
        planningDetail: "Review protected systems, retention, recovery dependencies, testing history, and the order in which critical services should be restored.",
        recapTitle: "Know what recovery looks like before it is needed",
        recapDetail: "Turn backup status into clear recovery expectations for the practice.",
      });
    case "storage-capacity":
      return base(selection, role, {
        headline: "Create capacity before storage becomes disruptive.",
        introduction: "Storage pressure can affect updates, application behavior, imaging workflows, and the ability to grow normally.",
        education: [
          { title: "Performance headroom", detail: "Systems need free space for temporary files, updates, application databases, and normal operating-system activity." },
          { title: "Growth", detail: "Imaging, documents, software updates, and local data can continue consuming capacity even when the office workflow has not changed." },
          { title: "Plan rather than purge", detail: "A capacity plan is more durable than repeated emergency cleanup and makes it easier to decide when expansion, migration, or replacement is appropriate." },
        ],
        evidenceTitle: counts.storage ? `${counts.storage} system${counts.storage === 1 ? " has" : "s have"} storage pressure` : "Storage capacity is a selected planning priority",
        evidenceDetail: counts.storage ? "The inventory shows systems that crossed the report's storage-attention thresholds." : "Confirm a validated storage finding before presenting capacity pressure as a current issue.",
        planningTitle: "Choose the right capacity fix",
        planningDetail: "Identify what is consuming space, confirm expected growth, and decide whether cleanup, expansion, migration, or replacement is the appropriate path.",
        recapTitle: "Restore storage headroom before it becomes urgent",
        recapDetail: "Create enough capacity for normal operations and expected growth instead of relying on repeated short-term cleanup.",
      });
    case "network-reliability":
      return base(selection, role, {
        headline: "Reliable connectivity keeps modern practice workflows moving.",
        introduction: "The network connects workstations, servers, imaging devices, phones, cloud services, and internet-based applications, so intermittent problems can show up in many different workflows.",
        education: [
          { title: "Shared dependency", detail: "A network issue can look like an application, internet, imaging, phone, or workstation problem depending on where the interruption is felt." },
          { title: "Intermittent issues need evidence", detail: "Good troubleshooting separates cabling, switching, firewall, wireless, internet-provider, and endpoint causes instead of replacing equipment by assumption." },
          { title: "Build for the actual environment", detail: "A reliable design accounts for device count, physical layout, cloud use, voice traffic, wireless coverage, and future growth." },
        ],
        evidenceTitle: "Network reliability is a selected operational concern",
        evidenceDetail: "Anchor the discussion to measured findings, support history, or client-reported symptoms and avoid attributing the cause until it is verified.",
        planningTitle: "Isolate the cause, then build the fix",
        planningDetail: "Validate the affected workflows, review the network path, confirm equipment and cabling condition, and scope only changes supported by the diagnosis.",
        recapTitle: "Treat connectivity symptoms as a diagnosable system",
        recapDetail: "Identify the actual failure point before deciding what should change.",
      });
    case "cybersecurity":
      return base(selection, role, {
        headline: incidents ? "Use the security findings to guide the next protection step." : "Keep strong protection active and visible.",
        introduction: incidents ? "The report includes reported security activity that deserves a clear follow-up path." : "Security is strongest when protection is continuously monitored and the practice can see that activity being reviewed before it becomes an incident.",
        education: [
          { title: "Layered protection", detail: "Endpoint monitoring, antivirus, early-warning controls, and response processes address different parts of the attack path." },
          { title: "Signals are not incidents", detail: "Security tools process large volumes of activity; the important distinction is what required investigation and what became a reportable incident." },
          { title: "Operational readiness", detail: "Security planning also includes user behavior, access controls, recovery, and a clear response process when something unusual occurs." },
        ],
        evidenceTitle: incidents ? `${incidents} security incident${incidents === 1 ? " was" : "s were"} reported` : "No security incidents were reported in the review period",
        evidenceDetail: "Use the Security section for event, signal, protection, and incident evidence so this focus remains centered on what those results mean.",
        planningTitle: incidents ? "Close the loop on the security follow-up" : "Maintain the protection baseline",
        planningDetail: incidents ? "Confirm the affected system, response actions, remaining remediation, and preventive changes supported by the investigation." : "Keep monitoring active, address any specific control gaps identified in the review, and revisit protection as the environment changes.",
        recapTitle: incidents ? "Carry the incident lessons into the next plan" : "Security is a strength to maintain",
        recapDetail: incidents ? "Use verified incident findings to decide what should change rather than broadening the response beyond the evidence." : "Maintain the current protection position while other technology work moves forward.",
      });
    case "hipaa-readiness":
      return base(selection, role, {
        headline: hipaa.notYetAssessedCount ? "Finish the readiness picture before treating the score as final." : "Use the completed readiness review to guide follow-up.",
        introduction: "HIPAA readiness in Compass is a structured review of technical controls and client-confirmed practices; unanswered questions should remain visibly incomplete rather than being guessed.",
        education: [
          { title: "Technical and administrative controls", detail: "Some controls can be supported by managed technology evidence, while policies, training, vendor oversight, and business processes require client confirmation." },
          { title: "Incomplete is not the same as failed", detail: "Unanswered questions reduce the displayed readiness result because the control has not yet been confirmed, not because Compass assumes the practice is noncompliant." },
          { title: "Follow-up creates the useful record", detail: "Completing open questions creates a better roadmap for documentation, remediation, and future review." },
        ],
        evidenceTitle: hipaa.notYetAssessedCount ? `${hipaa.notYetAssessedCount} HIPAA question${hipaa.notYetAssessedCount === 1 ? " remains" : "s remain"} open` : "The HIPAA readiness questions are complete",
        evidenceDetail: hipaa.notYetAssessedCount ? "Open items should be answered or deliberately deferred with the client rather than inferred from technical data." : "Use reviewed answers and corrective actions as the source of truth.",
        planningTitle: hipaa.notYetAssessedCount ? "Complete the remaining readiness questions" : "Work the confirmed readiness follow-ups",
        planningDetail: hipaa.notYetAssessedCount ? "Review the remaining client-confirmation items, add useful notes or evidence, and then reassess which findings require action." : "Prioritize only corrective actions supported by the completed assessment and assign clear ownership and timing.",
        recapTitle: hipaa.notYetAssessedCount ? "Finish the assessment before drawing final conclusions" : "Keep the readiness record current",
        recapDetail: hipaa.notYetAssessedCount ? "The current score remains provisional until the open questions are reviewed." : "Update the readiness record as technology, staff, vendors, and policies change.",
      });
    case "practice-growth":
      return base(selection, role, {
        headline: "Make the technology plan support where the practice is going next.",
        introduction: "Growth is easier when infrastructure, devices, licensing, connectivity, and support capacity are considered before new rooms, staff, services, or locations come online.",
        education: [
          { title: "Capacity", detail: "Servers, storage, network equipment, internet service, and licensing should have enough headroom for expected users and workloads." },
          { title: "Standardization", detail: "Consistent workstation, network, security, and deployment standards make future additions easier to support." },
          { title: "Sequence the work", detail: "Knowing what is changing and when makes it possible to separate prerequisites from improvements that can wait." },
        ],
        evidenceTitle: "Growth is a selected planning context",
        evidenceDetail: "Use the client's stated expansion plans as context; Compass should not invent new locations, staffing, or service changes.",
        planningTitle: "Build technology into the growth timeline",
        planningDetail: "Confirm the expected change, identify technology prerequisites, establish lead times, and align infrastructure work with the business schedule.",
        recapTitle: "Plan technology before growth makes it urgent",
        recapDetail: "Have the required capacity and standards in place when the practice is ready to expand.",
      });
    case "other":
    default: {
      const label = selection.customLabel?.trim() || "client concern";
      return base(selection, role, {
        headline: `Keep ${label.toLowerCase()} visible in the technology plan.`,
        introduction: "This concern was selected to shape the client conversation. It can influence emphasis without changing the underlying technical evidence.",
        education: [
          { title: "Start with the client's experience", detail: "Describe the operational concern in plain language before connecting it to technical findings." },
          { title: "Separate evidence from assumption", detail: "Use verified report data and documented client observations; do not infer a technical cause that has not been confirmed." },
          { title: "Turn the concern into a next step", detail: "The useful outcome is a clear investigation, decision, or planning action with ownership and timing." },
        ],
        evidenceTitle: `${label} is part of this review's focus`,
        evidenceDetail: "Connect this concern only to findings or client-provided context that are actually available in the project.",
        planningTitle: `Define the next step for ${label.toLowerCase()}`,
        planningDetail: "Confirm what needs to be learned or decided, identify the responsible party, and agree on the next checkpoint.",
        recapTitle: `Keep ${label.toLowerCase()} in the follow-up plan`,
        recapDetail: "Carry the concern forward as a specific action or decision instead of repeating it as a general risk statement.",
      });
    }
  }
}

export function suggestedPresentationConcerns(project: Project): PresentationConcernSelection[] {
  const counts = attentionCounts(project);
  const suggested: PresentationConcernSelection[] = [];
  if (counts.servers) suggested.push({ id: "server-lifecycle" });
  if (counts.workstations) suggested.push({ id: "workstation-lifecycle" });
  if (counts.os) suggested.push({ id: "os-support" });
  if (project.hipaa.enabled && scoreHipaaAssessment(project.hipaa).notYetAssessedCount) suggested.push({ id: "hipaa-readiness" });
  if (!suggested.length && factNumber(project, "huntress.incidentsReported")) suggested.push({ id: "cybersecurity" });
  return suggested.slice(0, 3);
}

export function selectedPresentationConcerns(project: Project): PresentationConcernSelection[] {
  const explicit = project.reviewOutcome?.presentationConcerns ?? [];
  return explicit.length ? explicit.slice(0, 3) : suggestedPresentationConcerns(project);
}

export function buildPresentationFocusStory(project: Project): PresentationFocusStory {
  const selections = selectedPresentationConcerns(project);
  const narratives = selections.map((selection, index) => narrativeFor(project, selection, roleFor(index)));
  const primary = narratives[0] ?? null;
  const secondary = narratives[1] ?? null;
  const supporting = narratives[2] ?? null;
  const clientConcern = project.reviewOutcome?.clientConcern?.trim() || "";
  const planningHeadline = primary?.planningTitle || "Build the next-step technology plan";
  const planningIntroduction = secondary
    ? `${primary?.planningDetail ?? "Confirm the highest-priority next step."} Then coordinate ${secondary.label.toLowerCase()} as a supporting priority so the work becomes one practical plan.`
    : primary?.planningDetail || "Use the review findings to confirm priorities, ownership, timing, and budget.";
  const recapHeadline = primary ? "What to carry forward from this review" : "Today's takeaways";
  const recapIntroduction = clientConcern
    ? `The plan is centered on ${primary?.label.toLowerCase() || "the verified findings"}, while keeping the client's stated concern in view: ${clientConcern}`
    : primary?.recapDetail || "Keep the strongest protections in place and move the highest-priority findings into a practical next-step plan.";
  return { selections, narratives, clientConcern, primary, secondary, supporting, planningHeadline, planningIntroduction, recapHeadline, recapIntroduction };
}
