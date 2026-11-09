import type { Project, ProjectAgreementBreakdown, ProjectAgreementLineItem, ProjectAgreementBillingPeriod } from "@/lib/projects/types";

/**
 * Line items are entered from a verified client agreement/invoice. The A360
 * marketing page is reference wording, never evidence that a client bought
 * an individual service.
 */
export const A360_SERVICE_DESCRIPTIONS: ReadonlyArray<{ label: string; description: string; category: ProjectAgreementLineItem["category"] }> = [
  { label: "Workstation management", category: "support", description: "Monitoring and operating-system update management for the workstations listed in the agreement." },
  { label: "Server management", category: "support", description: "Monitoring and operating-system update management for the servers listed in the agreement." },
  { label: "Unlimited remote support", category: "support", description: "Remote technical assistance for the covered systems and services in your plan." },
  { label: "Vendor coordination", category: "support", description: "Assistance coordinating technical issues with third-party technology vendors." },
  { label: "Endpoint protection", category: "security", description: "Managed endpoint security tools and monitoring for the devices covered by this service." },
  { label: "Managed firewall", category: "security", description: "Ongoing management and monitoring of the covered network firewall." },
  { label: "Managed Wi-Fi", category: "network", description: "Management and monitoring of the covered wireless network equipment." },
  { label: "Managed network switch", category: "network", description: "Management and monitoring of the covered network switches." },
  { label: "Server backup", category: "backup", description: "Managed backup service for the covered server, according to the backup option selected in the agreement." },
  { label: "CloudPlus backup & disaster recovery", category: "backup", description: "Managed backup and disaster recovery services for the covered system, according to the selected protection plan." },
  { label: "Workstation backup", category: "backup", description: "Managed backup service for the workstations specifically covered by this line item." },
  { label: "Cloud & Microsoft 365 management", category: "cloud", description: "Administration and support of the cloud or Microsoft 365 services specifically covered in the agreement." },
  { label: "Remote access service", category: "cloud", description: "Access to the remote-connectivity service identified in your agreement." },
  { label: "Local Technology Consultant", category: "planning", description: "Technology planning and guidance from a local Technology Consultant as provided under your plan." },
];


/** Editable examples transcribed from an illustrative A360 agreement, NOT a client's purchased services. */
export const A360_AGREEMENT_PRESET: ReadonlyArray<Omit<ProjectAgreementLineItem, "id">> = [
  { productId:"A360", name:"Advantage 360", description:"Advantage 360 is your fully managed IT solution – designed to keep your business secure, stable, and supported.", category:"support", quantity:1, unitPrice:0, billingPeriod:"monthly" },
  { productId:"A360-site", name:"Core management and support for your network", description:"Core management and support for your network", category:"support", quantity:1, unitPrice:125, billingPeriod:"monthly" },
  { productId:"A360-ws", name:"Workstation Management", description:"Workstation Management", category:"support", quantity:10, unitPrice:48, billingPeriod:"monthly" },
  { productId:"A360-pricing", name:"Pricing adjustment to meet agreement minimum", description:"Pricing adjustment to meet agreement minimum", category:"other", quantity:1, unitPrice:10, billingPeriod:"monthly" },
  { productId:"A360-firewall", name:"Firewall with software updates and warranty", description:"Firewall with software updates and warranty (Advantage Equipment)", category:"security", quantity:1, unitPrice:50, billingPeriod:"monthly" },
  { productId:"A360-switch-poe", name:"PoE Switch with software updates and warranty", description:"PoE Switch with software updates and warranty (Advantage Equipment)", category:"network", quantity:1, unitPrice:0, billingPeriod:"monthly" },
  { productId:"A360-wifi", name:"WiFi System with software updates and warranty", description:"WiFi System with software updates and warranty (Advantage Equipment)", category:"network", quantity:1, unitPrice:0, billingPeriod:"monthly" },
  { productId:"A360-ws-backup", name:"Workstation Backup", description:"Workstation Backup (on-site and cloud)", category:"backup", quantity:1, unitPrice:35, billingPeriod:"monthly" },
  { productId:"promo-a360", name:"Advantage 360 management credit", description:"$200/month Advantage 360 management credit over 18 months.", category:"other", quantity:1, unitPrice:-200, billingPeriod:"monthly" },
];
export function createA360AgreementLines(): ProjectAgreementLineItem[] {
  return A360_AGREEMENT_PRESET.map((item, index) => ({
    ...item,
    id: "agreement-a360-" + index + "-" + (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2)),
  }));
}

export const AGREEMENT_PERIOD_LABELS: Record<ProjectAgreementBillingPeriod, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
  "one-time": "One time",
  other: "Other",
};
const PERIODS: ProjectAgreementBillingPeriod[] = ["monthly", "quarterly", "annually", "one-time", "other"];
export const AGREEMENT_CATEGORIES: ProjectAgreementLineItem["category"][] =
  ["support", "security", "backup", "network", "cloud", "planning", "other"];

export function newAgreementBreakdown(): ProjectAgreementBreakdown {
  return { includeInReport: false, showPricing: true, asOfDate: "", sourceLabel: "",
    verifiedAt: "", notes: "", items: [] };
}
export function agreementLineAmount(line: ProjectAgreementLineItem): number | null {
  if (!Number.isFinite(line.quantity) || line.quantity <= 0 || line.unitPrice === null
    || !Number.isFinite(line.unitPrice)) return null;
  return Math.round(Math.round(line.unitPrice * 100) * line.quantity) / 100;
}
export function agreementValidationErrors(draft: ProjectAgreementBreakdown): string[] {
  const errors: string[] = [];
  if (draft.items.length === 0) errors.push("Add at least one verified line item.");
  const ids = new Set<string>();
  for (const [index, item] of draft.items.entries()) {
    const n = index + 1;
    if (!item.name.trim()) errors.push("Line " + n + ": service name is required.");
    if (!item.description.trim()) errors.push("Line " + n + ": explain the service in client-friendly language.");
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) errors.push("Line " + n + ": quantity must be greater than zero.");
    if (item.unitPrice !== null && !Number.isFinite(item.unitPrice))
      errors.push("Line " + n + ": rate must be a valid number, or left blank.");
    if (!PERIODS.includes(item.billingPeriod)) errors.push("Line " + n + ": select a billing period.");
    if (!AGREEMENT_CATEGORIES.includes(item.category)) errors.push("Line " + n + ": select a service category.");
    if (!item.id || ids.has(item.id)) errors.push("Line " + n + ": duplicate or missing line identity.");
    ids.add(item.id);
  }
  return errors;
}
export function includedAgreement(project: Pick<Project, "type" | "agreementBreakdown">): ProjectAgreementBreakdown | null {
  const agreement = project.agreementBreakdown;
  if (project.type !== "client-report" || !agreement?.includeInReport || !agreement.verifiedAt
      || agreementValidationErrors(agreement).length > 0) return null;
  return agreement;
}
export interface AgreementPeriodTotal {
  period: ProjectAgreementBillingPeriod;
  amount: number | null;
  pricedItems: number;
  items: number;
}
export function agreementPeriodTotals(agreement: ProjectAgreementBreakdown): AgreementPeriodTotal[] {
  return PERIODS.flatMap((period) => {
    const lines = agreement.items.filter((item) => item.billingPeriod === period);
    if (!lines.length) return [];
    const costs = lines.map(agreementLineAmount);
    const pricedItems = costs.filter((v): v is number => v !== null).length;
    const amount = pricedItems === lines.length
      ? Math.round(costs.reduce<number>((sum, v) => sum + (v ?? 0), 0) * 100) / 100 : null;
    return [{ period, amount, pricedItems, items: lines.length }];
  });
}
export function agreementMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}
export function agreementCategoryLabel(category: ProjectAgreementLineItem["category"]): string {
  return ({ support: "IT support & management", security: "Security", backup: "Backup & recovery", network: "Network",
    cloud: "Cloud & access", planning: "Technology planning", other: "Other services" } as const)[category];
}
