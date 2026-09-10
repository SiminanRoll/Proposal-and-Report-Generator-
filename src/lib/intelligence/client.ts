"use client";

import { enableHipaaAssessment } from "@/lib/hipaa/engine";
import { normalizeProposalProject, replaceA360MonthlyDefaults } from "@/lib/proposals/pricing";
import {
  classifyTechnicalOsSupport,
  isTechnicalFactKey,
  mergeTechnicalInventory,
  normalizedTechnicalIdentity,
  technicalSourceLabel,
  technicalSourcePriority,
  type TechnicalInventoryRecord,
} from "@/lib/technical-truth";
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

function technicalSourceRank(projectType: Project["type"], file: SourceFileRecord, analysis: FileAnalysis): number {
  return technicalSourcePriority(projectType, analysis.sourceType, file.mimeType, file.name);
}


type LifecycleInventoryRecord = TechnicalInventoryRecord;

function parseLifecycleInventory(analysis: FileAnalysis): LifecycleInventoryRecord[] {
  const value = analysis.facts.find((item) => item.key === "scalepad.inventory")?.value;
  const entries = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return entries.flatMap((entry) => {
    try {
      const parsed = JSON.parse(String(entry)) as LifecycleInventoryRecord;
      return parsed.name ? [parsed] : [];
    } catch {
      return [];
    }
  });
}

function lifecycleFactNumber(analysis: FileAnalysis, key: string): number {
  const value = analysis.facts.find((item) => item.key === key)?.value;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function lifecycleFactStrings(analysis: FileAnalysis, key: string): string[] {
  const value = analysis.facts.find((item) => item.key === key)?.value;
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return value === undefined || value === "" ? [] : [String(value)];
}

function isPdfLifecycleFile(file: SourceFileRecord): boolean {
  return file.mimeType === "application/pdf" || /\.pdf$/i.test(file.name);
}

function lifecycleFilenameSiteLabel(file: SourceFileRecord, index: number): string {
  const stem = file.name.replace(/\.[^.]+$/, "").trim();
  const cleaned = stem
    .replace(/\bscale\s*pad\b/gi, " ")
    .replace(/\bhardware\s+lifecycle\s+report\b/gi, " ")
    .replace(/\blifecycle\s+report\b/gi, " ")
    .replace(/\bhardware\s+report\b/gi, " ")
    .replace(/\breport\b/gi, " ")
    .replace(/\b20\d{2}[._ -]\d{1,2}[._ -]\d{1,2}\b/g, " ")
    .replace(/\b\d{1,2}[._ -]\d{1,2}[._ -]20\d{2}\b/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/[()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned && !/^\d+$/.test(cleaned) ? cleaned : `Site ${index + 1}`;
}

function lifecycleSiteLabel(file: SourceFileRecord, index: number, inventory: LifecycleInventoryRecord[]): string {
  const embeddedLocations = [...new Set(inventory.map((device) => String(device.location ?? "").trim()).filter(Boolean))];
  if (embeddedLocations.length === 1) return embeddedLocations[0];
  return lifecycleFilenameSiteLabel(file, index);
}

function normalizedLifecycleSerial(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function lifecycleInventoryMatchIndex(inventory: LifecycleInventoryRecord[], candidate: LifecycleInventoryRecord): number {
  const serial = normalizedLifecycleSerial(candidate.serial);
  if (serial) {
    const serialMatches = inventory.flatMap((device, index) => normalizedLifecycleSerial(device.serial) === serial ? [index] : []);
    if (serialMatches.length === 1) return serialMatches[0];
  }
  const name = normalizedTechnicalIdentity(candidate.sourceDeviceName ?? candidate.name);
  if (!name) return -1;
  const nameMatches = inventory.flatMap((device, index) => normalizedTechnicalIdentity(device.sourceDeviceName ?? device.name) === name ? [index] : []);
  return nameMatches.length === 1 ? nameMatches[0] : -1;
}

function multiSiteLifecycleCount(inventory: LifecycleInventoryRecord[], type: string): number {
  return inventory.filter((device) => String(device.type ?? "").trim().toLowerCase() === type).length;
}

function multiSiteLifecycleStatusCount(inventory: LifecycleInventoryRecord[], status: string): number {
  return inventory.filter((device) => String(device.lifecycleStatus ?? "").trim().toLowerCase() === status).length;
}

function mergedMultiSiteLifecycleFacts(
  facts: ExtractedFact[],
  lifecycleSources: Array<{ file: SourceFileRecord; analysis: FileAnalysis }>,
): ExtractedFact[] | null {
  const pdfSources = lifecycleSources.filter(({ file }) => isPdfLifecycleFile(file));
  if (pdfSources.length < 2) return null;

  const authoritativeSource = lifecycleSources.find(({ file, analysis }) =>
    file.mimeType === "application/x-client-compass-snapshot"
    || Boolean(analysis.facts.find((item) => item.key === "compass.authoritativeInventory")?.value)
  );

  const rawGroups = pdfSources.map(({ file, analysis }, sourceIndex) => {
    const inventory = parseLifecycleInventory(analysis);
    return { file, analysis, inventory, siteLabel: lifecycleSiteLabel(file, sourceIndex, inventory) };
  });
  if (rawGroups.some((group) => !group.inventory.length)) return null;

  const initialLabels = new Set(rawGroups.map((group) => group.siteLabel.trim().toLowerCase()).filter(Boolean));
  const sourceGroups = rawGroups.map((group, sourceIndex) => {
    const siteLabel = initialLabels.size >= 2 ? group.siteLabel : lifecycleFilenameSiteLabel(group.file, sourceIndex);
    const inventory = group.inventory.map((device, deviceIndex) => {
      const rawIdentity = String(device.sourceDeviceId ?? device.serial ?? device.name ?? deviceIndex + 1).trim() || String(deviceIndex + 1);
      return {
        ...device,
        location: siteLabel || `Site ${sourceIndex + 1}`,
        sourceDeviceId: `${group.file.id}:${rawIdentity}`,
        sourceDeviceName: String(device.sourceDeviceName ?? device.name ?? "").trim(),
      } as LifecycleInventoryRecord;
    });
    return { ...group, siteLabel: siteLabel || `Site ${sourceIndex + 1}`, inventory };
  });

  let combinedInventory: LifecycleInventoryRecord[];
  let enrichedDevices = 0;
  if (authoritativeSource) {
    const baseInventory = parseLifecycleInventory(authoritativeSource.analysis);
    if (!baseInventory.length) return null;
    const merge = mergeTechnicalInventory(baseInventory, sourceGroups.map((group) => ({ label: `${technicalSourceLabel("scalepad")} — ${group.siteLabel}`, inventory: group.inventory })));
    enrichedDevices = merge.enrichedDevices;
    combinedInventory = merge.inventory.map((device) => ({ ...device }));

    sourceGroups.forEach((group, groupIndex) => {
      for (const device of group.inventory) {
        const matchIndex = lifecycleInventoryMatchIndex(combinedInventory, device);
        if (matchIndex >= 0) {
          const current = combinedInventory[matchIndex];
          const currentLocation = String(current.location ?? "").trim();
          if (!currentLocation || /^(?:unassigned|unknown|n\/a|na)$/i.test(currentLocation)) {
            combinedInventory[matchIndex] = { ...current, location: group.siteLabel };
          }
          continue;
        }
        if (groupIndex === 0) continue;
        combinedInventory.push({
          ...device,
          authoritative: true,
          sourceName: `${technicalSourceLabel("scalepad")} — ${group.siteLabel}`,
        });
      }
    });
  } else {
    combinedInventory = sourceGroups.flatMap((group) => group.inventory);
  }

  const locations = [...new Set(combinedInventory.map((device) => String(device.location ?? "").trim()).filter(Boolean))];
  if (locations.length < 2) return null;

  const baseSource = authoritativeSource ?? sourceGroups[0];
  const next = facts.slice();
  const sourceTemplates = [...(authoritativeSource ? [authoritativeSource] : []), ...sourceGroups];
  const evidencePrefix = authoritativeSource
    ? `Combined managed inventory with ${sourceGroups.length} ScalePad site reports`
    : `Combined across ${sourceGroups.length} ScalePad site reports`;

  const upsertFact = (
    key: string,
    value: ExtractedFact["value"],
    label: string,
    category: ExtractedFact["category"] = "lifecycle",
  ): void => {
    const existingIndex = next.findIndex((item) => item.key === key);
    const sourceTemplate = sourceTemplates.flatMap((group) => group.analysis.facts).find((item) => item.key === key);
    const existing = existingIndex >= 0 ? next[existingIndex] : undefined;
    const combined: ExtractedFact = {
      ...(sourceTemplate ?? existing ?? {
        id: createId("fact"),
        key,
        label,
        value,
        category,
        confidence: "high" as const,
        sourceFileId: baseSource.file.id,
        evidence: "",
      }),
      id: existing?.id ?? sourceTemplate?.id ?? createId("fact"),
      key,
      label: sourceTemplate?.label ?? existing?.label ?? label,
      value,
      category: sourceTemplate?.category ?? existing?.category ?? category,
      confidence: "high",
      sourceFileId: baseSource.file.id,
      evidence: `${evidencePrefix}: ${locations.join(", ")}.`,
    };
    if (existingIndex >= 0) next[existingIndex] = combined;
    else next.push(combined);
  };

  const physicalTypes = new Set(["server", "backup-server", "workstation"]);
  const physicalInventory = combinedInventory.filter((device) => physicalTypes.has(String(device.type ?? "").trim().toLowerCase()));
  const replacementCurrent = multiSiteLifecycleStatusCount(physicalInventory, "current");
  const replacementDueSoon = multiSiteLifecycleStatusCount(physicalInventory, "due-soon");
  const replacementOverdue = multiSiteLifecycleStatusCount(physicalInventory, "overdue");
  const replacementUnknown = Math.max(0, physicalInventory.length - replacementCurrent - replacementDueSoon - replacementOverdue);
  const osStatuses = combinedInventory.map((device) => classifyTechnicalOsSupport(String(device.os ?? "")));

  upsertFact("scalepad.inventory", combinedInventory.map((device) => JSON.stringify(device)), "Device inventory");
  upsertFact("scalepad.locations", locations, "Locations", "planning");
  upsertFact("scalepad.multiSite", true, "Multiple lifecycle sites", "planning");
  upsertFact("scalepad.multiSitePdfCount", sourceGroups.length, "ScalePad site reports", "planning");
  upsertFact("scalepad.totalAssets", combinedInventory.length, "Hardware assets", "lifecycle");
  upsertFact("scalepad.physicalAssets", physicalInventory.length, "Physical lifecycle assets", "lifecycle");
  upsertFact("scalepad.sourceReportedTotal", combinedInventory.length, "Source-reported inventory total", "lifecycle");
  upsertFact("scalepad.parsedInventoryTotal", combinedInventory.length, "Parsed detailed inventory total", "lifecycle");
  upsertFact("scalepad.servers", multiSiteLifecycleCount(combinedInventory, "server"), "Primary servers", "lifecycle");
  upsertFact("scalepad.backupServers", multiSiteLifecycleCount(combinedInventory, "backup-server"), "Cloud Plus backup servers", "backup");
  upsertFact("scalepad.workstations", multiSiteLifecycleCount(combinedInventory, "workstation"), "Workstations", "lifecycle");
  upsertFact("scalepad.vms", multiSiteLifecycleCount(combinedInventory, "vm"), "Virtual machines", "lifecycle");
  upsertFact("scalepad.networkDevices", multiSiteLifecycleCount(combinedInventory, "network"), "Network devices", "network");
  upsertFact("scalepad.replacement.current", replacementCurrent, "Current devices", "lifecycle");
  upsertFact("scalepad.replacement.dueSoon", replacementDueSoon, "Devices due soon", "lifecycle");
  upsertFact("scalepad.replacement.overdue", replacementOverdue, "Devices overdue", "lifecycle");
  upsertFact("scalepad.replacement.unknown", replacementUnknown, "Assets under review", "lifecycle");
  upsertFact("scalepad.os.supported", osStatuses.filter((status) => status === "supported").length, "Operating systems supported", "lifecycle");
  upsertFact("scalepad.os.endingSoon", osStatuses.filter((status) => status === "ending-soon").length, "Operating systems ending soon", "lifecycle");
  upsertFact("scalepad.os.unsupported", osStatuses.filter((status) => status === "unsupported").length, "Operating systems unsupported", "lifecycle");
  upsertFact("scalepad.replaceNow", physicalInventory.filter((device) => String(device.lifecycleStatus ?? "") === "overdue").map((device) => String(device.name ?? "")).filter(Boolean), "Replace now", "planning");
  upsertFact("scalepad.planSoon", physicalInventory.filter((device) => String(device.lifecycleStatus ?? "") === "due-soon").map((device) => String(device.name ?? "")).filter(Boolean), "Plan soon", "planning");

  if (authoritativeSource && enrichedDevices) {
    upsertFact("scalepad.lifecycleEnrichedDevices", enrichedDevices, "Devices enriched from lifecycle source", "lifecycle");
  }

  const locationMap = new Map<string, LifecycleInventoryRecord[]>();
  for (const device of combinedInventory) {
    const location = String(device.location ?? "").trim();
    if (!location) continue;
    locationMap.set(location, [...(locationMap.get(location) ?? []), device]);
  }
  const locationSnapshots = [...locationMap.entries()].map(([name, devices], index) => ({
    id: `scalepad-location-${index + 1}`,
    clientId: "",
    name,
    deviceIds: devices.map((device) => String(device.sourceDeviceId ?? device.name ?? "")).filter(Boolean),
    physicalServers: devices.filter((device) => ["server", "backup-server"].includes(String(device.type ?? ""))).length,
    virtualServers: devices.filter((device) => String(device.type ?? "") === "vm" && /server/i.test(String(device.os ?? ""))).length,
    physicalWorkstations: devices.filter((device) => String(device.type ?? "") === "workstation").length,
    virtualWorkstations: devices.filter((device) => String(device.type ?? "") === "vm" && !/server/i.test(String(device.os ?? ""))).length,
    replaceNow: devices.filter((device) => String(device.lifecycleStatus ?? "") === "overdue").length,
    planSoon: devices.filter((device) => String(device.lifecycleStatus ?? "") === "due-soon").length,
    windows10: devices.filter((device) => /Windows\s*10/i.test(String(device.os ?? ""))).length,
    storageAttention: devices.filter((device) => {
      const storageState = String(device.storageState ?? "");
      const storagePercent = Number(device.storagePercent ?? 0);
      return storageState === "watch" || storageState === "critical" || (Number.isFinite(storagePercent) && storagePercent >= 80);
    }).length,
    findingIds: [],
    decisionIds: [],
  }));
  upsertFact("compass.locationSnapshots", locationSnapshots.map((snapshot) => JSON.stringify(snapshot)), "Location snapshots", "planning");

  return next;
}

function mergedLifecycleFacts(
  facts: ExtractedFact[],
  analyses: Array<{ file: SourceFileRecord; analysis: FileAnalysis }>,
): ExtractedFact[] {
  const lifecycleSources = analyses.filter(({ analysis }) => analysis.sourceType === "scalepad");
  if (!lifecycleSources.length) return facts;

  const multiSiteFacts = mergedMultiSiteLifecycleFacts(facts, lifecycleSources);
  if (multiSiteFacts) return multiSiteFacts;

  const baseSource = lifecycleSources[0];
  const authoritativeBase = baseSource.file.mimeType === "application/x-client-compass-snapshot"
    || Boolean(baseSource.analysis.facts.find((item) => item.key === "compass.authoritativeInventory")?.value);
  const baseInventory = parseLifecycleInventory(baseSource.analysis);
  if (!baseInventory.length) return facts;

  const enrichmentGroups = lifecycleSources.slice(1).flatMap(({ file, analysis }) => {
    const inventory = parseLifecycleInventory(analysis);
    if (!inventory.length) return [];
    return [{ label: file.mimeType === "application/pdf" || /\.pdf$/i.test(file.name) ? technicalSourceLabel("scalepad") : `${technicalSourceLabel("scalepad")} — ${file.name}`, inventory }];
  });
  const merge = mergeTechnicalInventory(baseInventory, enrichmentGroups);
  const next = facts.slice();
  const inventoryIndex = next.findIndex((item) => item.key === "scalepad.inventory");
  if (inventoryIndex >= 0) {
    next[inventoryIndex] = {
      ...next[inventoryIndex],
      value: merge.inventory.map((device) => JSON.stringify(device)),
      evidence: enrichmentGroups.length ? `${next[inventoryIndex].evidence}; safely enriched from uniquely matched lifecycle records` : next[inventoryIndex].evidence,
    };
  }

  const pdfSource = lifecycleSources.find(({ file }) => file.mimeType === "application/pdf" || /\.pdf$/i.test(file.name));
  const summaryKeys = [
    "scalepad.replacement.current",
    "scalepad.replacement.dueSoon",
    "scalepad.replacement.overdue",
    "scalepad.replacement.unknown",
    "scalepad.os.supported",
    "scalepad.os.endingSoon",
    "scalepad.os.unsupported",
  ];
  if (pdfSource && !authoritativeBase) {
    for (const key of summaryKeys) {
      const preferred = pdfSource.analysis.facts.find((item) => item.key === key);
      if (!preferred) continue;
      const existing = next.findIndex((item) => item.key === key);
      if (existing >= 0) next[existing] = preferred;
      else next.push(preferred);
    }
  }
  if (pdfSource && authoritativeBase) {
    for (const key of summaryKeys) {
      const supplemental = pdfSource.analysis.facts.find((item) => item.key === key);
      if (!supplemental) continue;
      const diagnosticKey = `lifecycleSource.${key.replace(/^scalepad\./, "")}`;
      if (!next.some((item) => item.key === diagnosticKey)) next.push({ ...supplemental, id: createId("fact"), key: diagnosticKey, label: `Lifecycle source: ${supplemental.label}` });
    }
  }
  if (merge.enrichedDevices && authoritativeBase) {
    const enrichmentLabels = [...new Set(enrichmentGroups.map((group) => group.label))];
    const upsertTechnicalSource = (key: string, label: string, value: string[], evidence: string): void => {
      const existing = next.findIndex((item) => item.key === key);
      const sourceFact: ExtractedFact = {
        id: existing >= 0 ? next[existing].id : createId("fact"),
        key,
        label,
        value,
        category: "lifecycle",
        confidence: "high",
        sourceFileId: baseSource.file.id,
        evidence,
      };
      if (existing >= 0) next[existing] = sourceFact;
      else next.push(sourceFact);
    };
    const managedAndLifecycle = [technicalSourceLabel("compass"), ...enrichmentLabels];
    upsertTechnicalSource("technical.source.lifecycle", "Lifecycle source", managedAndLifecycle, "Ninja / Client Compass remains authoritative; uniquely matched ScalePad records enrich age and purchase date only");
    upsertTechnicalSource("technical.source.warranty", "Warranty source", managedAndLifecycle, "Ninja / Client Compass remains authoritative; uniquely matched ScalePad records may enrich warranty dates only");
  }
  if (merge.enrichedDevices) {
    next.push({
      id: createId("fact"),
      key: "scalepad.lifecycleEnrichedDevices",
      label: "Devices enriched from lifecycle source",
      value: merge.enrichedDevices,
      category: "lifecycle",
      confidence: "high",
      sourceFileId: baseSource.file.id,
      evidence: "Exact or unique safe matches enriched age, purchase date, or warranty without changing authoritative inventory identity, classification, operating system, activity, or storage",
    });
  }
  if (merge.unmatchedEnrichment.length) {
    next.push({
      id: createId("fact"),
      key: "scalepad.lifecycleUnmatchedRecords",
      label: "Unmatched lifecycle records",
      value: merge.unmatchedEnrichment.map((device) => String(device.name ?? device.serial ?? "Unnamed lifecycle record")),
      category: "lifecycle",
      confidence: "high",
      sourceFileId: baseSource.file.id,
      evidence: "Diagnostic only; unmatched lifecycle records cannot add, remove, rename, merge, or suppress authoritative Ninja / Client Compass inventory",
    });
  }
  if (merge.ambiguousEnrichment.length) {
    next.push({
      id: createId("fact"),
      key: "scalepad.lifecycleAmbiguousRecords",
      label: "Ambiguous lifecycle matches",
      value: merge.ambiguousEnrichment.map((device) => String(device.name ?? device.serial ?? "Unnamed lifecycle record")),
      category: "lifecycle",
      confidence: "high",
      sourceFileId: baseSource.file.id,
      evidence: "Diagnostic only; ambiguous lifecycle records were not merged into authoritative inventory",
    });
  }
  return next;
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

function dedupeFacts(
  facts: ExtractedFact[],
  sourceMeta: Map<string, { file: SourceFileRecord; analysis: FileAnalysis }>,
  projectType: Project["type"],
): ExtractedFact[] {
  const map = new Map<string, ExtractedFact>();
  const rank = (candidate: ExtractedFact): number => {
    const source = sourceMeta.get(candidate.sourceFileId);
    return source ? technicalSourceRank(projectType, source.file, source.analysis) : 0;
  };
  for (const candidate of facts) {
    const existing = map.get(candidate.key);
    const technical = isTechnicalFactKey(candidate.key) || candidate.key.startsWith("technical.");
    const candidatePreferred = technical
      ? rank(candidate) > rank(existing ?? candidate) || (rank(candidate) === rank(existing ?? candidate) && (!existing || confidenceRank(candidate.confidence) > confidenceRank(existing.confidence)))
      : !existing || confidenceRank(candidate.confidence) > confidenceRank(existing.confidence);
    if (!existing || candidatePreferred) {
      if (existing && stableValue(existing.value) !== stableValue(candidate.value)) {
        const alternativeKey = `${existing.key}.${existing.sourceFileId}`;
        map.set(alternativeKey, { ...existing, key: alternativeKey, label: `${existing.label} — source alternative` });
      }
      map.set(candidate.key, candidate);
      continue;
    }
    if (stableValue(existing.value) !== stableValue(candidate.value)) {
      const alternativeKey = `${candidate.key}.${candidate.sourceFileId}`;
      map.set(alternativeKey, { ...candidate, key: alternativeKey, label: `${candidate.label} — source alternative` });
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
  const analyses = files
    .flatMap((file) => file.analysis ? [{ file, analysis: file.analysis }] : [])
    .sort((a, b) => technicalSourceRank(input.type, b.file, b.analysis) - technicalSourceRank(input.type, a.file, a.analysis));
  const sourceMeta = new Map(analyses.map((item) => [item.file.id, item]));
  let facts = dedupeFacts(analyses.flatMap(({ analysis }) => analysis.facts), sourceMeta, input.type);
  facts = mergedLifecycleFacts(facts, analyses);
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

  if (input.type === "prospect-proposal" || input.type === "legacy-modernization") {
    const proposalTypes = analyses.map(({ analysis }) => analysis.sourceType);
    if (!proposalTypes.includes("rft")) exceptions.push(openException({ key: "proposal.rftClassification", prompt: "Confirm the RFT source", reason: "The required technical workbook was not confidently recognized as an RFT assessment.", category: "operations", suggestedValue: "", sourceFileIds: [] }));
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
    if (!types.includes("scalepad")) exceptions.push(openException({ key: "clientReport.scalepadClassification", prompt: "Confirm the lifecycle/device source", reason: "The attached lifecycle or device source was not confidently recognized.", category: "lifecycle", suggestedValue: "", sourceFileIds: [] }));
    if (!types.includes("huntress")) exceptions.push(openException({ key: "clientReport.huntressClassification", prompt: "Confirm the Huntress source", reason: "The attached security report was not confidently recognized as Huntress.", category: "security", suggestedValue: "", sourceFileIds: [] }));

    const authoritativeInventory = Boolean(valueFor(facts, "compass.authoritativeInventory"));
    const multiSiteInventory = Boolean(valueFor(facts, "scalepad.multiSite"));
    const sourceTotal = authoritativeInventory && !multiSiteInventory
      ? numericValue(facts, "compass.authoritativeInventoryTotal")
      : numericValue(facts, "scalepad.sourceReportedTotal") || numericValue(facts, "scalepad.totalAssets");
    const parsedTotal = stringArray(valueFor(facts, "scalepad.inventory")).length || numericValue(facts, "scalepad.parsedInventoryTotal");
    const inventoryValues = stringArray(valueFor(facts, "scalepad.inventory"));
    const suspiciousNames = inventoryValues.flatMap((entry) => {
      try {
        const parsed = JSON.parse(entry) as { name?: unknown; sourceDeviceName?: unknown; authoritative?: unknown };
        const name = String(parsed.sourceDeviceName ?? parsed.name ?? "");
        const malformed = !name || /[\u0000-\u001F\u007F-\u009F\uE000-\uF8FF\uFFFE\uFFFF]/.test(name) || /^(?:(?:Last)?Check-?In|WarrantyExpiry|WarrantyExpires)/i.test(name);
        return malformed ? [name || "Unnamed device"] : [];
      } catch {
        return ["Unreadable device record"];
      }
    });
    if (sourceTotal > 0 && parsedTotal !== sourceTotal) {
      const sourceName = multiSiteInventory ? "The combined site inventory" : authoritativeInventory ? "Ninja / Client Compass" : "The lifecycle source";
      exceptions.push(openException({
        key: "clientReport.inventoryReconciliation",
        prompt: "Resolve the inventory count mismatch",
        reason: `${sourceName} reports ${sourceTotal} devices, but ${parsedTotal} device rows reached the report. Refresh source data and download the inventory diagnostics before generating.`,
        category: "lifecycle",
        suggestedValue: "Inventory reviewed",
        sourceFileIds: analyses.filter(({ analysis }) => analysis.sourceType === "scalepad").map(({ file }) => file.id),
      }));
    }
    if (suspiciousNames.length) {
      exceptions.push(openException({
        key: "clientReport.deviceNames",
        prompt: "Review malformed device names",
        reason: `${suspiciousNames.length} authoritative device name${suspiciousNames.length === 1 ? " needs" : "s need"} review. Names from Ninja / Client Compass remain unchanged unless they contain an unreadable control character or missing identity.`,
        category: "lifecycle",
        suggestedValue: "Names reviewed",
        sourceFileIds: analyses.filter(({ analysis }) => analysis.sourceType === "scalepad").map(({ file }) => file.id),
      }));
    }
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
  const rebuilt: Project = { ...project, intelligence, environment: environmentFromIntelligence(intelligence), status, updatedAt: new Date().toISOString() };
  const withCompliance = rebuilt.hipaa.enabled ? enableHipaaAssessment(rebuilt) : rebuilt;
  const normalized = normalizeProposalProject(withCompliance);
  const previouslyHadRft = project.intelligence.sourceSummaries.some((summary) => summary.sourceType === "rft");
  const nowHasRft = intelligence.sourceSummaries.some((summary) => summary.sourceType === "rft");
  return project.type !== "client-report" && nowHasRft && !previouslyHadRft
    ? replaceA360MonthlyDefaults(normalized)
    : normalized;
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
