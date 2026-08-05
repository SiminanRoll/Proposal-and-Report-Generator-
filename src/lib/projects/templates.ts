import type { ProjectType } from "./types";

export interface SourceRequirement {
  kind: string;
  label: string;
  description: string;
  required: boolean;
  extensions: string[];
  multiple?: boolean;
}

export interface ProjectTemplate {
  type: ProjectType;
  eyebrow: string;
  title: string;
  shortTitle: string;
  description: string;
  outcome: string;
  accent: "teal" | "blue" | "violet";
  sources: SourceRequirement[];
  painPointLabel: string;
  painPointPlaceholder: string;
}

export const PROJECT_TEMPLATES: Record<ProjectType, ProjectTemplate> = {
  "client-report": {
    type: "client-report",
    eyebrow: "Current client",
    title: "Client Technology Review",
    shortTitle: "Client Report",
    description: "Combine security, compliance readiness, lifecycle, and technology-health sources into one polished client conversation.",
    outcome: "Interactive technology + compliance review + client takeaway",
    accent: "teal",
    painPointLabel: "Topics to cover",
    painPointPlaceholder: "Examples: server planning, aging computers, backup confidence, recent security questions",
    sources: [
      { kind: "scalepad-pdf", label: "Lifecycle and device sources", description: "Current Client Compass/Ninja device export plus optional ScalePad report or device export for lifecycle enrichment", required: true, extensions: [".pdf", ".csv", ".tsv", ".xlsx", ".xls", ".xlsm", ".xlsb"], multiple: true },
      { kind: "huntress-pdf", label: "Huntress report", description: "Security posture, detections, and protection status", required: true, extensions: [".pdf"] },
      { kind: "supporting-report", label: "Supporting reports", description: "Optional backup, network, or security documentation", required: false, extensions: [".pdf", ".docx", ".xlsx"], multiple: true },
    ],
  },
  "prospect-proposal": {
    type: "prospect-proposal",
    eyebrow: "Potential client",
    title: "Advantage 360",
    shortTitle: "A360 Proposal",
    description: "Turn onsite discovery, technical findings, and compliance readiness into a complete assessment, recommendation, and low-friction proposal.",
    outcome: "Interactive assessment + proposal + internal handoff",
    accent: "blue",
    painPointLabel: "OTA pain points",
    painPointPlaceholder: "What is frustrating the client? What has failed? What would make changing providers worthwhile?",
    sources: [
      { kind: "rft-spreadsheet", label: "RFT spreadsheet", description: "Technical environment and assessment findings", required: true, extensions: [".xlsx", ".xls", ".xlsm", ".xlsb"] },
      { kind: "tc-discovery", label: "TC onsite notes", description: "Optional conversation notes, dependencies, and operational context", required: false, extensions: [".docx", ".pdf", ".txt"] },
      { kind: "office-photos", label: "Office photos", description: "Optional visual evidence and environment context", required: false, extensions: [".jpg", ".jpeg", ".png", ".webp"], multiple: true },
    ],
  },
  "legacy-modernization": {
    type: "legacy-modernization",
    eyebrow: "Existing quote",
    title: "Modernize Existing Proposal",
    shortTitle: "Modernize Proposal",
    description: "Use the RFT as the primary technical assessment, then modernize the existing quote into the same interactive Advantage proposal experience.",
    outcome: "RFT-driven assessment + modern proposal + internal handoff",
    accent: "violet",
    painPointLabel: "Conversion notes",
    painPointPlaceholder: "Anything that must remain unchanged, special pricing, custom language, or client context",
    sources: [
      { kind: "rft-spreadsheet", label: "RFT spreadsheet", description: "Primary technical environment, security configuration, hardware, storage, and lifecycle assessment", required: true, extensions: [".xlsx", ".xls", ".xlsm", ".xlsb"] },
      { kind: "legacy-proposal", label: "Existing proposal", description: "Current scope and pricing reference to modernize", required: true, extensions: [".pdf", ".docx"] },
      { kind: "supporting-notes", label: "Supporting notes", description: "Optional email, notes, or scope clarification", required: false, extensions: [".pdf", ".docx", ".txt"], multiple: true },
    ],
  },
};

export function getProjectTemplate(type: ProjectType): ProjectTemplate {
  return PROJECT_TEMPLATES[type];
}
