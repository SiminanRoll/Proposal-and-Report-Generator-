export type SegmentIconName = "pin" | "server" | "users" | "building" | "target" | "shield" | "calendar" | "spark";

export type SegmentRuleField =
  | "managed-assets"
  | "replace-now"
  | "plan-soon"
  | "healthy"
  | "physical-servers"
  | "physical-server-age-years"
  | "virtual-servers"
  | "workstations"
  | "workstation-age-years"
  | "server-os"
  | "virtual-server-os"
  | "workstation-os"
  | "estimated-value"
  | "priority-score"
  | "account-review-age-days"
  | "quote-age-days"
  | "quoted"
  | "activity-tracked"
  | "assigned-owner"
  | "city"
  | "state"
  | "market"
  | "industry"
  | "client-tags"
  | "location-contains"
  | "client-name-contains";

export type SegmentRuleOperator = "gte" | "lte" | "eq" | "gt" | "lt" | "contains" | "not-contains" | "is";
export type SegmentMatchMode = "all" | "any";

export type SegmentStatId =
  | "estimated-value"
  | "replace-now"
  | "plan-soon"
  | "healthy"
  | "managed-assets"
  | "physical-servers"
  | "workstations"
  | "reviews-due"
  | "open-quotes"
  | "activity-tracked";

export interface SegmentRule {
  id: string;
  field: SegmentRuleField;
  operator: SegmentRuleOperator;
  value: string;
}

export interface SegmentDefinition {
  schemaVersion: 1;
  id: string;
  title: string;
  descriptor: string;
  description: string;
  color: string;
  icon: SegmentIconName;
  matchMode: SegmentMatchMode;
  rules: SegmentRule[];
  includeClientIds: string[];
  excludeClientIds: string[];
  stats: SegmentStatId[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface SegmentClientMetrics {
  clientId: string;
  clientName: string;
  managedAssets: number;
  replaceNow: number;
  planSoon: number;
  healthy: number;
  physicalServers: number;
  physicalServerAgeYears: number | null;
  virtualServers: number;
  workstations: number;
  workstationAgeYears: number | null;
  physicalServerOs: string[];
  virtualServerOs: string[];
  workstationOs: string[];
  estimatedValue: number;
  priorityScore: number;
  accountReviewAgeDays: number | null;
  quoteAgeDays: number | null;
  quoted: boolean;
  activityTracked: boolean;
  assignedOwner: string;
  city: string;
  state: string;
  market: string;
  industry: string;
  tags: string[];
  locations: string[];
  lastAccountReview: string;
  lastQuoteDate: string;
}

export interface SegmentAggregate {
  clientCount: number;
  estimatedValue: number;
  replaceNow: number;
  planSoon: number;
  healthy: number;
  managedAssets: number;
  physicalServers: number;
  workstations: number;
  reviewsDue: number;
  openQuotes: number;
  activityTracked: number;
}

export interface SegmentSnapshot {
  segment: SegmentDefinition;
  clients: SegmentClientMetrics[];
  aggregate: SegmentAggregate;
}
