export type ReviewDisposition =
  | "advantage-replace"
  | "client-purchased"
  | "advantage-install-client-purchased"
  | "upgrade-only"
  | "retire-decommission"
  | "migrate-retire"
  | "monitor"
  | "deferred"
  | "no-action"
  | "completed"
  | "investigate";

export type ReviewOutcomeStatus = "not-reviewed" | "draft" | "confirmed";

export type PresentationConcernId =
  | "server-lifecycle"
  | "workstation-lifecycle"
  | "os-support"
  | "backup-recovery"
  | "storage-capacity"
  | "network-reliability"
  | "cybersecurity"
  | "hipaa-readiness"
  | "practice-growth"
  | "other";

export interface PresentationConcernSelection {
  id: PresentationConcernId;
  customLabel?: string;
}

export interface ReviewOutcomeItem {
  id: string;
  title: string;
  technicalFinding: string;
  disposition: ReviewDisposition;
  clientFacingNote: string;
  internalNote: string;
  responsibleParty: string;
  clientResponsibility?: string;
  advantageResponsibility?: string;
  targetDate: string;
  quoted?: boolean;
  includeInReport: boolean;
  deviceIds: string[];
  locationIds?: string[];
}

export interface ReviewOutcome {
  status: ReviewOutcomeStatus;
  reviewedAt: string;
  meetingSummary: string;
  agreedNextStep: string;
  reportTitle: string;
  executiveSummary: string;
  presentationConcerns: PresentationConcernSelection[];
  clientConcern: string;
  items: ReviewOutcomeItem[];
  lastUpdatedAt: string;
}
