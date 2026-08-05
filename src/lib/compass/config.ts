import type {
  CompassCardAccent,
  CompassCardDefinition,
  CompassCardEstimateMode,
  CompassCardIcon,
  CompassCardSignal,
  CompassConfig,
} from "./types";

export const COMPASS_CARD_SIGNAL_OPTIONS: Array<{ value: CompassCardSignal; label: string; description: string }> = [
  { value: "server-2012", label: "Windows Server 2012 / 2012 R2", description: "Server 2012 or 2012 R2 operating system." },
  { value: "unsupported-server-os", label: "Server OS older than 2012", description: "Windows Server 2011, 2008, 2003, 2000, or another older server OS." },
  { value: "server-age-critical", label: "Physical server 7+ years old", description: "Identifiable physical server at least seven years from warranty start." },
  { value: "server-age-warranty-critical", label: "Physical server 6+ with expired warranty", description: "Identifiable physical server at least six years old with a confirmed expired warranty." },
  { value: "critical-server-storage", label: "Critical server storage", description: "Server volume meets critical capacity criteria." },
  { value: "server-2016", label: "Windows Server 2016", description: "Server 2016 modernization planning trigger." },
  { value: "server-age-planning", label: "Physical server 5–6 years old", description: "Identifiable physical server between five and seven years old that is not already critical." },
  { value: "server-warranty-upcoming", label: "Server warranty expiring soon", description: "Physical server at least four years old with warranty expiring in the next twelve months." },
  { value: "server-consolidation", label: "Multiple older physical servers", description: "Two or more noncritical physical servers at least five years old." },
  { value: "windows-10-active", label: "Active Windows 10 device", description: "Windows 10 device with no six-month stale check-in signal." },
  { value: "replace-now", label: "Replace Now physical workstation", description: "Active, identifiable physical workstation meeting replacement criteria." },
  { value: "plan-soon", label: "Plan Soon physical workstation", description: "Active, identifiable physical workstation meeting planning criteria." },
  { value: "windows-11-home", label: "Windows 11 Home workstation", description: "Active workstation using Windows 11 Home." },
  { value: "critical-storage", label: "Critical storage", description: "Non-utility volume meets critical percentage and free-space criteria." },
  { value: "watch-storage", label: "Watch storage", description: "Non-utility volume meets watch percentage and free-space criteria." },
  { value: "expired-server-warranty", label: "Expired physical-server warranty", description: "Confirmed expired warranty on a physical server." },
  { value: "expired-workstation-warranty", label: "Expired physical-workstation warranty", description: "Confirmed expired warranty on an active physical workstation." },
];

export const COMPASS_CARD_ACCENTS: CompassCardAccent[] = ["blue", "red", "amber", "cyan", "violet", "teal"];
export const COMPASS_CARD_ICONS: CompassCardIcon[] = ["compass", "server", "calendar", "windows", "workstation", "storage"];
export const COMPASS_CARD_ESTIMATE_MODES: Array<{ value: CompassCardEstimateMode; label: string }> = [
  { value: "server", label: "Server replacement / migration estimate" },
  { value: "workstation", label: "Workstation modernization estimate" },
  { value: "storage", label: "Storage remediation estimate" },
  { value: "fixed", label: "Fixed estimate per qualifying client" },
];

export const DEFAULT_COMPASS_CARDS: CompassCardDefinition[] = [
  {
    id: "all",
    builtIn: true,
    enabled: true,
    order: 0,
    title: "Clients Needing Projects",
    countLabel: "clients with a meaningful current project opportunity",
    valueLabel: "deduplicated estimated opportunity represented",
    description: "Deduplicated clients qualifying through critical servers, server planning, five-plus Windows 10 devices, or five-plus lifecycle workstations.",
    accent: "blue",
    icon: "compass",
    criteriaType: "rollup",
    matchMode: "any",
    rules: [],
    sourceCardIds: ["critical-server", "server-planning", "windows-10", "workstation-lifecycle"],
    excludeSignals: [],
    estimateMode: "deduplicated",
    fixedEstimate: 0,
    manualClientIds: [],
  },
  {
    id: "critical-server",
    builtIn: true,
    enabled: true,
    order: 1,
    title: "Critical Server Projects",
    countLabel: "clients needing immediate server attention",
    valueLabel: "estimated immediate server value",
    description: "Unsupported server operating systems, critical physical lifecycle, expired-warranty age combinations, or genuinely critical server storage.",
    accent: "red",
    icon: "server",
    criteriaType: "signals",
    matchMode: "any",
    rules: [
      { id: "critical-server-2012", signal: "server-2012", minimumDevices: 1, enabled: true },
      { id: "critical-server-older-os", signal: "unsupported-server-os", minimumDevices: 1, enabled: true },
      { id: "critical-server-age", signal: "server-age-critical", minimumDevices: 1, enabled: true },
      { id: "critical-server-age-warranty", signal: "server-age-warranty-critical", minimumDevices: 1, enabled: true },
      { id: "critical-server-storage", signal: "critical-server-storage", minimumDevices: 1, enabled: true },
    ],
    sourceCardIds: [],
    excludeSignals: [],
    estimateMode: "server",
    fixedEstimate: 0,
    manualClientIds: [],
  },
  {
    id: "server-planning",
    builtIn: true,
    enabled: true,
    order: 2,
    title: "Server Planning",
    countLabel: "clients approaching a server project",
    valueLabel: "estimated planned server value",
    description: "Windows Server 2016, noncritical physical servers aged five to six years, near-term warranty expirations, or consolidation opportunities.",
    accent: "amber",
    icon: "calendar",
    criteriaType: "signals",
    matchMode: "any",
    rules: [
      { id: "planning-server-2016", signal: "server-2016", minimumDevices: 1, enabled: true },
      { id: "planning-server-age", signal: "server-age-planning", minimumDevices: 1, enabled: true },
      { id: "planning-server-warranty", signal: "server-warranty-upcoming", minimumDevices: 1, enabled: true },
      { id: "planning-server-consolidation", signal: "server-consolidation", minimumDevices: 1, enabled: true },
    ],
    sourceCardIds: [],
    excludeSignals: ["server-2012", "unsupported-server-os", "server-age-critical", "server-age-warranty-critical", "critical-server-storage"],
    estimateMode: "server",
    fixedEstimate: 0,
    manualClientIds: [],
  },
  {
    id: "windows-10",
    builtIn: true,
    enabled: true,
    order: 3,
    title: "Windows 10 Refresh",
    countLabel: "clients with five or more active Windows 10 devices",
    valueLabel: "estimated refresh value",
    description: "Five or more active Windows 10 devices. Physical workstations, VMs, and classification-review devices count toward the threshold; only valid device types create replacement value.",
    accent: "cyan",
    icon: "windows",
    criteriaType: "signals",
    matchMode: "any",
    rules: [{ id: "windows-10-minimum", signal: "windows-10-active", minimumDevices: 5, enabled: true }],
    sourceCardIds: [],
    excludeSignals: [],
    estimateMode: "workstation",
    fixedEstimate: 0,
    manualClientIds: [],
  },
  {
    id: "workstation-lifecycle",
    builtIn: true,
    enabled: true,
    order: 4,
    title: "Workstation Lifecycle",
    countLabel: "clients with five-plus Replace Now or Plan Soon workstations",
    valueLabel: "estimated workstation value",
    description: "Physical workstations only. A client qualifies with at least five Replace Now devices or at least five Plan Soon devices; the two groups are not combined.",
    accent: "violet",
    icon: "workstation",
    criteriaType: "signals",
    matchMode: "any",
    rules: [
      { id: "workstation-replace-now-minimum", signal: "replace-now", minimumDevices: 5, enabled: true },
      { id: "workstation-plan-soon-minimum", signal: "plan-soon", minimumDevices: 5, enabled: true },
    ],
    sourceCardIds: [],
    excludeSignals: [],
    estimateMode: "workstation",
    fixedEstimate: 0,
    manualClientIds: [],
  },
  {
    id: "storage",
    builtIn: true,
    enabled: true,
    order: 5,
    title: "Storage Attention",
    countLabel: "clients with meaningful capacity concerns",
    valueLabel: "estimated remediation value",
    description: "Critical or watch-level non-utility volumes using both free-space and utilization safeguards so large healthy drives are not overcounted.",
    accent: "teal",
    icon: "storage",
    criteriaType: "signals",
    matchMode: "any",
    rules: [
      { id: "storage-critical", signal: "critical-storage", minimumDevices: 1, enabled: true },
      { id: "storage-watch", signal: "watch-storage", minimumDevices: 1, enabled: true },
    ],
    sourceCardIds: [],
    excludeSignals: [],
    estimateMode: "storage",
    fixedEstimate: 0,
    manualClientIds: [],
  },
];

export const DEFAULT_COMPASS_CONFIG: CompassConfig = {
  score: {
    server2012First: 50,
    server2012Additional: 10,
    server2012Cap: 70,
    server2016First: 25,
    server2016Additional: 5,
    server2016Cap: 40,
    serverAgePlanningEach: 15,
    serverAgePlanningCap: 30,
    serverAgeCriticalEach: 25,
    serverAgeCriticalCap: 50,
    windows10Each: 3,
    windows10Cap: 30,
    windows11HomeEach: 2,
    windows11HomeCap: 12,
    replaceNowEach: 4,
    replaceNowCap: 24,
    planSoonEach: 1,
    planSoonCap: 10,
    criticalStorageEach: 4,
    criticalStorageCap: 16,
    watchStorageEach: 1,
    watchStorageCap: 6,
    expiredServerWarrantyEach: 8,
    expiredServerWarrantyCap: 16,
    expiredWorkstationWarrantyEach: 1,
    expiredWorkstationWarrantyCap: 8,
  },
  value: {
    standardServerReplacement: 45000,
    advancedServerMigration: 18000,
    multiServerAdditionalMultiplier: 0.75,
    standardWorkstationModernization: 2500,
    workstationDeploymentAllowance: 450,
    virtualOsRemediation: 750,
    storageRemediation: 7500,
    multisiteAdjustment: 5000,
    planningContingencyPercent: 10,
  },
  thresholds: {
    workstationPlanSoonYears: 5,
    workstationReplaceNowYears: 7,
    workstationExpiredWarrantyReplaceYears: 6,
    serverPlanningYears: 5,
    serverCriticalYears: 7,
    serverExpiredWarrantyCriticalYears: 6,
    serverWarrantyPlanningMinYears: 4,
    warrantyPlanningMonths: 12,
    staleDeviceMonths: 6,
    storageWatchPercent: 80,
    storageCriticalPercent: 90,
    storageSystemWatchFreeGb: 30,
    storageSystemCriticalFreeGb: 15,
    storageWatchFreeGb: 150,
    storageCriticalFreeGb: 100,
    storageMinimumVolumeGb: 8,
  },
  cards: structuredClone(DEFAULT_COMPASS_CARDS),
};

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()))] : [];
}

function normalizeCard(candidate: unknown, fallback: CompassCardDefinition | null, index: number): CompassCardDefinition | null {
  if (!candidate || typeof candidate !== "object") return fallback ? structuredClone(fallback) : null;
  const raw = candidate as Partial<CompassCardDefinition>;
  const idValue = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : fallback?.id;
  if (!idValue) return null;
  const id = idValue as CompassCardDefinition["id"];
  const isBuiltIn = Boolean(fallback?.builtIn || raw.builtIn);
  const rules = Array.isArray(raw.rules)
    ? raw.rules.flatMap((rule, ruleIndex) => {
      if (!rule || typeof rule !== "object") return [];
      const signal = (rule as Partial<CompassCardDefinition["rules"][number]>).signal;
      if (!COMPASS_CARD_SIGNAL_OPTIONS.some((option) => option.value === signal)) return [];
      return [{
        id: text((rule as Partial<CompassCardDefinition["rules"][number]>).id, `${id}-rule-${ruleIndex + 1}`),
        signal: signal as CompassCardSignal,
        minimumDevices: Math.max(1, Math.round(finite((rule as Partial<CompassCardDefinition["rules"][number]>).minimumDevices, 1))),
        enabled: (rule as Partial<CompassCardDefinition["rules"][number]>).enabled !== false,
      }];
    })
    : structuredClone(fallback?.rules ?? []);
  const accent = COMPASS_CARD_ACCENTS.includes(raw.accent as CompassCardAccent) ? raw.accent as CompassCardAccent : fallback?.accent ?? "blue";
  const icon = COMPASS_CARD_ICONS.includes(raw.icon as CompassCardIcon) ? raw.icon as CompassCardIcon : fallback?.icon ?? "compass";
  const estimateMode = (["deduplicated", "server", "workstation", "storage", "fixed"] as CompassCardEstimateMode[]).includes(raw.estimateMode as CompassCardEstimateMode)
    ? raw.estimateMode as CompassCardEstimateMode
    : fallback?.estimateMode ?? "fixed";
  return {
    id,
    builtIn: isBuiltIn,
    enabled: raw.enabled !== false,
    order: Math.max(0, Math.round(finite(raw.order, fallback?.order ?? index))),
    title: text(raw.title, fallback?.title ?? "Custom Opportunity"),
    countLabel: text(raw.countLabel, fallback?.countLabel ?? "qualifying clients"),
    valueLabel: text(raw.valueLabel, fallback?.valueLabel ?? "estimated opportunity value"),
    description: text(raw.description, fallback?.description ?? "Custom current-state opportunity criteria."),
    accent,
    icon,
    criteriaType: raw.criteriaType === "rollup" ? "rollup" : fallback?.criteriaType ?? "signals",
    matchMode: raw.matchMode === "all" ? "all" : "any",
    rules,
    sourceCardIds: stringArray(raw.sourceCardIds) as CompassCardDefinition["sourceCardIds"],
    excludeSignals: stringArray(raw.excludeSignals).filter((signal): signal is CompassCardSignal => COMPASS_CARD_SIGNAL_OPTIONS.some((option) => option.value === signal)),
    estimateMode,
    fixedEstimate: Math.max(0, finite(raw.fixedEstimate, fallback?.fixedEstimate ?? 0)),
    manualClientIds: stringArray(raw.manualClientIds),
  };
}

function normalizeCards(value: unknown): CompassCardDefinition[] {
  const incoming = Array.isArray(value) ? value : [];
  const normalized: CompassCardDefinition[] = [];
  for (const fallback of DEFAULT_COMPASS_CARDS) {
    const candidate = incoming.find((item) => item && typeof item === "object" && (item as { id?: unknown }).id === fallback.id);
    const card = normalizeCard(candidate ?? fallback, fallback, normalized.length);
    if (card) normalized.push(card);
  }
  for (const [index, candidate] of incoming.entries()) {
    if (!candidate || typeof candidate !== "object") continue;
    const rawId = (candidate as { id?: unknown }).id;
    if (typeof rawId !== "string" || DEFAULT_COMPASS_CARDS.some((card) => card.id === rawId) || normalized.some((card) => card.id === rawId)) continue;
    const customId = rawId.startsWith("custom-") ? rawId : `custom-${rawId}`;
    const card = normalizeCard({ ...(candidate as object), id: customId, builtIn: false, criteriaType: "signals" }, null, DEFAULT_COMPASS_CARDS.length + index);
    if (card) normalized.push(card);
  }
  const ordered = normalized.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)).map((card, index) => ({ ...card, order: index }));
  const validSignalCardIds = new Set(ordered.filter((card) => card.criteriaType === "signals").map((card) => card.id));
  return ordered.map((card) => ({
    ...card,
    sourceCardIds: card.criteriaType === "rollup"
      ? [...new Set(card.sourceCardIds)].filter((id) => id !== card.id && validSignalCardIds.has(id))
      : [],
  }));
}

export function normalizeCompassConfig(value: unknown): CompassConfig {
  if (!value || typeof value !== "object") return structuredClone(DEFAULT_COMPASS_CONFIG);
  const candidate = value as Partial<CompassConfig>;
  const score = candidate.score ?? {} as CompassConfig["score"];
  const valuation = candidate.value ?? {} as CompassConfig["value"];
  const thresholds = candidate.thresholds ?? {} as CompassConfig["thresholds"];
  const normalizedThresholds = Object.fromEntries(Object.entries(DEFAULT_COMPASS_CONFIG.thresholds).map(([key, fallback]) => [key, finite(thresholds[key as keyof typeof thresholds], fallback)])) as unknown as CompassConfig["thresholds"];

  // v1.2.2 stored the original 4/5-year workstation defaults and had no card definitions.
  // Upgrade only those exact legacy defaults; deliberate custom threshold values remain intact.
  if (!Array.isArray(candidate.cards)) {
    if (normalizedThresholds.workstationPlanSoonYears === 4) normalizedThresholds.workstationPlanSoonYears = DEFAULT_COMPASS_CONFIG.thresholds.workstationPlanSoonYears;
    if (normalizedThresholds.workstationReplaceNowYears === 5) normalizedThresholds.workstationReplaceNowYears = DEFAULT_COMPASS_CONFIG.thresholds.workstationReplaceNowYears;
  }

  return {
    score: Object.fromEntries(Object.entries(DEFAULT_COMPASS_CONFIG.score).map(([key, fallback]) => [key, finite(score[key as keyof typeof score], fallback)])) as unknown as CompassConfig["score"],
    value: Object.fromEntries(Object.entries(DEFAULT_COMPASS_CONFIG.value).map(([key, fallback]) => [key, finite(valuation[key as keyof typeof valuation], fallback)])) as unknown as CompassConfig["value"],
    thresholds: normalizedThresholds,
    cards: normalizeCards(candidate.cards),
  };
}
