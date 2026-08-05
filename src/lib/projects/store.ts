"use client";

import { useCallback, useEffect, useState } from "react";
import { isProjectType, type Project, type SourceDocument } from "./types";
import { deleteLocalSourceFiles } from "./file-store";
import { getProjectTemplate } from "./templates";
import { sourceRequirementState } from "./factory";
import { emptyHipaaAssessment, normalizeHipaaAssessment } from "@/lib/hipaa/engine";
import { normalizeProposalProject } from "@/lib/proposals/pricing";
import { normalizeOrganizationTerm } from "./client-language";

const STORAGE_KEY = "advantage.proposal-report-generator.projects.v2";
const LEGACY_KEY = "advantage.proposal-report-generator.projects.v1";
const CHANGE_EVENT = "advantage-projects-changed";

function migrateV1(input: Record<string, unknown>): Project | null {
  if (input.schemaVersion !== 1 || typeof input.type !== "string") return null;
  const template = getProjectTemplate(input.type as Project["type"]);
  const legacySources = Array.isArray(input.sources) ? input.sources as Array<Record<string, unknown>> : [];
  const sources: SourceDocument[] = template.sources.map((requirement) => {
    const legacy = legacySources.find((source) => source.kind === requirement.kind);
    const hasFile = Boolean(legacy?.name);
    return sourceRequirementState(requirement, hasFile ? [{
      id: `legacy_file_${String(legacy?.id ?? Date.now())}`,
      name: String(legacy?.name ?? "Previously attached file"),
      mimeType: String(legacy?.mimeType ?? ""),
      size: Number(legacy?.size ?? 0),
      addedAt: String(legacy?.addedAt ?? ""),
      status: "needs-review",
      error: "Reattach this file once to run Phase 2 source intelligence.",
    }] : []);
  });
  const legacyClient = (input.client && typeof input.client === "object" ? input.client : {}) as Record<string, unknown>;
  return {
    ...(input as unknown as Omit<Project, "schemaVersion" | "sources" | "intelligence">),
    client: { ...(legacyClient as unknown as Project["client"]), organizationTerm: normalizeOrganizationTerm(legacyClient.organizationTerm) },
    schemaVersion: 2,
    sources,
    status: "review-needed",
    intelligence: { status: "review-needed", overallConfidence: "low", facts: [], exceptions: [], sourceSummaries: [], findingCandidates: [], lastRunAt: "" },
    hipaa: emptyHipaaAssessment(),
    planningRecommendationMode: "onsite-review",
  };
}

function parseProjects(raw: string | null): Project[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const value = item as Record<string, unknown>;
      if (value.schemaVersion === 2 && "id" in value) {
        const project = value as unknown as Project;
        const normalized = normalizeProposalProject({ ...project, planningRecommendationMode: project.planningRecommendationMode === "remote-consultation" ? "remote-consultation" : "onsite-review", client: { ...project.client, organizationTerm: normalizeOrganizationTerm(project.client?.organizationTerm) }, hipaa: normalizeHipaaAssessment(project) });
        return [normalized];
      }
      const migrated = migrateV1(value);
      return migrated ? [normalizeProposalProject(migrated)] : [];
    });
  } catch {
    return [];
  }
}

function safeRead(): Project[] {
  if (typeof window === "undefined") return [];
  const current = parseProjects(window.localStorage.getItem(STORAGE_KEY));
  if (current.length) return current;
  const legacy = parseProjects(window.localStorage.getItem(LEGACY_KEY));
  if (legacy.length) write(legacy);
  return legacy;
}

function write(projects: Project[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function listProjects(): Project[] {
  return safeRead().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function getProject(id: string): Project | undefined { return safeRead().find((project) => project.id === id); }
export function saveProject(project: Project): void {
  const projects = safeRead();
  const index = projects.findIndex((item) => item.id === project.id);
  const updated = { ...project, updatedAt: new Date().toISOString() };
  if (index >= 0) projects[index] = updated; else projects.push(updated);
  write(projects);
}
export async function deleteProject(id: string): Promise<void> {
  const projects = safeRead();
  const project = projects.find((item) => item.id === id);
  write(projects.filter((item) => item.id !== id));
  if (project) {
    const sourceFileIds = project.sources.flatMap((source) => source.files.map((file) => file.id));
    const hipaaEvidenceIds = project.hipaa.answers.flatMap((answer) => answer.evidenceAttachment?.id ? [answer.evidenceAttachment.id] : []);
    const fileIds = [...new Set([...sourceFileIds, ...hipaaEvidenceIds])];
    try { await deleteLocalSourceFiles(fileIds); } catch { /* Workspace deletion should still succeed when browser storage is unavailable. */ }
  }
}

export function exportProjectsBackup(): void {
  if (typeof window === "undefined") return;
  const payload = {
    format: "advantage-proposal-report-generator-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: safeRead(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `proposal-report-workspaces-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function importProjectsBackup(file: File): Promise<number> {
  const raw = await file.text();
  const parsed: unknown = JSON.parse(raw);
  const candidateProjects = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && "projects" in parsed
      ? (parsed as { projects?: unknown }).projects
      : undefined;
  if (!Array.isArray(candidateProjects)) throw new Error("This file is not an Advantage Compass backup.");
  const imported = candidateProjects.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    if (value.schemaVersion === 2 && typeof value.id === "string" && typeof value.type === "string" && isProjectType(value.type)) {
      const project = value as unknown as Project;
      const normalized = normalizeProposalProject({ ...project, planningRecommendationMode: project.planningRecommendationMode === "remote-consultation" ? "remote-consultation" : "onsite-review", client: { ...project.client, organizationTerm: normalizeOrganizationTerm(project.client?.organizationTerm) }, hipaa: normalizeHipaaAssessment(project) });
      return [normalized];
    }
    const migrated = migrateV1(value);
    return migrated ? [normalizeProposalProject(migrated)] : [];
  });
  if (!imported.length) throw new Error("No valid workspaces were found in this backup.");

  const merged = new Map(safeRead().map((project) => [project.id, project]));
  for (const project of imported) {
    const current = merged.get(project.id);
    if (!current || project.updatedAt >= current.updatedAt) merged.set(project.id, project);
  }
  write([...merged.values()]);
  return imported.length;
}

export function useProjects(): { projects: Project[]; refresh: () => void } {
  const [projects, setProjects] = useState<Project[]>([]);
  const refresh = useCallback(() => setProjects(listProjects()), []);
  useEffect(() => {
    refresh();
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(CHANGE_EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, [refresh]);
  return { projects, refresh };
}
