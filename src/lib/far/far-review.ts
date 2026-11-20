import type { Project, FarReviewItem, SourceFileRecord } from "@/lib/projects/types";
import type { FarCategory, FarCandidate } from "@/lib/intelligence/browser/far-evidence";

export const FAR_CATEGORY_LABEL: Record<FarCategory, string> = {
  "service-value": "How we've helped",
  "open-decision": "To confirm",
  "potential-adjustment": "Worth reviewing",
};
export const FAR_CATEGORY_LIMIT: Record<FarCategory, number> = {
  "service-value": 3,
  "open-decision": 3,
  "potential-adjustment": 2,
};

export function farSourceFile(project: Project): SourceFileRecord | null {
  return project.sources.find((source) => source.kind === "far-brief")?.files.find((file) =>
    file.analysis?.sourceType === "far-brief" && file.status !== "failed") ?? null;
}

export function farCandidates(project: Project): Array<FarCandidate & { sourceFileId: string; recordId: string }> {
  const source = farSourceFile(project);
  if (!source) return [];
  const fact = source.analysis?.facts.find((item) => item.key === "far.candidates");
  if (!Array.isArray(fact?.value)) return [];
  return fact.value.flatMap((raw) => {
    try {
      const item = JSON.parse(String(raw)) as FarCandidate;
      if (!item.id || !["service-value", "open-decision", "potential-adjustment"].includes(item.category)) return [];
      return [{ ...item, sourceFileId: source.id, recordId: source.id + ":" + item.id }];
    } catch { return []; }
  });
}

/** No internal prices, ticket numbers, email addresses or source metadata on the client slide. */
export function safeFarClientText(value: string): boolean {
  const text = value.trim();
  if (text.length < 12 || text.length > 165) return false;
  if (/@|\b(?:ticket|agreement|company|case|contact)\s*#?\s*\d+\b|\bconfidential\b|\b(?:dr|mr|ms|mrs)\.\s+\w+|\$\s*[\d,]/i.test(text)) return false;
  return !/[\r\n]/.test(text);
}

export function farReviewEntry(project: Project, candidateId: string): FarReviewItem | undefined {
  return project.farReview?.items.find((item) => item.id === candidateId);
}

export function updateFarReviewItem(project: Project, item: FarReviewItem): Project {
  const current = Array.isArray(project.farReview?.items) ? project.farReview.items : [];
  const next = [...current.filter((row) => row.id !== item.id), item];
  return { ...project, farReview: { items: next, updatedAt: new Date().toISOString() } };
}

export function addFarManualItem(project: Project, category: FarCategory): Project {
  const file = farSourceFile(project);
  if (!file) return project;
  const id = file.id + ":manual_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  return updateFarReviewItem(project, { id, sourceFileId: file.id, category, clientText: "", evidence: "Written during account review", approved: false });
}

export function farPresentationItems(project: Project): Record<FarCategory, FarReviewItem[]> {
  const fileId = farSourceFile(project)?.id;
  const all = (fileId ? project.farReview?.items ?? [] : [])
    .filter((item) => item.sourceFileId === fileId && item.approved && safeFarClientText(item.clientText));
  const by = (category: FarCategory): FarReviewItem[] => all.filter((item) => item.category === category).slice(0, FAR_CATEGORY_LIMIT[category]);
  return { "service-value": by("service-value"), "open-decision": by("open-decision"), "potential-adjustment": by("potential-adjustment") };
}

export function hasFarPresentationItems(project: Project): boolean {
  const groups = farPresentationItems(project);
  return Object.values(groups).some((rows) => rows.length > 0);
}


/** Commit the three presenter-approved concern cards as the only FAR decisions
 * for this generated client-report package. Never expose unapproved internal text.
 * Other source files and service-value talking points are left untouched.
 */
export function applyFarGenerationReview(project: Project, selected: FarReviewItem[], skip = false): Project {
  const source = farSourceFile(project);
  if (!source) return project;
  const rows = skip ? [] : selected;
  if (rows.length > 3) throw new Error("Select at most three FAR concerns.");
  if (rows.some((row) => row.sourceFileId !== source.id || row.category === "service-value" || !safeFarClientText(row.clientText))) {
    throw new Error("Review the wording and source of every selected FAR concern.");
  }
  const ids = new Set(rows.map((row) => row.id));
  if (ids.size !== rows.length) throw new Error("The same FAR concern cannot be selected twice.");
  const existing = project.farReview?.items ?? [];
  // Clearing approval is scoped to the active FAR's decisions. It prevents
  // previously approved but unselected concerns from leaking via fallback logic.
  const retained = existing.map((item) => item.sourceFileId === source.id && item.category !== "service-value"
    ? { ...item, approved: ids.has(item.id), prioritySelected: ids.has(item.id) }
    : item);
  const reviewed = rows.map((row): FarReviewItem => ({
    id: row.id,
    sourceFileId: row.sourceFileId,
    category: row.category,
    clientText: row.clientText.trim(),
    evidence: row.evidence,
    approved: true,
    prioritySelected: true,
    priorityStatus: row.priorityStatus ?? "verify",
    priorityOwner: row.priorityOwner ?? "advantage",
    priorityNextAction: row.priorityNextAction,
    priorityTargetDate: row.priorityTargetDate,
    priorityResolutionNote: row.priorityResolutionNote,
  }));
  return { ...project, farReview: {
    items: [...retained.filter((item) => !ids.has(item.id)), ...reviewed],
    updatedAt: new Date().toISOString(),
  } };
}
