import type { ReviewOutcome } from "@/lib/review-outcomes/types";

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
  organizationTerm: string;
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

export type HipaaOwnership = "client" | "joint" | "advantage-prefill";
export type HipaaResponse = "yes" | "partially" | "no" | "not-applicable" | "not-yet-assessed";
export type HipaaSafeguardCategory = "Administrative Safeguards" | "Technical Safeguards" | "Physical Safeguards" | "Organizational Requirements";
export type HipaaEvidenceSource = "Imported technical report" | "Advantage-managed system" | "Advantage technician verification" | "Client-provided documentation" | "Client verbal confirmation" | "Client questionnaire" | "Joint review" | "Vendor documentation" | "Not yet verified";
export type HipaaVerificationStatus = "not-reviewed" | "proposed" | "technically-verified" | "client-confirmed";
export type HipaaCompletionStatus = "not-started" | "open" | "in-progress" | "complete" | "deferred";
export type HipaaRiskSeverity = "none" | "low" | "moderate" | "high" | "critical";

export interface HipaaQuestionDefinition {
  id: string;
  originalControlMapId: string | null;
  regulationMappings: string[];
  category: HipaaSafeguardCategory;
  title: string;
  question: string;
  plainLanguageExplanation: string;
  ownership: HipaaOwnership;
  reviewPrompts: string[];
  clientConfirms: string[];
  advantageConfirms: string[];
  evidenceHints: string[];
  notes: string[];
}

export interface HipaaEvidenceAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  addedAt: string;
}

export interface HipaaAnswer {
  questionId: string;
  response: HipaaResponse;
  confidence: Confidence;
  verificationStatus: HipaaVerificationStatus;
  evidenceSource: HipaaEvidenceSource;
  evidenceDate: string;
  evidenceAttachment: HipaaEvidenceAttachment | null;
  internalNotes: string;
  clientVisibleObservation: string;
  riskSeverity: HipaaRiskSeverity;
  recommendedAction: string;
  responsibleParty: string;
  targetDate: string;
  completionStatus: HipaaCompletionStatus;
  clientConfirmationStatus: "pending" | "confirmed" | "deferred";
  clientConfirmer: string;
  confirmationDate: string;
  lastReviewedDate: string;
  includeInReport: boolean;
  deferred: boolean;
  deferredAt: string;
  deferredReason: string;
}

export interface HipaaScoreSummary {
  overall: number;
  confirmedReadiness: number;
  completionPercentage: number;
  categories: Record<HipaaSafeguardCategory, number>;
  confirmedCategories: Record<HipaaSafeguardCategory, number>;
  categoryCompletion: Record<HipaaSafeguardCategory, number>;
  counts: Record<HipaaResponse, number>;
  confirmedQuestionCount: number;
  assessedQuestionCount: number;
  applicableQuestionCount: number;
  notYetAssessedCount: number;
  label: "Strong Readiness" | "Good Progress" | "Developing" | "Needs Attention" | "Critical Gaps" | "Incomplete Assessment";
}

export interface HipaaAssessmentSnapshot {
  id: string;
  createdAt: string;
  reportingPeriod: { start: string; end: string };
  scores: HipaaScoreSummary;
  answers: HipaaAnswer[];
  confirmedBy: string;
}

export interface HipaaAssessment {
  questionSetVersion: string;
  enabled: boolean;
  status: "not-started" | "in-progress" | "ready-for-confirmation" | "confirmed" | "confirmed-incomplete";
  reportingPeriod: { start: string; end: string };
  answers: HipaaAnswer[];
  clientConfirmation: { status: "pending" | "confirmed"; confirmer: string; confirmedAt: string; acceptedResponsibility: boolean };
  snapshots: HipaaAssessmentSnapshot[];
  includeDetailedAppendix: boolean;
  lastUpdatedAt: string;
}

export type CatalogCategory = "managed-services" | "hardware" | "labor" | "applications" | "onboarding" | "discount" | "other";

export interface CatalogLineItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: CatalogCategory;
  quantity: number;
  unitPrice: number;
  billing: "monthly" | "one-time";
  included: boolean;
  requiresPrice?: boolean;
}

export interface PlanningAppointment {
  status: "scheduled";
  date: string;
  time: string;
  timeZone: string;
  consultantName: string;
  scheduledAt: string;
}

export type PlanningRecommendationMode = "onsite-review" | "remote-consultation" | "no-action-needed";

export interface ProjectManualInventoryDevice {
  id: string;
  type: "server" | "backup-server" | "workstation" | "vm" | "network";
  name: string;
  user: string;
  lastCheckIn: string;
  make: string;
  serial: string;
  model: string;
  os: string;
  age: number;
  purchased: string;
  warrantyExpires: string;
  ram: string;
  cpu: string;
  storage: string;
  storageUsage: string;
  storagePercent: number;
  storageFreeGb: number;
  graphics: string;
  location: string;
  lifecycleStatus: "current" | "due-soon" | "overdue" | "unknown";
}

export interface ProjectManualInventory {
  updatedAt: string;
  devices: ProjectManualInventoryDevice[];
}

export interface NewOwnershipSettings {
  enabled: boolean;
  agreementAuthorizationUrl: string;
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
  manualInventory?: ProjectManualInventory;
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
  newOwnership?: NewOwnershipSettings;
  planningRecommendationMode?: PlanningRecommendationMode;
  planningAppointment?: PlanningAppointment;
  reviewOutcome: ReviewOutcome;
  signature: {
    status: "not-required" | "draft" | "sent" | "signed" | "declined";
    signerName: string;
    signerTitle?: string;
    acceptedTerms?: boolean;
    signedAt: string;
  };
  hipaa: HipaaAssessment;
  handoff: {
    status: "not-ready" | "ready" | "exported";
    notes: string;
  };
}
