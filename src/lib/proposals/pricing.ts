import type { CatalogCategory, CatalogLineItem, ExtractedFact, Project } from "@/lib/projects/types";

export const A360_MONTHLY_PRICING = {
  site: 125,
  serverStandardBackup: 180,
  multiServerDiscount: -100,
  workstation: 48,
  cloudPlusAdvancedBackup: 100,
  workstationBackup: 35,
  managedFirewall: 50,
  goToMyPc: 20,
  newClientDiscount: -200,
} as const;

function idFor(sku: string): string {
  return `catalog_${sku.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
}

export function createCatalogItemId(prefix = "custom"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `catalog_${prefix}_${crypto.randomUUID()}`;
  return `catalog_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function factValue(facts: ExtractedFact[], key: string): ExtractedFact["value"] | undefined {
  return facts.find((fact) => fact.key === key)?.value;
}

function factNumber(facts: ExtractedFact[], key: string): number {
  const value = factValue(facts, key);
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return 0;
}

function factList(facts: ExtractedFact[], key: string): string[] {
  const value = factValue(facts, key);
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function item(input: Omit<CatalogLineItem, "id">): CatalogLineItem {
  return { id: idFor(input.sku), ...input };
}

export function buildDefaultProposalCatalogItems(facts: ExtractedFact[], organizationTerm = "practice"): CatalogLineItem[] {
  const term = organizationTerm.trim().toLowerCase() || "practice";
  const dentalOrClinical = term === "practice" || term === "hospital";
  const servers = Math.round(factNumber(facts, "environment.servers"));
  const totalComputers = Math.round(factNumber(facts, "environment.totalComputers"));
  const workstationFact = Math.round(factNumber(facts, "environment.workstations"));
  const workstations = workstationFact || Math.max(0, totalComputers - servers);
  const serverReplacements = Math.round(factNumber(facts, "lifecycle.serversNeedingReplacement")) || factList(facts, "lifecycle.serverReview").length;
  const workstationReplacements = Math.round(factNumber(facts, "lifecycle.workstationsNeedingReplacement"));
  const replacementComputers = serverReplacements + workstationReplacements;
  const clinicalApps = factList(facts, "applications.clinical");
  const applicationDetail = clinicalApps.length ? `Detected applications include ${clinicalApps.slice(0, 6).join(", ")}.` : dentalOrClinical ? "Management and imaging requirements should be confirmed before deployment." : "Business application requirements should be confirmed before deployment.";

  return [
    item({ sku: "A360-SITE", name: "A360 Site", description: `Core managed-services coverage for the ${term} location.`, category: "managed-services", quantity: 1, unitPrice: A360_MONTHLY_PRICING.site, billing: "monthly", included: true }),
    item({ sku: "A360-SERVER-STANDARD", name: "A360 Server with Standard Backup", description: "Managed server coverage with standard backup protection.", category: "managed-services", quantity: servers, unitPrice: A360_MONTHLY_PRICING.serverStandardBackup, billing: "monthly", included: servers > 0 }),
    item({ sku: "A360-SERVER-DISCOUNT", name: "A360 Server Multi-Server Discount", description: "Monthly discount for each qualifying additional managed server.", category: "discount", quantity: Math.max(0, servers - 1), unitPrice: A360_MONTHLY_PRICING.multiServerDiscount, billing: "monthly", included: servers > 1 }),
    item({ sku: "A360-WORKSTATION", name: "A360 Workstation", description: "Managed support, monitoring, maintenance, and security coverage for each workstation.", category: "managed-services", quantity: workstations, unitPrice: A360_MONTHLY_PRICING.workstation, billing: "monthly", included: workstations > 0 }),
    item({ sku: "A360-CLOUD-PLUS", name: "A360 Cloud Plus Advanced Backup", description: "Advanced local/cloud recovery coverage and emergency standby capability for a protected server.", category: "managed-services", quantity: 0, unitPrice: A360_MONTHLY_PRICING.cloudPlusAdvancedBackup, billing: "monthly", included: false }),
    item({ sku: "A360-WORKSTATION-BACKUP", name: "A360 Workstation Backup", description: "Optional workstation-level backup protection.", category: "managed-services", quantity: 0, unitPrice: A360_MONTHLY_PRICING.workstationBackup, billing: "monthly", included: false }),
    item({ sku: "A360-FIREWALL", name: "A360 Managed Firewall", description: `Managed firewall service for the ${term} network.`, category: "managed-services", quantity: 0, unitPrice: A360_MONTHLY_PRICING.managedFirewall, billing: "monthly", included: false }),
    item({ sku: "A360-GOTOMYPC", name: "A360 GoToMyPC Access", description: "Optional managed remote-access subscription.", category: "managed-services", quantity: 0, unitPrice: A360_MONTHLY_PRICING.goToMyPc, billing: "monthly", included: false }),
    item({ sku: "A360-NEW-CLIENT-DISCOUNT", name: "New Client A360 Discount", description: "Optional recurring new-client discount.", category: "discount", quantity: 0, unitPrice: A360_MONTHLY_PRICING.newClientDiscount, billing: "monthly", included: false }),
    item({ sku: "PROJECT-WORKSTATIONS", name: "Replacement workstation equipment", description: "Business-class computers and required hardware identified in the approved replacement scope.", category: "hardware", quantity: workstationReplacements, unitPrice: 0, billing: "one-time", included: workstationReplacements > 0, requiresPrice: true }),
    item({ sku: "PROJECT-SERVER", name: "Server and infrastructure equipment", description: "Server, backup, networking, or related infrastructure included in the approved project scope.", category: "hardware", quantity: serverReplacements, unitPrice: 0, billing: "one-time", included: serverReplacements > 0, requiresPrice: true }),
    item({ sku: "PROJECT-LABOR", name: "Equipment installation and configuration labor", description: "Preparation, installation, migration, configuration, validation, and deployment labor.", category: "labor", quantity: replacementComputers, unitPrice: 0, billing: "one-time", included: replacementComputers > 0, requiresPrice: true }),
    item({ sku: "PROJECT-PMS", name: dentalOrClinical ? "Management application installation" : "Business application installation", description: applicationDetail, category: "applications", quantity: workstationReplacements, unitPrice: 0, billing: "one-time", included: workstationReplacements > 0 && clinicalApps.length > 0, requiresPrice: true }),
    item({ sku: "PROJECT-IMAGING", name: dentalOrClinical ? "Imaging application installation" : "Additional application installation", description: dentalOrClinical ? "Installation, configuration, and validation of imaging software required on replacement systems." : "Installation, configuration, and validation of additional line-of-business software required on replacement systems.", category: "applications", quantity: workstationReplacements, unitPrice: 0, billing: "one-time", included: false, requiresPrice: true }),
    item({ sku: "PROJECT-ONBOARDING", name: "New-client onboarding and documentation", description: "Environment documentation, account setup, deployment of management and security tools, and transition coordination.", category: "onboarding", quantity: 1, unitPrice: 0, billing: "one-time", included: true, requiresPrice: true }),
  ];
}

export function proposalLineTotal(line: CatalogLineItem): number {
  if (!line.included) return 0;
  const quantity = Number.isFinite(line.quantity) ? Math.max(0, line.quantity) : 0;
  const unitPrice = Number.isFinite(line.unitPrice) ? line.unitPrice : 0;
  return quantity * unitPrice;
}

export function proposalTotals(lines: CatalogLineItem[]): { monthly: number; oneTime: number } {
  return lines.reduce((totals, line) => {
    const amount = proposalLineTotal(line);
    if (line.billing === "monthly") totals.monthly += amount;
    else totals.oneTime += amount;
    return totals;
  }, { monthly: 0, oneTime: 0 });
}

export function includedProposalItems(project: Project, billing?: CatalogLineItem["billing"]): CatalogLineItem[] {
  return project.catalogItems.filter((line) => line.included && line.quantity > 0 && (!billing || line.billing === billing));
}

export function proposalPricingWarnings(project: Project): CatalogLineItem[] {
  return includedProposalItems(project, "one-time").filter((line) => line.requiresPrice && line.unitPrice === 0);
}

function inferCategory(line: CatalogLineItem): CatalogCategory {
  if (line.category) return line.category;
  if (line.unitPrice < 0) return "discount";
  if (line.billing === "monthly") return "managed-services";
  if (/labor|install|configuration|migration/i.test(line.name)) return "labor";
  if (/application|software|imaging|practice/i.test(line.name)) return "applications";
  if (/onboard|documentation|transition/i.test(line.name)) return "onboarding";
  if (/computer|workstation|server|equipment|hardware/i.test(line.name)) return "hardware";
  return "other";
}

function normalizeLine(line: CatalogLineItem): CatalogLineItem {
  return {
    ...line,
    id: line.id || createCatalogItemId("restored"),
    sku: line.sku || "CUSTOM",
    name: line.name || "Custom proposal item",
    category: inferCategory(line),
    description: line.description || "",
    quantity: Number.isFinite(line.quantity) ? Math.max(0, line.quantity) : 0,
    unitPrice: Number.isFinite(line.unitPrice) ? line.unitPrice : 0,
    included: Boolean(line.included),
  };
}

export function normalizeProposalProject(project: Project): Project {
  if (project.type !== "prospect-proposal") return project;
  const sourceItems = Array.isArray(project.catalogItems) && project.catalogItems.length
    ? project.catalogItems.map(normalizeLine)
    : buildDefaultProposalCatalogItems(project.intelligence?.facts ?? [], project.client?.organizationTerm);
  const totals = proposalTotals(sourceItems);
  return {
    ...project,
    catalogItems: sourceItems,
    pricing: { monthly: totals.monthly, oneTime: totals.oneTime, currency: "USD" },
    signature: {
      status: project.signature?.status ?? "draft",
      signerName: project.signature?.signerName ?? "",
      signerTitle: project.signature?.signerTitle ?? "",
      acceptedTerms: project.signature?.acceptedTerms ?? false,
      signedAt: project.signature?.signedAt ?? "",
    },
  };
}

export function replaceA360MonthlyDefaults(project: Project): Project {
  const defaults = buildDefaultProposalCatalogItems(project.intelligence?.facts ?? [], project.client?.organizationTerm).filter((line) => line.billing === "monthly");
  const oneTime = project.catalogItems.filter((line) => line.billing === "one-time");
  const catalogItems = [...defaults, ...oneTime];
  const totals = proposalTotals(catalogItems);
  return { ...project, catalogItems, pricing: { monthly: totals.monthly, oneTime: totals.oneTime, currency: "USD" } };
}

export function projectWithCatalogItems(project: Project, catalogItems: CatalogLineItem[]): Project {
  const totals = proposalTotals(catalogItems);
  return {
    ...project,
    catalogItems,
    pricing: { monthly: totals.monthly, oneTime: totals.oneTime, currency: "USD" },
    updatedAt: new Date().toISOString(),
    signature: project.signature.status === "signed"
      ? { ...project.signature, status: "draft", acceptedTerms: false, signedAt: "" }
      : project.signature,
  };
}
