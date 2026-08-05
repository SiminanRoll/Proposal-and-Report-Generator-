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

export interface ReviewOutcomeItem {
  id: string;
  title: string;
  technicalFinding: string;
  disposition: ReviewDisposition;
  clientFacingNote: string;
  internalNote: string;
  responsibleParty: string;
  targetDate: string;
  includeInReport: boolean;
  deviceIds: string[];
}

export interface ReviewOutcome {
  status: ReviewOutcomeStatus;
  reviewedAt: string;
  meetingSummary: string;
  agreedNextStep: string;
  reportTitle: string;
  executiveSummary: string;
  items: ReviewOutcomeItem[];
  lastUpdatedAt: string;
}
