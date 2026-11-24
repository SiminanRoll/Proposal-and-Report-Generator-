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
      detail: `${locations} - network oversight, troubleshooting, and coordination across your connected systems.`,
      slideTitle: "Network management",
      slideDetail: "Oversight and troubleshooting across your connected systems.",
    },
    {
      key: "security", title: "Security monitoring & response",
      detail: "Managed endpoint protection, continuous security monitoring, and human follow-up when threats need attention.",
      slideTitle: "Security & response",
      slideDetail: "Endpoint protection, continuous monitoring and human follow-up.",
    },
    {
      key: "support", title: "Unlimited remote diagnostics",
      detail: "Direct access through Advantage Connect for remote diagnosis and troubleshooting of covered systems.",
      slideTitle: "Unlimited remote diagnostics",
      slideDetail: "Help for covered systems through Advantage Connect.",
    },
  ];
  if (discovery.server === "yes") services.push({
    key: "server", title: "Server & standard backup",
    detail: "1 onsite server - managed monitoring, standard backup protection, and recovery planning.",
    slideTitle: "Server & backup",
    slideDetail: "Server monitoring, standard backups and recovery planning.",
  });
  services.push({
    key: "guidance", title: "Ongoing technology guidance",
    detail: options.includeLifecyclePlanning === true
      ? "Documented environment history, Technology Consultant guidance, technology safeguards, and lifecycle planning around your priorities."
      : "Documented environment history, Technology Consultant guidance, and technology safeguards aligned with your priorities.",
    slideTitle: "Technology guidance",
    slideDetail: options.includeLifecyclePlanning === true
      ? "Documented history, consultant guidance, safeguards and lifecycle planning."
      : "Documented history, consultant guidance and technology safeguards.",
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
    environmentSummary: [workstations, locations, discovery.server === "yes" ? "1 onsite server" : discovery.server === "no" ? "No onsite server" : "Server details to confirm"].join(" · "),
    overview: "One monthly plan for managed devices, security, monitoring, remote diagnostics, software vendor coordination, and ongoing guidance.",
    scopeNote: "Final monthly scope is confirmed onsite. Onboarding, onsite work, hardware, projects and third-party subscriptions are quoted separately.",
    serverNote: discovery.server === "not-sure" ? "Server management and standard backup scope will be confirmed during the onsite assessment." : "",
  };
}
