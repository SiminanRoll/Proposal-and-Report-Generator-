import type { Project, ProjectClient } from "./types";

export const DEFAULT_ORGANIZATION_TERM = "practice";

export const ORGANIZATION_TERM_SUGGESTIONS = [
  "practice",
  "firm",
  "hospital",
  "business",
  "organization",
] as const;

export function normalizeOrganizationTerm(value: unknown): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9& -]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 40);
  return normalized || DEFAULT_ORGANIZATION_TERM;
}

export function organizationTerm(source: Pick<Project, "client"> | Pick<ProjectClient, "organizationTerm">): string {
  const value = "client" in source ? source.client.organizationTerm : source.organizationTerm;
  return normalizeOrganizationTerm(value);
}

export function organizationTermTitle(source: Pick<Project, "client"> | Pick<ProjectClient, "organizationTerm">): string {
  const term = organizationTerm(source);
  return term.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function organizationPossessive(source: Pick<Project, "client"> | Pick<ProjectClient, "organizationTerm">): string {
  return `${organizationTerm(source)}’s`;
}

export function organizationReference(source: Pick<Project, "client"> | Pick<ProjectClient, "organizationTerm">): string {
  return `the ${organizationTerm(source)}`;
}

export function organizationAudienceExamples(project: Pick<Project, "client">): string {
  const term = organizationTerm(project);
  if (term === "practice") return "the doctor, practice manager, office manager, or HIPAA coordinator";
  if (term === "firm") return "a managing partner, firm administrator, office manager, or security coordinator";
  if (term === "hospital") return "the owner, hospital administrator, office manager, or security coordinator";
  if (term === "business") return "the owner, operations manager, office manager, or security coordinator";
  return `a leader, manager, office administrator, or security coordinator from the ${term}`;
}

export function supportHeading(project: Pick<Project, "client">): string {
  const term = organizationTerm(project);
  if (term === "practice") return "Support that understands dental";
  if (term === "firm") return "Support built for professional services";
  if (term === "hospital") return "Support built for clinical operations";
  if (term === "business") return "Support built around your business";
  return `Support built around your ${term}`;
}

export function applicationSupportCopy(project: Pick<Project, "client">): string {
  const term = organizationTerm(project);
  if (term === "practice") return "We work with the practice-management, imaging, and clinical systems your team relies on every day.";
  if (term === "firm") return "We support the case-management, document, communications, and business systems your team relies on every day.";
  if (term === "hospital") return "We support the management, imaging, laboratory, and clinical systems your team relies on every day.";
  return "We support the applications, workflows, and connected systems your team relies on every day.";
}

export function applicationPlanningCopy(project: Pick<Project, "client">): string {
  const term = organizationTerm(project);
  if (term === "practice") return "practice-management and imaging applications";
  if (term === "firm") return "case-management, document, and business applications";
  if (term === "hospital") return "management, imaging, laboratory, and clinical applications";
  return "business applications and workflows";
}

export function workflowCopy(project: Pick<Project, "client">): string {
  const term = organizationTerm(project);
  return term === "practice" || term === "hospital" ? "clinical workflow" : "day-to-day workflow";
}

export function adaptOrganizationLanguage(value: string, project: Pick<Project, "client">): string {
  const term = organizationTerm(project);
  const possessive = organizationPossessive(project);
  if (term === DEFAULT_ORGANIZATION_TERM) return value;
  return value
    .replace(/the practice’s/gi, `the ${possessive}`)
    .replace(/the practice's/gi, `the ${possessive}`)
    .replace(/your practice’s/gi, `your ${possessive}`)
    .replace(/your practice's/gi, `your ${possessive}`)
    .replace(/the practice/gi, `the ${term}`)
    .replace(/your practice/gi, `your ${term}`)
    .replace(/\bpractice’s\b/gi, possessive)
    .replace(/\bpractice's\b/gi, possessive)
    .replace(/\bpractice\b/gi, term);
}
