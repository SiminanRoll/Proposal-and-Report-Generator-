import type { ReviewOutcome } from "@/lib/review-outcomes/types";

export type CompassDeviceType = "physical-server" | "virtual-server" | "physical-workstation" | "virtual-workstation" | "unknown";
export type CompassLifecycle = "current" | "plan-soon" | "replace-now" | "unknown";
export type CompassSeverity = "critical" | "high" | "planning" | "watch" | "info";
export type CompassBuiltInCardCategory = "all" | "critical-server" | "server-planning" | "windows-10" | "workstation-lifecycle" | "storage" | "reviews-due" | "quote-needed";
export type CompassCardCategory = CompassBuiltInCardCategory | `custom-${string}`;
export type CompassCardAccent = "blue" | "red" | "amber" | "cyan" | "violet" | "teal";
export type CompassCardIcon = "compass" | "server" | "calendar" | "windows" | "workstation" | "storage";

export type CompassCardSignal =
  | "server-2012"
  | "unsupported-server-os"
  | "server-age-critical"
  | "server-age-warranty-critical"
  | "critical-server-storage"
  | "server-2016"
  | "server-age-planning"
  | "server-warranty-upcoming"
  | "server-consolidation"
  | "windows-10-active"
  | "windows-11-home"
  | "replace-now"
  | "plan-soon"
  | "critical-storage"
  | "watch-storage"
  | "expired-server-warranty"
  | "expired-workstation-warranty";

export type CompassCardEstimateMode = "deduplicated" | "server" | "workstation" | "storage" | "fixed";
export type CompassWorkflowRule = "reviews-due" | "quote-needed";

export interface CompassCardRule {
  id: string;
  signal: CompassCardSignal;
  minimumDevices: number;
  enabled: boolean;
}

export interface CompassCardDefinition {
  id: CompassCardCategory;
  builtIn: boolean;
  enabled: boolean;
  order: number;
  title: string;
  countLabel: string;
  valueLabel: string;
  description: string;
  accent: CompassCardAccent;
  icon: CompassCardIcon;
  criteriaType: "signals" | "rollup" | "workflow";
  workflowRule: CompassWorkflowRule | "";
  workflowMonths: number;
  matchMode: "any" | "all";
  rules: CompassCardRule[];
  sourceCardIds: CompassCardCategory[];
  excludeSignals: CompassCardSignal[];
  estimateMode: CompassCardEstimateMode;
  fixedEstimate: number;
  manualClientIds: string[];
}

export interface CompassCaptainsLogTask {
  id: string;
  type: string;
  tag: string;
  title: string;
  status: string;
  scheduledAt: string;
  createdAt: string;
  source: string;
  companyId?: string;
}

export interface CompassCaptainsLogActivity {
  id: string;
  type: string;
  tag: string;
  title: string;
  status: string;
  scheduledAt: string;
  completedAt: string;
  createdAt: string;
  source: string;
  companyId?: string;
}

export interface CompassCaptainsLogState {
  matched: boolean;
  companyId?: string;
  linkedCompany: string;
  closestCompany: string;
  matchMethod: string;
  matchScore: number;
  syncedAt: string;
  openTaskCount: number;
  openTasks: CompassCaptainsLogTask[];
  recentActivity: CompassCaptainsLogActivity[];
}

export interface CompassClient {
  id: string;
  companyId?: string;
  name: string;
  aliases: string[];
  city: string;
  state: string;
  market: string;
  industry: string;
  tags: string[];
  primaryContact: string;
  primaryContactRole: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  assignedOwner: string;
  technicalConsultant?: string;
  lastAccountReview: string;
  lastSalesInteraction: string;
  futureTechnicalConsultantActivity?: string;
  lastQuoteDate: string;
  quoted: boolean;
  nextFollowUp: string;
  workflowStatus: string;
  internalNote: string;
  recordReviewNeeded?: boolean;
  recordReviewReason?: string;
  accountReviewStatus?: string;
  accountReviewCycleResolvedDate?: string;
  accountReviewActivityThrough?: string;
  accountReviewNextDate?: string;
  accountReviewDisposition?: string;
  accountReviewStateNote?: string;
  accountReviewStateUpdatedAt?: string;
  reviewOutcome: ReviewOutcome;
  lastDataRefresh: string;
  captainsLog?: CompassCaptainsLogState;
}

export interface CompassLocation {
  id: string;
  clientId: string;
  name: string;
}

export interface DiskVolumeCondition {
  label: string;
  usedPercent: number | null;
  usedGb: number | null;
  totalGb: number | null;
  freeGb: number | null;
  isSystem: boolean;
  state: "healthy" | "watch" | "critical" | "unknown";
  excludedReason: string;
}

export interface CompassDevice {
  id: string;
  clientId: string;
  locationId: string;
  name: string;
  organization: string;
  deviceType: CompassDeviceType;
  isVirtual: boolean;
  virtualizationPlatform: string;
  model: string;
  processor?: string;
  videoCard: string;
  osName: string;
  status: string;
  memoryGiB: number | null;
  sourceDeviceType?: string;
  purchaseDate?: string;
  diskVolumeSource: string;
  diskVolumes: DiskVolumeCondition[];
  warrantyStart: string;
  warrantyEnd: string;
  lastUptime: string;
  lastLogin: string;
  lifecycle: CompassLifecycle;
  source: string;
}

export interface CompassFinding {
  id: string;
  clientId: string;
  deviceId: string;
  category: CompassCardSignal | string;
  severity: CompassSeverity;
  title: string;
  explanation: string;
  scoreContribution: number;
  valueCategory: CompassCardCategory | "none";
}

export interface CompassOpportunity {
  clientId: string;
  cardCategory: CompassCardCategory;
  affectedDeviceIds: string[];
  drivers: string[];
  estimatedValue: number;
  confidence: "high" | "medium" | "low";
  assumptionKeys: string[];
}

export interface CompassClientSummary {
  clientId: string;
  clientName: string;
  priorityScore: number;
  priorityTier: "Critical" | "High" | "Planning" | "Monitor";
  topDrivers: string[];
  totalEstimatedValue: number;
  opportunities: CompassOpportunity[];
}

export interface CompassImportSummary {
  totalRows: number;
  organizationsDetected: number;
  matchedOrganizations: number;
  unmatchedOrganizations: number;
  newOrganizations: number;
  devicesDetected: number;
  physicalServers: number;
  virtualMachines: number;
  workstations: number;
  rejectedRows: number;
  osConcerns: number;
  storageConcerns: number;
}

export interface CompassDataset {
  schemaVersion: 1;
  calculationVersion?: number;
  calculationFingerprint?: string;
  calculatedAt?: string;
  clients: CompassClient[];
  locations: CompassLocation[];
  devices: CompassDevice[];
  findings: CompassFinding[];
  summaries: CompassClientSummary[];
  importedAt: string;
  importSourceName: string;
  importSummary: CompassImportSummary;
}

export interface CompassScoreConfig {
  server2012First: number;
  server2012Additional: number;
  server2012Cap: number;
  server2016First: number;
  server2016Additional: number;
  server2016Cap: number;
  serverAgePlanningEach: number;
  serverAgePlanningCap: number;
  serverAgeCriticalEach: number;
  serverAgeCriticalCap: number;
  windows10Each: number;
  windows10Cap: number;
  windows11HomeEach: number;
  windows11HomeCap: number;
  replaceNowEach: number;
  replaceNowCap: number;
  planSoonEach: number;
  planSoonCap: number;
  criticalStorageEach: number;
  criticalStorageCap: number;
  watchStorageEach: number;
  watchStorageCap: number;
  expiredServerWarrantyEach: number;
  expiredServerWarrantyCap: number;
  expiredWorkstationWarrantyEach: number;
  expiredWorkstationWarrantyCap: number;
}

export interface CompassValueConfig {
  standardServerReplacement: number;
  advancedServerMigration: number;
  multiServerAdditionalMultiplier: number;
  standardWorkstationModernization: number;
  workstationDeploymentAllowance: number;
  virtualOsRemediation: number;
  storageRemediation: number;
  multisiteAdjustment: number;
  planningContingencyPercent: number;
}

export interface CompassThresholdConfig {
  workstationPlanSoonYears: number;
  workstationReplaceNowYears: number;
  workstationExpiredWarrantyReplaceYears: number;
  serverPlanningYears: number;
  serverCriticalYears: number;
  serverExpiredWarrantyCriticalYears: number;
  serverWarrantyPlanningMinYears: number;
  warrantyPlanningMonths: number;
  staleDeviceMonths: number;
  storageWatchPercent: number;
  storageCriticalPercent: number;
  storageSystemWatchFreeGb: number;
  storageSystemCriticalFreeGb: number;
  storageWatchFreeGb: number;
  storageCriticalFreeGb: number;
  storageMinimumVolumeGb: number;
  accountReviewDueMonths: number;
}

export type CompassCoverageCardSetId = "client-project-coverage" | "priority-lens";
export type CompassCoverageCardId = "needs-review" | "discussed-open" | "quoted-open" | "highest-risk" | "oldest-quotes" | "largest-need";

export interface CompassCoverageConfig {
  defaultCardSet: CompassCoverageCardSetId;
  priorityLensEnabled: boolean;
  minimumWorkstations: number;
  primaryCardOrder: Array<"needs-review" | "discussed-open" | "quoted-open">;
  priorityCardOrder: Array<"highest-risk" | "oldest-quotes" | "largest-need">;
  hiddenCardIds: CompassCoverageCardId[];
}

export interface CompassConfig {
  score: CompassScoreConfig;
  value: CompassValueConfig;
  thresholds: CompassThresholdConfig;
  cards: CompassCardDefinition[];
  coverage: CompassCoverageConfig;
}

export interface RawCompassRow {
  rowNumber: number;
  organization: string;
  location: string;
  deviceName: string;
  stableId: string;
  lastUptime: string;
  processor: string;
  videoCard: string;
  warrantyStart: string;
  warrantyEnd: string;
  lastLogin: string;
  memoryGiB: string;
  osName: string;
  deviceStatus: string;
  diskVolumeUsage: string;
  sourceDeviceType: string;
  deviceModel: string;
  purchaseDate: string;
}

export interface ParsedCompassImport {
  sourceName: string;
  rows: RawCompassRow[];
  totalRows: number;
  rejectedRows: number;
  detectedHeaders: string[];
}

export type OrganizationResolution =
  | { mode: "existing"; clientId: string }
  | { mode: "new" }
  | { mode: "unresolved" };

export type OrganizationResolutions = Record<string, OrganizationResolution>;

export interface CompassImportPreview {
  summary: CompassImportSummary;
  organizations: string[];
  unresolvedOrganizations: string[];
  dataset: CompassDataset | null;
}

export interface CompassCardMetric {
  id: CompassCardCategory;
  title: string;
  count: number;
  affectedDeviceCount: number;
  value: number;
  clients: Array<{ clientId: string; name: string; driver: string; estimate: number; score: number; tier: string }>;
}
