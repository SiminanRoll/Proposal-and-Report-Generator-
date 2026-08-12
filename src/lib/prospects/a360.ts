import { A360_MONTHLY_PRICING } from "@/lib/proposals/pricing";

export type OrganizationLanguage = "practice" | "firm" | "business" | "organization";
export type ProspectIndustry = "Dental" | "Medical" | "Legal" | "Accounting" | "Other";
export type ServerAnswer = "yes" | "no" | "not-sure";
export type ImagingEnvironment = "2D" | "2D + 3D" | "Not sure" | "";

export interface A360ProspectDiscovery {
  contactName: string;
  organizationName: string;
  organizationLanguage: OrganizationLanguage;
  industry: ProspectIndustry;
  priorities: string[];
  workstations: number;
  server: ServerAnswer;
  locations: number;
  managementSoftware: string;
  imagingSoftware: string;
  imagingEnvironment: ImagingEnvironment;
  otherSoftware: string;
}

export interface ProspectEstimate {
  low: number;
  high: number;
  assumptions: string[];
}

export const A360_PRIORITY_OPTIONS = [
  "Reliability & downtime",
  "Cybersecurity",
  "Faster computers",
  "Better support",
  "Predictable costs",
  "HIPAA & compliance",
  "Growth & expansion",
  "Aging technology",
  "Backup & recovery",
  "Current IT frustration",
] as const;

export function emptyA360Prospect(): A360ProspectDiscovery {
  return {
    contactName: "",
    organizationName: "",
    organizationLanguage: "practice",
    industry: "Dental",
    priorities: [],
    workstations: 0,
    server: "not-sure",
    locations: 1,
    managementSoftware: "",
    imagingSoftware: "",
    imagingEnvironment: "",
    otherSoftware: "",
  };
}

export function preliminaryA360Estimate(discovery: A360ProspectDiscovery): ProspectEstimate {
  const sites = Math.max(1, Math.round(discovery.locations || 1));
  const workstations = Math.max(0, Math.round(discovery.workstations || 0));
  const base = sites * A360_MONTHLY_PRICING.site + workstations * A360_MONTHLY_PRICING.workstation;
  const serverLow = discovery.server === "yes" ? A360_MONTHLY_PRICING.serverStandardBackup : 0;
  const serverHigh = discovery.server === "no" ? 0 : A360_MONTHLY_PRICING.serverStandardBackup;
  const assumptions = [
    `${sites} ${sites === 1 ? "location" : "locations"}`,
    `${workstations} client-reported ${workstations === 1 ? "workstation" : "workstations"}`,
    discovery.server === "yes" ? "1 client-reported server" : discovery.server === "no" ? "No server reported" : "Server presence not yet confirmed",
  ];
  return { low: base + serverLow, high: base + serverHigh, assumptions };
}

export function prospectDisplayName(discovery: A360ProspectDiscovery): string {
  return discovery.organizationName.trim() || discovery.contactName.trim();
}

export function softwareQuestionLabel(industry: ProspectIndustry): string {
  if (industry === "Dental") return "Practice management software";
  if (industry === "Medical") return "Practice management / EHR software";
  if (industry === "Legal") return "Practice or case management software";
  if (industry === "Accounting") return "Accounting, tax, or document software";
  return "Business management software";
}

export function priorityStory(priority: string, term: OrganizationLanguage): { title: string; body: string } {
  const stories: Record<string, { title: string; body: string }> = {
    "Reliability & downtime": { title: `Keep the ${term} operating.`, body: "Proactive monitoring, maintenance, backup planning, and a documented environment help reduce avoidable interruptions and give the team a clearer recovery path when something does happen." },
    Cybersecurity: { title: "Protection with people behind it.", body: "Layered security, continuous monitoring, updates, and human investigation work together so routine activity stays in the background and meaningful signals receive attention." },
    "Faster computers": { title: "Make everyday work feel easier.", body: "Lifecycle planning and right-sized equipment create a better foundation for the applications, imaging, multitasking, and daily workflows the team relies on." },
    "Better support": { title: "One team that knows the environment.", body: "Remote support, local onsite help, vendor coordination, and ongoing documentation stay connected under one technology relationship." },
    "Predictable costs": { title: "Turn technology into a plan.", body: "A managed monthly relationship and proactive lifecycle planning make routine support more predictable while larger projects can be scoped and scheduled intentionally." },
    "HIPAA & compliance": { title: "Build readiness into the routine.", body: "Security controls, documentation, follow-up, and ongoing guidance support the compliance conversation without treating a preliminary discussion as a verified assessment." },
    "Growth & expansion": { title: "Give growth a repeatable technology foundation.", body: "Standards, documentation, vendor coordination, and lifecycle planning make it easier to add people, equipment, or locations with fewer surprises." },
    "Aging technology": { title: "Plan replacements before they become urgent.", body: "Lifecycle visibility helps the team prioritize aging systems and choose timing, budget, and sequencing while options are still available." },
    "Backup & recovery": { title: "A backup matters when it can be recovered.", body: "Recovery planning connects protected data, onsite and cloud copies, and the process for restoring service. The onsite assessment confirms what protection the environment actually needs." },
    "Current IT frustration": { title: "Replace friction with ownership.", body: "One accountable partner can coordinate support, vendors, planning, and follow-through so the team spends less time managing the technology relationship." },
  };
  return stories[priority] ?? { title: "Technology built around what matters.", body: "Advantage 360 brings support, security, maintenance, backup planning, and ongoing guidance into one relationship." };
}
