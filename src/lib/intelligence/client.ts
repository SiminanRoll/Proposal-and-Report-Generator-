"use client";

import type {
  FileAnalysis,
  Project,
  ProjectIntelligence,
  SourceDocument,
  SourceFileRecord,
  ExtractedFact,
  IntelligenceException,
  Confidence,
} from "@/lib/projects/types";

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function analyzeBrowserFile(input: {
  file: File;
  expectedKind: string;
  fileId: string;
}): Promise<FileAnalysis> {
  if (input.file.size > 35 * 1024 * 1024) {
    throw new Error("Files larger than 35 MB are not supported in the browser workspace.");
  }
  const [{ analyzeFile }, buffer] = await Promise.all([
    import("@/lib/intelligence/browser/analyze-file"),
    input.file.arrayBuffer(),
  ]);
  return analyzeFile({
    buffer,
    fileName: input.file.name,
    mimeType: input.file.type,
    expectedKind: input.expectedKind,
    fileId: input.fileId,
  });
}

export function sourceFileRecord(file: File, analysis?: FileAnalysis, error?: string, fileId?: string): SourceFileRecord {
  return {
    id: fileId ?? createId("file"),
    name: file.name,
    mimeType: file.type,
    size: file.size,
    addedAt: new Date().toISOString(),
    status: error ? "failed" : analysis ? (analysis.confidence === "low" ? "needs-review" : "processed") : "attached",
    analysis,
    error,
  };
}

function confidenceRank(value: Confidence): number {
  return value === "high" ? 3 : value === "medium" ? 2 : 1;
}

function highestConfidence(items: Confidence[]): Confidence {
  if (!items.length) return "low";
  const average = items.reduce((sum, value) => sum + confidenceRank(value), 0) / items.length;
  return average >= 2.45 ? "high" : average >= 1.55 ? "medium" : "low";
}

function stableValue(value: ExtractedFact["value"]): string {
  return Array.isArray(value) ? value.join(" | ") : String(value);
}

function dedupeFacts(facts: ExtractedFact[]): ExtractedFact[] {
  const map = new Map<string, ExtractedFact>();
  for (const candidate of facts) {
    const existing = map.get(candidate.key);
    if (!existing || confidenceRank(candidate.confidence) > confidenceRank(existing.confidence)) {
      map.set(candidate.key, candidate);
      continue;
    }
    if (existing && stableValue(existing.value) !== stableValue(candidate.value)) {
      map.set(`${candidate.key}.${candidate.sourceFileId}`, candidate);
    }
  }
  return [...map.values()];
}

function valueFor(facts: ExtractedFact[], key: string): ExtractedFact["value"] | undefined {
  return facts.find((item) => item.key === key)?.value;
}

function numericValue(facts: ExtractedFact[], key: string): number {
  const value = valueFor(facts, key);
  return typeof value === "number" ? value : Number(value ?? 0) || 0;
}

function stringArray(value: ExtractedFact["value"] | undefined): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value === undefined || value === "") return [];
  return [String(value)];
}

function openException(input: Omit<IntelligenceException, "id" | "status" | "value">): IntelligenceException {
  return { id: createId("exception"), status: "open", value: "", ...input };
}

function preserveResolvedExceptions(next: IntelligenceException[], previous?: ProjectIntelligence): IntelligenceException[] {
  const resolved = new Map((previous?.exceptions ?? []).filter((item) => item.status === "resolved").map((item) => [item.key, item]));
  return next.map((item) => resolved.get(item.key) ?? item);
}

export function buildProjectIntelligence(input: {
  type: Project["type"];
  sources: SourceDocument[];
  painPoints: string[];
  previous?: ProjectIntelligence;
}): ProjectIntelligence {
  const files = input.sources.flatMap((source) => source.files);
  const analyses = files.flatMap((file) => file.analysis ? [{ file, analysis: file.analysis }] : []);
  const facts = dedupeFacts(analyses.flatMap(({ analysis }) => analysis.facts));
  const sourceSummaries = analyses.map(({ file, analysis }) => ({
    fileId: file.id,
    fileName: file.name,
    sourceType: analysis.sourceType,
    confidence: analysis.confidence,
    summary: analysis.summary,
    highlights: analysis.highlights,
    warnings: analysis.warnings,
  }));
  const findingCandidates = analyses.flatMap(({ analysis }) => analysis.findingCandidates);
  const exceptions: IntelligenceException[] = [];

  for (const source of input.sources) {
    if (source.required && source.files.length === 0) {
      exceptions.push(openException({ key: `source.${source.kind}.missing`, prompt: `Attach ${source.label}`, reason: "This source is required for the selected outcome.", category: "operations", suggestedValue: "", sourceFileIds: [] }));
    }
    for (const file of source.files) {
      if (file.status === "failed" || file.analysis?.confidence === "low") {
        exceptions.push(openException({ key: `source.${file.id}.review`, prompt: `Confirm how ${file.name} should be used`, reason: file.error || file.analysis?.warnings[0] || "The source could not be classified with enough confidence.", category: "operations", suggestedValue: file.analysis?.sourceType ?? "", sourceFileIds: [file.id] }));
      }
    }
  }

  if (input.type === "prospect-proposal") {
    const enabledAccounts = numericValue(facts, "environment.enabledLocalAccounts");
    exceptions.push(openException({
      key: "proposal.managedUsers",
      prompt: "How many managed users should the proposal include?",
      reason: "The RFT can identify enabled local accounts, but that is not always the billable user count.",
      category: "pricing",
      suggestedValue: enabledAccounts ? String(enabledAccounts) : "",
      sourceFileIds: facts.filter((item) => item.key === "environment.enabledLocalAccounts").map((item) => item.sourceFileId),
    }));
    exceptions.push(openException({
      key: "client.locationCount",
      prompt: "How many locations are included?",
      reason: "The technical report may not distinguish all physical offices or planned locations.",
      category: "client",
      suggestedValue: "1",
      sourceFileIds: [],
    }));
    if (!input.painPoints.length && !facts.some((item) => item.key === "discovery.painPointCandidates")) {
      exceptions.push(openException({
        key: "discovery.primaryPain",
        prompt: "What is the client’s main reason for considering a change?",
        reason: "A strong proposal should connect the technical recommendation to the client’s real concern.",
        category: "operations",
        suggestedValue: "",
        sourceFileIds: [],
      }));
    }
    const missingBackupCount = numericValue(facts, "backup.endpointMissing");
    if (missingBackupCount > 0) {
      exceptions.push(openException({
        key: "backup.currentDesign",
        prompt: "Confirm the current backup and recovery setup",
        reason: `The RFT did not identify endpoint backup on ${missingBackupCount} devices, but centralized server or cloud protection may exist separately.`,
        category: "backup",
        suggestedValue: "",
        sourceFileIds: facts.filter((item) => item.key === "backup.endpointMissing").map((item) => item.sourceFileId),
      }));
    }
  }

  if (input.type === "client-report") {
    const types = analyses.map(({ analysis }) => analysis.sourceType);
    if (!types.includes("scalepad")) exceptions.push(openException({ key: "clientReport.scalepadClassification", prompt: "Confirm the ScalePad source", reason: "The attached lifecycle report was not confidently recognized as ScalePad.", category: "lifecycle", suggestedValue: "", sourceFileIds: [] }));
    if (!types.includes("huntress")) exceptions.push(openException({ key: "clientReport.huntressClassification", prompt: "Confirm the Huntress source", reason: "The attached security report was not confidently recognized as Huntress.", category: "security", suggestedValue: "", sourceFileIds: [] }));
  }

  if (input.type === "legacy-modernization") {
    const hasPricing = facts.some((item) => item.category === "pricing");
    if (!hasPricing) exceptions.push(openException({ key: "legacy.pricing", prompt: "Confirm the proposal pricing", reason: "No reliable monthly or one-time pricing lines were extracted from the legacy proposal.", category: "pricing", suggestedValue: "", sourceFileIds: analyses.map(({ file }) => file.id) }));
    else exceptions.push(openException({ key: "legacy.pricingReview", prompt: "Review extracted pricing and quantities", reason: "Legacy pricing is always reviewed before the new interactive proposal is published.", category: "pricing", suggestedValue: "Pricing reviewed", sourceFileIds: analyses.map(({ file }) => file.id) }));
  }



  const uniqueExceptions = [...new Map(exceptions.map((item) => [item.key, item])).values()];
  const preserved = preserveResolvedExceptions(uniqueExceptions, input.previous);
  const openCount = preserved.filter((item) => item.status === "open").length;
  const analyzedCount = analyses.length;
  const failedCount = files.filter((file) => file.status === "failed").length;

  return {
    status: failedCount && !analyzedCount ? "failed" : openCount ? "review-needed" : analyzedCount ? "ready" : "idle",
    overallConfidence: highestConfidence(analyses.map(({ analysis }) => analysis.confidence)),
    facts,
    exceptions: preserved,
    sourceSummaries,
    findingCandidates,
    lastRunAt: analyzedCount ? new Date().toISOString() : "",
  };
}

export function environmentFromIntelligence(intelligence: ProjectIntelligence): Record<string, unknown> {
  const environment: Record<string, unknown> = {};
  for (const item of intelligence.facts) environment[item.key] = item.value;
  for (const exception of intelligence.exceptions.filter((item) => item.status === "resolved")) environment[`confirmed.${exception.key}`] = exception.value;
  return environment;
}

export function projectWithRebuiltIntelligence(project: Project): Project {
  const intelligence = buildProjectIntelligence({
    type: project.type,
    sources: project.sources,
    painPoints: project.painPoints,
    previous: project.intelligence,
  });
  const hasMissingRequired = project.sources.some((source) => source.required && source.files.length === 0);
  const status: Project["status"] = hasMissingRequired
    ? "sources-needed"
    : intelligence.status === "review-needed" || intelligence.status === "failed"
      ? "review-needed"
      : intelligence.status === "ready"
        ? "intelligence-ready"
        : "ready-for-intelligence";
  return { ...project, intelligence, environment: environmentFromIntelligence(intelligence), status, updatedAt: new Date().toISOString() };
}

export function resolvedException(project: Project, exceptionId: string, value: string): Project {
  const intelligence = {
    ...project.intelligence,
    exceptions: project.intelligence.exceptions.map((item) => item.id === exceptionId ? { ...item, value: value.trim(), status: value.trim() ? "resolved" as const : "open" as const } : item),
  };
  const openCount = intelligence.exceptions.filter((item) => item.status === "open").length;
  intelligence.status = openCount ? "review-needed" : "ready";
  return {
    ...project,
    intelligence,
    environment: environmentFromIntelligence(intelligence),
    status: openCount ? "review-needed" : "intelligence-ready",
    updatedAt: new Date().toISOString(),
  };
}

export function factDisplayValue(value: ExtractedFact["value"]): string {
  if (Array.isArray(value)) return value.length ? value.join(" · ") : "None identified";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
