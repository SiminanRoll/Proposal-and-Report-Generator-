import { A360_MONTHLY_PRICING } from "@/lib/proposals/pricing";

const STORAGE_KEY = "advantage.proposal-report-generator.a360-presentation-pricing.v1";
const CHANGE_EVENT = "a360-presentation-pricing-changed";

export interface A360PresentationPricing {
  site: number;
  workstation: number;
  serverStandardBackup: number;
  multiServerDiscount: number;
  cloudPlusAdvancedBackup: number;
  workstationBackup: number;
  managedFirewall: number;
  goToMyPc: number;
  newClientDiscount: number;
  minimumAgreement: number;
}

export const DEFAULT_A360_PRESENTATION_PRICING: A360PresentationPricing = {
  site: A360_MONTHLY_PRICING.site,
  workstation: A360_MONTHLY_PRICING.workstation,
  serverStandardBackup: A360_MONTHLY_PRICING.serverStandardBackup,
  multiServerDiscount: A360_MONTHLY_PRICING.multiServerDiscount,
  cloudPlusAdvancedBackup: A360_MONTHLY_PRICING.cloudPlusAdvancedBackup,
  workstationBackup: A360_MONTHLY_PRICING.workstationBackup,
  managedFirewall: A360_MONTHLY_PRICING.managedFirewall,
  goToMyPc: A360_MONTHLY_PRICING.goToMyPc,
  newClientDiscount: A360_MONTHLY_PRICING.newClientDiscount,
  minimumAgreement: 0,
};

function finite(value: unknown, fallback: number, allowNegative = false): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return allowNegative ? parsed : Math.max(0, parsed);
}

export function normalizeA360PresentationPricing(value: unknown): A360PresentationPricing {
  const raw = value && typeof value === "object" ? value as Partial<A360PresentationPricing> : {};
  return {
    site: finite(raw.site, DEFAULT_A360_PRESENTATION_PRICING.site),
    workstation: finite(raw.workstation, DEFAULT_A360_PRESENTATION_PRICING.workstation),
    serverStandardBackup: finite(raw.serverStandardBackup, DEFAULT_A360_PRESENTATION_PRICING.serverStandardBackup),
    multiServerDiscount: finite(raw.multiServerDiscount, DEFAULT_A360_PRESENTATION_PRICING.multiServerDiscount, true),
    cloudPlusAdvancedBackup: finite(raw.cloudPlusAdvancedBackup, DEFAULT_A360_PRESENTATION_PRICING.cloudPlusAdvancedBackup),
    workstationBackup: finite(raw.workstationBackup, DEFAULT_A360_PRESENTATION_PRICING.workstationBackup),
    managedFirewall: finite(raw.managedFirewall, DEFAULT_A360_PRESENTATION_PRICING.managedFirewall),
    goToMyPc: finite(raw.goToMyPc, DEFAULT_A360_PRESENTATION_PRICING.goToMyPc),
    newClientDiscount: finite(raw.newClientDiscount, DEFAULT_A360_PRESENTATION_PRICING.newClientDiscount, true),
    minimumAgreement: finite(raw.minimumAgreement, DEFAULT_A360_PRESENTATION_PRICING.minimumAgreement),
  };
}

export function loadA360PresentationPricing(): A360PresentationPricing {
  if (typeof window === "undefined") return { ...DEFAULT_A360_PRESENTATION_PRICING };
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeA360PresentationPricing(JSON.parse(stored)) : { ...DEFAULT_A360_PRESENTATION_PRICING };
  } catch {
    return { ...DEFAULT_A360_PRESENTATION_PRICING };
  }
}

export function saveA360PresentationPricing(pricing: A360PresentationPricing): A360PresentationPricing {
  const normalized = normalizeA360PresentationPricing(pricing);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    window.dispatchEvent(new Event("storage"));
  }
  return normalized;
}

export function resetA360PresentationPricing(): A360PresentationPricing {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    window.dispatchEvent(new Event("storage"));
  }
  return { ...DEFAULT_A360_PRESENTATION_PRICING };
}

export const A360_PRESENTATION_PRICING_CHANGE_EVENT = CHANGE_EVENT;
