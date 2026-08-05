import { getProjectTemplate } from "./templates";
import type { Project, ProjectType, SourceDocument, SourceFileRecord } from "./types";
import { buildProjectIntelligence, environmentFromIntelligence } from "@/lib/intelligence/client";
import { emptyHipaaAssessment, enableHipaaAssessment } from "@/lib/hipaa/engine";
import { normalizeProposalProject } from "@/lib/proposals/pricing";
import { normalizeOrganizationTerm } from "./client-language";
import { emptyReviewOutcome, normalizeReviewOutcome } from "@/lib/review-outcomes/model";
import type { ReviewOutcome } from "@/lib/review-outcomes/types";

export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function sourceRequirementState(
  requirement: { kind: string; label: string; required: boolean; extensions: string[]; multiple?: boolean },
  files: SourceFileRecord[] = [],
): SourceDocument {
  const status = files.length === 0
    ? "needed"
    : files.some((file) => file.status === "failed")
      ? "failed"
      : files.some((file) => file.status === "needs-review")
        ? "needs-review"
        : files.every((file) => file.status === "processed")
          ? "processed"
          : "attached";
  return {
    id: createId("source"),
    kind: requirement.kind,
    label: requirement.label,
    required: requirement.required,
    acceptedExtensions: requirement.extensions,
    multiple: Boolean(requirement.multiple),
    files,
    status,
  };
}

export function withSourceFiles(source: SourceDocument, files: SourceFileRecord[]): SourceDocument {
  const next = sourceRequirementState({ kind: source.kind, label: source.label, required: source.required, extensions: source.acceptedExtensions, multiple: source.multiple }, files);
  return { ...next, id: source.id };
}

export function createProject(input: {
  type: ProjectType;
  clientName: string;
  organizationTerm?: string;
  projectName?: string;
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  contactPhone?: string;
  painPoints?: string;
  sourceRecords?: Record<string, SourceFileRecord[]>;
  reviewOutcome?: ReviewOutcome;
}): Project {
  const template = getProjectTemplate(input.type);
  const now = new Date().toISOString();
  const id = createId("project");
  const sources = template.sources.map((requirement) => sourceRequirementState(requirement, input.sourceRecords?.[requirement.kind] ?? []));
  const painPoints = input.painPoints ? input.painPoints.split("\n").map((item) => item.trim()).filter(Boolean) : [];
  const intelligence = buildProjectIntelligence({ type: input.type, sources, painPoints });
  const missingRequired = sources.some((source) => source.required && source.files.length === 0);
  const status: Project["status"] = missingRequired ? "sources-needed" : intelligence.status === "review-needed" ? "review-needed" : intelligence.status === "ready" ? "intelligence-ready" : "ready-for-intelligence";

  const project: Project = {
    schemaVersion: 2,
    id,
    type: input.type,
    name: input.projectName?.trim() || `${input.clientName.trim()} — ${template.shortTitle}`,
    status,
    createdAt: now,
    updatedAt: now,
    client: {
      name: input.clientName.trim(),
      industry: "",
      organizationTerm: normalizeOrganizationTerm(input.organizationTerm),
      locations: [],
      contacts: [input.contactName, input.contactRole, input.contactEmail, input.contactPhone].some((value) => Boolean(value?.trim())) ? [{ id: createId("contact"), name: input.contactName?.trim() || "Primary contact", role: input.contactRole?.trim() ?? "", email: input.contactEmail?.trim() ?? "", phone: input.contactPhone?.trim() ?? "", primary: true }] : [],
    },
    sources,
    painPoints,
    environment: environmentFromIntelligence(intelligence),
    intelligence,
    findings: [],
    recommendations: [],
    catalogItems: [],
    pricing: { monthly: 0, oneTime: 0, currency: "USD" },
    presentation: { title: template.title, executiveSummary: "", publishedAt: "", publicSlug: "" },
    planningRecommendationMode: "onsite-review",
    reviewOutcome: input.reviewOutcome ? normalizeReviewOutcome(input.reviewOutcome) : emptyReviewOutcome(),
    signature: { status: input.type === "client-report" ? "not-required" : "draft", signerName: "", signerTitle: "", acceptedTerms: false, signedAt: "" },
    hipaa: emptyHipaaAssessment(),
    handoff: { status: "not-ready", notes: "" },
  };
  const withCompliance = enableHipaaAssessment(project);
  return normalizeProposalProject(withCompliance);
}
