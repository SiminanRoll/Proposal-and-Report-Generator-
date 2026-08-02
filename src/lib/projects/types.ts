export const PROJECT_TYPES = [
  "client-report",
  "prospect-proposal",
  "legacy-modernization",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];
export type ProjectStatus =
  | "draft"
  | "sources-needed"
  | "ready-for-intelligence"
  | "analyzing"
  | "review-needed"
  | "intelligence-ready"
  | "published";
export type SourceStatus = "needed" | "attached" | "analyzing" | "processed" | "needs-review" | "failed";
export type Confidence = "high" | "medium" | "low";
export type IntelligenceCategory = "security" | "network" | "lifecycle" | "backup" | "operations" | "planning" | "pricing" | "client";

export function isProjectType(value: string): value is ProjectType {
  return PROJECT_TYPES.includes(value as ProjectType);
}

export interface ClientContact {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  primary: boolean;
}

export interface ProjectClient {
  name: string;
  industry: string;
  locations: Array<{ id: string; name: string; address: string }>;
  contacts: ClientContact[];
}

export interface ExtractedFact {
  id: string;
  key: string;
  label: string;
  value: string | number | boolean | string[];
  category: IntelligenceCategory;
  confidence: Confidence;
  sourceFileId: string;
  evidence: string;
  requiresConfirmation?: boolean;
}

export interface FindingCandidate {
  id: string;
  category: Exclude<IntelligenceCategory, "pricing" | "client">;
  title: string;
  clientSummary: string;
  severity: "healthy" | "attention" | "priority";
  sourceFileId: string;
  evidence: string;
}

export interface FileAnalysis {
  sourceType:
    | "rft"
    | "scalepad"
    | "huntress"
    | "legacy-proposal"
    | "tc-notes"
    | "office-photo"
    | "supporting-document"
    | "generic-pdf"
    | "unknown";
  confidence: Confidence;
  title: string;
  summary: string;
  facts: ExtractedFact[];
  findingCandidates: FindingCandidate[];
  highlights: string[];
  warnings: string[];
  rawTextPreview: string;
  analyzedAt: string;
}

export interface SourceFileRecord {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  addedAt: string;
  status: Exclude<SourceStatus, "needed">;
  analysis?: FileAnalysis;
  error?: string;
}

export interface SourceDocument {
  id: string;
  kind: string;
  label: string;
  required: boolean;
  acceptedExtensions: string[];
  multiple: boolean;
  status: SourceStatus;
  files: SourceFileRecord[];
}

export interface IntelligenceException {
  id: string;
  key: string;
  prompt: string;
  reason: string;
  category: IntelligenceCategory;
  status: "open" | "resolved";
  suggestedValue: string;
  value: string;
  sourceFileIds: string[];
}

export interface SourceSummary {
  fileId: string;
  fileName: string;
  sourceType: FileAnalysis["sourceType"];
  confidence: Confidence;
  summary: string;
  highlights: string[];
  warnings: string[];
}

export interface ProjectIntelligence {
  status: "idle" | "processing" | "ready" | "review-needed" | "failed";
  overallConfidence: Confidence;
  facts: ExtractedFact[];
  exceptions: IntelligenceException[];
  sourceSummaries: SourceSummary[];
  findingCandidates: FindingCandidate[];
  lastRunAt: string;
}

export interface Finding {
  id: string;
  category: "security" | "network" | "lifecycle" | "backup" | "operations" | "planning";
  title: string;
  clientSummary: string;
  severity: "healthy" | "attention" | "priority";
  evidenceIds: string[];
}

export interface Recommendation {
  id: string;
  title: string;
  clientValue: string;
  findingIds: string[];
  itemIds: string[];
  optional: boolean;
}

export interface CatalogLineItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  billing: "monthly" | "one-time";
  included: boolean;
}

export interface Project {
  schemaVersion: 2;
  id: string;
  type: ProjectType;
  name: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  client: ProjectClient;
  sources: SourceDocument[];
  painPoints: string[];
  environment: Record<string, unknown>;
  intelligence: ProjectIntelligence;
  findings: Finding[];
  recommendations: Recommendation[];
  catalogItems: CatalogLineItem[];
  pricing: {
    monthly: number;
    oneTime: number;
    currency: "USD";
  };
  presentation: {
    title: string;
    executiveSummary: string;
    publishedAt: string;
    publicSlug: string;
  };
  signature: {
    status: "not-required" | "draft" | "sent" | "signed" | "declined";
    signerName: string;
    signedAt: string;
  };
  handoff: {
    status: "not-ready" | "ready" | "exported";
    notes: string;
  };
}
