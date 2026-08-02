"use client";

import { useCallback, useEffect, useState } from "react";
import type { Project, SourceDocument } from "./types";
import { getProjectTemplate } from "./templates";
import { sourceRequirementState } from "./factory";

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
  return {
    ...(input as unknown as Omit<Project, "schemaVersion" | "sources" | "intelligence">),
    schemaVersion: 2,
    sources,
    status: "review-needed",
    intelligence: { status: "review-needed", overallConfidence: "low", facts: [], exceptions: [], sourceSummaries: [], findingCandidates: [], lastRunAt: "" },
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
      if (value.schemaVersion === 2 && "id" in value) return [value as unknown as Project];
      const migrated = migrateV1(value);
      return migrated ? [migrated] : [];
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
export function deleteProject(id: string): void { write(safeRead().filter((project) => project.id !== id)); }
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
