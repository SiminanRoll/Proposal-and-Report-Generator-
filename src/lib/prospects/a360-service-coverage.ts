import type { A360ProspectDiscovery } from "@/lib/prospects/a360";

export interface A360ServiceCoverageRow {
  key: string;
  title: string;
  detail: string;
}

export type A360ServiceKey = "workstations" | "network" | "security" | "support" | "server" | "guidance";

export interface A360ServiceCoverageCard extends A360ServiceCoverageRow {
  key: A360ServiceKey;
  slideTitle: string;
  slideDetail: string;
}

export interface A360ServiceCoverage {
  services: A360ServiceCoverageCard[];
  software: A360ServiceCoverageRow[];
  cloud: A360ServiceCoverageRow & { slideTitle: string; slideDetail: string };
  onsite: A360ServiceCoverageRow & {
    slideDetail: string;
    rateLabel: string;
    rateNote: string;
    reviewNote: string;
  };
  environmentSummary: string;
  overview: string;
  scopeNote: string;
  serverNote: string;
}

/** Shared client-facing scope for the estimate slide and PDF, without repricing
 * a saved estimate or treating optional products as purchased services. */
export function a360ServiceCoverage(
  discovery: A360ProspectDiscovery,
  options: { includeLifecyclePlanning?: boolean } = {},
): A360ServiceCoverage {
  const quantity = (value: number, noun: string) => Number.isFinite(value) && value > 0
    ? `${Math.round(value)} ${noun}${Math.round(value) === 1 ? "" : "s"}`
    : `${noun[0].toUpperCase()}${noun.slice(1)} count to confirm`;
  const workstations = quantity(discovery.workstations, "workstation");
  const locations = quantity(discovery.locations, "location");
  const services: A360ServiceCoverageCard[] = [
    {
      key: "workstations", title: "Managed workstations",
      detail: `${workstations} - proactive monitoring and routine operating-system and security patches.`,
      slideTitle: "Managed workstations",
      slideDetail: "Monitoring, system updates and security patches.",
    },
    {
      key: "network", title: "Network management",
      detail: `${locations} - monitoring, updates and troubleshooting for covered Wi-Fi, firewalls, routers and network switches.`,
      slideTitle: "Network management",
      slideDetail: "Wi-Fi, firewalls and network switches, monitored and managed.",
    },
    {
      key: "security", title: "Security monitoring & response",
      detail: "Managed antivirus and endpoint detection and response (EDR), with 24/7 security monitoring and human response to threats.",
      slideTitle: "Security & response",
      slideDetail: "Endpoint protection, 24/7 security monitoring and human response.",
    },
    {
      key: "support", title: "Unlimited remote diagnostics",
      detail: "Unlimited remote diagnosis and troubleshooting of existing covered systems through Advantage Connect, phone or email during business hours.",
      slideTitle: "Unlimited remote diagnostics",
      slideDetail: "Help through Advantage Connect during business hours.",
    },
  ];
  if (discovery.server === "yes") services.push({
    key: "server", title: "Server & standard backup",
    detail: "1 onsite server - monitoring, updates, and managed standard backup with encrypted local and cloud copies. Recovery options follow the confirmed backup scope.",
    slideTitle: "Server & backup",
    slideDetail: "Server monitoring, encrypted local/cloud backups and recovery planning.",
  });
  services.push({
    key: "guidance", title: "Ongoing technology guidance",
    detail: options.includeLifecyclePlanning === true
      ? "Your dedicated local Technology Consultant helps with budgeting, technology safeguards and lifecycle planning. Documented environment history and technical information support compliance reviews."
      : "Your dedicated local Technology Consultant helps with planning, budgeting and technology safeguards. Documented environment history and technical information support compliance reviews.",
    slideTitle: "Local technology guidance",
    slideDetail: options.includeLifecyclePlanning === true
      ? "Your local consultant for budgeting, safeguards and lifecycle planning."
      : "Planning, budgeting and guidance from your local consultant.",
  });

  const software: A360ServiceCoverageRow[] = [];
  if (discovery.managementSoftware.trim()) software.push({
    key: "management-software", title: discovery.managementSoftware.trim(),
    detail: "Technical support and vendor coordination for your management software.",
  });
  if (discovery.imagingSoftware.trim()) software.push({
    key: "imaging-software", title: discovery.imagingSoftware.trim(),
    detail: `Technical support and vendor coordination for imaging${discovery.imagingEnvironment && discovery.imagingEnvironment !== "Not sure" ? ` (${discovery.imagingEnvironment})` : ""}.`,
  });
  else if (discovery.imagingEnvironment && discovery.imagingEnvironment !== "Not sure") software.push({
    key: "imaging-environment", title: `${discovery.imagingEnvironment} imaging`,
    detail: "Imaging workflow support and vendor coordination; application name to confirm.",
  });
  if (discovery.otherSoftware.trim()) software.push({
    key: "other-software", title: discovery.otherSoftware.trim(),
    detail: "Technical support and vendor coordination for your other business applications.",
  });

  return {
    services,
    software,
    cloud: {
      key: "cloud", title: "Software, cloud & vendor coordination",
      detail: "Software and internet vendor coordination, plus management of covered Microsoft 365, email, remote-access and private-cloud services. Cloud services and subscriptions are confirmed in the final scope.",
      slideTitle: "Software & cloud support",
      slideDetail: "Vendor coordination for covered apps, Microsoft 365, email and remote access.",
    },
    // Hourly onsite work is intentionally outside the monthly services array.
    onsite: {
      key: "onsite", title: "Local onsite service",
      detail: "When remote troubleshooting needs hands-on help, our local engineers can come to your office.",
      slideDetail: "Local engineers who can come to your office.",
      rateLabel: "$125/hour",
      rateNote: "Business hours · Billed separately",
      reviewNote: "Billable work is reviewed with you before it begins.",
    },
    environmentSummary: [workstations, locations, discovery.server === "yes" ? "1 onsite server" : discovery.server === "no" ? "No onsite server" : "Server details to confirm"].join(" · "),
    overview: "One monthly plan for managed devices, security, monitoring, remote diagnostics, covered cloud services, vendor coordination, and local guidance.",
    scopeNote: "Final monthly scope is confirmed onsite. Onboarding, hardware, projects and third-party subscriptions are quoted separately.",
    serverNote: discovery.server === "not-sure" ? "Server management and standard backup scope will be confirmed during the onsite assessment." : "",
  };
}
