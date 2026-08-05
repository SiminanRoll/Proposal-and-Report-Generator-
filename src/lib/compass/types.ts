export type CompassDeviceType = "physical-server" | "virtual-server" | "physical-workstation" | "virtual-workstation" | "unknown";
export type CompassLifecycle = "current" | "plan-soon" | "replace-now" | "unknown";
export type CompassSeverity = "critical" | "high" | "planning" | "watch" | "info";
export type CompassCardCategory = "all" | "critical-server" | "server-planning" | "windows-10" | "workstation-lifecycle" | "storage";

export interface CompassClient {
  id: string;
  name: string;
  aliases: string[];
  primaryContact: string;
  assignedOwner: string;
  lastAccountReview: string;
  lastProjectMapping: string;
  nextFollowUp: string;
  workflowStatus: string;
  internalNote: string;
  lastDataRefresh: string;
}

export interface CompassLocation {
  id: string;
  clientId: string;
  name: string;
}

export interface DiskVolumeCondition {
  label: string;
  usedPercent: number | null;
  state: "healthy" | "watch" | "critical" | "unknown";
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
  videoCard: string;
  osName: string;
  memoryGiB: number | null;
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
  category: string;
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
  serverPlanningYears: number;
  serverCriticalYears: number;
  storageWatchPercent: number;
  storageCriticalPercent: number;
}

export interface CompassConfig {
  score: CompassScoreConfig;
  value: CompassValueConfig;
  thresholds: CompassThresholdConfig;
}

export interface RawCompassRow {
  rowNumber: number;
  organization: string;
  location: string;
  deviceName: string;
  stableId: string;
  lastUptime: string;
  videoCard: string;
  warrantyStart: string;
  warrantyEnd: string;
  lastLogin: string;
  memoryGiB: string;
  osName: string;
  diskVolumeUsage: string;
  deviceModel: string;
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
