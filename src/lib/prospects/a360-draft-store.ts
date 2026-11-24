"use client";

import type { Project } from "@/lib/projects/types";
import { createId } from "@/lib/projects/factory";
import { getProject, listProjects, saveProject } from "@/lib/projects/store";
import { preliminaryA360Estimate, type A360ProspectDiscovery } from "@/lib/prospects/a360";
import { buildA360ConversationRecord, createA360ConversationProject, normalizeA360ConversationProject } from "./a360-conversation";

export const A360_RESUME_PRESENTATION_EVENT = "advantage-a360-resume-presentation";

/** Persist before showing the first slide, using the same project store as Recent Reports. */
export function createA360Draft(discovery: A360ProspectDiscovery): Project {
  const record = buildA360ConversationRecord({
    handoffId: createId("a360"), discovery, estimate: preliminaryA360Estimate(discovery),
    appointment: null, contactEmail: "", contactPhone: "",
  });
  return saveA360Draft(createA360ConversationProject(record));
}

/** Synchronous writes make the latest edit durable before Close, refresh, or scheduler dismissal. */
export function saveA360Draft(project: Project): Project {
  const record = project.a360Conversation;
  if (!record) throw new Error("This workspace does not contain an A360 conversation.");
  const existing = getProject(project.id) ?? listProjects().find((item) => item.a360Conversation?.handoffId === record.handoffId);
  const next = normalizeA360ConversationProject({
    ...project,
    id: existing?.id ?? project.id,
    createdAt: existing?.createdAt ?? project.createdAt,
    updatedAt: new Date().toISOString(),
  });
  saveProject(next);
  return next;
}

export function loadA360Draft(projectId: string): Project {
  const project = getProject(projectId);
  if (!project?.a360Conversation) throw new Error("This A360 conversation could not be found in this browser. Open its saved workspace or restore a backup.");
  return normalizeA360ConversationProject(project);
}

export function resumeA360Presentation(projectId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(A360_RESUME_PRESENTATION_EVENT, { detail: { projectId } }));
}
