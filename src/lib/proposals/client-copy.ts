import type { CatalogLineItem, Finding, Project } from "@/lib/projects/types";
import { factNumber, reportableLifecycleDevices } from "@/lib/outcomes/client-report-data";

export const PROPOSAL_COVER_TITLE = "Advantage 360";
export const PROPOSAL_COVER_SUMMARY = "We reviewed the technology supporting your practice and identified several areas that should be addressed, along with areas that are working well today. This proposal outlines our recommendations, how we will support your team, the investment required, and the next steps to move forward with confidence.";

export interface ProposalHardwareFinding {
  title: string;
  summary: string;
  severity: Finding["severity"];
  category: Finding["category"];
}

function computerLabel(count: number): string {
  return `${count} computer${count === 1 ? "" : "s"}`;
}

export function proposalHardwareFinding(project: Project): ProposalHardwareFinding | null {
  const devices = reportableLifecycleDevices(project).filter((device) => device.lifecycleStatus === "overdue");
  const detailedServers = devices.filter((device) => device.type === "server").length;
  const detailedBackupServers = devices.filter((device) => device.type === "backup-server").length;
  const detailedWorkstations = devices.filter((device) => device.type === "workstation").length;

  const serverCount = Math.max(detailedServers, Math.round(factNumber(project, "lifecycle.serversNeedingReplacement")));
  const backupServerCount = detailedBackupServers;
  const workstationCount = Math.max(detailedWorkstations, Math.round(factNumber(project, "lifecycle.workstationsNeedingReplacement")));

  if (serverCount + backupServerCount + workstationCount === 0) return null;

  let title = "Equipment should be replaced";
  let summary = "The equipment identified in this review has reached replacement age. Planning the work now allows it to be scheduled and budgeted before it begins disrupting the practice.";

  if (serverCount === 1 && backupServerCount === 1 && workstationCount > 0) {
    title = `The server, Cloud Plus backup server, and ${computerLabel(workstationCount)} should be replaced`;
    summary = "The primary server, Cloud Plus backup server, and these computers have reached replacement age. Because these systems work together, they should be reviewed as one project so applications, imaging, data, and backup protection remain intact throughout the transition.";
  } else if (serverCount === 1 && backupServerCount === 1) {
    title = "The server and Cloud Plus backup server should be replaced";
    summary = "The primary server and Cloud Plus backup server have reached replacement age. Because they work together to support daily operations and recovery, they should be planned as one project so applications, data, and backup protection remain intact throughout the transition.";
  } else if (serverCount === 1 && workstationCount > 0) {
    title = `The server and ${computerLabel(workstationCount)} should be replaced`;
    summary = "The server and these computers have reached an age where hardware failure, expired warranty coverage, and software compatibility can create unnecessary downtime. We recommend planning the replacements now so applications, imaging systems, files, and backups can be moved carefully instead of waiting for an unexpected failure.";
  } else if (serverCount === 1) {
    title = "The server should be replaced";
    summary = "The server has reached an age where hardware failure or software compatibility can create unnecessary downtime. We recommend planning its replacement now so applications, imaging systems, files, and backups can be moved carefully instead of waiting for an unexpected failure.";
  } else if (backupServerCount === 1 && workstationCount > 0) {
    title = `The Cloud Plus backup server and ${computerLabel(workstationCount)} should be replaced`;
    summary = "The Cloud Plus backup server and these computers have reached replacement age. Planning the work together helps preserve backup protection while the affected equipment is replaced and tested.";
  } else if (backupServerCount === 1) {
    title = "The Cloud Plus backup server should be replaced";
    summary = "The Cloud Plus backup server has reached replacement age. Replacing it protects the local and cloud recovery design and preserves emergency standby capability for the primary server.";
  } else if (workstationCount > 0) {
    title = `${computerLabel(workstationCount)} should be replaced`;
    summary = "These computers have reached replacement age and are more likely to experience hardware failure, warranty limitations, or compatibility issues. Replacing them now allows the work to be scheduled and budgeted before they begin disrupting the practice.";
  } else if (serverCount > 1) {
    title = `${serverCount} servers should be replaced`;
    summary = "These servers have reached replacement age. They should be reviewed together so applications, data, backups, and connected systems can be moved carefully as part of a complete project plan.";
  } else if (backupServerCount > 1) {
    title = `${backupServerCount} Cloud Plus backup servers should be replaced`;
    summary = "These backup servers have reached replacement age. Replacing them preserves local and cloud recovery coverage and emergency standby capability for the protected servers.";
  }

  return { title, summary, severity: "priority", category: "lifecycle" };
}

export function proposalLineClientCopy(line: CatalogLineItem): { name: string; description: string } {
  const copies: Record<string, { name: string; description: string }> = {
    "PROJECT-WORKSTATIONS": {
      name: "Replacement computers",
      description: "Business-class computers and the required hardware for the approved replacement work.",
    },
    "PROJECT-SERVER": {
      name: "Server and related infrastructure",
      description: "The server, backup system, networking equipment, and related infrastructure included in the project.",
    },
    "PROJECT-LABOR": {
      name: "Installation and setup",
      description: "Preparation, installation, configuration, data migration, testing, and deployment of the new equipment.",
    },
    "PROJECT-PMS": {
      name: "Practice-management software setup",
      description: "Installation and testing of the practice-management software required on the replacement computers.",
    },
    "PROJECT-IMAGING": {
      name: "Imaging-software setup",
      description: "Installation, configuration, and testing of the imaging applications required on the replacement computers.",
    },
    "PROJECT-ONBOARDING": {
      name: "Client onboarding and documentation",
      description: "Documentation, account setup, installation of management and security tools, and transition into ongoing support.",
    },
    "A360-SITE": {
      name: "Practice support coverage",
      description: "Managed technology support and service coordination for the practice.",
    },
    "A360-SERVER-STANDARD": {
      name: "Server management and backup",
      description: "Monitoring, maintenance, support, and backup protection for the server.",
    },
    "A360-WORKSTATION": {
      name: "Computer support and security",
      description: "Ongoing support, monitoring, maintenance, and security protection for each covered computer.",
    },
    "A360-CLOUD-PLUS": {
      name: "Cloud Plus backup protection",
      description: "Local and cloud recovery protection with emergency standby capability for the covered server.",
    },
    "A360-WORKSTATION-BACKUP": {
      name: "Computer backup protection",
      description: "Backup protection for the covered computer.",
    },
    "A360-FIREWALL": {
      name: "Managed firewall",
      description: "Managed firewall protection and oversight for the practice network.",
    },
    "A360-GOTOMYPC": {
      name: "Managed remote access",
      description: "Secure remote-access service for the included user or computer.",
    },
    "A360-NEW-CLIENT-DISCOUNT": {
      name: "New-client service credit",
      description: "The recurring service credit included with this proposal.",
    },
    "A360-SERVER-DISCOUNT": {
      name: "Additional-server service credit",
      description: "The recurring service credit applied to qualifying additional servers.",
    },
  };
  return copies[line.sku] ?? { name: line.name, description: line.description ?? "" };
}
